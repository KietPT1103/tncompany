"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, firebaseConfigReady } from "@/lib/firebase";
import { useRouter } from "next/navigation";

type Role = "admin" | "user" | "server";

const inferRoleFromEmail = (email?: string | null): Role => {
  const normalized = (email || "").trim().toLowerCase();
  if (normalized.endsWith("@service.local")) return "server";
  if (normalized.endsWith("@cashier.local")) return "user";
  return "user";
};

interface AuthContextType {
  user: User | null;
  role: Role | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!firebaseConfigReady || !auth || !db) {
      setUser(null);
      setRole(null);
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        try {
          // Fetch role from Firestore
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const storedRole = userDoc.data().role;
            if (storedRole === "admin" || storedRole === "user" || storedRole === "server") {
              setRole(storedRole);
            } else {
              setRole(inferRoleFromEmail(currentUser.email));
            }
          } else {
            // Fallback by account identity if user document is not ready yet.
            console.log("No user document found, inferring role from account email");
            setRole(inferRoleFromEmail(currentUser.email));
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setRole(inferRoleFromEmail(currentUser.email));
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    if (!auth) {
      router.push("/login");
      return;
    }

    await signOut(auth);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
