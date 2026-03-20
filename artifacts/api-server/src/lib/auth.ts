import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env["JWT_SECRET"] || "change_me_in_production";
const JWT_EXPIRES_IN = "24h";
const BCRYPT_ROUNDS = 10;
const LEGACY_SALT = "libraryos_salt";

// ---------- Password Hashing ----------

/** Hash a password with bcrypt */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Compare a plain password against a stored hash (supports bcrypt + legacy SHA-256) */
export async function comparePassword(password: string, storedHash: string): Promise<boolean> {
  // bcrypt hashes always start with "$2a$" or "$2b$"
  if (storedHash.startsWith("$2")) {
    return bcrypt.compare(password, storedHash);
  }
  // Legacy SHA-256 fallback
  const crypto = await import("crypto");
  const legacyHash = crypto.createHash("sha256").update(password + LEGACY_SALT).digest("hex");
  return legacyHash === storedHash;
}

/** Check if a hash is legacy SHA-256 (needs upgrade to bcrypt) */
function isLegacyHash(hash: string): boolean {
  return !hash.startsWith("$2");
}

// ---------- Token (JWT) ----------

interface TokenPayload {
  userId: number;
  role: string;
  tenantId: number | null;
}

export function generateToken(userId: number, role: string, tenantId?: number | null): string {
  const payload: TokenPayload = { userId, role, tenantId: tenantId ?? null };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function parseToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Middleware ----------

export interface AuthRequest extends Request {
  user?: {
    id: number;
    name: string;
    username: string;
    role: string;
    tenantId: number | null;
  };
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const payload = parseToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (!user || !user.isActive) {
      res.status(401).json({ error: "User not found or inactive" });
      return;
    }
    req.user = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId ?? null,
    };
    next();
  } catch (err) {
    res.status(500).json({ error: "Authentication error" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export { isLegacyHash, hashPassword as hashPasswordAsync };
