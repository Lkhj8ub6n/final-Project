import { pgTable, text, serial, timestamp, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { invoicesTable } from "./invoices";

export const returnsTable = pgTable("returns", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  invoiceId: integer("invoice_id").notNull().references(() => invoicesTable.id),
  staffId: integer("staff_id").notNull().references(() => usersTable.id),
  items: jsonb("items").notNull().default([]),
  totalRefund: numeric("total_refund", { precision: 10, scale: 3 }).notNull(),
  refundMethod: text("refund_method").notNull(), // cash, credit
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReturnSchema = createInsertSchema(returnsTable).omit({ id: true, createdAt: true });
export type InsertReturn = z.infer<typeof insertReturnSchema>;
export type Return = typeof returnsTable.$inferSelect;
