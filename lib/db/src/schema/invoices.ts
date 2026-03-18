import { pgTable, text, serial, timestamp, boolean, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { shiftsTable } from "./shifts";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  shiftId: integer("shift_id").notNull().references(() => shiftsTable.id),
  staffId: integer("staff_id").notNull().references(() => usersTable.id),
  items: jsonb("items").notNull().default([]),
  subtotal: numeric("subtotal", { precision: 10, scale: 3 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 3 }).notNull().default("0"),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }),
  total: numeric("total", { precision: 10, scale: 3 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // cash, card
  status: text("status").notNull().default("active"), // active, cancelled
  cancelReason: text("cancel_reason"),
  isSynced: boolean("is_synced").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
