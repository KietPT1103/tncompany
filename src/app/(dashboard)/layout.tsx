"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/AdminSidebar";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      sidebarCollapsed ? "1" : "0"
    );
  }, [sidebarCollapsed]);

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <AdminSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F8FAFC]">
          {children}
        </main>
      </div>
    </div>
  );
}
