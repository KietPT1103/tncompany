"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChefHat,
  Coffee,
  History,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  BAR_SIDEBAR_STORAGE_KEY,
  getInitialBarSidebarCollapsed,
  getNextBarSidebarCollapsed,
} from "./barSidebarState";

type BarNavigationSidebarProps = {
  onOpenHistory: () => void;
};

function getStoredCollapsedPreference() {
  if (typeof window === "undefined") return true;

  try {
    return getInitialBarSidebarCollapsed(
      window.localStorage.getItem(BAR_SIDEBAR_STORAGE_KEY),
    );
  } catch {
    return true;
  }
}

export default function BarNavigationSidebar({
  onOpenHistory,
}: BarNavigationSidebarProps) {
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(getStoredCollapsedPreference);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        BAR_SIDEBAR_STORAGE_KEY,
        collapsed ? "1" : "0",
      );
    } catch {
      // The sidebar still works when local storage is unavailable.
    }
  }, [collapsed]);

  const toggleLabel = collapsed
    ? "Mở menu pha chế"
    : "Thu gọn menu pha chế";
  const itemClassName = (active = false) =>
    `group flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold transition-[background-color,color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#063B2E] active:scale-[0.97] motion-reduce:transition-none ${
      collapsed ? "justify-center" : ""
    } ${
      active
        ? "bg-[#F6C85F] text-[#063B2E] shadow-sm"
        : "text-[#D7EEE6] hover:bg-white/10 hover:text-white"
    }`;

  return (
    <aside
      aria-label="Điều hướng pha chế"
      className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/10 bg-[#063B2E] text-white shadow-[8px_0_28px_rgba(15,23,42,0.12)] transition-[width] duration-200 motion-reduce:transition-none ${
        collapsed ? "w-14 lg:w-[72px]" : "w-[248px]"
      }`}
    >
      <div
        className={`flex h-[86px] shrink-0 items-center border-b border-white/10 ${
          collapsed ? "justify-center px-2" : "gap-2.5 px-4"
        }`}
      >
        {!collapsed ? (
          <>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#F6C85F] ring-1 ring-inset ring-white/10">
              <ChefHat className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">Khu pha chế</p>
              <p className="mt-0.5 text-xs font-semibold text-emerald-100/70">
                Điều hướng nhanh
              </p>
            </div>
          </>
        ) : null}
        <button
          type="button"
          onClick={() =>
            setCollapsed((current) => getNextBarSidebarCollapsed(current))
          }
          aria-controls="bar-navigation-menu"
          aria-expanded={!collapsed}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[#F6C85F] transition-[background-color,color,transform] duration-150 ease-out hover:bg-white/10 hover:text-[#FDE7A3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] active:scale-[0.96] motion-reduce:transition-none"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <nav
        id="bar-navigation-menu"
        aria-label="Menu pha chế"
        className="flex-1 space-y-2 px-2 py-4"
      >
        <Link
          href="/bar"
          aria-current="page"
          title={collapsed ? "Vận hành pha chế" : undefined}
          className={itemClassName(true)}
        >
          <Coffee className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={collapsed ? "sr-only" : "truncate"}>
            Vận hành pha chế
          </span>
        </Link>

        <button
          type="button"
          onClick={onOpenHistory}
          title={collapsed ? "Lịch sử đã lấy" : undefined}
          className={itemClassName()}
        >
          <History className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={collapsed ? "sr-only" : "truncate"}>
            Lịch sử đã lấy
          </span>
        </button>
      </nav>

      <div className="border-t border-white/10 p-2.5">
        <button
          type="button"
          onClick={logout}
          title={collapsed ? "Đăng xuất" : undefined}
          className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-[#F6C85F] transition-[background-color,color,transform] duration-150 ease-out hover:bg-[#F6C85F] hover:text-[#063B2E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#063B2E] active:scale-[0.96] motion-reduce:transition-none ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className={collapsed ? "sr-only" : ""}>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}
