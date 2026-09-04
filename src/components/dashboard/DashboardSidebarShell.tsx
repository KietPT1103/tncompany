"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { getDashboardSidebarMobileState } from "./dashboardSidebarState";

type DashboardSidebarControls = {
  closeMobileMenu: () => void;
};

type DashboardSidebarShellProps = {
  children: (controls: DashboardSidebarControls) => ReactNode;
  collapsed: boolean;
  desktopPosition?: "fixed" | "static";
  headerExtra?: ReactNode;
  mobileHeaderAction?: ReactNode;
  mobileHeaderLabel: string;
  mobileMenuLabel: string;
  onToggleCollapsed?: () => void;
  sidebarId: string;
  sidebarLabel: string;
};

export default function DashboardSidebarShell({
  children,
  collapsed,
  desktopPosition = "static",
  headerExtra,
  mobileHeaderAction,
  mobileHeaderLabel,
  mobileMenuLabel,
  onToggleCollapsed,
  sidebarId,
  sidebarLabel,
}: DashboardSidebarShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileState = getDashboardSidebarMobileState(mobileOpen);

  const closeMobileMenu = useCallback(() => {
    setMobileOpen(false);
    window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileMenu();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    mobileCloseButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMobileMenu, mobileOpen]);

  return (
    <>
      <header
        aria-label={mobileHeaderLabel}
        className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-center border-b border-[#F6C85F]/20 bg-[linear-gradient(135deg,#064E3B,#033C2F)] px-16 shadow-[0_2px_6px_rgba(0,35,25,0.2)] lg:hidden"
      >
        {!mobileOpen ? (
          <button
            ref={mobileMenuButtonRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label={`Mở ${mobileMenuLabel}`}
            aria-controls={sidebarId}
            aria-expanded="false"
            className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg bg-emerald-800 text-[#F6C85F] shadow-[0_2px_8px_rgba(0,35,25,0.24)] transition-[background-color,transform] duration-150 ease-out hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#064E3B] active:-translate-y-1/2 active:scale-[0.96] motion-reduce:transition-none"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}

        <Link
          href="/"
          aria-label="Về Tổng quan kinh doanh"
          className="flex h-12 w-[156px] items-center justify-center overflow-hidden rounded-md transition-[opacity,transform] duration-150 ease-out hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#064E3B] active:scale-[0.96] motion-reduce:transition-none"
        >
          <img
            src="/assets/tn_services.png"
            alt="TN Services"
            className="h-auto w-[140px] max-w-none"
            draggable={false}
          />
        </Link>

        {mobileHeaderAction}
      </header>

      <aside
        id={sidebarId}
        aria-label={sidebarLabel}
        className={`admin-sidebar admin-sidebar__ease fixed inset-y-0 left-0 z-[60] flex h-screen w-[280px] flex-col font-nunito shadow-[0_8px_24px_rgba(0,35,25,0.24)] transition-[transform,width] duration-200 motion-reduce:transition-none lg:z-30 lg:translate-x-0 lg:border-r lg:border-[#F6C85F]/20 lg:shadow-none ${
          mobileState.drawerTransform
        } ${
          desktopPosition === "fixed" ? "lg:fixed" : "lg:static"
        } ${collapsed ? "lg:w-[72px]" : "lg:w-[248px]"}`}
      >
        <div
          className={`border-b border-white/10 px-3 py-3 ${
            collapsed ? "lg:px-2" : ""
          }`}
        >
          <div
            className={`flex h-14 items-center justify-between gap-2 ${
              collapsed ? "lg:justify-center" : ""
            }`}
          >
            <div
              className={`flex h-14 w-[166px] shrink-0 items-center overflow-hidden ${
                collapsed ? "lg:hidden" : ""
              }`}
            >
              <img
                src="/assets/tn_services.png"
                alt="TN Services"
                className="h-auto w-full max-w-none"
                draggable={false}
              />
            </div>

            <button
              ref={mobileCloseButtonRef}
              type="button"
              onClick={closeMobileMenu}
              aria-label={`Đóng ${mobileMenuLabel}`}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#FDE7A3] transition-[background-color,color,transform] duration-150 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] active:scale-[0.96] motion-reduce:transition-none lg:hidden"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            {onToggleCollapsed ? (
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-label={
                  collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"
                }
                title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md text-[#F6C85F] transition-[background-color,color,transform] duration-150 ease-out hover:bg-white/10 hover:text-[#FDE7A3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] active:scale-[0.96] motion-reduce:transition-none lg:inline-flex"
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>

          {headerExtra}
        </div>

        {children({ closeMobileMenu })}
      </aside>

      {mobileState.overlayVisible ? (
        <button
          type="button"
          tabIndex={-1}
          onClick={closeMobileMenu}
          aria-label={`Đóng ${mobileMenuLabel}`}
          className="fixed inset-0 z-50 cursor-default bg-[#032B22]/60 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}
    </>
  );
}
