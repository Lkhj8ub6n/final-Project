import { Router, type IRouter } from "express";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { db, invoicesTable, productsTable, usersTable, notificationsTable } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function formatInvoice(inv: any, staffName: string) {
  return {
    id: inv.id, tenantId: inv.tenantId, shiftId: inv.shiftId, staffId: inv.staffId, staffName,
    items: inv.items ?? [], subtotal: parseFloat(inv.subtotal),
    discountAmount: parseFloat(inv.discountAmount ?? "0"),
    discountPercent: inv.discountPercent ? parseFloat(inv.discountPercent) : null,
    total: parseFloat(inv.total), paymentMethod: inv.paymentMethod,
    status: inv.status, cancelReason: inv.cancelReason ?? null,
    isSynced: inv.isSynced, createdAt: inv.createdAt?.toISOString?.() ?? inv.createdAt,
  };
}

router.get("/invoices", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const invoices = await db.select().from(invoicesTable).where(eq(invoicesTable.tenantId, tenantId)).orderBy(desc(invoicesTable.createdAt));
  const staffCache: Record<number, string> = {};
  const result = await Promise.all(invoices.map(async (inv) => {
    if (!staffCache[inv.staffId]) {
      const [u] = await db.select().from(usersTable).where(eq(usersTable.id, inv.staffId));
      staffCache[inv.staffId] = u?.name ?? "Unknown";
    }
    return formatInvoice(inv, staffCache[inv.staffId]);
  }));
  res.json(result);
});

router.post("/invoices", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const staffId = req.user!.id;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const { shiftId, items, discountAmount, discountPercent, paymentMethod } = req.body;
  if (!items?.length || !paymentMethod) { res.status(400).json({ error: "Missing required fields" }); return; }

  // Calculate totals and update stock
  let subtotal = 0;
  const enrichedItems: any[] = [];
  for (const item of items) {
    const lineTotal = item.quantity * item.unitPrice;
    subtotal += lineTotal;
    enrichedItems.push({ ...item, id: Date.now() + Math.random(), discountAmount: 0, total: lineTotal });
    // Update stock for physical products
    if (item.itemType === "product" && item.productId) {
      const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      if (prod) {
        const newQty = prod.stockQuantity - item.quantity;
        await db.update(productsTable).set({ stockQuantity: Math.max(0, newQty) }).where(eq(productsTable.id, item.productId));
        // Check low stock
        if (newQty <= prod.stockAlertThreshold) {
          await db.insert(notificationsTable).values({
            tenantId, type: "low_stock",
            title: "تنبيه نفاد المخزون",
            message: `منتج: ${prod.name} - الكمية المتبقية: ${Math.max(0, newQty)} قطع`,
            referenceId: prod.id,
          });
        }
      }
    }
  }
  const discAmt = discountAmount ?? 0;
  const total = Math.max(0, subtotal - discAmt);

  const [inv] = await db.insert(invoicesTable).values({
    tenantId, shiftId, staffId, items: enrichedItems,
    subtotal: subtotal.toString(), discountAmount: discAmt.toString(),
    discountPercent: discountPercent?.toString() ?? null,
    total: total.toString(), paymentMethod, status: "active", isSynced: true,
  }).returning();

  res.status(201).json(formatInvoice(inv, req.user!.name));
});

router.get("/invoices/:invoiceId", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId, 10);
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, inv.staffId));
  res.json(formatInvoice(inv, u?.name ?? "Unknown"));
});

router.post("/invoices/:invoiceId/cancel", authenticate as any, requireRole("tenant_admin", "super_admin") as any, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId, 10);
  const { reason } = req.body;
  const [inv] = await db.update(invoicesTable).set({ status: "cancelled", cancelReason: reason }).where(eq(invoicesTable.id, id)).returning();
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  // Restore stock
  if (inv.items) {
    for (const item of inv.items as any[]) {
      if (item.itemType === "product" && item.productId) {
        const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
        if (prod) {
          await db.update(productsTable).set({ stockQuantity: prod.stockQuantity + item.quantity }).where(eq(productsTable.id, item.productId));
        }
      }
    }
  }
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, inv.staffId));
  res.json(formatInvoice(inv, u?.name ?? "Unknown"));
});

export default router;
