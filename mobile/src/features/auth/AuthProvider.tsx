import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearToken, getMe, getToken, login as loginApi } from "@/services/api";
import type { AppUser } from "@/types";

type AuthValue = {
  user: AppUser | null;
  loading: boolean;
  signIn(login: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getToken().then((token) => token ? getMe().then((data) => setUser(data.user)) : undefined)
      .catch(clearToken).finally(() => setLoading(false));
  }, []);
  const value = useMemo<AuthValue>(() => ({
    user, loading,
    async signIn(login, password) { setUser(await loginApi(login, password)); },
    async signOut() { await clearToken(); setUser(null); }
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be inside AuthProvider");
  return value;
}
