import { app, BrowserWindow, ipcMain, shell, dialog, nativeTheme } from "electron";
import path from "path";
import {
  getConfig, setConfig,
  getLocalProducts, upsertProducts, decrementLocalStock,
  getCurrentLocalShift, openLocalShift, closeLocalShift,
  createPendingInvoice, getPendingInvoiceCount,
  type LocalProduct,
} from "./db";
import { syncAll, onSyncStatusChange } from "./sync";
import { setupAutoUpdater, installUpdate } from "./updater";

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
    const res = await fetch(`${serverUrl}/api/health`, { signal: ctrl.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
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
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
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
    const data = (await res.json()) as any;
    if (!res.ok) return { error: data.error ?? "Login failed" };
    authToken = data.token as string;
    syncAll(authToken).catch(() => {});
    return { user: data.user, token: data.token };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Cannot reach server" };
  }
});

ipcMain.handle("auth:logout", () => {
  authToken = null;
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
    const data = (await res.json()) as any[];
    const products: LocalProduct[] = data.map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode ?? null,
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
      if (res.ok) return await res.json();
    } catch {}
  }
  return getCurrentLocalShift();
});

ipcMain.handle("shifts:open", async (_event, openingBalance: number) => {
  if (isOnline && authToken) {
    const serverUrl = getConfig("server_url") ?? "";
    try {
      const res = await fetch(`${serverUrl}/api/shifts/open`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ openingBalance }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const local = openLocalShift(openingBalance);
      if (data.id) {
        const db = (await import("./db")).getDb();
        db.prepare("UPDATE local_shifts SET remote_id = ?, is_synced = 1 WHERE id = ?").run(data.id, local.id);
      }
      return { ...data, localId: local.id };
    } catch (err) {
      throw err;
    }
  }
  return openLocalShift(openingBalance);
});

ipcMain.handle("shifts:close", async (_event, shiftId: number, closingBalance: number, isRemote: boolean) => {
  if (isOnline && authToken && isRemote) {
    const serverUrl = getConfig("server_url") ?? "";
    const res = await fetch(`${serverUrl}/api/shifts/${shiftId}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ closingBalance }),
    });
    const data = await res.json() as any;
    if (!res.ok) throw new Error(data.error ?? "Failed");
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

ipcMain.handle("invoices:create", async (_event, invoiceData: any) => {
  const items = invoiceData.items as Array<{ productId: number; quantity: number; unitPrice: number; productName: string; itemType: string }>;
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountAmount = invoiceData.discountAmount ?? 0;
  const total = Math.max(0, subtotal - discountAmount);

  if (isOnline && authToken) {
    const serverUrl = getConfig("server_url") ?? "";
    try {
      const res = await fetch(`${serverUrl}/api/invoices`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(invoiceData),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error ?? "Failed");
      for (const item of items) {
        if (item.itemType === "product") decrementLocalStock(item.productId, item.quantity);
      }
      return { ...data, offline: false };
    } catch (err) {
      throw err;
    }
  }

  const currentShift = getCurrentLocalShift();
  const pending = createPendingInvoice({
    localShiftId: currentShift?.id ?? null,
    remoteShiftId: currentShift?.remoteId ?? null,
    items: items.map((i) => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, itemType: i.itemType })),
    subtotal,
    discountAmount,
    total,
    paymentMethod: invoiceData.paymentMethod,
  });
  for (const item of items) {
    if (item.itemType === "product") decrementLocalStock(item.productId, item.quantity);
  }
  return { id: `LOCAL-${pending.id}`, total, offline: true };
});

ipcMain.handle("invoices:pending-count", () => {
  return getPendingInvoiceCount();
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
