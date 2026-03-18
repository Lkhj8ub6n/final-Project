import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "libraryos_salt").digest("hex");
}

export function generateToken(userId: number, role: string, tenantId?: number | null): string {
  const payload = { userId, role, tenantId: tenantId ?? null, ts: Date.now() };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function parseToken(token: string): { userId: number; role: string; tenantId: number | null } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    return payload;
  } catch {
    return null;
  }
}

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
    res.status(401).json({ error: "Invalid token" });
    return;
  }
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
