"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  CakeSlice,
  CalendarDays,
  Calculator,
  Check,
  ChevronsUpDown,
  Coffee,
  FileText,
  KeyRound,
  LogOut,
  Menu,
  MessageSquareText,
  Package,
  PanelLeftClose,
  ReceiptText,
  Tags,
  Tractor,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { StoreType, useStore } from "@/context/StoreContext";

const navItems = [
  { href: "/", label: "Dashboard", icon: Calculator },
  { href: "/reports", label: "BÃ¡o cÃ¡o", icon: FileText },
  { href: "/cash-flow", label: "DÃ²ng tiá»n", icon: BarChart3 },
  { href: "/product", label: "Sáº£n pháº©m", icon: Package },
  { href: "/categories", label: "Danh má»¥c", icon: Tags },
  { href: "/payroll", label: "TÃ­nh lÆ°Æ¡ng", icon: Wallet },
  { href: "/payroll-estimate", label: "Æ¯á»›c lÆ°á»£ng lÆ°Æ¡ng", icon: CalendarDays },
  { href: "/social-listening", label: "Social Listening", icon: MessageSquareText },
  { href: "/seo-articles", label: "Bai viet SEO", icon: FileText },
];

const adminExtraNavItems = [
  { href: "/internal-invoices", label: "HÃ³a Ä‘Æ¡n ná»™i bá»™", icon: ReceiptText },
  { href: "/tax-invoices", label: "HÃ³a Ä‘Æ¡n thuáº¿", icon: ReceiptText },
  { href: "/activity-logs", label: "Nháº­t kÃ½ mÃ¡y", icon: Activity },
  { href: "/accounts", label: "TÃ i khoáº£n", icon: KeyRound },
];

const storeOptions: {
  id: StoreType;
  icon: typeof Coffee;
  label: string;
  note: string;
}[] = [
  { id: "cafe", icon: Coffee, label: "Cafe", note: "Quáº§y nÆ°á»›c" },
  { id: "restaurant", icon: UtensilsCrossed, label: "Láº©u / Báº¿p", note: "Khu báº¿p" },
  { id: "bakery", icon: CakeSlice, label: "Tiá»‡m bÃ¡nh", note: "Quáº§y bÃ¡nh" },
  { id: "farm", icon: Tractor, label: "Farm", note: "Khu tráº£i nghiá»‡m" },
];

export default function AdminSidebar({
  collapsed = false,
  onToggleCollapsed,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const { logout, role, loading } = useAuth();
  const { setStoreId, storeId, storeName } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showStoreMenu, setShowStoreMenu] = useState(false);
  const storeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showStoreMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (
        storeMenuRef.current &&
        target instanceof Node &&
        !storeMenuRef.current.contains(target)
      ) {
        setShowStoreMenu(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [showStoreMenu]);

  if (loading || !role || role === "user" || role === "server") {
    return null;
  }

  const effectiveCollapsed = role === "manager" ? false : collapsed;
  const visibleNavItems =
    role === "manager"
      ? navItems.filter((item) => item.href === "/payroll-estimate")
      : [...navItems, ...adminExtraNavItems];

  const currentStore =
    storeOptions.find((option) => option.id === storeId) || storeOptions[0];
  const CurrentStoreIcon = currentStore.icon;

  return (
    <>
      <button
        className="fixed left-4 top-4 z-50 rounded-lg border border-slate-200 bg-white p-2 shadow-sm lg:hidden"
        onClick={() => setIsOpen((value) => !value)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-200 ease-in-out lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
          effectiveCollapsed
            ? "w-64 lg:w-0 lg:min-w-0 lg:-translate-x-full lg:overflow-hidden lg:border-r-0"
            : "w-64"
        )}
      >
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xl font-bold text-primary">
              <div className="rounded-lg bg-primary/10 p-1.5">
                <Calculator className="h-6 w-6" />
              </div>
              <span>Cost Ong Quan</span>
            </div>

            {onToggleCollapsed && role !== "manager" ? (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="hidden rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 lg:inline-flex"
                aria-label="áº¨n sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div ref={storeMenuRef} className="relative mt-4">
            <button
              type="button"
              onClick={() => setShowStoreMenu((value) => !value)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-emerald-200 hover:bg-white"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-white p-2 text-emerald-600 shadow-sm">
                  <CurrentStoreIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Khu vá»±c hiá»‡n táº¡i
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {currentStore.label}
                  </div>
                  <div className="text-xs text-slate-500">{storeName}</div>
                </div>
              </div>
              <ChevronsUpDown className="h-4 w-4 text-slate-400" />
            </button>

            {showStoreMenu ? (
              <div className="absolute left-0 top-[calc(100%+10px)] z-20 w-full rounded-[24px] border border-slate-200 bg-white p-2 shadow-xl">
                {storeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = option.id === storeId;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setStoreId(option.id);
                        setShowStoreMenu(false);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition",
                        active
                          ? "bg-emerald-50 text-emerald-900"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "rounded-2xl p-2",
                            active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{option.label}</div>
                          <div className="text-xs text-inherit/75">{option.note}</div>
                        </div>
                      </div>
                      {active ? <Check className="h-4 w-4" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
          {visibleNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));

            return (
              <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
                <button
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon
                    className={cn("h-5 w-5", isActive ? "text-primary" : "text-slate-400")}
                  />
                  {item.label}
                </button>
              </Link>
            );
          })}
        </div>

        <div className="border-t border-slate-100 p-4">
          <Button
            variant="ghost"
            onClick={logout}
            className="flex w-full items-center justify-start gap-3 px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut className="h-5 w-5" />
            ÄÄƒng xuáº¥t
          </Button>
        </div>
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}
