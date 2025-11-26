import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth";

/**
 * Extract token from request - checks cookie first, then Authorization header
 */
function extractToken(req: Request): string | null {
  // Check cookie first (preferred for browser clients)
  if (req.cookies?.auth_token) {
    return req.cookies.auth_token;
  }

  // Fall back to Authorization header (for API clients)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Extract refresh token from request
 */
function extractRefreshToken(req: Request): string | null {
  return req.cookies?.refresh_token || null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);

    if (!token) {
      // Try to refresh using refresh token
      const refreshToken = extractRefreshToken(req);
      if (refreshToken) {
        const refreshResult = await AuthService.refreshAccessToken(refreshToken, res);
        if (refreshResult) {
          (req as any).user = refreshResult.user;
          return next();
        }
      }
      return res.status(401).json({ error: "Unauthorized - No token provided" });
    }

    const user = await AuthService.verifyToken(token);

    if (!user) {
      // Token invalid/expired - try refresh
      const refreshToken = extractRefreshToken(req);
      if (refreshToken) {
        const refreshResult = await AuthService.refreshAccessToken(refreshToken, res);
        if (refreshResult) {
          (req as any).user = refreshResult.user;
          return next();
        }
      }
      return res.status(401).json({ error: "Unauthorized - Invalid token" });
    }

    // Attach user to request
    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

// Optional auth - doesn't block but attaches user if present
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (token) {
      const user = await AuthService.verifyToken(token);
      if (user) {
        (req as any).user = user;
      }
    }
    next();
  } catch (error) {
    next();
  }
}
