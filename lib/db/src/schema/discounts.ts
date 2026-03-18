import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const discountsTable = pgTable("discounts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // product, category, buy_x_get_y, invoice
  discountValue: numeric("discount_value", { precision: 10, scale: 3 }).notNull(),
  discountType: text("discount_type").notNull(), // percent, amount
  productId: integer("product_id"),
  productName: text("product_name"),
  category: text("category"),
  buyQuantity: integer("buy_quantity"),
  getFreeQuantity: integer("get_free_quantity"),
  minInvoiceAmount: numeric("min_invoice_amount", { precision: 10, scale: 3 }),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDiscountSchema = createInsertSchema(discountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDiscount = z.infer<typeof insertDiscountSchema>;
export type Discount = typeof discountsTable.$inferSelect;
