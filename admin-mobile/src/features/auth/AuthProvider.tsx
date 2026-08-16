import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AdminUser } from "@/types";
import { clearToken, getMe, getToken, login } from "@/services/api";

type AuthContextValue = {
  user: AdminUser | null;
  loading: boolean;
  signIn(loginName: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getToken()
      .then((token) => (token ? getMe().then(setUser) : undefined))
      .catch(clearToken)
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async signIn(loginName, password) {
        setUser(await login(loginName, password));
      },
      async signOut() {
        await clearToken();
        setUser(null);
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
