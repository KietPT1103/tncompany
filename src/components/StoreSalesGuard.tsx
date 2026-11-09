import type { ReactNode } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";

/** Keep historical selection available without mounting a sales screen for a closed store. */
export default function StoreSalesGuard({ children }: { children: ReactNode }) {
  const { storeId, activeStores, storesLoading, storesError, refreshStores } = useStore();
  const { user } = useAuth();
  const salesStoreId = ["user", "server", "bartender"].includes(user?.role || "") ? user?.storeId : storeId;
  if (storesLoading) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Đang tải thông tin quầy...</div>;
  if (!activeStores.some(item => item.id === salesStoreId)) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold text-emerald-950">Quầy không khả dụng</h1><p role="alert" className="mt-3 text-sm text-slate-600">{storesError || "Quầy đã ngừng hoạt động hoặc bị xoá. Bạn vẫn có thể xem dữ liệu lịch sử trong trang quản trị."}</p><div className="mt-6 flex justify-center gap-4"><button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => void refreshStores()}>Thử lại</button><Link href="/admin" className="text-sm font-semibold text-emerald-700">Về trang quản trị</Link></div></div></div>;
  }
  return <>{children}</>;
}
