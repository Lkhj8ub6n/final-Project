import { asyncHandler } from "../middlewares/error-handler";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, platformsTable } from "@workspace/db";
import { authenticate, requireRole } from "../lib/auth";

const router: IRouter = Router();

function formatPlatform(p: any) {
  return {
    id: p.id, name: p.name, description: p.description ?? null,
    grades: p.grades ?? [], subjects: p.subjects ?? [],
    pricingTiers: p.pricingTiers ?? [], currentOffer: p.currentOffer ?? null,
    isActive: p.isActive, updatedAt: p.updatedAt?.toISOString?.() ?? p.updatedAt,
  };
}

router.get("/platforms", async (_req, res): Promise<void> => {
  const platforms = await db.select().from(platformsTable).orderBy(platformsTable.name);
  res.json(platforms.map(formatPlatform));
});

router.post("/platforms", authenticate as any, requireRole("super_admin") as any, asyncHandler(async (req, res): Promise<void> => {
  const { name, description, grades, subjects, pricingTiers, currentOffer } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [p] = await db.insert(platformsTable).values({
    name, description: description ?? null,
    grades: grades ?? [], subjects: subjects ?? [],
    pricingTiers: pricingTiers ?? [], currentOffer: currentOffer ?? null,
    isActive: true,
  }).returning();
  res.status(201).json(formatPlatform(p));
}));

router.patch("/platforms/:platformId", authenticate as any, requireRole("super_admin") as any, asyncHandler(async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.platformId) ? req.params.platformId[0] : req.params.platformId, 10);
  const updates: any = {};
  const fields = ["name","description","grades","subjects","pricingTiers","currentOffer","isActive"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [p] = await db.update(platformsTable).set(updates).where(eq(platformsTable.id, id)).returning();
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatPlatform(p));
}));

router.delete("/platforms/:platformId", authenticate as any, requireRole("super_admin") as any, asyncHandler(async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.platformId) ? req.params.platformId[0] : req.params.platformId, 10);
  const [p] = await db.delete(platformsTable).where(eq(platformsTable.id, id)).returning();
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
}));

export default router;
