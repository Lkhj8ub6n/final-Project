import { asyncHandler } from "../middlewares/error-handler";
import { Router, type IRouter, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, ordersTable, productsTable, usersTable, tenantsTable, notificationsTable, type Order as DbOrder } from "@workspace/db";
import { authenticate, AuthRequest } from "../lib/auth";

const router: IRouter = Router();

async function formatOrder(o: DbOrder) {
  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, o.studentId));
  return {
    id: o.id, tenantId: o.tenantId, studentId: o.studentId,
    studentName: student?.name ?? "Unknown",
    studentPhone: student?.phone ?? "",
    items: (o.items as unknown[]) ?? [], total: parseFloat(o.total as string),
    status: o.status, notes: o.notes ?? null,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
    updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : o.updatedAt,
  };
}

const requireTenantAdmin = (req: AuthRequest, res: Response): boolean => {
  const role = req.user!.role;
  if (role !== "tenant_admin" && role !== "super_admin") {
    res.status(403).json({ error: "Tenant admin access required" });
    return false;
  }
  return true;
};

router.get("/orders", authenticate as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  if (!requireTenantAdmin(req, res)) return;
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const conditions = [
    eq(ordersTable.tenantId, tenantId),
    ...(status ? [eq(ordersTable.status, status)] : []),
  ];
  const orders = await db.select().from(ordersTable).where(and(...conditions)).orderBy(desc(ordersTable.createdAt));
  const result = await Promise.all(orders.map(formatOrder));
  res.json(result);
}));

router.get("/orders/:orderId", authenticate as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  if (!requireTenantAdmin(req, res)) return;
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const id = parseInt(Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId, 10);
  const [o] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId)));
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await formatOrder(o));
}));

router.patch("/orders/:orderId/status", authenticate as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  if (!requireTenantAdmin(req, res)) return;
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const id = parseInt(Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId, 10);
  const { status } = req.body as { status: string };
  const [o] = await db.update(ordersTable).set({ status }).where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId))).returning();
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await formatOrder(o));
}));

router.post("/orders/:orderId/cancel", authenticate as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  if (!requireTenantAdmin(req, res)) return;
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const id = parseInt(Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId, 10);
  const [o] = await db.update(ordersTable).set({ status: "cancelled" }).where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId))).returning();
  if (!o) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await formatOrder(o));
}));

// Store routes
router.get("/store/:tenantSlug/info", asyncHandler(async (req, res): Promise<void> => {
  const tenantSlug = Array.isArray(req.params.tenantSlug) ? req.params.tenantSlug[0] : req.params.tenantSlug;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
  if (!tenant) { res.status(404).json({ error: "Library not found" }); return; }
  res.json({ name: tenant.name, address: tenant.address ?? null, phone: tenant.phone ?? null, slug: tenant.slug });
}));

router.get("/store/:tenantSlug/products", asyncHandler(async (req, res): Promise<void> => {
  const tenantSlug = Array.isArray(req.params.tenantSlug) ? req.params.tenantSlug[0] : req.params.tenantSlug;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
  if (!tenant) { res.status(404).json({ error: "Library not found" }); return; }
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const baseConditions = [
    eq(productsTable.tenantId, tenant.id),
    eq(productsTable.showInStore, true),
    eq(productsTable.isActive, true),
    ...(category ? [eq(productsTable.category, category)] : []),
  ];
  let products = await db.select().from(productsTable).where(and(...baseConditions));
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }
  res.json(products.map(p => ({
    id: p.id, name: p.name, category: p.category, price: parseFloat(p.price as string),
    discountedPrice: null, imageUrl: p.imageUrl ?? null,
    stockQuantity: p.stockQuantity, isAvailable: p.stockQuantity > 0,
  })));
}));

