import { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme } from "electron";
import path from "path";

// Fix for Linux GTK 2/3 vs GTK 4 symbol crash
if (process.platform === "linux") {
  process.env.GDK_BACKEND = "x11";
  app.commandLine.appendSwitch("disable-gpu");
}
import {
  getConfig, setConfig,
  getLocalProducts, upsertProducts, decrementLocalStock,
  getCurrentLocalShift, openLocalShift, closeLocalShift,
  createPendingInvoice, getPendingInvoiceCount,
  type LocalProduct,
} from "./db";
import { syncAll, onSyncStatusChange } from "./sync";
import { setupAutoUpdater, installUpdate } from "./updater";

interface CreateInvoicePayload {
  shiftId: number;
  items: Array<{
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    itemType: string;
  }>;
  discountAmount?: number;
  paymentMethod: "cash" | "card";
}

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let authToken: string | null = null;
let isOnline = false;
let syncTimer: ReturnType<typeof setInterval> | null = null;

async function checkOnline(): Promise<boolean> {
  const serverUrl = getConfig("server_url");
  if (!serverUrl) return false;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${serverUrl}/api/healthz`, { signal: ctrl.signal });
    clearTimeout(timeout);
    const ok = res.ok;
    console.log(`[Connectivity] Check ${serverUrl}/api/healthz -> Status: ${res.status} (${ok ? "OK" : "Failed"})`);
    return ok;
  } catch (err) {
    console.error(`[Connectivity] Error checking ${serverUrl}/api/health:`, err instanceof Error ? err.message : err);
    return false;
  }
}

async function updateConnectivity(): Promise<void> {
  const prev = isOnline;
  isOnline = await checkOnline();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("connectivity:change", isOnline);
  }
  if (!prev && isOnline && authToken) {
    syncAll(authToken).catch(() => {});
  }
}

function createWindow(): void {
  nativeTheme.themeSource = "light";

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: "LibraryOS POS",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    frame: true,
    backgroundColor: "#f8f9fa",
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5174");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "dist/renderer/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (!isDev) {
    setupAutoUpdater(mainWindow);
  }
}

app.whenReady().then(() => {
  const storedToken = getConfig("auth_token");
  if (storedToken) authToken = storedToken;

  createWindow();

  setInterval(() => { updateConnectivity().catch(() => {}); }, 15_000);
  updateConnectivity().catch(() => {});

  syncTimer = setInterval(() => {
    if (isOnline && authToken) {
      syncAll(authToken).catch(() => {});
    }
  }, 5 * 60_000);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (syncTimer) clearInterval(syncTimer);
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("connectivity:check", async () => {
  isOnline = await checkOnline();
  return isOnline;
});

ipcMain.handle("config:get", (_event, key: string) => {
  return getConfig(key);
});

ipcMain.handle("config:set", (_event, key: string, value: string) => {
  setConfig(key, value);
});

ipcMain.handle("auth:login", async (_event, username: string, password: string, serverUrl: string) => {
  const url = serverUrl.replace(/\/$/, "");
  setConfig("server_url", url);
  try {
    const res = await fetch(`${url}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role: "cashier" }),
    });
    const data = (await res.json()) as { token?: string; user?: unknown; error?: string };
    if (!res.ok) return { error: data.error ?? "Login failed" };
    authToken = data.token ?? null;
    if (authToken) {
      setConfig("auth_token", authToken);
      syncAll(authToken).catch(() => {});
    }
    return { user: data.user, token: data.token };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Cannot reach server" };
  }
});

ipcMain.handle("auth:logout", () => {
  authToken = null;
  setConfig("auth_token", "");
});

ipcMain.handle("products:list", (_event, search?: string) => {
  return getLocalProducts(search);
});

ipcMain.handle("products:sync", async () => {
  if (!isOnline || !authToken) return { error: "Offline" };
  const serverUrl = getConfig("server_url") ?? "";
  try {
    const res = await fetch(`${serverUrl}/api/products?limit=1000`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const data = (await res.json()) as Array<{
      id: number; name: string; barcode?: string; price: string;
      stockQuantity?: number; stockAlertThreshold?: number; category?: string; isActive?: boolean;
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
    return { count: products.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sync failed" };
  }
});

ipcMain.handle("shifts:current", async () => {
  if (isOnline && authToken) {
    const serverUrl = getConfig("server_url") ?? "";
    try {
      const res = await fetch(`${serverUrl}/api/shifts/current`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 404) return null;
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        return { ...data, source: "remote" };
      }
    } catch {}
  }
  const localShift = getCurrentLocalShift();
  if (!localShift) return null;
  return { ...localShift, source: "local" };
});

ipcMain.handle("shifts:open", async (_event, openingBalance: number) => {
  if (isOnline && authToken) {
    const serverUrl = getConfig("server_url") ?? "";
    const res = await fetch(`${serverUrl}/api/shifts/open`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ openingBalance }),
    });
    const data = (await res.json()) as { id?: number; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to open shift");
    const local = openLocalShift(openingBalance);
    if (data.id) {
      const { getDb } = await import("./db");
      getDb().prepare("UPDATE local_shifts SET remote_id = ?, is_synced = 1 WHERE id = ?").run(data.id, local.id);
    }
    return { ...data, source: "remote", localId: local.id };
  }
  return { ...openLocalShift(openingBalance), source: "local" };
});

