import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite";
import { applySecurityMiddleware } from "./middleware/security";

const app = express();

// Health check endpoint (must be before other middleware for Azure monitoring)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
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
})();
