"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export default function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) return null;

  if (role && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Truy c?p b? t? ch?i</h1>
          <p className="text-slate-600 mb-4">B?n kh?ng c? quy?n truy c?p trang n?y.</p>
          <button
            onClick={() =>
              router.push(role === "user" || role === "server" ? "/pos" : "/")
            }
            className="px-4 py-2 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
          >
            Quay l?i {role === "user" || role === "server" ? "POS" : "Trang ch?"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
