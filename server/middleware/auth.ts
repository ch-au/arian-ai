import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized - No token provided" });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const user = await AuthService.verifyToken(token);

    if (!user) {
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
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
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
