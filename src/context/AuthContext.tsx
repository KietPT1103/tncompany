"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearApiToken, fetchCurrentUser, getApiToken, logoutApi } from "@/lib/api";
import { AppUser, normalizeUserRole, UserRole } from "@/types/auth";

type AuthContextType = {
  user: AppUser | null;
  role: UserRole | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  refreshUser: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = async () => {
    if (!getApiToken()) {
      setUser(null);
      setRole(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { user: currentUser } = await fetchCurrentUser();
      const normalizedRole = normalizeUserRole(currentUser);
      setUser(
        normalizedRole
          ? {
              ...currentUser,
              role: normalizedRole,
            }
          : currentUser
      );
      setRole(normalizedRole);
    } catch {
      clearApiToken();
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const logout = async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore logout API failures and clear the local session anyway.
    }

    clearApiToken();
    setUser(null);
    setRole(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
