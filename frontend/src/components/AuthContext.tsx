import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearApiCache } from "../api/client";
import type { CurrentUser } from "../api/types";

type AuthContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  login: (account: string, password: string) => Promise<CurrentUser>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const token = localStorage.getItem("qingfeng_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<never, CurrentUser>("/auth/me");
      setUser(me);
    } catch {
      localStorage.removeItem("qingfeng_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refresh,
      login: async (account, password) => {
        const data = await api.post<never, { token: string; user: CurrentUser }>("/auth/login", { account, password });
        clearApiCache();
        localStorage.setItem("qingfeng_token", data.token);
        setUser(data.user);
        return data.user;
      },
      logout: () => {
        clearApiCache();
        localStorage.removeItem("qingfeng_token");
        setUser(null);
      }
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
