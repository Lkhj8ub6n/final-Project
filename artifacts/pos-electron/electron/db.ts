import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const dbPath = path.join(app.getPath("userData"), "pos-local.db");
    _db = new Database(dbPath);
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      barcode TEXT,
      price REAL NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      stock_alert_threshold INTEGER NOT NULL DEFAULT 5,
      category TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

    CREATE TABLE IF NOT EXISTS local_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remote_id INTEGER,
      opening_balance REAL NOT NULL DEFAULT 0,
      closing_balance REAL,
      status TEXT NOT NULL DEFAULT 'open',
      opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      is_synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pending_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      local_shift_id INTEGER,
      remote_shift_id INTEGER,
      items TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_synced INTEGER NOT NULL DEFAULT 0,
      remote_id INTEGER,
      sync_error TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      success INTEGER NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

interface ProductRow {
  id: number;
  name: string;
  barcode: string | null;
  price: number;
  stock_quantity: number;
  stock_alert_threshold: number;
  category: string | null;
  is_active: number;
}

interface ShiftRow {
  id: number;
  remote_id: number | null;
  opening_balance: number;
  closing_balance: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  is_synced: number;
}

interface PendingInvoiceRow {
  id: number;
  local_shift_id: number | null;
  remote_shift_id: number | null;
  items: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  payment_method: string;
  created_at: string;
  is_synced: number;
  remote_id: number | null;
  sync_error: string | null;
}

function mapProduct(row: ProductRow): LocalProduct {
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode,
    price: row.price,
    stockQuantity: row.stock_quantity,
    stockAlertThreshold: row.stock_alert_threshold,
    category: row.category,
    isActive: row.is_active === 1,
  };
}

function mapShift(row: ShiftRow): LocalShift {
  return {
    id: row.id,
    remoteId: row.remote_id,
    openingBalance: row.opening_balance,
    closingBalance: row.closing_balance,
    status: row.status === "open" ? "open" : "closed",
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    isSynced: row.is_synced === 1,
  };
}

function mapPendingInvoice(row: PendingInvoiceRow): PendingInvoice {
  return {
    id: row.id,
    localShiftId: row.local_shift_id,
    remoteShiftId: row.remote_shift_id,
    items: JSON.parse(row.items) as InvoiceItem[],
    subtotal: row.subtotal,
    discountAmount: row.discount_amount,
    total: row.total,
    paymentMethod: row.payment_method === "cash" ? "cash" : "card",
    createdAt: row.created_at,
    isSynced: row.is_synced === 1,
    remoteId: row.remote_id,
    syncError: row.sync_error,
  };
}

export function getConfig(key: string): string | null {
  const db = getDb();
  const stmt = db.prepare("SELECT value FROM config WHERE key = ?");
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setConfig(key: string, value: string): void {
  const db = getDb();
  const stmt = db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)");
  stmt.run(key, value);
}

export interface LocalProduct {
  id: number;
  name: string;
  barcode: string | null;
  price: number;
  stockQuantity: number;
  stockAlertThreshold: number;
  category: string | null;
  isActive: boolean;
}

export interface LocalShift {
  id: number;
  remoteId: number | null;
  openingBalance: number;
  closingBalance: number | null;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  isSynced: boolean;
}

export interface PendingInvoice {
  id: number;
  localShiftId: number | null;
  remoteShiftId: number | null;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  paymentMethod: "cash" | "card";
  createdAt: string;
  isSynced: boolean;
  remoteId: number | null;
  syncError: string | null;
}

export interface InvoiceItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  itemType: string;
}

export function getLocalProducts(search?: string): LocalProduct[] {
  const db = getDb();
  let rows: ProductRow[];
  if (search) {
    const stmt = db.prepare("SELECT * FROM products WHERE is_active = 1 AND (name LIKE ? OR barcode = ?) ORDER BY name LIMIT 200");
    rows = stmt.all(`%${search}%`, search) as ProductRow[];
  } else {
    const stmt = db.prepare("SELECT * FROM products WHERE is_active = 1 ORDER BY name LIMIT 200");
    rows = stmt.all() as ProductRow[];
  }
  return rows.map(mapProduct);
}

