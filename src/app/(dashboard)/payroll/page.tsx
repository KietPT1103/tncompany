"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Users, FileSpreadsheet, ArrowLeft, Wallet, Menu, ChevronLeft, ChevronRight } from "lucide-react";
import EmployeeManager from "./_components/EmployeeManager";
import PayrollManager from "./_components/PayrollManager";
import PayrollDetail from "./_components/PayrollDetail";
import Link from "next/link";

export default function PayrollPage() {
  const { user, role, loading } = useAuth();
  const { storeId, storeName } = useStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"employee" | "payroll">("payroll");
  const [selectedPayrollId, setSelectedPayrollId] = useState<string | null>(
    null
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Auto-collapse sidebar when viewing details
  useEffect(() => {
    if (selectedPayrollId) {
      setIsSidebarOpen(false);
    } else {
        setIsSidebarOpen(true);
    }
  }, [selectedPayrollId]);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (role !== "admin") {
        router.push("/pos");
      }
    }
  }, [user, role, loading, router]);

  if (loading || !user || !storeId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5 text-slate-500" />
              </Button>
            </Link>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                Quản lý lương
              </h1>
              <span className="text-xs text-slate-500 font-medium ml-7">
                {storeName}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row gap-6 relative transition-all duration-300">
          {/* Sidebar / Tabs */}
          <aside 
            className={`space-y-2 transition-all duration-300 ease-in-out border-r md:border-r-0 md:pr-4 ${
              isSidebarOpen ? "w-full md:w-64 opacity-100" : "w-0 opacity-0 overflow-hidden md:pr-0"
            }`}
          >
            <div className="flex items-center justify-between md:hidden mb-2">
                <span className="text-sm font-bold text-slate-500">Menu</span>
                <Button variant="ghost" size="sm" onClick={() => setIsSidebarOpen(false)}>
                    <ChevronLeft className="w-4 h-4" />
                </Button>
            </div>

            <button
              onClick={() => {
                setActiveTab("payroll");
                setSelectedPayrollId(null);
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 font-medium transition-colors whitespace-nowrap ${
                activeTab === "payroll"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "hover:bg-white hover:shadow-sm text-slate-600"
              }`}
            >
              <FileSpreadsheet className="w-5 h-5 shrink-0" />
              Bảng lương
            </button>
            <button
              onClick={() => {
                 setActiveTab("employee");
                 if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 font-medium transition-colors whitespace-nowrap ${
                activeTab === "employee"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "hover:bg-white hover:shadow-sm text-slate-600"
              }`}
            >
              <Users className="w-5 h-5 shrink-0" />
              Nhân viên
            </button>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
             {/* Toggle Sidebar Button (Desktop) */}
            <div className="mb-4 flex items-center gap-2">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                    title={isSidebarOpen ? "Thu gọn menu" : "Mở menu"}
                >
                    {isSidebarOpen ? <ChevronLeft /> : <Menu />}
                </Button>
                {!isSidebarOpen && selectedPayrollId && (
                     <Button 
                        variant="link" 
                        onClick={() => setSelectedPayrollId(null)}
                        className="text-slate-500 hover:text-emerald-600 pl-0 gap-1"
                    >
                        <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
                    </Button>
                )}
            </div>

            {activeTab === "employee" ? (
              <EmployeeManager storeId={storeId} />
            ) : (
              <>
                {selectedPayrollId ? (
                  <PayrollDetail
                    payrollId={selectedPayrollId}
                    onBack={() => setSelectedPayrollId(null)}
                  />
                ) : (
                  <PayrollManager
                    storeId={storeId}
                    onSelectPayroll={setSelectedPayrollId}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
