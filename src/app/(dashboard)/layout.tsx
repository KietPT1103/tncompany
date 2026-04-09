"use client";

import { useEffect, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import AdminSidebar from "@/AdminSidebar";
import { useAuth } from "@/context/AuthContext";

const SIDEBAR_STORAGE_KEY = "admin_sidebar_collapsed";

function getInitialSidebarCollapsed() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);

  useEffect(() => {
    if (typeof window === "undefined") return;
        window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      sidebarCollapsed ? "1" : "0"
    );
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (role === "manager") {
      setSidebarCollapsed(false);
    }
  }, [role]);

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {sidebarCollapsed && role !== "manager" ? (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="absolute left-4 top-4 z-20 hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50 lg:inline-flex"
            aria-label="Hiện sidebar"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        ) : null}

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F8FAFC]">
          {children}
        </main>
      </div>
    </div>
  );
}
