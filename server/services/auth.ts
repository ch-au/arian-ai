import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Response } from "express";
import { db } from "../db";
import { users, refreshTokens } from "@shared/schema";
import { eq, and, lt } from "drizzle-orm";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable must be set");
}
const JWT_SECRET: string = process.env.JWT_SECRET;
const SALT_ROUNDS = 10;

// Token configuration
const ACCESS_TOKEN_EXPIRY = "4h"; // Reduced from 7d for security
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

// Cookie configuration
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

export interface AuthUser {
  id: number;
  username: string;
}

export interface TokenPayload {
  userId: number;
  username: string;
}

export class AuthService {
  /**
   * Register a new user
   */
  static async register(username: string, password: string): Promise<AuthUser> {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error("Username already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        username,
        password: hashedPassword,
      })
      .returning();

    return {
      id: newUser.id,
      username: newUser.username,
    };
  }

  /**
   * Login user and return JWT token
   * @param res - Express response object for setting cookies (optional for backward compatibility)
   */
  static async login(
    username: string,
    password: string,
    res?: Response
  ): Promise<{ user: AuthUser; token: string; refreshToken?: string }> {
    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error("Invalid credentials");
    }

    // Generate JWT access token (shorter lived)
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
      } as TokenPayload,
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Generate refresh token
    const refreshToken = await this.createRefreshToken(user.id);

    // Set cookies if response object provided
    if (res) {
      this.setAuthCookies(res, token, refreshToken);
    }

    return {
      user: {
        id: user.id,
        username: user.username,
      },
      token,
      refreshToken,
    };
  }

  /**
   * Set auth cookies on the response
   */
  static setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    // Access token cookie (4 hours)
    res.cookie("auth_token", accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 4 * 60 * 60 * 1000, // 4 hours
    });

    // Refresh token cookie (7 days)
    res.cookie("refresh_token", refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    });
  }

  /**
   * Clear auth cookies on logout
   */
  static clearAuthCookies(res: Response): void {
    res.clearCookie("auth_token", COOKIE_OPTIONS);
    res.clearCookie("refresh_token", COOKIE_OPTIONS);
  }

  /**
   * Create a new refresh token and store in database
   */
  static async createRefreshToken(userId: number): Promise<string> {
    const token = crypto.randomBytes(64).toString("hex");
    const hashedToken = this.hashToken(token);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await db.insert(refreshTokens).values({
      token: hashedToken,
      userId,
      expiresAt,
    });

    return token;
  }

  /**
   * Validate refresh token and return new access token
   */
  static async refreshAccessToken(refreshToken: string, res?: Response): Promise<{ token: string; user: AuthUser } | null> {
    const hashedToken = this.hashToken(refreshToken);

    // Find and validate refresh token
    const [storedToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, hashedToken))
      .limit(1);

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return null;
    }

    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, storedToken.userId))
      .limit(1);

    if (!user) {
      return null;
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
      } as TokenPayload,
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    // Set new access token cookie if response provided
    if (res) {
      res.cookie("auth_token", newAccessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 4 * 60 * 60 * 1000,
      });
    }

    return {
      token: newAccessToken,
      user: {
        id: user.id,
        username: user.username,
      },
    };
  }

  /**
   * Revoke a refresh token (for logout)
   */
  static async revokeRefreshToken(refreshToken: string): Promise<void> {
    const hashedToken = this.hashToken(refreshToken);
    await db.delete(refreshTokens).where(eq(refreshTokens.token, hashedToken));
  }

  /**
   * Revoke all refresh tokens for a user (for security events)
   */
  static async revokeAllUserTokens(userId: number): Promise<void> {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  }

  /**
   * Clean up expired refresh tokens (should be run periodically)
   */
  static async cleanupExpiredTokens(): Promise<number> {
    const result = await db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()))
      .returning();
    return result.length;
  }

  /**
   * Hash a token for storage
   */
  private static hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Verify JWT token and return user
   */
  static async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;

      // Verify user still exists
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: number): Promise<AuthUser | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
    };
  }
}
