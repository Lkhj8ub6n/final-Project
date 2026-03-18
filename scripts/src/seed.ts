import { db, usersTable, tenantsTable, tenantSettingsTable, productsTable, platformsTable } from "@workspace/db";
import crypto from "crypto";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "libraryos_salt").digest("hex");
}

async function main() {
  console.log("Seeding database...");
  
  // Create super admin user
  try {
    await db.insert(usersTable).values({
      name: "Super Admin",
      username: "superadmin",
      passwordHash: hashPassword("admin123"),
      role: "super_admin",
      isActive: true,
    }).onConflictDoNothing();
    console.log("Super admin created");
  } catch (e: any) { console.log("Super admin:", e.message); }

  // Create demo tenant
  let tenantId: number;
  try {
    const [tenant] = await db.insert(tenantsTable).values({
      name: "مكتبة النور",
      slug: "al-noor",
      address: "شارع المدينة، عمان، الأردن",
      phone: "0791234567",
      whatsappNumber: "962791234567",
      ownerName: "أحمد محمود",
      ownerEmail: "ahmed@al-noor.jo",
      ownerPasswordHash: hashPassword("admin123"),
      isActive: true,
    }).onConflictDoNothing().returning();
    
    if (tenant) {
      tenantId = tenant.id;
      console.log("Tenant created:", tenantId);
    } else {
      const existing = await db.select().from(tenantsTable).limit(1);
      tenantId = existing[0]?.id ?? 1;
      console.log("Using existing tenant:", tenantId);
    }
  } catch (e: any) {
    const existing = await db.select().from(tenantsTable).limit(1);
    tenantId = existing[0]?.id ?? 1;
    console.log("Tenant error:", e.message);
  }

  // Tenant admin user
  try {
    await db.insert(usersTable).values({
      tenantId,
      name: "أحمد محمود",
      username: "ahmed@al-noor.jo",
      passwordHash: hashPassword("admin123"),
      role: "tenant_admin",
      isActive: true,
    }).onConflictDoNothing();
    console.log("Tenant admin created");
  } catch (e: any) { console.log("Tenant admin:", e.message); }

  // Cashier user
  try {
    await db.insert(usersTable).values({
      tenantId,
      name: "محمد الكاشير",
      username: "cashier1",
      passwordHash: hashPassword("cash123"),
      role: "cashier",
      isActive: true,
    }).onConflictDoNothing();
    console.log("Cashier created");
  } catch (e: any) { console.log("Cashier:", e.message); }

  // Tenant settings
  try {
    await db.insert(tenantSettingsTable).values({
      tenantId,
      libraryName: "مكتبة النور",
      defaultStockAlertThreshold: 5,
      acceptCashPayment: true,
      acceptCardPayment: true,
    }).onConflictDoNothing();
    console.log("Settings created");
  } catch (e: any) { console.log("Settings:", e.message); }

  // Products
  const products = [
    { name: "دوسية الأستاذ محمد - رياضيات", category: "دوسيات", price: "3.500", stockQuantity: 45, stockAlertThreshold: 5, showInStore: true, barcode: "D001" },
    { name: "دوسية الأستاذ أحمد - علوم", category: "دوسيات", price: "3.000", stockQuantity: 32, stockAlertThreshold: 5, showInStore: true, barcode: "D002" },
    { name: "أقلام رصاص HB", category: "قرطاسية", price: "0.250", stockQuantity: 200, stockAlertThreshold: 20, showInStore: true, barcode: "S001" },
    { name: "دفتر خطوط A4", category: "قرطاسية", price: "0.500", stockQuantity: 150, stockAlertThreshold: 15, showInStore: true, barcode: "S002" },
    { name: "ألوان خشب 12 لون", category: "قرطاسية", price: "1.500", stockQuantity: 80, stockAlertThreshold: 10, showInStore: true, barcode: "S003" },
    { name: "محفظة مدرسية", category: "إكسسوارات", price: "5.000", stockQuantity: 25, stockAlertThreshold: 5, showInStore: true, barcode: "A001" },
    { name: "قاموس عربي-إنجليزي", category: "كتب", price: "4.500", stockQuantity: 15, stockAlertThreshold: 3, showInStore: true, barcode: "B001" },
    { name: "بطاقة Classera 20 دينار", category: "بطاقات", price: "20.000", stockQuantity: 10, stockAlertThreshold: 2, showInStore: false, barcode: "C001" },
  ];

  for (const p of products) {
    try {
      await db.insert(productsTable).values({ tenantId, isActive: true, ...p } as any).onConflictDoNothing();
    } catch (e: any) { console.log("Product error:", e.message); }
  }
  console.log("Products seeded");

  // Educational platforms
  try {
    await db.insert(platformsTable).values({
      name: "Classera",
      description: "منصة تعليمية شاملة",
      grades: ["جيل 2009", "جيل 2008", "أساسي"],
      subjects: ["رياضيات", "علوم", "لغة عربية", "لغة إنجليزية"],
      pricingTiers: [
        { cardValue: 10, price: 10.5 },
        { cardValue: 20, price: 21.0, discountedPrice: 19.5 },
        { cardValue: 50, price: 52.0, discountedPrice: 48.0 },
      ] as any,
      currentOffer: "عرض الموسم: 7% خصم على بطاقة 20 دينار",
      isActive: true,
    }).onConflictDoNothing();
    
    await db.insert(platformsTable).values({
      name: "إدراك",
      description: "منصة إدراك التعليمية",
      grades: ["جيل 2009", "جيل 2008"],
      subjects: ["رياضيات", "فيزياء", "كيمياء", "أحياء"],
      pricingTiers: [
        { cardValue: 15, price: 15.5 },
        { cardValue: 30, price: 31.0 },
      ] as any,
      currentOffer: null,
      isActive: true,
    }).onConflictDoNothing();
    console.log("Platforms seeded");
  } catch (e: any) { console.log("Platform error:", e.message); }

  console.log("\n✅ Seed complete!");
  console.log("Credentials:");
  console.log("  Super Admin:  superadmin / admin123  (role: super_admin)");
  console.log("  Library Owner: ahmed@al-noor.jo / admin123  (role: tenant_admin)");
  console.log("  Cashier:      cashier1 / cash123  (role: cashier)");
  console.log("  Store URL:    /store/al-noor");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
