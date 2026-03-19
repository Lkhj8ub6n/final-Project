import {
  getPendingInvoices,
  markInvoiceSynced,
  markInvoiceSyncFailed,
  updateLocalShiftRemoteId,
  getUnsyncedShifts,
  upsertProducts,
  addSyncLog,
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
    const localToRemoteShiftId = await syncUnsyncedShifts(serverUrl, token);
    const remaining = await syncPendingInvoices(serverUrl, token, localToRemoteShiftId);
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
    const data = (await res.json()) as Array<{
      id: number; name: string; barcode?: string; price: string;
      stockQuantity?: number; stockAlertThreshold?: number;
      category?: string; isActive?: boolean;
    }>;
    const products: LocalProduct[] = data.map((p) => ({
      id: p.id, name: p.name, barcode: p.barcode ?? null,
      price: parseFloat(p.price),
      stockQuantity: p.stockQuantity ?? 0,
      stockAlertThreshold: p.stockAlertThreshold ?? 5,
      category: p.category ?? null,
      isActive: p.isActive ?? true,
    }));
    upsertProducts(products);
    addSyncLog("sync_products", "products", null, true, `Synced ${products.length} products`);
  } catch (err) {
    addSyncLog("sync_products", "products", null, false, err instanceof Error ? err.message : String(err));
  }
}

async function syncUnsyncedShifts(serverUrl: string, token: string): Promise<Map<number, number>> {
  const localToRemote = new Map<number, number>();
  const unsynced = getUnsyncedShifts();

  for (const shift of unsynced) {
    try {
      const openRes = await fetch(`${serverUrl}/api/shifts/open`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ openingBalance: shift.openingBalance }),
      });
      if (!openRes.ok && openRes.status !== 400) {
        throw new Error(`HTTP ${openRes.status}`);
      }

      let remoteId: number;
      if (openRes.ok) {
        const openData = (await openRes.json()) as { id: number };
        remoteId = openData.id;
      } else {
        const currentRes = await fetch(`${serverUrl}/api/shifts/current`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!currentRes.ok) throw new Error(`Cannot get current shift: HTTP ${currentRes.status}`);
        const currentData = (await currentRes.json()) as { id: number };
        remoteId = currentData.id;
      }

      if (shift.status === "closed" && shift.closingBalance !== null) {
        const closeRes = await fetch(`${serverUrl}/api/shifts/${remoteId}/close`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ closingBalance: shift.closingBalance }),
        });
        if (!closeRes.ok) throw new Error(`Failed to close remote shift: HTTP ${closeRes.status}`);
      }

      updateLocalShiftRemoteId(shift.id, remoteId);
      localToRemote.set(shift.id, remoteId);
      addSyncLog("sync_shift", "shifts", shift.id, true, `Remote ID: ${remoteId}`);
    } catch (err) {
      addSyncLog("sync_shift", "shifts", shift.id, false, err instanceof Error ? err.message : String(err));
    }
  }

  return localToRemote;
}

async function syncPendingInvoices(serverUrl: string, token: string, localToRemoteShiftId: Map<number, number>): Promise<number> {
  const pending = getPendingInvoices();
  let failed = 0;

  for (const inv of pending) {
    const remoteShiftId = inv.remoteShiftId
      ?? (inv.localShiftId !== null ? localToRemoteShiftId.get(inv.localShiftId) : undefined);

    if (!remoteShiftId) {
      failed++;
      markInvoiceSyncFailed(inv.id, "No remote shift ID available");
      continue;
    }

    try {
      const res = await fetch(`${serverUrl}/api/invoices`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId: remoteShiftId,
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
