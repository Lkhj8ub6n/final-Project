import { DatabaseSync, type StatementSync } from "node:sqlite";
import path from "path";
import { app } from "electron";

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_db) {
    const dbPath = path.join(app.getPath("userData"), "pos-local.db");
    _db = new DatabaseSync(dbPath);
    migrate(_db);
  }
  return _db;
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

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

export function getConfig(key: string): string | null {
  const db = getDb();
  const stmt = db.prepare("SELECT value FROM config WHERE key = ?") as StatementSync;
  const row = stmt.get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setConfig(key: string, value: string): void {
  const db = getDb();
  const stmt = db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)") as StatementSync;
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
  let rows: unknown[];
  if (search) {
    const stmt = db.prepare("SELECT * FROM products WHERE is_active = 1 AND (name LIKE ? OR barcode = ?) ORDER BY name LIMIT 200") as StatementSync;
    rows = stmt.all(`%${search}%`, search) as unknown[];
  } else {
    const stmt = db.prepare("SELECT * FROM products WHERE is_active = 1 ORDER BY name LIMIT 200") as StatementSync;
    rows = stmt.all() as unknown[];
  }
  return (rows as any[]).map(mapProduct);
}

export function upsertProducts(products: LocalProduct[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO products
      (id, name, barcode, price, stock_quantity, stock_alert_threshold, category, is_active, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `) as StatementSync;
  for (const p of products) {
    stmt.run(p.id, p.name, p.barcode ?? null, p.price, p.stockQuantity, p.stockAlertThreshold, p.category ?? null, p.isActive ? 1 : 0);
  }
}

export function decrementLocalStock(productId: number, quantity: number): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ?") as StatementSync;
  stmt.run(quantity, productId);
}

export function getCurrentLocalShift(): LocalShift | null {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM local_shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1") as StatementSync;
  const row = stmt.get() as any;
  return row ? mapShift(row) : null;
}

export function openLocalShift(openingBalance: number): LocalShift {
  const db = getDb();
  const stmt = db.prepare("INSERT INTO local_shifts (opening_balance, status) VALUES (?, 'open')") as StatementSync;
  const result = stmt.run(openingBalance);
  const getStmt = db.prepare("SELECT * FROM local_shifts WHERE id = ?") as StatementSync;
  const row = getStmt.get(Number(result.lastInsertRowid)) as any;
  return mapShift(row);
}

export function closeLocalShift(id: number, closingBalance: number): LocalShift {
  const db = getDb();
  const stmt = db.prepare("UPDATE local_shifts SET closing_balance = ?, status = 'closed', closed_at = datetime('now') WHERE id = ?") as StatementSync;
  stmt.run(closingBalance, id);
  const getStmt = db.prepare("SELECT * FROM local_shifts WHERE id = ?") as StatementSync;
  const row = getStmt.get(id) as any;
  return mapShift(row);
}

export function createPendingInvoice(data: Omit<PendingInvoice, "id" | "createdAt" | "isSynced" | "remoteId" | "syncError">): PendingInvoice {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO pending_invoices
      (local_shift_id, remote_shift_id, items, subtotal, discount_amount, total, payment_method)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `) as StatementSync;
  const result = stmt.run(
    data.localShiftId ?? null,
    data.remoteShiftId ?? null,
    JSON.stringify(data.items),
    data.subtotal,
    data.discountAmount,
    data.total,
    data.paymentMethod,
  );
  const getStmt = db.prepare("SELECT * FROM pending_invoices WHERE id = ?") as StatementSync;
  const row = getStmt.get(Number(result.lastInsertRowid)) as any;
  return mapPendingInvoice(row);
}

export function getPendingInvoices(): PendingInvoice[] {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM pending_invoices WHERE is_synced = 0 ORDER BY created_at") as StatementSync;
  const rows = stmt.all() as unknown[];
  return (rows as any[]).map(mapPendingInvoice);
}

export function markInvoiceSynced(id: number, remoteId: number): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE pending_invoices SET is_synced = 1, remote_id = ? WHERE id = ?") as StatementSync;
  stmt.run(remoteId, id);
}

export function markInvoiceSyncFailed(id: number, error: string): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE pending_invoices SET sync_error = ? WHERE id = ?") as StatementSync;
  stmt.run(error, id);
}

export function markShiftSynced(localId: number, remoteId: number): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE local_shifts SET is_synced = 1, remote_id = ? WHERE id = ?") as StatementSync;
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
  const stmt = db.prepare("SELECT * FROM local_shifts WHERE is_synced = 0 ORDER BY id") as StatementSync;
  const rows = stmt.all() as unknown[];
  return (rows as any[]).map((row) => ({
    id: row.id as number,
    openingBalance: row.opening_balance as number,
    closingBalance: row.closing_balance as number | null,
    status: row.status as "open" | "closed",
    openedAt: row.opened_at as string,
    closedAt: row.closed_at as string | null,
  }));
}

export function updateLocalShiftRemoteId(localId: number, remoteId: number): void {
  const db = getDb();
  const stmt = db.prepare("UPDATE local_shifts SET remote_id = ?, is_synced = 1 WHERE id = ?") as StatementSync;
  stmt.run(remoteId, localId);
}

export function getPendingInvoiceCount(): number {
  const db = getDb();
  const stmt = db.prepare("SELECT COUNT(*) as count FROM pending_invoices WHERE is_synced = 0") as StatementSync;
  const row = stmt.get() as { count: number };
  return row.count;
}

export function addSyncLog(action: string, entity: string, entityId: number | null, success: boolean, message?: string): void {
  const db = getDb();
  const stmt = db.prepare("INSERT INTO sync_log (action, entity, entity_id, success, message) VALUES (?, ?, ?, ?, ?)") as StatementSync;
  stmt.run(action, entity, entityId ?? null, success ? 1 : 0, message ?? null);
}

function mapProduct(row: any): LocalProduct {
  return {
    id: row.id as number,
    name: row.name as string,
    barcode: row.barcode as string | null,
    price: row.price as number,
    stockQuantity: row.stock_quantity as number,
    stockAlertThreshold: row.stock_alert_threshold as number,
    category: row.category as string | null,
    isActive: row.is_active === 1,
  };
}

function mapShift(row: any): LocalShift {
  return {
    id: row.id as number,
    remoteId: row.remote_id as number | null,
    openingBalance: row.opening_balance as number,
    closingBalance: row.closing_balance as number | null,
    status: row.status as "open" | "closed",
    openedAt: row.opened_at as string,
    closedAt: row.closed_at as string | null,
    isSynced: row.is_synced === 1,
  };
}

function mapPendingInvoice(row: any): PendingInvoice {
  return {
    id: row.id as number,
    localShiftId: row.local_shift_id as number | null,
    remoteShiftId: row.remote_shift_id as number | null,
    items: JSON.parse(row.items as string) as InvoiceItem[],
    subtotal: row.subtotal as number,
    discountAmount: row.discount_amount as number,
    total: row.total as number,
    paymentMethod: row.payment_method as "cash" | "card",
    createdAt: row.created_at as string,
    isSynced: row.is_synced === 1,
    remoteId: row.remote_id as number | null,
    syncError: row.sync_error as string | null,
  };
}
