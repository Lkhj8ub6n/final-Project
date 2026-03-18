import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, returnsTable, productsTable } from "@workspace/db";
import { authenticate, AuthRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/returns", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const returns_ = await db.select().from(returnsTable).where(eq(returnsTable.tenantId, tenantId));
  res.json(returns_.map(r => ({
    id: r.id, tenantId: r.tenantId, invoiceId: r.invoiceId, staffId: r.staffId,
    items: r.items ?? [], totalRefund: parseFloat(r.totalRefund as string),
    refundMethod: r.refundMethod, reason: r.reason,
    createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
  })));
});

router.post("/returns", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const staffId = req.user!.id;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const { invoiceId, items, refundMethod, reason } = req.body;
  if (!invoiceId || !items?.length || !refundMethod || !reason) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }
  const totalRefund = items.reduce((sum: number, i: any) => sum + i.quantity * i.unitPrice, 0);
  // Restore stock
  for (const item of items) {
    if (item.productId) {
      const [prod] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
      if (prod) {
        await db.update(productsTable).set({ stockQuantity: prod.stockQuantity + item.quantity }).where(eq(productsTable.id, item.productId));
      }
    }
  }
  const [r] = await db.insert(returnsTable).values({
    tenantId, invoiceId, staffId, items,
    totalRefund: totalRefund.toString(), refundMethod, reason,
  }).returning();
  res.status(201).json({
    id: r.id, tenantId: r.tenantId, invoiceId: r.invoiceId, staffId: r.staffId,
    items: r.items ?? [], totalRefund: parseFloat(r.totalRefund as string),
    refundMethod: r.refundMethod, reason: r.reason,
    createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
  });
});

export default router;
