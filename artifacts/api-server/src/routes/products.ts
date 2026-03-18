import { Router, type IRouter } from "express";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { authenticate, AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function formatProduct(p: any) {
  return {
    id: p.id, tenantId: p.tenantId, name: p.name, category: p.category,
    barcode: p.barcode ?? null, price: parseFloat(p.price), stockQuantity: p.stockQuantity,
    stockAlertThreshold: p.stockAlertThreshold, imageUrl: p.imageUrl ?? null,
    showInStore: p.showInStore, isActive: p.isActive, createdAt: p.createdAt?.toISOString?.() ?? p.createdAt,
  };
}

router.get("/products", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const { category, search, showInStore, lowStock } = req.query as any;
  let conditions: any[] = [eq(productsTable.tenantId, tenantId)];
  if (category) conditions.push(eq(productsTable.category, category));
  if (search) conditions.push(ilike(productsTable.name, `%${search}%`));
  if (showInStore === "true") conditions.push(eq(productsTable.showInStore, true));
  if (lowStock === "true") conditions.push(sql`${productsTable.stockQuantity} <= ${productsTable.stockAlertThreshold}`);
  const products = await db.select().from(productsTable).where(and(...conditions)).orderBy(productsTable.name);
  res.json(products.map(formatProduct));
});

router.post("/products", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const { name, category, barcode, price, stockQuantity, stockAlertThreshold, imageUrl, showInStore } = req.body;
  if (!name || !category || price == null) { res.status(400).json({ error: "Missing required fields" }); return; }
  const [p] = await db.insert(productsTable).values({
    tenantId, name, category, barcode: barcode || null, price: price.toString(),
    stockQuantity: stockQuantity ?? 0, stockAlertThreshold: stockAlertThreshold ?? 5,
    imageUrl: imageUrl || null, showInStore: showInStore ?? false, isActive: true,
  }).returning();
  res.status(201).json(formatProduct(p));
});

router.get("/products/barcode/:barcode", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const barcode = Array.isArray(req.params.barcode) ? req.params.barcode[0] : req.params.barcode;
  const [p] = await db.select().from(productsTable).where(and(eq(productsTable.tenantId, tenantId), eq(productsTable.barcode, barcode)));
  if (!p) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(formatProduct(p));
});

router.get("/products/:productId", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const id = parseInt(Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId, 10);
  const [p] = await db.select().from(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.tenantId, tenantId)));
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatProduct(p));
});

router.patch("/products/:productId", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const id = parseInt(Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId, 10);
  const updates: any = {};
  const fields = ["name","category","barcode","price","stockQuantity","stockAlertThreshold","imageUrl","showInStore","isActive"];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates[f] = f === "price" ? req.body[f].toString() : req.body[f];
    }
  }
  const [p] = await db.update(productsTable).set(updates).where(and(eq(productsTable.id, id), eq(productsTable.tenantId, tenantId))).returning();
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatProduct(p));
});

router.delete("/products/:productId", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const id = parseInt(Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId, 10);
  const [p] = await db.delete(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.tenantId, tenantId))).returning();
  if (!p) { res.status(404).json({ error: "Not found" }); return; }
  res.sendStatus(204);
});

router.post("/products/:productId/toggle-store", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const id = parseInt(Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId, 10);
  const [current] = await db.select().from(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.tenantId, tenantId)));
  if (!current) { res.status(404).json({ error: "Not found" }); return; }
  const [p] = await db.update(productsTable).set({ showInStore: !current.showInStore }).where(eq(productsTable.id, id)).returning();
  res.json(formatProduct(p));
});

export default router;
