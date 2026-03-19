import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "./electron-api";

interface AuthState {
  user: User | null;
  token: string | null;
  serverUrl: string | null;
}

interface AuthContextValue extends AuthState {
  login(username: string, password: string, serverUrl: string): Promise<string | null>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ user: null, token: null, serverUrl: null });

  useEffect(() => {
    const stored = localStorage.getItem("pos_auth");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthState;
        setAuth(parsed);
      } catch {}
    }
  }, []);

  const login = async (username: string, password: string, serverUrl: string): Promise<string | null> => {
    const result = await window.electronAPI.login(username, password, serverUrl);
    if (result.error) return result.error;
    const newAuth: AuthState = {
      user: result.user as User,
      token: result.token ?? null,
      serverUrl,
    };
    setAuth(newAuth);
    localStorage.setItem("pos_auth", JSON.stringify(newAuth));
    return null;
  };

  const logout = () => {
    window.electronAPI.logout();
    setAuth({ user: null, token: null, serverUrl: null });
    localStorage.removeItem("pos_auth");
  };

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
