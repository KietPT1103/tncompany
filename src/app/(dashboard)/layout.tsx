"use client";

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
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
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);
  const isCashierBillsPage =
    role === "user" && location.pathname.replace(/\/+$/, "") === "/admin/bills";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      sidebarCollapsed ? "1" : "0"
    );
  }, [sidebarCollapsed]);

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {!isCashierBillsPage && (
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        />
      )}

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <main
          className={`flex-1 overflow-x-hidden overflow-y-auto bg-[#F8FAFC] ${
            isCashierBillsPage ? "pt-0" : "pt-16 lg:pt-0"
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
