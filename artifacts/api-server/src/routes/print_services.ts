import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, printServicesTable } from "@workspace/db";
import { authenticate, AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function format(s: any) {
  return {
    id: s.id, tenantId: s.tenantId, name: s.name, pricingType: s.pricingType,
    price: parseFloat(s.price), paperSize: s.paperSize ?? null,
    colorType: s.colorType ?? null, isActive: s.isActive,
    createdAt: s.createdAt?.toISOString?.() ?? s.createdAt,
  };
}

router.get("/print-services", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const services = await db.select().from(printServicesTable).where(eq(printServicesTable.tenantId, tenantId));
  res.json(services.map(format));
});

router.post("/print-services", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const { name, pricingType, price, paperSize, colorType } = req.body;
  const [s] = await db.insert(printServicesTable).values({
    tenantId, name, pricingType, price: price.toString(),
    paperSize: paperSize ?? null, colorType: colorType ?? null, isActive: true,
  }).returning();
  res.status(201).json(format(s));
});

router.patch("/print-services/:serviceId", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.serviceId) ? req.params.serviceId[0] : req.params.serviceId, 10);
  const updates: any = {};
  const fields = ["name","pricingType","price","paperSize","colorType","isActive"];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates[f] = f === "price" ? req.body[f].toString() : req.body[f];
    }
  }
  const [s] = await db.update(printServicesTable).set(updates).where(eq(printServicesTable.id, id)).returning();
  if (!s) { res.status(404).json({ error: "Not found" }); return; }
  res.json(format(s));
});

router.delete("/print-services/:serviceId", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.serviceId) ? req.params.serviceId[0] : req.params.serviceId, 10);
  const [s] = await db.delete(printServicesTable).where(eq(printServicesTable.id, id)).returning();
  if (!s) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

export default router;
