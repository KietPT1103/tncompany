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
  FileSpreadsheet,
  KeyRound,
  LogOut,
  Menu,
  MessageSquareText,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Tags,
  Tractor,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
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
      { href: "/reports", label: "Báo cáo", icon: FileText, permission: "reports.access" },
      { href: "/cash-flow", label: "Dòng tiền", icon: BarChart3, permission: "cash_flow.access" },
    ],
  },
  {
    key: "sample-bills",
    label: "Tạo bill mẫu",
    icon: FileSpreadsheet,
    items: [
      {
        href: "/sample-bills/products",
        label: "DS sản phẩm",
        icon: Package,
        permission: "sample_bills.access",
        roles: ["admin"],
      },
      {
        href: "/sample-bills/coffee",
        label: "Mẫu nước",
        icon: Coffee,
        permission: "sample_bills.access",
        roles: ["admin"],
      },
      {
        href: "/sample-bills/hotpot",
        label: "Mẫu lẩu",
        icon: UtensilsCrossed,
        permission: "sample_bills.access",
        roles: ["admin"],
      },
      {
        href: "/sample-bills/farm",
        label: "Mẫu farm",
        icon: Tractor,
        permission: "sample_bills.access",
        roles: ["admin"],
      },
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
        href: "/product/receipts",
        label: "Nhập hàng",
        icon: Package,
        permission: "inventory_receipts.access",
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

  useEffect(() => {
    if (!isOpen && !showStoreMenu) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      setShowStoreMenu(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, showStoreMenu]);

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
      {!isOpen ? (
        <button
          type="button"
          className="fixed left-4 top-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.14)] transition-[background-color,color,transform] duration-150 ease-out hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] motion-reduce:transition-none lg:hidden"
          onClick={() => setIsOpen(true)}
          aria-label="Mở menu"
          aria-controls="admin-sidebar"
          aria-expanded="false"
        >
          <Menu className="h-5 w-5" />
        </button>
      ) : null}

      <aside
        id="admin-sidebar"
        aria-label="Điều hướng quản trị"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen w-[280px] flex-col bg-white shadow-[0_8px_24px_rgba(15,23,42,0.16)] transition-[transform,width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none lg:static lg:translate-x-0 lg:border-r lg:border-slate-200/80 lg:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[72px]" : "lg:w-[248px]"
        )}
      >
        <div
          className={cn(
            "border-b border-slate-100 px-3 py-3",
            collapsed && "lg:px-2"
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between gap-2",
              collapsed && "lg:flex-col lg:justify-center"
            )}
          >
            <div
              className={cn(
                "flex min-w-0 items-center gap-2.5",
                collapsed && "lg:hidden"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Calculator className="h-5 w-5" />
              </div>
              <span
                className={cn(
                  "truncate text-lg font-bold text-primary",
                  collapsed && "lg:hidden"
                )}
              >
                TN Services
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 transition-[background-color,color,transform] duration-150 ease-out hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] motion-reduce:transition-none lg:hidden"
              aria-label="Đóng menu"
            >
              <X className="h-5 w-5" />
            </button>

            {onToggleCollapsed ? (
              <button
                type="button"
                onClick={() => {
                  setShowStoreMenu(false);
                  onToggleCollapsed();
                }}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-500 transition-[background-color,color,transform] duration-150 ease-out hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] motion-reduce:transition-none lg:inline-flex"
                aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
                title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            ) : null}
          </div>

          <div ref={storeMenuRef} className="relative mt-3">
            <button
              type="button"
              onClick={() => setShowStoreMenu((value) => !value)}
              className={cn(
                "flex h-12 w-full items-center justify-between rounded-lg bg-slate-50 px-2.5 text-left transition-[background-color,color,transform] duration-150 ease-out hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] motion-reduce:transition-none",
                collapsed && "lg:mx-auto lg:h-10 lg:w-10 lg:justify-center lg:p-0"
              )}
              aria-haspopup="listbox"
              aria-expanded={showStoreMenu}
              aria-label={"Khu vực hiện tại: " + currentStore.label}
              title={collapsed ? currentStore.label : undefined}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-primary shadow-[0_1px_3px_rgba(15,23,42,0.12)]">
                  <CurrentStoreIcon className="h-4 w-4" />
                </div>
                <div className={cn("min-w-0", collapsed && "lg:hidden")}>
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {currentStore.label}
                  </div>
                  <div className="truncate text-xs text-slate-500">{storeName}</div>
                </div>
              </div>
              <ChevronsUpDown
                className={cn(
                  "h-4 w-4 shrink-0 text-slate-400",
                  collapsed && "lg:hidden"
                )}
              />
            </button>

            {showStoreMenu ? (
              <div
                role="listbox"
                aria-label="Chọn khu vực"
                className={cn(
                  "absolute left-0 top-[calc(100%+8px)] z-50 w-full rounded-lg bg-white p-1.5 shadow-[0_4px_8px_rgba(15,23,42,0.16)] ring-1 ring-black/5",
                  collapsed &&
                    "lg:left-[calc(100%+12px)] lg:top-0 lg:w-60"
                )}
              >
                {storeOptions.map((option) => {
                  const Icon = option.icon;
                  const active = option.id === storeId;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setStoreId(option.id);
                        setShowStoreMenu(false);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "flex min-h-12 w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition-[background-color,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none",
                        active
                          ? "bg-emerald-50 text-emerald-900"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                            active
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-100 text-slate-500"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{option.label}</div>
                          <div className="truncate text-xs text-inherit/75">{option.note}</div>
                        </div>
                      </div>
                      {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <nav
          aria-label="Menu quản trị"
          className={cn(
            "flex-1 overflow-x-hidden overflow-y-auto px-3 py-3",
            collapsed && "lg:px-2"
          )}
        >
          <div className="space-y-1">
            {visibleStandaloneItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href + "/"));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-[background-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] motion-reduce:transition-none",
                    collapsed && "lg:justify-center lg:px-0",
                    isActive
                      ? "bg-emerald-50 text-emerald-800"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      isActive ? "text-emerald-600" : "text-slate-400"
                    )}
                  />
                  <span className={cn("truncate", collapsed && "lg:sr-only")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}

            {visibleNavGroups.map((group) => {
              const isGroupActive = group.items.some(
                (item) =>
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href + "/"))
              );
              const isGroupOpen = openGroups[group.key] ?? isGroupActive;
              const GroupIcon = group.icon;

              return (
                <div key={group.key} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsed && onToggleCollapsed) {
                        setOpenGroups((current) => ({
                          ...current,
                          [group.key]: true,
                        }));
                        onToggleCollapsed();
                        return;
                      }

                      setOpenGroups((current) => ({
                        ...current,
                        [group.key]: !isGroupOpen,
                      }));
                    }}
                    className={cn(
                      "flex h-10 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-sm font-semibold transition-[background-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] motion-reduce:transition-none",
                      collapsed && "lg:justify-center lg:px-0",
                      isGroupActive
                        ? "text-emerald-700"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                      collapsed && isGroupActive && "lg:bg-emerald-50"
                    )}
                    aria-expanded={isGroupOpen}
                    title={collapsed ? group.label : undefined}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <GroupIcon
                        className={cn(
                          "h-5 w-5 shrink-0",
                          isGroupActive ? "text-emerald-600" : "text-slate-400"
                        )}
                      />
                      <span className={cn("truncate", collapsed && "lg:sr-only")}>
                        {group.label}
                      </span>
                    </span>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ease-out motion-reduce:transition-none",
                        isGroupOpen && "rotate-90 text-emerald-600",
                        collapsed && "lg:hidden"
                      )}
                    />
                  </button>

                  {isGroupOpen ? (
                    <div
                      className={cn(
                        "space-y-0.5 pl-3",
                        collapsed && "lg:hidden"
                      )}
                    >
                      {group.items.map((item) => {
                        const isActive =
                          pathname === item.href ||
                          (item.href !== "/" && pathname.startsWith(item.href + "/"));

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-[background-color,color,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] motion-reduce:transition-none",
                              isActive
                                ? "bg-emerald-50 text-emerald-800"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            )}
                          >
                            <item.icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                isActive ? "text-emerald-600" : "text-slate-400"
                              )}
                            />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </nav>

        <div
          className={cn(
            "border-t border-slate-100 p-2.5",
            collapsed && "lg:p-2"
          )}
        >
          <button
            type="button"
            onClick={logout}
            title={collapsed ? "Đăng xuất" : undefined}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-rose-600 transition-[background-color,color,transform] duration-150 ease-out hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 active:scale-[0.96] motion-reduce:transition-none",
              collapsed && "lg:justify-center lg:px-0"
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={cn(collapsed && "lg:sr-only")}>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {isOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}