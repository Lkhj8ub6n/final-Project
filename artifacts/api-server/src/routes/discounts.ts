import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, discountsTable } from "@workspace/db";
import { authenticate, AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function formatDiscount(d: any) {
  return {
    id: d.id, tenantId: d.tenantId, name: d.name, type: d.type,
    discountValue: parseFloat(d.discountValue), discountType: d.discountType,
    productId: d.productId ?? null, productName: d.productName ?? null,
    category: d.category ?? null, buyQuantity: d.buyQuantity ?? null,
    getFreeQuantity: d.getFreeQuantity ?? null,
    minInvoiceAmount: d.minInvoiceAmount ? parseFloat(d.minInvoiceAmount) : null,
    startDate: d.startDate, endDate: d.endDate, isActive: d.isActive,
    createdAt: d.createdAt?.toISOString?.() ?? d.createdAt,
  };
}

router.get("/discounts", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const discounts = await db.select().from(discountsTable).where(eq(discountsTable.tenantId, tenantId));
  res.json(discounts.map(formatDiscount));
});

router.post("/discounts", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const data = req.body;
  const [d] = await db.insert(discountsTable).values({
    tenantId, name: data.name, type: data.type,
    discountValue: data.discountValue.toString(), discountType: data.discountType,
    productId: data.productId ?? null, productName: data.productName ?? null,
    category: data.category ?? null, buyQuantity: data.buyQuantity ?? null,
    getFreeQuantity: data.getFreeQuantity ?? null,
    minInvoiceAmount: data.minInvoiceAmount?.toString() ?? null,
    startDate: data.startDate, endDate: data.endDate, isActive: data.isActive ?? true,
  }).returning();
  res.status(201).json(formatDiscount(d));
});

router.patch("/discounts/:discountId", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.discountId) ? req.params.discountId[0] : req.params.discountId, 10);
  const updates: any = {};
  const fields = ["name","discountValue","discountType","startDate","endDate","isActive"];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates[f] = f === "discountValue" ? req.body[f].toString() : req.body[f];
    }
  }
  const [d] = await db.update(discountsTable).set(updates).where(eq(discountsTable.id, id)).returning();
  if (!d) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatDiscount(d));
});

router.delete("/discounts/:discountId", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.discountId) ? req.params.discountId[0] : req.params.discountId, 10);
  const [d] = await db.delete(discountsTable).where(eq(discountsTable.id, id)).returning();
  if (!d) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.post("/discounts/:discountId/toggle", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.discountId) ? req.params.discountId[0] : req.params.discountId, 10);
  const [current] = await db.select().from(discountsTable).where(eq(discountsTable.id, id));
  if (!current) { res.status(404).json({ error: "Not found" }); return; }
  const [d] = await db.update(discountsTable).set({ isActive: !current.isActive }).where(eq(discountsTable.id, id)).returning();
  res.json(formatDiscount(d));
});

export default router;
