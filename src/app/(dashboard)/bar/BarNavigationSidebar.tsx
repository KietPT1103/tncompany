"use client";

import Link from "next/link";
import { Coffee, History, LogOut } from "lucide-react";
import DashboardSidebarShell from "@/components/dashboard/DashboardSidebarShell";
import { useAuth } from "@/context/AuthContext";
import { getNextBarSidebarCollapsed } from "./barSidebarState";

type BarNavigationSidebarProps = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onOpenHistory: () => void;
};

export default function BarNavigationSidebar({
  collapsed,
  onCollapsedChange,
  onOpenHistory,
}: BarNavigationSidebarProps) {
  const { logout } = useAuth();
  const itemClassName = (active = false) =>
    `group flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold transition-[background-color,color,transform,box-shadow] duration-150 ease-out hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] active:scale-[0.96] motion-reduce:transition-none ${
      collapsed ? "lg:justify-center lg:px-0" : ""
    } ${
      active
        ? "bg-[#F6C85F] text-[#063B2E] shadow-[0_2px_6px_rgba(0,35,25,0.2)]"
        : "text-[#D7EEE6] hover:bg-white/[0.08] hover:text-white"
    }`;

  return (
    <DashboardSidebarShell
      collapsed={collapsed}
      desktopPosition="fixed"
      mobileHeaderLabel="Thanh điều hướng pha chế"
      mobileMenuLabel="menu pha chế"
      onToggleCollapsed={() =>
        onCollapsedChange(getNextBarSidebarCollapsed(collapsed))
      }
      sidebarId="bar-navigation-sidebar"
      sidebarLabel="Điều hướng pha chế"
    >
      {({ closeMobileMenu }) => (
        <>
          <nav
            id="bar-navigation-menu"
            aria-label="Menu pha chế"
            className={`flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-3 py-3 ${
              collapsed ? "lg:px-2" : ""
            }`}
          >
            <Link
              href="/bar"
              onClick={closeMobileMenu}
              aria-current="page"
              title={collapsed ? "Vận hành pha chế" : undefined}
              className={itemClassName(true)}
            >
              <Coffee className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span
                className={collapsed ? "truncate lg:sr-only" : "truncate"}
              >
                Vận hành pha chế
              </span>
            </Link>

            <button
              type="button"
              onClick={() => {
                closeMobileMenu();
                onOpenHistory();
              }}
              title={collapsed ? "Lịch sử đã lấy" : undefined}
              className={itemClassName()}
            >
              <History className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span
                className={collapsed ? "truncate lg:sr-only" : "truncate"}
              >
                Lịch sử đã lấy
              </span>
            </button>
          </nav>

          <div
            className={`border-t border-white/10 p-2.5 ${
              collapsed ? "lg:p-2" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => {
                closeMobileMenu();
                void logout();
              }}
              title={collapsed ? "Đăng xuất" : undefined}
              className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-[#F6C85F] transition-[background-color,color,transform] duration-150 ease-out hover:bg-[#F6C85F] hover:text-[#063B2E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#063B2E] active:scale-[0.96] motion-reduce:transition-none ${
                collapsed ? "lg:justify-center lg:px-0" : ""
              }`}
            >
              <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className={collapsed ? "lg:sr-only" : ""}>
                Đăng xuất
              </span>
            </button>
          </div>
        </>
      )}
    </DashboardSidebarShell>
  );
}
