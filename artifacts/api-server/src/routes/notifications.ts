import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { authenticate, AuthRequest } from "../lib/auth";

const router: IRouter = Router();

function format(n: any) {
  return {
    id: n.id, tenantId: n.tenantId, type: n.type, title: n.title,
    message: n.message, isRead: n.isRead, referenceId: n.referenceId ?? null,
    createdAt: n.createdAt?.toISOString?.() ?? n.createdAt,
  };
}

router.get("/notifications", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  const notifs = await db.select().from(notificationsTable).where(eq(notificationsTable.tenantId, tenantId)).orderBy(desc(notificationsTable.createdAt));
  res.json(notifs.map(format));
});

router.post("/notifications/:notificationId/read", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.notificationId) ? req.params.notificationId[0] : req.params.notificationId, 10);
  const [n] = await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, id)).returning();
  if (!n) { res.status(404).json({ error: "Not found" }); return; }
  res.json(format(n));
});

router.post("/notifications/mark-all-read", authenticate as any, async (req: AuthRequest, res): Promise<void> => {
  const tenantId = req.user!.tenantId;
  if (!tenantId) { res.status(403).json({ error: "No tenant" }); return; }
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.tenantId, tenantId));
  res.json({ success: true, message: "All marked as read" });
});

export default router;
