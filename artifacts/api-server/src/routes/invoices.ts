import { Router, type IRouter } from "express";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { db, invoicesTable, productsTable, usersTable, notificationsTable, shiftsTable } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function formatInvoice(inv: typeof invoicesTable.$inferSelect, staffName: string) {
  return {
    id: inv.id, tenantId: inv.tenantId, shiftId: inv.shiftId, staffId: inv.staffId, staffName,
    items: inv.items ?? [], subtotal: parseFloat(inv.subtotal as string),
    discountAmount: parseFloat((inv.discountAmount ?? "0") as string),
    discountPercent: inv.discountPercent ? parseFloat(inv.discountPercent as string) : null,
    total: parseFloat(inv.total as string), paymentMethod: inv.paymentMethod,
    status: inv.status, cancelReason: inv.cancelReason ?? null,
    isSynced: inv.isSynced, createdAt: inv.createdAt?.toISOString?.() ?? inv.createdAt,
  };
}

router.get("/invoices", authenticate as never, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }

  const shiftId = req.query.shiftId ? parseInt(req.query.shiftId as string, 10) : undefined;
  const staffId = req.query.staffId ? parseInt(req.query.staffId as string, 10) : undefined;
  const paymentMethod = req.query.paymentMethod as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;

  const invoices = await db
    .select()
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.tenantId, tenantId),
        shiftId !== undefined ? eq(invoicesTable.shiftId, shiftId) : undefined,
        staffId !== undefined ? eq(invoicesTable.staffId, staffId) : undefined,
        paymentMethod ? eq(invoicesTable.paymentMethod, paymentMethod as "cash" | "card") : undefined,
        dateFrom ? gte(invoicesTable.createdAt, new Date(dateFrom)) : undefined,
        dateTo ? lte(invoicesTable.createdAt, new Date(dateTo)) : undefined,
      ),
    )
    .orderBy(desc(invoicesTable.createdAt));

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

router.post("/invoices", authenticate as never, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const staffId = req.user!.id;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const { shiftId, items, discountAmount, discountPercent, paymentMethod } = req.body as {
    shiftId: number;
    items: Array<{ productId?: number; itemType: string; quantity: number; unitPrice: number; productName?: string }>;
    discountAmount?: number;
    discountPercent?: number;
    paymentMethod: "cash" | "card";
  };
  if (!shiftId || !items?.length || !paymentMethod) { res.status(400).json({ error: "Missing required fields" }); return; }

  const [shift] = await db.select().from(shiftsTable).where(
    and(eq(shiftsTable.id, shiftId), eq(shiftsTable.tenantId, tenantId))
  );
  if (!shift) { res.status(403).json({ error: "Invalid or unauthorized shift" }); return; }

  let subtotal = 0;
  const enrichedItems: Array<Record<string, unknown>> = [];
  for (const item of items) {
    const lineTotal = item.quantity * item.unitPrice;
    subtotal += lineTotal;
    enrichedItems.push({ ...item, id: Date.now() + Math.random(), discountAmount: 0, total: lineTotal });
    if (item.itemType === "product" && item.productId) {
      const [prod] = await db.select().from(productsTable).where(
        and(eq(productsTable.id, item.productId), eq(productsTable.tenantId, tenantId))
      );
      if (prod) {
        const newQty = prod.stockQuantity - item.quantity;
        await db.update(productsTable).set({ stockQuantity: Math.max(0, newQty) }).where(
          and(eq(productsTable.id, item.productId), eq(productsTable.tenantId, tenantId))
        );
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

router.get("/invoices/:invoiceId", authenticate as never, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const id = parseInt(Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId, 10);
  const [inv] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, id), eq(invoicesTable.tenantId, tenantId)));
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, inv.staffId));
  res.json(formatInvoice(inv, u?.name ?? "Unknown"));
});

router.post("/invoices/:invoiceId/cancel", authenticate as never, requireRole("tenant_admin", "super_admin") as never, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const id = parseInt(Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId, 10);
  const { reason } = req.body as { reason?: string };
  const [inv] = await db.update(invoicesTable).set({ status: "cancelled", cancelReason: reason }).where(and(eq(invoicesTable.id, id), eq(invoicesTable.tenantId, tenantId))).returning();
  if (!inv) { res.status(404).json({ error: "Not found" }); return; }
  if (inv.items) {
    for (const item of inv.items as Array<{ itemType: string; productId?: number; quantity: number }>) {
      if (item.itemType === "product" && item.productId) {
        const [prod] = await db.select().from(productsTable).where(
          and(eq(productsTable.id, item.productId), eq(productsTable.tenantId, tenantId))
        );
        if (prod) {
          await db.update(productsTable).set({ stockQuantity: prod.stockQuantity + item.quantity }).where(
            and(eq(productsTable.id, item.productId), eq(productsTable.tenantId, tenantId))
          );
        }
      }
    }
  }
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, inv.staffId));
  res.json(formatInvoice(inv, u?.name ?? "Unknown"));
});

export default router;
