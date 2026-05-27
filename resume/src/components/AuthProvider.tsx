"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AuthUser } from "@/lib/auth";
import { getAuthUser, logoutRequest } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  mounted: boolean;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  mounted: false,
  isAuthenticated: false,
  setUser: () => {},
  logout: async () => {},
  refresh: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  const refresh = useCallback(() => {
    setUserState(getAuthUser());
  }, []);

  useEffect(() => {
    refresh();
    setMounted(true);
  }, [refresh]);

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, mounted, isAuthenticated: !!user, setUser, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
