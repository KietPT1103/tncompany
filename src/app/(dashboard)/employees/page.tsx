"use client";

import { Users } from "lucide-react";

import { useStore } from "@/context/StoreContext";
import EmployeeManager from "../payroll/_components/EmployeeManager";

export default function EmployeesPage() {
  const { storeId, storeName } = useStore();

  if (!storeId) return null;

  return (
    <main className="min-h-full bg-slate-50/80">
      <div className="mx-auto max-w-screen-2xl space-y-5 p-3 sm:p-5 lg:p-6">
        <header className="border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-[#F6C85F] shadow-sm">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-emerald-900 sm:text-4xl">
                Nhân sự
              </h1>
              <p className="mt-1 text-sm font-semibold text-[#B99128]">
                Quản lý nhân viên và vai trò tại{" "}
                <span className="text-emerald-800">{storeName}</span>
              </p>
            </div>
          </div>
        </header>

        <EmployeeManager storeId={storeId} />
      </div>
    </main>
  );
}
