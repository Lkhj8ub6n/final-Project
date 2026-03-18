import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cardsTable } from "@workspace/db";
import { authenticate, AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function formatCard(c: any) {
  return {
    id: c.id, tenantId: c.tenantId, platformName: c.platformName,
    cardValue: parseFloat(c.cardValue), quantity: c.quantity,
    price: parseFloat(c.price), alertThreshold: c.alertThreshold,
    createdAt: c.createdAt?.toISOString?.() ?? c.createdAt,
  };
}

router.get("/cards", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const cards = await db.select().from(cardsTable).where(eq(cardsTable.tenantId, tenantId)).orderBy(cardsTable.platformName);
  res.json(cards.map(formatCard));
});

router.post("/cards", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const { platformName, cardValue, quantity, price, alertThreshold } = req.body;
  const [c] = await db.insert(cardsTable).values({
    tenantId, platformName, cardValue: cardValue.toString(),
    quantity, price: price.toString(), alertThreshold,
  }).returning();
  res.status(201).json(formatCard(c));
});

router.patch("/cards/:cardId", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const id = parseInt(Array.isArray(req.params.cardId) ? req.params.cardId[0] : req.params.cardId, 10);
  const updates: any = {};
  if (req.body.quantity !== undefined) updates.quantity = req.body.quantity;
  if (req.body.price !== undefined) updates.price = req.body.price.toString();
  if (req.body.alertThreshold !== undefined) updates.alertThreshold = req.body.alertThreshold;
  const [c] = await db.update(cardsTable).set(updates).where(and(eq(cardsTable.id, id), eq(cardsTable.tenantId, tenantId))).returning();
  if (!c) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatCard(c));
});

router.delete("/cards/:cardId", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const id = parseInt(Array.isArray(req.params.cardId) ? req.params.cardId[0] : req.params.cardId, 10);
  const [c] = await db.delete(cardsTable).where(and(eq(cardsTable.id, id), eq(cardsTable.tenantId, tenantId))).returning();
  if (!c) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

export default router;
