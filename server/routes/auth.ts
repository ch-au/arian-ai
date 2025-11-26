import { Router, Request, Response } from "express";
import { AuthService } from "../services/auth";
import { z } from "zod";

const router = Router();

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { username, password } = registerSchema.parse(req.body);

    const user = await AuthService.register(username, password);
    const { token, refreshToken } = await AuthService.login(username, password, res);

    res.json({
      user: {
        id: user.id,
        username: user.username,
      },
      token, // Still return token for backward compatibility
    });
  } catch (error: any) {
    if (error.message === "Username already exists") {
      return res.status(409).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const { user, token } = await AuthService.login(username, password, res);

    res.json({
      user: {
        id: user.id,
        username: user.username,
      },
      token, // Still return token for backward compatibility
    });
  } catch (error: any) {
    if (error.message === "Invalid credentials") {
      return res.status(401).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: error.errors });
    }
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token provided" });
    }

    const result = await AuthService.refreshAccessToken(refreshToken, res);

    if (!result) {
      AuthService.clearAuthCookies(res);
      return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    res.json({
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    res.status(500).json({ error: "Token refresh failed" });
  }
});

/**
 * GET /api/auth/me
 * Get current user (requires authentication)
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get user" });
  }
});

/**
 * POST /api/auth/logout
 * Logout - clear cookies and revoke refresh token
 */
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    // Revoke refresh token if present
    if (refreshToken) {
      await AuthService.revokeRefreshToken(refreshToken);
    }

    // Clear cookies
    AuthService.clearAuthCookies(res);

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    // Still clear cookies even if revocation fails
    AuthService.clearAuthCookies(res);
    res.json({ message: "Logged out successfully" });
  }
});

export default router;
