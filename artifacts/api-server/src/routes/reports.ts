import { asyncHandler } from "../middlewares/error-handler";
import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { db, invoicesTable, ordersTable, productsTable, notificationsTable, tenantsTable } from "@workspace/db";
import { authenticate, requireRole, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/reports/dashboard", authenticate as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayInvoices = await db.select().from(invoicesTable).where(and(eq(invoicesTable.tenantId, tenantId), eq(invoicesTable.status, "active"), gte(invoicesTable.createdAt, today)));
  const todaySales = todayInvoices.reduce((sum, i) => sum + parseFloat(i.total as string), 0);
  const newOrders = await db.select().from(ordersTable).where(and(eq(ordersTable.tenantId, tenantId), eq(ordersTable.status, "new")));
  const lowStockProds = await db.select().from(productsTable).where(and(eq(productsTable.tenantId, tenantId), sql`${productsTable.stockQuantity} <= ${productsTable.stockAlertThreshold}`));
  const recentInvoices = await db.select().from(invoicesTable).where(eq(invoicesTable.tenantId, tenantId)).orderBy(desc(invoicesTable.createdAt)).limit(5);

  // Category breakdown
  const allInvoices = await db.select().from(invoicesTable).where(and(eq(invoicesTable.tenantId, tenantId), eq(invoicesTable.status, "active")));
  const categoryMap: Record<string, number> = {};
  let grandTotal = 0;
  for (const inv of allInvoices) {
    const items = inv.items as any[] ?? [];
    for (const item of items) {
      const cat = item.category ?? item.itemType ?? "أخرى";
      categoryMap[cat] = (categoryMap[cat] ?? 0) + item.total;
      grandTotal += item.total;
    }
  }
  const salesByCategory = Object.entries(categoryMap).map(([cat, sales]) => ({
    category: cat, sales, percentage: grandTotal > 0 ? (sales / grandTotal) * 100 : 0,
  }));

  res.json({
    todaySales, todayInvoices: todayInvoices.length,
    newOrders: newOrders.length, lowStockProducts: lowStockProds.length,
    recentInvoices: recentInvoices.map(inv => ({
      id: inv.id, tenantId: inv.tenantId, shiftId: inv.shiftId, staffId: inv.staffId, staffName: "",
      items: inv.items ?? [], subtotal: parseFloat(inv.subtotal as string),
      discountAmount: parseFloat((inv.discountAmount ?? "0") as string),
      discountPercent: inv.discountPercent ? parseFloat(inv.discountPercent as string) : null,
      total: parseFloat(inv.total as string), paymentMethod: inv.paymentMethod,
      status: inv.status, cancelReason: inv.cancelReason ?? null,
      isSynced: inv.isSynced, createdAt: inv.createdAt?.toISOString?.() ?? inv.createdAt,
    })),
    salesByCategory,
  });
}));

router.get("/reports/sales", authenticate as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const invoices = await db.select().from(invoicesTable).where(and(eq(invoicesTable.tenantId, tenantId), eq(invoicesTable.status, "active"))).orderBy(invoicesTable.createdAt);
  const dataMap: Record<string, { sales: number; invoices: number }> = {};
  let totalSales = 0;
  for (const inv of invoices) {
    const date = inv.createdAt.toISOString().split("T")[0];
    if (!dataMap[date]) dataMap[date] = { sales: 0, invoices: 0 };
    dataMap[date].sales += parseFloat(inv.total as string);
    dataMap[date].invoices += 1;
    totalSales += parseFloat(inv.total as string);
  }
  res.json({
    period: "all", totalSales, totalInvoices: invoices.length,
    data: Object.entries(dataMap).map(([date, d]) => ({ date, sales: d.sales, invoices: d.invoices })),
    categoryBreakdown: [],
  });
}));

router.get("/reports/top-products", authenticate as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const invoices = await db.select().from(invoicesTable).where(and(eq(invoicesTable.tenantId, tenantId), eq(invoicesTable.status, "active")));
  const productMap: Record<number, { productName: string; category: string; quantitySold: number; revenue: number }> = {};
  for (const inv of invoices) {
    for (const item of (inv.items as any[] ?? [])) {
      if (item.productId) {
        if (!productMap[item.productId]) productMap[item.productId] = { productName: item.productName, category: "product", quantitySold: 0, revenue: 0 };
        productMap[item.productId].quantitySold += item.quantity;
        productMap[item.productId].revenue += item.total;
      }
    }
  }
  const limit = parseInt(req.query.limit as string ?? "10", 10);
  const result = Object.entries(productMap).map(([id, d]) => ({ productId: parseInt(id), ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, limit);
  res.json(result);
}));

router.get("/reports/payment-methods", authenticate as any, asyncHandler(async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const invoices = await db.select().from(invoicesTable).where(and(eq(invoicesTable.tenantId, tenantId), eq(invoicesTable.status, "active")));
  let cashTotal = 0, cardTotal = 0;
  for (const inv of invoices) {
    const amount = parseFloat(inv.total as string);
    if (inv.paymentMethod === "cash") cashTotal += amount;
    else cardTotal += amount;
  }
  const total = cashTotal + cardTotal;
  res.json({
    cashTotal, cardTotal,
    cashPercent: total > 0 ? (cashTotal / total) * 100 : 0,
    cardPercent: total > 0 ? (cardTotal / total) * 100 : 0,
  });
}));

// ─── Super Admin: Platform-wide stats ───────────────────────────────────────
router.get("/super/stats", authenticate as any, requireRole("super_admin") as any, async (_req, res): Promise<void> => {
  const [allTenants, allOrders, allInvoices] = await Promise.all([
    db.select({ id: tenantsTable.id, isActive: tenantsTable.isActive }).from(tenantsTable),
    db.select({ status: ordersTable.status }).from(ordersTable),
    db.select({ total: invoicesTable.total, status: invoicesTable.status }).from(invoicesTable),
  ]);
  const totalRevenue = allInvoices
    .filter(i => i.status === "active")
    .reduce((sum, i) => sum + parseFloat(i.total as string), 0);
  res.json({
    totalLibraries: allTenants.length,
    activeLibraries: allTenants.filter(t => t.isActive).length,
    suspendedLibraries: allTenants.filter(t => !t.isActive).length,
    totalRevenue,
    totalStoreOrders: allOrders.length,
    pendingStoreOrders: allOrders.filter(o => o.status === "new").length,
  });
});

export default router;
