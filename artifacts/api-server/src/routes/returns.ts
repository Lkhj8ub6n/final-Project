import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, returnsTable, productsTable, invoicesTable } from "@workspace/db";
import { authenticate, AuthRequest } from "../lib/auth";

const router: IRouter = Router();

interface InvoiceItemRecord {
  productId?: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  itemType: string;
}

interface ReturnItemRequest {
  productId?: number;
  productName: string;
  quantity: number;
  unitPrice: number;
}

router.get("/returns", authenticate as never, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const returns_ = await db.select().from(returnsTable).where(eq(returnsTable.tenantId, tenantId));
  res.json(returns_.map((r) => ({
    id: r.id, tenantId: r.tenantId, invoiceId: r.invoiceId, staffId: r.staffId,
    items: r.items ?? [], totalRefund: parseFloat(r.totalRefund as string),
    refundMethod: r.refundMethod, reason: r.reason,
    createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
  })));
});

router.post("/returns", authenticate as never, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const staffId = req.user!.id;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }

  const { invoiceId, items, refundMethod, reason } = req.body as {
    invoiceId: number;
    items: ReturnItemRequest[];
    refundMethod: "cash" | "credit";
    reason: string;
  };

  if (!invoiceId || !items?.length || !refundMethod || !reason) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }

  // Verify the invoice belongs to this tenant
  const [invoice] = await db.select().from(invoicesTable).where(
    and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.tenantId, tenantId)),
  );
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found or does not belong to this tenant" }); return;
  }

  // Validate return items against the original invoice
  const invoiceItems = (invoice.items ?? []) as InvoiceItemRecord[];
  for (const ri of items) {
    const matched = invoiceItems.find(
      (ii) => ri.productId != null
        ? ii.productId === ri.productId
        : ii.productName === ri.productName,
    );
    if (!matched) {
      res.status(422).json({ error: `Item "${ri.productName}" not found in original invoice` }); return;
    }
    if (ri.quantity <= 0 || ri.quantity > matched.quantity) {
      res.status(422).json({ error: `Invalid return quantity for "${ri.productName}": max is ${matched.quantity}` }); return;
    }
  }

  const totalRefund = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  // Run everything atomically
  const result = await db.transaction(async (tx) => {
    // Restore stock for each returned product using tenant-scoped predicate
    for (const item of items) {
      if (item.productId != null) {
        const [prod] = await tx
          .select()
          .from(productsTable)
          .where(and(eq(productsTable.id, item.productId), eq(productsTable.tenantId, tenantId)));
        if (prod) {
          await tx
            .update(productsTable)
            .set({ stockQuantity: prod.stockQuantity + item.quantity })
            .where(and(eq(productsTable.id, item.productId), eq(productsTable.tenantId, tenantId)));
        }
      }
    }

    const [r] = await tx
      .insert(returnsTable)
      .values({ tenantId, invoiceId, staffId, items, totalRefund: totalRefund.toString(), refundMethod, reason })
      .returning();

    return r;
  });

  res.status(201).json({
    id: result.id, tenantId: result.tenantId, invoiceId: result.invoiceId, staffId: result.staffId,
    items: result.items ?? [], totalRefund: parseFloat(result.totalRefund as string),
    refundMethod: result.refundMethod, reason: result.reason,
    createdAt: result.createdAt?.toISOString?.() ?? result.createdAt,
  });
});

export default router;
