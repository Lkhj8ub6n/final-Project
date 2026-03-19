import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, shiftsTable, usersTable, invoicesTable, returnsTable } from "@workspace/db";
import { authenticate, AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function formatShift(s: typeof shiftsTable.$inferSelect, staffName: string) {
  return {
    id: s.id, tenantId: s.tenantId, staffId: s.staffId, staffName,
    openingBalance: parseFloat(s.openingBalance as string),
    closingBalance: s.closingBalance ? parseFloat(s.closingBalance as string) : null,
    status: s.status, openedAt: s.openedAt?.toISOString?.() ?? s.openedAt,
    closedAt: s.closedAt?.toISOString?.() ?? null,
  };
}

router.get("/shifts", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const shifts = await db.select().from(shiftsTable).where(eq(shiftsTable.tenantId, tenantId)).orderBy(desc(shiftsTable.openedAt));
  const userIds = [...new Set(shifts.map(s => s.staffId))];
  const staffMap: Record<number, string> = {};
  for (const uid of userIds) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, uid));
    if (u) staffMap[uid] = u.name;
  }
  res.json(shifts.map(s => formatShift(s, staffMap[s.staffId] ?? "Unknown")));
});

router.post("/shifts/open", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  const staffId = req.user!.id;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const existing = await db.select().from(shiftsTable).where(and(eq(shiftsTable.staffId, staffId), eq(shiftsTable.status, "open")));
  if (existing.length > 0) { res.status(400).json({ error: "Shift already open" }); return; }
  const { openingBalance } = req.body as { openingBalance: number };
  const [s] = await db.insert(shiftsTable).values({
    tenantId, staffId, openingBalance: openingBalance.toString(), status: "open", openedAt: new Date(),
  }).returning();
  res.status(201).json(formatShift(s, req.user!.name));
});

router.get("/shifts/current", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const staffId = req.user!.id;
  const [s] = await db.select().from(shiftsTable).where(and(eq(shiftsTable.staffId, staffId), eq(shiftsTable.status, "open")));
  if (!s) { res.status(404).json({ error: "No open shift" }); return; }
  res.json(formatShift(s, req.user!.name));
});

router.post("/shifts/:shiftId/close", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const id = parseInt(Array.isArray(req.params.shiftId) ? req.params.shiftId[0] : req.params.shiftId, 10);
  const { closingBalance } = req.body as { closingBalance: number };
  const [s] = await db.update(shiftsTable).set({
    closingBalance: closingBalance.toString(), status: "closed", closedAt: new Date(),
  }).where(and(eq(shiftsTable.id, id), eq(shiftsTable.tenantId, tenantId))).returning();
  if (!s) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatShift(s, req.user!.name));
});

router.get("/shifts/:shiftId", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const id = parseInt(Array.isArray(req.params.shiftId) ? req.params.shiftId[0] : req.params.shiftId, 10);
  const [s] = await db.select().from(shiftsTable).where(and(eq(shiftsTable.id, id), eq(shiftsTable.tenantId, tenantId)));
  if (!s) { res.status(404).json({ error: "Not found" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, s.staffId));
  const staffName = user?.name ?? "Unknown";
  const invoices = await db.select().from(invoicesTable).where(and(eq(invoicesTable.shiftId, id), eq(invoicesTable.status, "active")));
  const returns_ = await db.select().from(returnsTable).where(eq(returnsTable.invoiceId, s.id));
  const totalSales = invoices.reduce((sum, inv) => sum + parseFloat(inv.total as string), 0);
  const cashSales = invoices.filter(i => i.paymentMethod === "cash").reduce((sum, i) => sum + parseFloat(i.total as string), 0);
  const cardSales = invoices.filter(i => i.paymentMethod === "card").reduce((sum, i) => sum + parseFloat(i.total as string), 0);
  const totalReturns = returns_.reduce((sum, r) => sum + parseFloat(r.totalRefund as string), 0);
  res.json({
    ...formatShift(s, staffName),
    totalInvoices: invoices.length, totalSales, cashSales, cardSales, totalReturns,
  });
});

export default router;
