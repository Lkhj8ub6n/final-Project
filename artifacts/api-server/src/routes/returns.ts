import { asyncHandler } from "../middlewares/error-handler";
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

interface ReturnItemRecord {
  productId?: number;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface ReturnItemRequest {
  productId?: number;
  productName: string;
  quantity: number;
  unitPrice?: number;
}

router.get("/returns", authenticate as never, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const returns_ = await db.select().from(returnsTable).where(eq(returnsTable.tenantId, tenantId));
  res.json(returns_.map((r) => ({
    id: r.id, tenantId: r.tenantId, invoiceId: r.invoiceId, staffId: r.staffId,
    items: r.items ?? [], totalRefund: parseFloat(r.totalRefund as string),
    refundMethod: r.refundMethod, reason: r.reason,
    createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
  })));
}));

router.post("/returns", authenticate as never, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
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

  // 1. Verify the invoice belongs to this tenant
  const [invoice] = await db.select().from(invoicesTable).where(
    and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.tenantId, tenantId)),
  );
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found or does not belong to this tenant" }); return;
  }

  const invoiceItems = (invoice.items ?? []) as InvoiceItemRecord[];

  // 2. Load all prior returns for this invoice to enforce cumulative limits
  const priorReturns = await db.select().from(returnsTable).where(
    eq(returnsTable.invoiceId, invoiceId),
  );
  const priorQty: Record<string, number> = {};
  for (const ret of priorReturns) {
    for (const ri of (ret.items ?? []) as ReturnItemRecord[]) {
      const key = ri.productId != null ? `id:${ri.productId}` : `name:${ri.productName}`;
      priorQty[key] = (priorQty[key] ?? 0) + ri.quantity;
    }
  }

  // 3. Merge duplicate request lines (same product → sum quantities)
  const merged = new Map<string, ReturnItemRequest & { quantity: number }>();
  for (const ri of items) {
    if (!ri.productName || ri.quantity <= 0) continue;
    const key = ri.productId != null ? `id:${ri.productId}` : `name:${ri.productName}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += ri.quantity;
    } else {
      merged.set(key, { ...ri });
    }
  }

  if (merged.size === 0) {
    res.status(400).json({ error: "No valid items to return" }); return;
  }

  // 4. Validate each merged line: existence + quantity (with cumulative check)
  //    Derive authoritative unit price from the invoice — never trust the client price.
  const enrichedItems: ReturnItemRecord[] = [];
  let totalRefund = 0;

  for (const [key, ri] of merged) {
    const invItem = invoiceItems.find((ii) =>
      ri.productId != null ? ii.productId === ri.productId : ii.productName === ri.productName,
    );
    if (!invItem) {
      res.status(422).json({ error: `Item "${ri.productName}" not found in original invoice` }); return;
    }

    const alreadyReturned = priorQty[key] ?? 0;
    const available = invItem.quantity - alreadyReturned;
    if (ri.quantity > available) {
      res.status(422).json({
        error: `Cannot return ${ri.quantity} of "${ri.productName}": only ${available} unit(s) eligible for return`,
      }); return;
    }

    // Use authoritative price from the invoice, not the client-supplied value
    const authUnitPrice = invItem.unitPrice;
    totalRefund += ri.quantity * authUnitPrice;
    enrichedItems.push({
      productId: invItem.productId ?? undefined,
      productName: invItem.productName,
      quantity: ri.quantity,
      unitPrice: authUnitPrice,
    });
  }

  // 5. Run everything atomically
  const result = await db.transaction(async (tx) => {
    for (const item of enrichedItems) {
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
      .values({
        tenantId, invoiceId, staffId,
        items: enrichedItems,
        totalRefund: totalRefund.toString(),
        refundMethod,
        reason,
      })
      .returning();

    return r;
  });

  res.status(201).json({
    id: result.id, tenantId: result.tenantId, invoiceId: result.invoiceId, staffId: result.staffId,
    items: result.items ?? [], totalRefund: parseFloat(result.totalRefund as string),
    refundMethod: result.refundMethod, reason: result.reason,
    createdAt: result.createdAt?.toISOString?.() ?? result.createdAt,
  });
}));

export default router;