router.get("/store/:tenantSlug/products/:productId", asyncHandler(async (req, res): Promise<void> => {
  const tenantSlug = Array.isArray(req.params.tenantSlug) ? req.params.tenantSlug[0] : req.params.tenantSlug;
  const productId = parseInt(Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId, 10);
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
  if (!tenant) { res.status(404).json({ error: "Library not found" }); return; }
  const [p] = await db.select().from(productsTable).where(and(eq(productsTable.id, productId), eq(productsTable.tenantId, tenant.id)));
  if (!p) { res.status(404).json({ error: "Product not found" }); return; }
  res.json({ id: p.id, name: p.name, category: p.category, price: parseFloat(p.price as string), discountedPrice: null, imageUrl: p.imageUrl ?? null, stockQuantity: p.stockQuantity, isAvailable: p.stockQuantity > 0 });
}));

router.post("/store/:tenantSlug/orders", authenticate as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  if (req.user!.role !== "student") { res.status(403).json({ error: "Only students can place store orders" }); return; }
  const tenantSlug = Array.isArray(req.params.tenantSlug) ? req.params.tenantSlug[0] : req.params.tenantSlug;
  const studentId = req.user!.id;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
  if (!tenant) { res.status(404).json({ error: "Library not found" }); return; }
  if (req.user!.tenantId !== tenant.id) {
    res.status(403).json({ error: "You can only place orders at your registered library" }); return;
  }
  const { items, notes } = req.body;
  if (!items?.length) { res.status(400).json({ error: "No items" }); return; }

  interface OrderItemInput { productId: number; quantity: number; }
  interface EnrichedItem { id: number; productId: number; productName: string; quantity: number; unitPrice: number; total: number; }

  let total = 0;
  const enrichedItems: EnrichedItem[] = [];
  for (const item of items as OrderItemInput[]) {
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      res.status(400).json({ error: `Invalid quantity for product ${item.productId}` }); return;
    }
    const [p] = await db.select().from(productsTable).where(
      and(
        eq(productsTable.id, item.productId),
        eq(productsTable.tenantId, tenant.id),
        eq(productsTable.isActive, true),
        eq(productsTable.showInStore, true),
      )
    );
    if (!p) { res.status(400).json({ error: `Product ${item.productId} not found or unavailable` }); return; }
    if (p.stockQuantity < qty) {
      res.status(400).json({ error: `Insufficient stock for "${p.name}" (available: ${p.stockQuantity})` }); return;
    }
    const unitPrice = parseFloat(p.price as string);
    const lineTotal = unitPrice * qty;
    total += lineTotal;
    enrichedItems.push({ id: Math.floor(Date.now() + Math.random() * 1e6), productId: p.id, productName: p.name, quantity: qty, unitPrice, total: lineTotal });
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
}));

router.get("/store/my-orders", authenticate as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  if (req.user!.role !== "student") { res.status(403).json({ error: "Only students can access their orders" }); return; }
  const studentId = req.user!.id;
  const orders = await db.select().from(ordersTable).where(eq(ordersTable.studentId, studentId)).orderBy(desc(ordersTable.createdAt));
  const result = await Promise.all(orders.map(formatOrder));
  res.json(result);
}));

router.get("/store/:tenantSlug/my-orders", authenticate as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  if (req.user!.role !== "student") { res.status(403).json({ error: "Only students can access their orders" }); return; }
  const tenantSlug = Array.isArray(req.params.tenantSlug) ? req.params.tenantSlug[0] : req.params.tenantSlug;
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug));
  if (!tenant) { res.status(404).json({ error: "Library not found" }); return; }
  if (req.user!.tenantId !== tenant.id) {
    res.status(403).json({ error: "You can only view orders from your registered library" }); return;
  }
  const studentId = req.user!.id;
  const orders = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.studentId, studentId), eq(ordersTable.tenantId, tenant.id)))
    .orderBy(desc(ordersTable.createdAt));
  const result = await Promise.all(orders.map(formatOrder));
  res.json(result);
}));

export default router;
