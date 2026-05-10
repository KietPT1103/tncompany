"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getDefaultRouteForUser,
  getPermissionForPath,
  hasAnyPermission,
} from "@/lib/permissions";
import type { AppPermission } from "@/types/auth";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  permission?: AppPermission | AppPermission[];
  inferPermission?: boolean;
}

export default function RoleGuard({
  children,
  allowedRoles = [],
  permission,
  inferPermission = true,
}: RoleGuardProps) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const requiredPermissions = Array.isArray(permission)
    ? permission
    : permission
    ? [permission]
    : inferPermission
    ? (() => {
        const inferredPermission = getPermissionForPath(pathname);
        return inferredPermission ? [inferredPermission] : [];
      })()
    : [];
  const requiresPermission = requiredPermissions.length > 0;
  const passesRoleCheck = !allowedRoles.length || (role ? allowedRoles.includes(role) : false);
  const passesPermissionCheck = !requiresPermission || hasAnyPermission(user, requiredPermissions);
  const nextPath = getDefaultRouteForUser(user);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) return null;

  if ((!requiresPermission && !passesRoleCheck) || !passesPermissionCheck) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Truy c?p b? t? ch?i</h1>
          <p className="text-slate-600 mb-4">B?n kh?ng c? quy?n truy c?p trang n?y.</p>
          <button
            onClick={() => router.push(nextPath)}
            className="px-4 py-2 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
          >
            Quay l?i khu v?c du?c cap quy?n
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
