import { asyncHandler } from "../middlewares/error-handler";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, tenantsTable } from "@workspace/db";
import { hashPassword, comparePassword, generateToken, authenticate, AuthRequest, isLegacyHash } from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/login", asyncHandler(async (req, res): Promise<void> => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    res.status(400).json({ error: "Missing credentials" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!user || user.role !== role || !user.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const passwordValid = await comparePassword(password, user.passwordHash);
  if (!passwordValid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Auto-upgrade legacy SHA-256 hash to bcrypt on successful login
  if (isLegacyHash(user.passwordHash)) {
    const newHash = await hashPassword(password);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));
  }

  // Update last login
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  let tenantName: string | null = null;
  let tenantSlug: string | null = null;
  if (user.tenantId) {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, user.tenantId));
    if (tenant) {
      tenantName = tenant.name;
      tenantSlug = tenant.slug;
    }
  }
  const token = generateToken(user.id, user.role, user.tenantId);
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId ?? null,
      tenantName,
      tenantSlug,
    },
  });
}));

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", authenticate as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  const user = req.user!;
  let tenantName: string | null = null;
  let tenantSlug: string | null = null;
  if (user.tenantId) {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, user.tenantId));
    if (tenant) {
      tenantName = tenant.name;
      tenantSlug = tenant.slug;
    }
  }
  res.json({ ...user, tenantName, tenantSlug });
}));

router.post("/auth/register-student", asyncHandler(async (req, res): Promise<void> => {
  const { fullName, phone, password, tenantSlug } = req.body;
  if (!fullName || !phone || !password || !tenantSlug) {
    res.status(400).json({ error: "All fields required" });
    return;
  }
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
  if (!tenant) {
    res.status(400).json({ error: "Library not found" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.username, phone));
  if (existing.length > 0) {
    res.status(400).json({ error: "Phone number already registered" });
    return;
  }
  const hashedPassword = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    tenantId: tenant.id,
    name: fullName,
    username: phone,
    passwordHash: hashedPassword,
    role: "student",
    phone,
    isActive: true,
  }).returning();
  const token = generateToken(user.id, user.role, user.tenantId);
  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId ?? null,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
    },
  });
}));

export default router;
