import React, { createContext, useContext, useState, useEffect } from "react";

export interface StoreUser {
  id: number;
  name: string;
  username: string;
  role: string;
  tenantId: number | null;
  tenantName: string | null;
  tenantSlug: string | null;
}

interface StoreAuthContextType {
  student: StoreUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: StoreUser) => void;
  logout: () => void;
}

const StoreAuthContext = createContext<StoreAuthContextType | undefined>(undefined);

export function StoreAuthProvider({ children }: { children: React.ReactNode }) {
  const [student, setStudent] = useState<StoreUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("store_token");
    const storedUser = localStorage.getItem("store_user");
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setStudent(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("store_token");
        localStorage.removeItem("store_user");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: StoreUser) => {
    localStorage.setItem("store_token", newToken);
    localStorage.setItem("store_user", JSON.stringify(newUser));
    setToken(newToken);
    setStudent(newUser);
  };

  const logout = () => {
    localStorage.removeItem("store_token");
    localStorage.removeItem("store_user");
    setToken(null);
    setStudent(null);
  };

  return (
    <StoreAuthContext.Provider value={{ student, token, isAuthenticated: !!student, isLoading, login, logout }}>
      {children}
    </StoreAuthContext.Provider>
  );
}

export function useStoreAuth() {
  const context = useContext(StoreAuthContext);
  if (!context) throw new Error("useStoreAuth must be used within StoreAuthProvider");
  return context;
}
