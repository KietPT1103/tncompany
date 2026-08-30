"use client";

import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getOpenShiftByCashier } from "@/services/shiftService";

const SHIFT_ENABLED_STORES = new Set(["cafe", "restaurant", "bakery"]);
const SHIFT_EXEMPT_ADMIN_PATHS = [
  "/admin/product/checks",
  "/admin/product/issues",
  "/admin/product/receipts",
  "/admin/inventory-receipts",
];

export const isShiftExemptAdminPath = (pathname: string) =>
  SHIFT_EXEMPT_ADMIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

export default function CashierOpenShiftGuard() {
  const { user, role, loading: authLoading } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasOpenShift, setHasOpenShift] = useState(false);
  const [error, setError] = useState("");

  const mustHaveOpenShift =
    role === "user" &&
    !!user?.storeId &&
    SHIFT_ENABLED_STORES.has(user.storeId) &&
    !isShiftExemptAdminPath(location.pathname);

  const checkShift = useCallback(async () => {
    if (!mustHaveOpenShift || !user?.storeId || !user.uid) {
      setHasOpenShift(true);
      setChecking(false);
      setError("");
      return;
    }

    try {
      const shift = await getOpenShiftByCashier(user.storeId, user.uid);
      setHasOpenShift(!!shift);
      setError("");
    } catch (caughtError) {
      console.error("Không thể kiểm tra trạng thái ca", caughtError);
      setHasOpenShift(false);
      setError("Không thể kiểm tra trạng thái ca. Vui lòng thử lại.");
    } finally {
      setChecking(false);
    }
  }, [mustHaveOpenShift, user?.storeId, user?.uid]);

  useEffect(() => {
    void checkShift();
  }, [checkShift, location.pathname]);

  useEffect(() => {
    if (!mustHaveOpenShift) return;
    const interval = window.setInterval(() => void checkShift(), 15_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkShift();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [checkShift, mustHaveOpenShift]);

  if (authLoading || checking) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">Đang kiểm tra ca làm việc...</div>;
  }

  if (error) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="rounded-lg border border-rose-200 bg-white p-5 text-center shadow-sm"><p className="text-sm text-rose-700">{error}</p><button type="button" className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => void checkShift()}>Thử lại</button></div></div>;
  }

  if (mustHaveOpenShift && !hasOpenShift) {
    return <Navigate to="/pos" replace state={{ shiftRequired: true }} />;
  }

  return <Outlet />;
}
