import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isOnline: (): Promise<boolean> =>
    ipcRenderer.invoke("connectivity:check"),

  onConnectivityChange: (cb: (online: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, online: boolean) => cb(online);
    ipcRenderer.on("connectivity:change", listener);
    return () => ipcRenderer.removeListener("connectivity:change", listener);
  },

  getConfig: (key: string): Promise<string | null> =>
    ipcRenderer.invoke("config:get", key),

  setConfig: (key: string, value: string): Promise<void> =>
    ipcRenderer.invoke("config:set", key, value),

  login: (username: string, password: string, serverUrl: string): Promise<{ user?: unknown; token?: string; error?: string }> =>
    ipcRenderer.invoke("auth:login", username, password, serverUrl),

  logout: (): Promise<void> =>
    ipcRenderer.invoke("auth:logout"),

  getProducts: (search?: string): Promise<unknown[]> =>
    ipcRenderer.invoke("products:list", search),

  syncProducts: (): Promise<unknown> =>
    ipcRenderer.invoke("products:sync"),

  getCurrentShift: (): Promise<unknown> =>
    ipcRenderer.invoke("shifts:current"),

  openShift: (openingBalance: number): Promise<unknown> =>
    ipcRenderer.invoke("shifts:open", openingBalance),

  closeShift: (shiftId: number, closingBalance: number, isRemote: boolean): Promise<unknown> =>
    ipcRenderer.invoke("shifts:close", shiftId, closingBalance, isRemote),

  getShiftDetails: (shiftId: number, isRemote: boolean): Promise<unknown> =>
    ipcRenderer.invoke("shifts:details", shiftId, isRemote),

  createInvoice: (data: unknown): Promise<unknown> =>
    ipcRenderer.invoke("invoices:create", data),

  getPendingCount: (): Promise<number> =>
    ipcRenderer.invoke("invoices:pending-count"),

  printReceipt: (receiptHtml: string): Promise<void> =>
    ipcRenderer.invoke("print:receipt", receiptHtml),

  triggerSync: (): Promise<unknown> =>
    ipcRenderer.invoke("sync:trigger"),

  onSyncStatus: (cb: (status: string, pendingCount: number) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { status: string; pendingCount: number }) =>
      cb(data.status, data.pendingCount);
    ipcRenderer.on("sync:status", listener);
    return () => ipcRenderer.removeListener("sync:status", listener);
  },

  installUpdate: (): void => {
    ipcRenderer.invoke("update:install");
  },

  onUpdateStatus: (cb: (status: string, data?: unknown) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { status: string; data?: unknown }) =>
      cb(payload.status, payload.data);
    ipcRenderer.on("update:status", listener);
    return () => ipcRenderer.removeListener("update:status", listener);
  },
});
