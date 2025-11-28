import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite";
import { applySecurityMiddleware } from "./middleware/security";

const app = express();

// Health check endpoint (must be before other middleware for Azure monitoring)
// Supports both /health and / for Azure's default health probe
const healthResponse = (_req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
};

app.get("/health", healthResponse);

// Azure sometimes probes / - respond with health if it's a health probe (no Accept header for HTML)
app.get("/", (req, res, next) => {
  const acceptHeader = req.headers.accept || "";
  const userAgent = req.headers["user-agent"] || "";

  // Health probes typically don't accept HTML and have specific user agents
  const isHealthProbe =
    !acceptHeader.includes("text/html") &&
    (userAgent.includes("HealthCheck") ||
     userAgent.includes("AlwaysOn") ||
     userAgent.includes("Azure") ||
     userAgent === "" ||
     req.query._health !== undefined);

  if (isHealthProbe) {
    return healthResponse(req, res);
  }

  // Otherwise, let it fall through to static file serving
  next();
});

// Apply security middleware FIRST (before body parsing)
applySecurityMiddleware(app);

// Cookie parser for auth tokens
app.use(cookieParser());

// Body parsing with size limits
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '5mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Skip logging GET requests - they're mostly polling and create noise
      if (req.method === 'GET') {
        return;
      }

      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Start the background simulation queue processor
  const { SimulationQueueService } = await import("./services/simulation-queue");
  SimulationQueueService.startBackgroundProcessor();
  log("Background simulation queue processor started");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    log(`Unhandled error handled: ${message}`);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    // Dynamic import to avoid bundling dev dependencies in production
    const { setupVite } = await import("./vite-dev");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use the PORT from environment variables, with a fallback to 3000
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });

  // Graceful shutdown handling for Azure/Docker
  const shutdown = (signal: string) => {
    log(`Received ${signal}, shutting down gracefully...`);

    // Stop accepting new connections
    server.close(() => {
      log("HTTP server closed");
      process.exit(0);
    });

    // Force shutdown after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      log("Forcing shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
