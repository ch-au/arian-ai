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
      'http://localhost:5000',
    ];

    // Allow requests with no origin (mobile apps, curl, Postman, same-origin, etc.)
    if (!origin) return callback(null, true);

    // Check explicit allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow Azure Web Apps domains
    if (origin.includes('.azurewebsites.net')) {
      return callback(null, true);
    }

    // In development, allow any localhost origin
    if (process.env.NODE_ENV !== 'production') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }

    // Reject all other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24 hours
};

// Rate Limiting - General API
// Disabled in development, active in production
const isDevelopment = process.env.NODE_ENV !== 'production';
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 minutes in production
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting entirely in development
    if (isDevelopment) return true;
    // Skip rate limiting for health checks and static assets
    return req.path === '/health' || req.path.startsWith('/assets');
  },
});

// Rate Limiting - Auth endpoints (stricter, but skipped in dev)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 failed login attempts per 15 minutes in production
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  skip: () => isDevelopment, // Skip in development
});

// Rate Limiting - Simulation endpoints (expensive operations, skipped in dev)
// This limits queue creation/start actions, not individual runs
const simulationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 negotiation queue starts per hour in production (each can have many runs)
  message: { error: 'Simulation rate limit exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDevelopment, // Skip in development
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

  // Simulation rate limiting - only for creating/starting simulations, not status polling
  // POST to create queue or start execution (not GET for status checks)
  app.use('/api/simulations/queue/:negotiationId', (req, res, next) => {
    if (req.method === 'POST') return simulationLimiter(req, res, next);
    next();
  });
  app.use('/api/simulations/queue/:queueId/start', simulationLimiter);
  app.use('/api/simulations/queue/:queueId/execute', simulationLimiter);

  // Request size limits
  app.use('/api/', requestSizeLimiter('5mb'));
}

export { authLimiter, simulationLimiter, generalLimiter };
