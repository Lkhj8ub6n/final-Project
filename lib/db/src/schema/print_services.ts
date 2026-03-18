import { pgTable, text, serial, timestamp, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const printServicesTable = pgTable("print_services", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name").notNull(),
  pricingType: text("pricing_type").notNull(), // fixed, per_page
  price: numeric("price", { precision: 10, scale: 3 }).notNull(),
  paperSize: text("paper_size"),
  colorType: text("color_type"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPrintServiceSchema = createInsertSchema(printServicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPrintService = z.infer<typeof insertPrintServiceSchema>;
export type PrintService = typeof printServicesTable.$inferSelect;
