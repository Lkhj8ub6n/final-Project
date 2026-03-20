import { asyncHandler } from "../middlewares/error-handler";
import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/health", asyncHandler(async (_req, res) => {
  await db.execute(sql`SELECT 1`);
  res.json({ status: "ok" });
}));

router.get("/healthz", asyncHandler(async (_req, res) => {
  await db.execute(sql`SELECT 1`);
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
}));

export default router;
