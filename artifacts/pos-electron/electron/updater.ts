import { autoUpdater } from "electron-updater";
import { BrowserWindow, app } from "electron";

export function setupAutoUpdater(win: BrowserWindow): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true;
  }

  autoUpdater.on("checking-for-update", () => {
    sendStatus(win, "checking");
  });

  autoUpdater.on("update-available", (info) => {
    sendStatus(win, "available", info);
  });

  autoUpdater.on("update-not-available", () => {
    sendStatus(win, "not-available");
  });

  autoUpdater.on("download-progress", (progress) => {
    sendStatus(win, "progress", progress);
  });

  autoUpdater.on("update-downloaded", (info) => {
    sendStatus(win, "downloaded", info);
  });

  autoUpdater.on("error", (err) => {
    sendStatus(win, "error", { message: err.message });
  });

  setInterval(() => {
    autoUpdater.checkForUpdates().catch((e: unknown) => {
      console.warn("Auto-update check failed:", e instanceof Error ? e.message : e);
    });
  }, 4 * 60 * 60 * 1000);

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((e: unknown) => {
      console.warn("Auto-update check failed:", e instanceof Error ? e.message : e);
    });
  }, 10_000);
}

function sendStatus(win: BrowserWindow, status: string, data?: unknown): void {
  if (!win.isDestroyed()) {
    win.webContents.send("update:status", { status, data });
  }
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall();
}
