"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ArrowLeft, FileSpreadsheet, Users } from "lucide-react";
import { useLocation } from "react-router-dom";
import EmployeeManager from "./_components/EmployeeManager";
import PayrollManager from "./_components/PayrollManager";
import PayrollDetail from "./_components/PayrollDetail";

type PayrollTab = "employee" | "payroll";

const tabs = [
  { id: "payroll" as const, label: "Bảng lương", icon: FileSpreadsheet },
  { id: "employee" as const, label: "Nhân sự", icon: Users },
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
      } else if (role !== "admin") {
        router.push("/pos");
      }
    }
  }, [loading, role, router, user]);

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
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-screen-2xl space-y-5 p-4 lg:p-6">
        <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <Button
                type="button"
                variant="ghost"
                className="h-10 gap-2 px-0 text-slate-500"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại
              </Button>
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">Tính lương</h1>
                <p className="mt-1 text-sm text-slate-500">{storeName}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
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
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition",
                      isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {activeTab === "employee" ? (
          <EmployeeManager storeId={storeId} refreshKey={employeeRefreshKey} />
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
