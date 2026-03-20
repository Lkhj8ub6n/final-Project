import { asyncHandler } from "../middlewares/error-handler";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tenantSettingsTable } from "@workspace/db";
import { authenticate, AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function format(s: any) {
  return {
    id: s.id, tenantId: s.tenantId, libraryName: s.libraryName,
    logoUrl: s.logoUrl ?? null, address: s.address ?? null, phone: s.phone ?? null,
    defaultStockAlertThreshold: s.defaultStockAlertThreshold,
    acceptCashPayment: s.acceptCashPayment, acceptCardPayment: s.acceptCardPayment,
  };
}

router.get("/settings", authenticate as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const [s] = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId));
  if (!s) { res.status(404).json({ error: "Settings not found" }); return; }
  res.json(format(s));
}));

router.patch("/settings", authenticate as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const updates: any = {};
  const fields = ["libraryName","logoUrl","address","phone","defaultStockAlertThreshold","acceptCashPayment","acceptCardPayment"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [s] = await db.update(tenantSettingsTable).set(updates).where(eq(tenantSettingsTable.tenantId, tenantId)).returning();
  if (!s) { res.status(404).json({ error: "Settings not found" }); return; }
  res.json(format(s));
}));

export default router;
