"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import {
  Activity,
  BarChart3,
  CakeSlice,
  CalendarDays,
  Calculator,
  Check,
  ChevronRight,
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
import type { AppPermission, UserRole } from "@/types/auth";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Calculator;
  permission?: AppPermission;
  roles?: UserRole[];
};

type NavGroup = {
  key: string;
  label: string;
  icon: typeof Calculator;
  items: NavItem[];
};

const standaloneNavItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Calculator, permission: "dashboard.access" },
  { href: "/activity-logs", label: "Nhật ký máy", icon: Activity, permission: "activity_logs.access" },
  { href: "/accounts", label: "Tài khoản", icon: KeyRound, permission: "accounts.access" },
];

const navGroups: NavGroup[] = [
  {
    key: "billing",
    label: "Hóa đơn",
    icon: ReceiptText,
    items: [
      { href: "/pos", label: "Hóa đơn", icon: ReceiptText, permission: "bills.access" },
      {
        href: "/virtual-bills",
        label: "Tạo bill ảo",
        icon: ReceiptText,
        permission: "virtual_bills.access",
        roles: ["admin"],
      },
      { href: "/reports", label: "Báo cáo", icon: FileText, permission: "reports.access" },
      { href: "/cash-flow", label: "Dòng tiền", icon: BarChart3, permission: "cash_flow.access" },
    ],
  },
  {
    key: "products",
    label: "Sản phẩm",
    icon: Package,
    items: [
      { href: "/product", label: "Sản phẩm", icon: Package, permission: "product.access" },
      { href: "/product/checks", label: "Kiểm kho", icon: Package, permission: "inventory_checks.access" },
      {
        href: "/inventory-receipts",
        label: "Nhập hàng",
        icon: Package,
        permission: "inventory_receipts.view",
      },
      { href: "/categories", label: "Danh mục", icon: Tags, permission: "categories.access" },
    ],
  },
  {
    key: "payroll",
    label: "Tính lương",
    icon: Wallet,
    items: [
      { href: "/payroll", label: "Tính lương", icon: Wallet, permission: "payroll.access" },
      {
        href: "/payroll-estimate",
        label: "Ước lượng lương",
        icon: CalendarDays,
        permission: "payroll_estimate.access",
      },
      { href: "/timesheet", label: "Chấm công", icon: CalendarDays, permission: "timesheet.access" },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    icon: MessageSquareText,
    items: [
      {
        href: "/social-listening",
        label: "Social Listening",
        icon: MessageSquareText,
        permission: "social_listening.access",
      },
      { href: "/seo-articles", label: "Bài viết SEO", icon: FileText, permission: "seo_articles.access" },
    ],
  },
  {
    key: "invoices",
    label: "Hóa đơn nội bộ",
    icon: ReceiptText,
    items: [
      {
        href: "/internal-invoices",
        label: "Hóa đơn nội bộ",
        icon: ReceiptText,
        permission: "internal_invoices.access",
      },
      { href: "/tax-invoices", label: "Hóa đơn thuế", icon: ReceiptText, permission: "tax_invoices.access" },
    ],
  },
];

const storeOptions: {
  id: StoreType;
  icon: typeof Coffee;
  label: string;
  note: string;
}[] = [
  { id: "cafe", icon: Coffee, label: "Cafe", note: "Quầy nước" },
  { id: "restaurant", icon: UtensilsCrossed, label: "Lẩu / Bếp", note: "Mô hình Bếp" },
  { id: "bakery", icon: CakeSlice, label: "Tiệm bánh", note: "Quầy bánh" },
  { id: "farm", icon: Tractor, label: "Farm", note: "Khu trải nghiệm" },
];

export default function AdminSidebar({
  collapsed = false,
  onToggleCollapsed,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const { logout, user, loading } = useAuth();
  const userRole = user?.role || null;
  const { setStoreId, storeId, storeName } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showStoreMenu, setShowStoreMenu] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
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

  const canViewItem = (item: NavItem) => {
    if (item.roles?.length && (!userRole || !item.roles.includes(userRole))) {
      return false;
    }
    return item.permission ? hasPermission(user, item.permission) : true;
  };

  const visibleStandaloneItems = standaloneNavItems.filter(canViewItem);
  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(canViewItem),
    }))
    .filter((group) => group.items.length > 0);

  const activeGroupKeys = useMemo(
    () =>
      visibleNavGroups
        .filter((group) =>
          group.items.some(
            (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))
          )
        )
        .map((group) => group.key),
    [pathname, visibleNavGroups]
  );

  useEffect(() => {
    if (activeGroupKeys.length === 0) return;

    setOpenGroups((current) => {
      const next = { ...current };
      let changed = false;

      activeGroupKeys.forEach((groupKey) => {
        if (!next[groupKey]) {
          next[groupKey] = true;
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [activeGroupKeys]);

  if (loading || !user) {
    return null;
  }

  if (visibleStandaloneItems.length === 0 && visibleNavGroups.length === 0) {
    return null;
  }

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
          collapsed
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

            {onToggleCollapsed ? (
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="hidden rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 lg:inline-flex"
                aria-label="Ẩn sidebar"
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
                    Khu vực hiện tại
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

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-6">
          {visibleStandaloneItems.map((item) => {
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

          {visibleNavGroups.map((group) => {
            const isGroupActive = group.items.some(
              (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`))
            );
            const isGroupOpen = openGroups[group.key] ?? isGroupActive;
            const GroupIcon = group.icon;

            return (
              <div
                key={group.key}
                className={cn(
                  "overflow-hidden rounded-2xl border transition",
                  isGroupActive
                    ? "border-emerald-100 bg-emerald-50/60"
                    : "border-slate-200 bg-white"
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((current) => ({
                      ...current,
                      [group.key]: !isGroupOpen,
                    }))
                  }
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition",
                    isGroupActive ? "text-emerald-700" : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <GroupIcon
                      className={cn("h-5 w-5", isGroupActive ? "text-emerald-600" : "text-slate-400")}
                    />
                    <span className="text-sm font-semibold">{group.label}</span>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isGroupOpen ? "rotate-90 text-emerald-600" : "text-slate-400"
                    )}
                  />
                </button>

                {isGroupOpen ? (
                  <div className="space-y-1 px-2 pb-2">
                    {group.items.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        (item.href !== "/" && pathname.startsWith(`${item.href}/`));

                      return (
                        <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)}>
                          <button
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                              isActive
                                ? "bg-white text-primary shadow-sm"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )}
                          >
                            <item.icon
                              className={cn(
                                "h-5 w-5",
                                isActive ? "text-primary" : "text-slate-400"
                              )}
                            />
                            {item.label}
                          </button>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
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
            Đăng xuất
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
