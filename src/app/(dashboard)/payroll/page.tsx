"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Clock3, FileSpreadsheet, Users } from "lucide-react";
import { useLocation } from "react-router-dom";
import EmployeeManager from "./_components/EmployeeManager";
import PayrollManager from "./_components/PayrollManager";
import PayrollDetail from "./_components/PayrollDetail";
import RoleStartTimeManager from "./_components/RoleStartTimeManager";

type PayrollTab = "employee" | "payroll" | "roleStartTime";

const tabs = [
  { id: "payroll" as const, label: "Bảng lương", icon: FileSpreadsheet },
  { id: "employee" as const, label: "Nhân sự", icon: Users },
  { id: "roleStartTime" as const, label: "Gi\u1edd vào theo vị trí", icon: Clock3 },
];

export default function PayrollPage() {
  const { user, role, loading } = useAuth();
  const { storeId, storeName } = useStore();
  const router = useRouter();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<PayrollTab>("payroll");
  const [selectedPayrollId, setSelectedPayrollId] = useState<string | null>(null);
  const [employeeRefreshKey, setEmployeeRefreshKey] = useState(0);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      }
    }
  }, [loading, router, user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openPayrollId = params.get("openPayroll");
    if (openPayrollId) {
      setActiveTab("payroll");
      setSelectedPayrollId(openPayrollId);
    }
  }, [location.search]);

  if (loading || !user || !storeId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="mx-auto max-w-screen-2xl space-y-5 p-3 sm:p-5 lg:p-6">
        <header className="border-b border-slate-200 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-950 sm:text-2xl">Tính lương</h1>
              <p className="mt-1 text-sm text-slate-500">
                Quản lý kỳ lương và nhân sự tại{" "}
                <span className="font-medium text-slate-700">{storeName}</span>
              </p>
            </div>

            <div
              className="inline-flex w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-1 lg:w-auto"
              role="tablist"
              aria-label="Quản lý lương"
            >
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id !== "payroll") setSelectedPayrollId(null);
                    }}
                    role="tab"
                    aria-selected={isActive}
                    className={cn(
                      "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1",
                      isActive
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {activeTab === "employee" ? (
          <EmployeeManager storeId={storeId} refreshKey={employeeRefreshKey} />
        ) : activeTab === "roleStartTime" ? (
          <RoleStartTimeManager storeId={storeId} />
        ) : selectedPayrollId ? (
          <PayrollDetail
            payrollId={selectedPayrollId}
            onBack={() => setSelectedPayrollId(null)}
            onEmployeesChanged={() => setEmployeeRefreshKey((current) => current + 1)}
          />
        ) : (
          <PayrollManager storeId={storeId} onSelectPayroll={setSelectedPayrollId} />
        )}
      </div>
    </div>
  );
}