import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, ordersTable, productsTable, usersTable, tenantsTable, notificationsTable } from "@workspace/db";
import { authenticate, AuthRequest } from "../lib/auth";

const router: IRouter = Router();

async function formatOrder(o: any) {
  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, o.studentId));
  return {
    id: o.id, tenantId: o.tenantId, studentId: o.studentId,
    studentName: student?.name ?? "Unknown",
    studentPhone: student?.phone ?? "",
    items: o.items ?? [], total: parseFloat(o.total),
    status: o.status, notes: o.notes ?? null,
    createdAt: o.createdAt?.toISOString?.() ?? o.createdAt,
    updatedAt: o.updatedAt?.toISOString?.() ?? o.updatedAt,
  };
}

router.get("/orders", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const { status } = req.query as any;
  const conditions: any[] = [eq(ordersTable.tenantId, tenantId)];
  if (status) conditions.push(eq(ordersTable.status, status));
  const orders = await db.select().from(ordersTable).where(and(...conditions)).orderBy(desc(ordersTable.createdAt));
  const result = await Promise.all(orders.map(formatOrder));
  res.json(result);
});

router.get("/orders/:orderId", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId, 10);
  const [o] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await formatOrder(o));
});

router.patch("/orders/:orderId/status", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId, 10);
  const { status } = req.body;
  const [o] = await db.update(ordersTable).set({ status }).where(eq(ordersTable.id, id)).returning();
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await formatOrder(o));
});

router.post("/orders/:orderId/cancel", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId, 10);
  const [o] = await db.update(ordersTable).set({ status: "cancelled" }).where(eq(ordersTable.id, id)).returning();
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await formatOrder(o));
});

// Store routes
router.get("/store/:tenantSlug/info", async (req, res): Promise<void> => {
  const tenantSlug = Array.isArray(req.params.tenantSlug) ? req.params.tenantSlug[0] : req.params.tenantSlug;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
  if (!tenant) { res.status(404).json({ error: "Library not found" }); return; }
  res.json({ name: tenant.name, address: tenant.address ?? null, phone: tenant.phone ?? null, slug: tenant.slug });
});

router.get("/store/:tenantSlug/products", async (req, res): Promise<void> => {
  const tenantSlug = Array.isArray(req.params.tenantSlug) ? req.params.tenantSlug[0] : req.params.tenantSlug;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
  if (!tenant) { res.status(404).json({ error: "Library not found" }); return; }
  const { category, search } = req.query as any;
  const conditions: any[] = [eq(productsTable.tenantId, tenant.id), eq(productsTable.showInStore, true), eq(productsTable.isActive, true)];
  const products = await db.select().from(productsTable).where(and(...conditions));
  res.json(products.map(p => ({
    id: p.id, name: p.name, category: p.category, price: parseFloat(p.price as string),
    discountedPrice: null, imageUrl: p.imageUrl ?? null,
    stockQuantity: p.stockQuantity, isAvailable: p.stockQuantity > 0,
  })));
});

router.get("/store/:tenantSlug/products/:productId", async (req, res): Promise<void> => {
  const tenantSlug = Array.isArray(req.params.tenantSlug) ? req.params.tenantSlug[0] : req.params.tenantSlug;
  const productId = parseInt(Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId, 10);
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
  if (!tenant) { res.status(404).json({ error: "Library not found" }); return; }
  const [p] = await db.select().from(productsTable).where(and(eq(productsTable.id, productId), eq(productsTable.tenantId, tenant.id)));
  if (!p) { res.status(404).json({ error: "Product not found" }); return; }
  res.json({ id: p.id, name: p.name, category: p.category, price: parseFloat(p.price as string), discountedPrice: null, imageUrl: p.imageUrl ?? null, stockQuantity: p.stockQuantity, isAvailable: p.stockQuantity > 0 });
});

router.post("/store/:tenantSlug/orders", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantSlug = Array.isArray(req.params.tenantSlug) ? req.params.tenantSlug[0] : req.params.tenantSlug;
  const studentId = req.user!.id;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
  if (!tenant) { res.status(404).json({ error: "Library not found" }); return; }
  const { items, notes } = req.body;
  if (!items?.length) { res.status(400).json({ error: "No items" }); return; }

  let total = 0;
  const enrichedItems: any[] = [];
  for (const item of items) {
    const [p] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    if (!p) { res.status(400).json({ error: `Product ${item.productId} not found` }); return; }
    const lineTotal = parseFloat(p.price as string) * item.quantity;
    total += lineTotal;
    enrichedItems.push({ id: Date.now() + Math.random(), productId: p.id, productName: p.name, quantity: item.quantity, unitPrice: parseFloat(p.price as string), total: lineTotal });
  }

  const [o] = await db.insert(ordersTable).values({
    tenantId: tenant.id, studentId, items: enrichedItems,
    total: total.toString(), status: "new", notes: notes ?? null,
  }).returning();

  // Create notification for library owner
  await db.insert(notificationsTable).values({
    tenantId: tenant.id, type: "new_order",
    title: "طلب جديد من المتجر الإلكتروني",
    message: `طلب جديد #${o.id} بقيمة ${total.toFixed(3)} دينار`,
    referenceId: o.id,
  });

  res.status(201).json(await formatOrder(o));
});

router.get("/store/my-orders", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const studentId = req.user!.id;
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.studentId, studentId)).orderBy(desc(ordersTable.createdAt));
  const result = await Promise.all(orders.map(formatOrder));
  res.json(result);
});

export default router;
