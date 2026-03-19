import { useEffect, useState } from "react";
import Login from "./pages/login";
import POS from "./pages/pos";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { ConnectivityProvider } from "./lib/connectivity";
import "./lib/electron-api";

function AppInner() {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!user) {
    return <Login onLogin={() => {}} />;
  }

  return (
    <ConnectivityProvider>
      <POS />
    </ConnectivityProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
