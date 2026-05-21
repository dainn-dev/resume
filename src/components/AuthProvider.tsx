"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { SessionProvider, useSession, signOut as nextAuthSignOut } from "next-auth/react";
import type { AuthUser } from "@/lib/auth";
import { getAuthUser, loginUser, logoutUser } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  mounted: boolean;
  isAuthenticated: boolean;
  login: (name: string, email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  mounted: false,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [localUser, setLocalUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocalUser(getAuthUser());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const oauthUser: AuthUser = {
        name: session.user.name ?? "",
        email: session.user.email ?? "",
      };
      loginUser(oauthUser);
      setLocalUser(oauthUser);
    }
  }, [status, session]);

  const login = useCallback((name: string, email: string) => {
    const u: AuthUser = { name, email };
    loginUser(u);
    setLocalUser(u);
  }, []);

  const logout = useCallback(async () => {
    logoutUser();
    setLocalUser(null);
    if (status === "authenticated") {
      await nextAuthSignOut({ redirect: false });
    }
  }, [status]);

  const user = localUser;
  const oauthLoading = status === "loading";
  const isMounted = mounted && !oauthLoading;

  return (
    <AuthContext.Provider value={{ user, mounted: isMounted, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthContextProvider>{children}</AuthContextProvider>
    </SessionProvider>
  );
}
