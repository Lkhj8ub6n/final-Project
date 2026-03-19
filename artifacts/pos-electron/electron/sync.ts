import {
  getPendingInvoices,
  markInvoiceSynced,
  markInvoiceSyncFailed,
  markShiftSynced,
  upsertProducts,
  addSyncLog,
  getCurrentLocalShift,
  getConfig,
  type LocalProduct,
} from "./db";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

let syncListeners: Array<(status: SyncStatus, pendingCount: number) => void> = [];

export function onSyncStatusChange(cb: (status: SyncStatus, pendingCount: number) => void): () => void {
  syncListeners.push(cb);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== cb);
  };
}

function emitStatus(status: SyncStatus, pendingCount: number): void {
  for (const l of syncListeners) l(status, pendingCount);
}

export async function syncAll(token: string): Promise<void> {
  const serverUrl = getConfig("server_url") ?? "";
  if (!serverUrl || !token) return;

  emitStatus("syncing", 0);

  try {
    await syncProducts(serverUrl, token);
    await syncPendingShifts(serverUrl, token);
    const remaining = await syncPendingInvoices(serverUrl, token);
    emitStatus(remaining === 0 ? "success" : "error", remaining);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    addSyncLog("sync_all", "global", null, false, msg);
    emitStatus("error", getPendingInvoices().length);
  }
}

async function syncProducts(serverUrl: string, token: string): Promise<void> {
  try {
    const res = await fetch(`${serverUrl}/api/products?limit=1000`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as any[];
    const products: LocalProduct[] = data.map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode ?? null,
      price: parseFloat(p.price),
      stockQuantity: p.stockQuantity ?? p.stock_quantity ?? 0,
      stockAlertThreshold: p.stockAlertThreshold ?? p.stock_alert_threshold ?? 5,
      category: p.category ?? null,
      isActive: p.isActive ?? p.is_active ?? true,
    }));
    upsertProducts(products);
    addSyncLog("sync_products", "products", null, true, `Synced ${products.length} products`);
  } catch (err) {
    addSyncLog("sync_products", "products", null, false, err instanceof Error ? err.message : String(err));
  }
}

async function syncPendingShifts(serverUrl: string, token: string): Promise<void> {
  const shift = getCurrentLocalShift();
  if (!shift || shift.isSynced || shift.remoteId) return;
  try {
    const res = await fetch(`${serverUrl}/api/shifts/open`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ openingBalance: shift.openingBalance }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { id: number };
    markShiftSynced(shift.id, data.id);
    addSyncLog("sync_shift", "shifts", shift.id, true, `Remote ID: ${data.id}`);
  } catch (err) {
    addSyncLog("sync_shift", "shifts", shift.id, false, err instanceof Error ? err.message : String(err));
  }
}

async function syncPendingInvoices(serverUrl: string, token: string): Promise<number> {
  const pending = getPendingInvoices();
  let failed = 0;

  for (const inv of pending) {
    const shiftId = inv.remoteShiftId ?? getCurrentLocalShift()?.remoteId;
    if (!shiftId) {
      failed++;
      continue;
    }
    try {
      const res = await fetch(`${serverUrl}/api/invoices`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId,
          items: inv.items,
          discountAmount: inv.discountAmount,
          paymentMethod: inv.paymentMethod,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { id: number };
      markInvoiceSynced(inv.id, data.id);
      addSyncLog("sync_invoice", "invoices", inv.id, true, `Remote ID: ${data.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      markInvoiceSyncFailed(inv.id, msg);
      addSyncLog("sync_invoice", "invoices", inv.id, false, msg);
      failed++;
    }
  }
  return failed;
}
