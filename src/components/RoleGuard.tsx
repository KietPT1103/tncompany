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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600"></div>
      </div>
    );
  }

  if (!user) return null;

  if (!passesRoleCheck || !passesPermissionCheck) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Truy cập bị từ chối</h1>
          <p className="text-slate-600 mb-4">Bạn không có quyền truy cập trang này.</p>
          <button
            onClick={() => router.push(nextPath)}
            className="px-4 py-2 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
          >
            Quay lại khu vực được cấp quyền
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
