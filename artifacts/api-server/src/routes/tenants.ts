import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tenantsTable, usersTable, tenantSettingsTable } from "@workspace/db";
import { authenticate, requireRole, AuthRequest, hashPassword } from "../lib/auth";

const router: IRouter = Router();

router.get("/tenants", authenticate as any, requireRole("super_admin") as any, async (_req, res): Promise<void> => {
  const tenants = await db.select().from(tenantsTable).orderBy(tenantsTable.createdAt);
  res.json(tenants.map(t => ({
    id: t.id, name: t.name, slug: t.slug,
    address: t.address ?? null, phone: t.phone ?? null,
    whatsappNumber: t.whatsappNumber ?? null,
    ownerName: t.ownerName, ownerEmail: t.ownerEmail,
    isActive: t.isActive, createdAt: t.createdAt.toISOString(),
  })));
});

router.post("/tenants", authenticate as any, requireRole("super_admin") as any, async (req: AuthRequest, res): Promise<void> => {
  const { name, slug, address, phone, whatsappNumber, ownerName, ownerEmail, ownerPassword } = req.body;
  if (!name || !slug || !ownerName || !ownerEmail || !ownerPassword) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  // Create tenant
  const [tenant] = await db.insert(tenantsTable).values({
    name, slug, address, phone, whatsappNumber, ownerName, ownerEmail,
    ownerPasswordHash: hashPassword(ownerPassword),
    isActive: true,
  }).returning();
  // Create owner user
  await db.insert(usersTable).values({
    tenantId: tenant.id, name: ownerName, username: ownerEmail,
    passwordHash: hashPassword(ownerPassword), role: "tenant_admin", isActive: true,
  });
  // Create default settings
  await db.insert(tenantSettingsTable).values({
    tenantId: tenant.id, libraryName: name,
    defaultStockAlertThreshold: 5, acceptCashPayment: true, acceptCardPayment: true,
  });
  res.status(201).json({
    id: tenant.id, name: tenant.name, slug: tenant.slug,
    address: tenant.address ?? null, phone: tenant.phone ?? null,
    whatsappNumber: tenant.whatsappNumber ?? null,
    ownerName: tenant.ownerName, ownerEmail: tenant.ownerEmail,
    isActive: tenant.isActive, createdAt: tenant.createdAt.toISOString(),
  });
});

router.get("/tenants/:tenantId", authenticate as any, requireRole("super_admin") as any, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId, 10);
  const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, id));
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: t.id, name: t.name, slug: t.slug, address: t.address ?? null, phone: t.phone ?? null, whatsappNumber: t.whatsappNumber ?? null, ownerName: t.ownerName, ownerEmail: t.ownerEmail, isActive: t.isActive, createdAt: t.createdAt.toISOString() });
});

router.patch("/tenants/:tenantId", authenticate as any, requireRole("super_admin") as any, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId, 10);
  const { name, address, phone, whatsappNumber, ownerName, ownerEmail } = req.body;
  const [t] = await db.update(tenantsTable).set({ name, address, phone, whatsappNumber, ownerName, ownerEmail }).where(eq(tenantsTable.id, id)).returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: t.id, name: t.name, slug: t.slug, address: t.address ?? null, phone: t.phone ?? null, whatsappNumber: t.whatsappNumber ?? null, ownerName: t.ownerName, ownerEmail: t.ownerEmail, isActive: t.isActive, createdAt: t.createdAt.toISOString() });
});

router.post("/tenants/:tenantId/toggle-status", authenticate as any, requireRole("super_admin") as any, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.tenantId) ? req.params.tenantId[0] : req.params.tenantId, 10);
  const [current] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, id));
  if (!current) { res.status(404).json({ error: "Not found" }); return; }
  const [t] = await db.update(tenantsTable).set({ isActive: !current.isActive }).where(eq(tenantsTable.id, id)).returning();
  res.json({ id: t.id, name: t.name, slug: t.slug, address: t.address ?? null, phone: t.phone ?? null, whatsappNumber: t.whatsappNumber ?? null, ownerName: t.ownerName, ownerEmail: t.ownerEmail, isActive: t.isActive, createdAt: t.createdAt.toISOString() });
});

export default router;
