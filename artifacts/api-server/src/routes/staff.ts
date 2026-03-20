import { asyncHandler } from "../middlewares/error-handler";
import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { authenticate, requireRole, AuthRequest, hashPassword } from "../lib/auth";

const router: IRouter = Router();

function formatStaff(u: any) {
  return {
    id: u.id, tenantId: u.tenantId, name: u.name, username: u.username,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt?.toISOString?.() ?? null,
    createdAt: u.createdAt?.toISOString?.() ?? u.createdAt,
  };
}

router.get("/staff", authenticate as any, requireRole("tenant_admin") as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const staff = await db.select().from(usersTable).where(and(eq(usersTable.tenantId, tenantId), eq(usersTable.role, "cashier")));
  res.json(staff.map(formatStaff));
}));

router.post("/staff", authenticate as any, requireRole("tenant_admin") as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const { name, username, password } = req.body;
  if (!name || !username || !password) { res.status(400).json({ error: "All fields required" }); return; }
  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (existing.length > 0) { res.status(400).json({ error: "Username already taken" }); return; }
  const [u] = await db.insert(usersTable).values({
    tenantId, name, username, passwordHash: hashPassword(password), role: "cashier", isActive: true,
  }).returning();
  res.status(201).json(formatStaff(u));
}));

router.patch("/staff/:staffId", authenticate as any, requireRole("tenant_admin") as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.staffId) ? req.params.staffId[0] : req.params.staffId, 10);
  const updates: any = {};
  if (req.body.name) updates.name = req.body.name;
  if (req.body.username) updates.username = req.body.username;
  if (req.body.password) updates.passwordHash = hashPassword(req.body.password);
  const [u] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!u) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatStaff(u));
}));

router.delete("/staff/:staffId", authenticate as any, requireRole("tenant_admin") as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.staffId) ? req.params.staffId[0] : req.params.staffId, 10);
  const [u] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!u) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
}));

router.post("/staff/:staffId/toggle-status", authenticate as any, requireRole("tenant_admin") as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.staffId) ? req.params.staffId[0] : req.params.staffId, 10);
  const [current] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!current) { res.status(404).json({ error: "Not found" }); return; }
  const [u] = await db.update(usersTable).set({ isActive: !current.isActive }).where(eq(usersTable.id, id)).returning();
  res.json(formatStaff(u));
}));

export default router;
