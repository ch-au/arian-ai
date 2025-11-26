import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Express, Request, Response, NextFunction } from 'express';

// CORS Configuration
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:3000',
      // Add production domains here
    ];

    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV === 'development') {
      // In development, allow any localhost origin
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24 hours
};

// Rate Limiting - General API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

// Rate Limiting - Auth endpoints (stricter)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Rate Limiting - Simulation endpoints (expensive operations)
const simulationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 simulation batches per hour
  message: { error: 'Simulation rate limit exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Request size limiting middleware
function requestSizeLimiter(maxSize: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    const maxBytes = parseSize(maxSize);

    if (contentLength > maxBytes) {
      return res.status(413).json({ error: 'Request entity too large' });
    }
    next();
  };
}

function parseSize(size: string): number {
  const units: Record<string, number> = { b: 1, kb: 1024, mb: 1024 * 1024 };
  const match = size.toLowerCase().match(/^(\d+)(b|kb|mb)$/);
  if (!match) return 1024 * 1024; // Default 1MB
  return parseInt(match[1], 10) * units[match[2]];
}

// Apply all security middleware
export function applySecurityMiddleware(app: Express): void {
  // Helmet - Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Required for Vite HMR in dev
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          "wss:",
          "ws:",
          "https://api.openai.com",
          "https://cloud.langfuse.com",
          "https://generativelanguage.googleapis.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Required for some external resources
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }));

  // CORS
  app.use(cors(corsOptions));

  // General rate limiting for all API routes
  app.use('/api/', generalLimiter);

  // Stricter rate limiting for auth endpoints
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  // Simulation rate limiting
  app.use('/api/simulations/queue', simulationLimiter);
  app.use('/api/simulations/execute', simulationLimiter);

  // Request size limits
  app.use('/api/', requestSizeLimiter('5mb'));
}

export { authLimiter, simulationLimiter, generalLimiter };