export function upsertProducts(products: LocalProduct[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO products
      (id, name, barcode, price, stock_quantity, stock_alert_threshold, category, is_active, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const upsertMany = db.transaction((prods: LocalProduct[]) => {
    for (const p of prods) {
      stmt.run(p.id, p.name, p.barcode ?? null, p.price, p.stockQuantity, p.stockAlertThreshold, p.category ?? null, p.isActive ? 1 : 0);
    }
  });
  upsertMany(products);
}

export function decrementLocalStock(productId: number, quantity: number): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ?");
  stmt.run(quantity, productId);
}

export function getCurrentLocalShift(): LocalShift | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM local_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1");
  const row = stmt.get() as ShiftRow | undefined;
  return row ? mapShift(row) : null;
}

export function openLocalShift(openingBalance: number): LocalShift {
  const db = getDb();
  const stmt = db.prepare("INSERT INTO local_shifts (opening_balance, status) VALUES (?, 'open')");
  const result = stmt.run(openingBalance);
  const getStmt = db.prepare("SELECT * FROM local_shifts WHERE id = ?");
  const row = getStmt.get(Number(result.lastInsertRowid)) as ShiftRow;
  return mapShift(row);
}

export function closeLocalShift(id: number, closingBalance: number): LocalShift {
  const db = getDb();
  const stmt = db.prepare("UPDATE local_shifts SET closing_balance = ?, status = 'closed', closed_at = datetime('now') WHERE id = ?");
  stmt.run(closingBalance, id);
  const getStmt = db.prepare("SELECT * FROM local_shifts WHERE id = ?");
  const row = getStmt.get(id) as ShiftRow;
  return mapShift(row);
}

export function createPendingInvoice(data: Omit<PendingInvoice, "id" | "createdAt" | "isSynced" | "remoteId" | "syncError">): PendingInvoice {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO pending_invoices
      (local_shift_id, remote_shift_id, items, subtotal, discount_amount, total, payment_method)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.localShiftId ?? null,
    data.remoteShiftId ?? null,
    JSON.stringify(data.items),
    data.subtotal,
    data.discountAmount,
    data.total,
    data.paymentMethod,
  );
  const getStmt = db.prepare("SELECT * FROM pending_invoices WHERE id = ?");
  const row = getStmt.get(Number(result.lastInsertRowid)) as PendingInvoiceRow;
  return mapPendingInvoice(row);
}

export function getPendingInvoices(): PendingInvoice[] {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM pending_invoices WHERE is_synced = 0 ORDER BY created_at");
  const rows = stmt.all() as PendingInvoiceRow[];
  return rows.map(mapPendingInvoice);
}

export function markInvoiceSynced(id: number, remoteId: number): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE pending_invoices SET is_synced = 1, remote_id = ? WHERE id = ?");
  stmt.run(remoteId, id);
}

export function markInvoiceSyncFailed(id: number, error: string): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE pending_invoices SET sync_error = ? WHERE id = ?");
  stmt.run(error, id);
}

export function markShiftSynced(localId: number, remoteId: number): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE local_shifts SET is_synced = 1, remote_id = ? WHERE id = ?");
  stmt.run(remoteId, localId);
}

export interface UnsyncedShift {
  id: number;
  openingBalance: number;
  closingBalance: number | null;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
}

export function getUnsyncedShifts(): UnsyncedShift[] {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM local_shifts WHERE is_synced = 0 ORDER BY id");
  const rows = stmt.all() as ShiftRow[];
  return rows.map((row) => ({
    id: row.id,
    openingBalance: row.opening_balance,
    closingBalance: row.closing_balance,
    status: row.status === "open" ? "open" : "closed",
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  }));
}

export function updateLocalShiftRemoteId(localId: number, remoteId: number): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE local_shifts SET remote_id = ?, is_synced = 1 WHERE id = ?");
  stmt.run(remoteId, localId);
}

export function getPendingInvoiceCount(): number {
  const db = getDb();
  const stmt = db.prepare("SELECT COUNT(*) as count FROM pending_invoices WHERE is_synced = 0");
  const row = stmt.get() as { count: number };
  return row.count;
}

export function addSyncLog(action: string, entity: string, entityId: number | null, success: boolean, message?: string): void {
  const db = getDb();
  const stmt = db.prepare("INSERT INTO sync_log (action, entity, entity_id, success, message) VALUES (?, ?, ?, ?, ?)");
  stmt.run(action, entity, entityId ?? null, success ? 1 : 0, message ?? null);
}
