import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable must be set");
}
const SALT_ROUNDS = 10;

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
   */
  static async login(username: string, password: string): Promise<{ user: AuthUser; token: string }> {
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

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
      } as TokenPayload,
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return {
      user: {
        id: user.id,
        username: user.username,
      },
      token,
    };
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