ipcMain.handle("shifts:close", async (_event, shiftId: number, closingBalance: number, isRemote: boolean) => {
  if (isOnline && authToken && isRemote) {
    const serverUrl = getConfig("server_url") ?? "";
    const res = await fetch(`${serverUrl}/api/shifts/${shiftId}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ closingBalance }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to close shift");
    const localMirror = getCurrentLocalShift();
    if (localMirror) closeLocalShift(localMirror.id, closingBalance);
    return data;
  }
  return closeLocalShift(shiftId, closingBalance);
});

ipcMain.handle("shifts:details", async (_event, shiftId: number, isRemote: boolean) => {
  if (isOnline && authToken && isRemote) {
    const serverUrl = getConfig("server_url") ?? "";
    const res = await fetch(`${serverUrl}/api/shifts/${shiftId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) return await res.json();
  }
  return null;
});

ipcMain.handle("invoices:create", async (_event, invoiceData: CreateInvoicePayload) => {
  const { items, discountAmount, paymentMethod } = invoiceData;
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discAmt = discountAmount ?? 0;
  const total = Math.max(0, subtotal - discAmt);

  const saveLocal = (): { id: string; total: number; offline: boolean } => {
    const currentShift = getCurrentLocalShift();
    const pending = createPendingInvoice({
      localShiftId: currentShift?.id ?? null,
      remoteShiftId: currentShift?.remoteId ?? null,
      items: items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        itemType: i.itemType,
      })),
      subtotal, discountAmount: discAmt, total, paymentMethod,
    });
    for (const item of items) {
      if (item.itemType === "product") decrementLocalStock(item.productId, item.quantity);
    }
    return { id: `LOCAL-${pending.id}`, total, offline: true };
  };

  if (isOnline && authToken) {
    const serverUrl = getConfig("server_url") ?? "";
    let res: Response;
    try {
      res = await fetch(`${serverUrl}/api/invoices`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(invoiceData),
      });
    } catch {
      isOnline = false;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("connectivity:change", false);
      }
      return saveLocal();
    }
    const data = (await res.json()) as { id?: number; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Failed to create invoice");
    for (const item of items) {
      if (item.itemType === "product") decrementLocalStock(item.productId, item.quantity);
    }
    return { ...data, offline: false };
  }

  return saveLocal();
});

ipcMain.handle("invoices:pending-count", () => {
  return getPendingInvoiceCount();
});

ipcMain.handle("invoices:get", async (_event, invoiceId: number) => {
  if (isOnline && authToken) {
    const serverUrl = getConfig("server_url") ?? "";
    try {
      const res = await fetch(`${serverUrl}/api/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) return await res.json();
    } catch {}
  }
  return null;
});

ipcMain.handle("invoices:list", async (_event, shiftId: number) => {
  if (isOnline && authToken) {
    const serverUrl = getConfig("server_url") ?? "";
    try {
      const res = await fetch(`${serverUrl}/api/invoices?shiftId=${shiftId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) return await res.json();
    } catch {}
  }
  return [];
});

ipcMain.handle("returns:create", async (_event, data: unknown) => {
  if (isOnline && authToken) {
    const serverUrl = getConfig("server_url") ?? "";
    const res = await fetch(`${serverUrl}/api/returns`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(result.error ?? "Failed to create return");
  } else {
    throw new Error("Must be online to create returns");
  }
});

ipcMain.handle("print:receipt", async (_event, receiptHtml: string) => {
  if (!mainWindow) return;
  const printWin = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } });
  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(receiptHtml)}`);
  printWin.webContents.print({ silent: true, printBackground: true }, (success, reason) => {
    if (!success) {
      dialog.showErrorBox("خطأ في الطباعة", reason ?? "فشلت عملية الطباعة");
    }
    printWin.destroy();
  });
});

ipcMain.handle("sync:trigger", async () => {
  if (!isOnline || !authToken) return { error: "Offline" };
  await syncAll(authToken);
  return { ok: true };
});

ipcMain.handle("update:install", () => {
  installUpdate();
});

onSyncStatusChange((status, pendingCount) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("sync:status", { status, pendingCount });
  }
});
