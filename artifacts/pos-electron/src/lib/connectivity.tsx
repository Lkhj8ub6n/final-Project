import React, { createContext, useContext, useEffect, useState } from "react";

interface ConnectivityContextValue {
  isOnline: boolean;
  pendingCount: number;
  syncStatus: string;
  triggerSync(): void;
}

const ConnectivityContext = createContext<ConnectivityContextValue>({
  isOnline: false,
  pendingCount: 0,
  syncStatus: "idle",
  triggerSync: () => {},
});

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState("idle");

  useEffect(() => {
    window.electronAPI.isOnline().then(setIsOnline).catch(() => {});

    const removeConnListener = window.electronAPI.onConnectivityChange((online) => {
      setIsOnline(online);
    });

    const removeSyncListener = window.electronAPI.onSyncStatus((status, count) => {
      setSyncStatus(status);
      setPendingCount(count);
    });

    const refreshPending = () => {
      window.electronAPI.getPendingCount().then(setPendingCount).catch(() => {});
    };
    refreshPending();

    const interval = setInterval(refreshPending, 30_000);

    return () => {
      removeConnListener();
      removeSyncListener();
      clearInterval(interval);
    };
  }, []);

  const triggerSync = () => {
    window.electronAPI.triggerSync().catch(() => {});
  };

  return (
    <ConnectivityContext.Provider value={{ isOnline, pendingCount, syncStatus, triggerSync }}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}
