"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { hasPermission } from "@/lib/permissions";
import {
  Activity,
  BarChart3,
  Boxes,
  CakeSlice,
  CalendarDays,
  Calculator,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Coffee,
  FileText,
  FileSpreadsheet,
  FileChartColumn,
  Gauge,
  KeyRound,
  LogOut,
  Menu,
  MessageSquareText,
  Package,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Tags,
  Tractor,
  Truck,
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
  exact?: boolean;
};

type NavGroup = {
  key: string;
  label: string;
  icon: typeof Calculator;
  items: NavItem[];
};

const isNavItemActive = (pathname: string, item: NavItem) =>
  pathname === item.href ||
  (!item.exact && item.href !== "/" && pathname.startsWith(`${item.href}/`));

const standaloneNavItems: NavItem[] = [
  {
    href: "/overview",
    label: "Tổng quan",
    icon: Gauge,
    permission: "dashboard.access",
    roles: ["admin"],
  },
  {
    href: "/activity-logs",
    label: "Nhật ký máy",
    icon: Activity,
    permission: "activity_logs.access",
  },
  {
    href: "/accounts",
    label: "Tài khoản",
    icon: KeyRound,
    permission: "accounts.access",
  },
];

const navGroups: NavGroup[] = [
  {
    key: "dashboard",
    label: "Sổ quỹ",
    icon: Gauge,
    items: [
      {
        href: "/cost",
        label: "Tính cost",
        icon: Calculator,
        permission: "dashboard.access",
        roles: ["admin"],
        exact: true,
      },
    ],
  },
  {
    key: "reports",
    label: "Báo cáo",
    icon: FileChartColumn,
    items: [
      {
        href: "/reports/products",
        label: "Hàng hoá",
        icon: PackageSearch,
        permission: "reports.access",
      },
      {
        href: "/reports",
        label: "Báo cáo cost",
        icon: FileText,
        permission: "reports.access",
        exact: true,
      },
    ],
  },
  {
    key: "billing",
    label: "Hóa đơn",
    icon: ReceiptText,
    items: [
      {
        href: "/pos",
        label: "Bán hàng POS",
        icon: ReceiptText,
        permission: "bills.access",
      },
      {
        href: "/bar",
        label: "Màn hình pha chế",
        icon: Coffee,
        permission: "bills.access",
      },
      {
        href: "/bills",
        label: "Danh sách hóa đơn",
        icon: ReceiptText,
        permission: "bills.access",
      },
      {
        href: "/cash-flow",
        label: "Dòng tiền",
        icon: BarChart3,
        permission: "cash_flow.access",
      },
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
      {
        href: "/product",
        label: "Sản phẩm",
        icon: Package,
        permission: "product.access",
      },
      {
        href: "/product/ingredients",
        label: "Nguyên liệu",
        icon: Boxes,
        permission: "product.access",
      },
      {
        href: "/product/suppliers",
        label: "Nhà phân phối",
        icon: Truck,
        permission: "product.access",
      },
      {
        href: "/product/checks",
        label: "Kiểm kho",
        icon: Package,
        permission: "inventory_checks.access",
      },
      {
        href: "/inventory-receipts",
        label: "Nhập hàng",
        icon: Package,
        permission: "inventory_receipts.view",
      },
      {
        href: "/categories",
        label: "Danh mục",
        icon: Tags,
        permission: "categories.access",
      },
    ],
  },
  {
    key: "payroll",
    label: "Tính lương",
    icon: Wallet,
    items: [
      {
        href: "/payroll",
        label: "Tính lương",
        icon: Wallet,
        permission: "payroll.access",
      },
      {
        href: "/timesheet",
        label: "Chấm công",
        icon: CalendarDays,
        permission: "timesheet.access",
      },
      {
        href: "/payroll-estimate",
        label: "Ước lượng lương",
        icon: CalendarDays,
        permission: "payroll_estimate.access",
      },
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
      {
        href: "/seo-articles",
        label: "Bài viết SEO",
        icon: FileText,
        permission: "seo_articles.access",
      },
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
      {
        href: "/tax-invoices",
        label: "Hóa đơn thuế",
        icon: ReceiptText,
        permission: "tax_invoices.access",
      },
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
  {
    id: "restaurant",
    icon: UtensilsCrossed,
    label: "Lẩu / Bếp",
    note: "Mô hình Bếp",
  },
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
  const isStoreLocked = userRole === "user" || userRole === "server" || userRole === "bartender";
  const [isOpen, setIsOpen] = useState(false);
  const [showStoreMenu, setShowStoreMenu] = useState(false);
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const storeMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const assignedStoreId = user?.storeId;
    if (
      isStoreLocked &&
      (assignedStoreId === "cafe" ||
        assignedStoreId === "restaurant" ||
        assignedStoreId === "bakery" ||
        assignedStoreId === "farm") &&
      assignedStoreId !== storeId
    ) {
      setStoreId(assignedStoreId);
    }
  }, [isStoreLocked, setStoreId, storeId, user?.storeId]);

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

  const activeGroupKey = useMemo(
    () =>
      visibleNavGroups.find((group) =>
        group.items.some((item) => isNavItemActive(pathname, item)),
      )?.key ?? null,
    [pathname, visibleNavGroups],
  );

  useEffect(() => {
    setOpenGroupKey(activeGroupKey);
  }, [activeGroupKey]);

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
          className="fixed left-4 top-3 z-50 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-800 text-[#ffb800] shadow-[0_2px_8px_rgba(0,35,25,0.24)] transition-[background-color,color,transform] duration-150 ease-out hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-800 focus-visible:ring-offset-2 active:scale-[0.96] motion-reduce:transition-none lg:hidden"
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
          "admin-sidebar admin-sidebar__ease fixed font-nunito inset-y-0 left-0 z-40 flex h-screen w-[280px] flex-col shadow-[0_8px_24px_rgba(0,35,25,0.24)] transition-[transform,width] duration-200 motion-reduce:transition-none lg:static lg:translate-x-0 lg:border-r lg:border-[#F6C85F]/20 lg:shadow-none",
          isOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[72px]" : "lg:w-[248px]",
        )}
      >
        <div
          className={cn(
            "border-b border-white/10 px-3 py-3",
            collapsed && "lg:px-2",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-between gap-2",
              collapsed && "lg:flex-col lg:justify-center",
            )}
          >
            <div
              className={cn(
                "flex min-w-0 items-center",
                collapsed && "lg:hidden",
              )}
            >
              <div className="flex h-14 w-[166px] shrink-0 items-center overflow-hidden">
                <img
                  src="/assets/tn_services.png"
                  alt="TN Services"
                  className="h-auto w-full max-w-none"
                  draggable={false}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#FDE7A3] transition-[background-color,color,transform] duration-150 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] active:scale-[0.96] motion-reduce:transition-none lg:hidden"
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
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md text-[#F6C85F] transition-[background-color,color,transform] duration-150 ease-out hover:bg-white/10 hover:text-[#FDE7A3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] active:scale-[0.96] motion-reduce:transition-none lg:inline-flex"
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
              onClick={() => {
                if (!isStoreLocked) setShowStoreMenu((value) => !value);
              }}
              disabled={isStoreLocked}
              className={cn(
                "flex h-14 w-full items-center justify-between rounded-lg bg-white/[0.06] px-2.5 text-left ring-1 ring-inset ring-white/15 transition-[background-color,color,transform] duration-150 ease-out hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] active:scale-[0.96] motion-reduce:transition-none",
                collapsed &&
                  "lg:mx-auto lg:h-10 lg:w-10 lg:justify-center lg:p-0",
              )}
              aria-haspopup="listbox"
              aria-expanded={showStoreMenu}
              aria-label={"Khu vực hiện tại: " + currentStore.label}
              title={collapsed ? currentStore.label : undefined}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F6C85F]/15 text-[#F6C85F] ring-1 ring-inset ring-[#F6C85F]/25">
                  <CurrentStoreIcon className="h-4 w-4" />
                </div>
                <div className={cn("min-w-0", collapsed && "lg:hidden")}>
                  <div className="truncate text-sm font-semibold text-white">
                    {currentStore.label}
                  </div>
                  <div className="truncate text-xs text-[#B8D8CC]">
                    {storeName}
                  </div>
                </div>
              </div>
              {!isStoreLocked && <ChevronsUpDown
                className={cn(
                  "h-4 w-4 shrink-0 text-[#F6C85F] transition-transform duration-200 ease-out motion-reduce:transition-none",
                  showStoreMenu && "rotate-180",
                  collapsed && "lg:hidden",
                )}
              />}
            </button>

            {showStoreMenu && !isStoreLocked ? (
              <div
                role="listbox"
                aria-label="Chọn khu vực"
                className={cn(
                  "absolute left-0 top-[calc(100%+8px)] z-50 w-full animate-in rounded-lg bg-[#073D31] p-1.5 text-white shadow-[0_4px_8px_rgba(0,25,18,0.28)] ring-1 ring-white/15 duration-150 fade-in-0 zoom-in-95 motion-reduce:animate-none",
                  collapsed && "lg:left-[calc(100%+12px)] lg:top-0 lg:w-60",
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
                        "flex min-h-12 w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition-[background-color,color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white motion-reduce:transition-none",
                        active
                          ? "bg-[#F6C85F] text-[#063B2E]"
                          : "text-[#D7EEE6] hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                            active
                              ? "bg-[#063B2E]/10 text-[#063B2E]"
                              : "bg-white/10 text-[#F6C85F]",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {option.label}
                          </div>
                          <div className="truncate text-xs text-inherit/75">
                            {option.note}
                          </div>
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
            collapsed && "lg:px-2",
          )}
        >
          <div className="space-y-1">
            {visibleStandaloneItems.map((item) => {
              const isActive = isNavItemActive(pathname, item);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-[background-color,color,transform] duration-150 ease-out hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] active:scale-[0.96] motion-reduce:transition-none",
                    collapsed && "lg:justify-center lg:px-0",
                    isActive
                      ? "bg-[#F6C85F] text-[#063B2E] shadow-[0_2px_6px_rgba(0,35,25,0.2)]"
                      : "text-[#D7EEE6] hover:bg-white/[0.08] hover:text-white",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      isActive ? "text-[#063B2E]" : "text-white/80",
                    )}
                  />
                  <span className={cn("truncate", collapsed && "lg:sr-only")}>
                    {item.label}
                  </span>
                </Link>
              );
            })}

            {visibleNavGroups.map((group) => {
              const isGroupActive = group.items.some((item) =>
                isNavItemActive(pathname, item),
              );
              const isGroupOpen = openGroupKey === group.key;
              const GroupIcon = group.icon;

              return (
                <div key={group.key} className="space-y-0.5 py-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (collapsed && onToggleCollapsed) {
                        setOpenGroupKey(group.key);
                        onToggleCollapsed();
                        return;
                      }

                      setOpenGroupKey((current) =>
                        current === group.key ? null : group.key,
                      );
                    }}
                    className={cn(
                      ` admin-sidebar__ease
                        flex h-10 w-full items-center justify-between gap-3
                        rounded-md px-3
                        text-left text-sm font-semibold
                        text-[#F6C85F]

                        bg-white/[0.08]
                        ring-1 ring-inset ring-[#F6C85F]/35

                        transition-[background-color,color,transform,box-shadow]
                        duration-200

                        hover:translate-x-0.5
                        hover:bg-white/[0.12]
                        hover:text-[#FDE7A3]
                        hover:ring-[#F6C85F]/55

                        focus-visible:outline-none
                        focus-visible:ring-2
                        focus-visible:ring-[#F6C85F]

                        active:scale-[0.96]
                        motion-reduce:transition-none
                      `,
                      collapsed && "lg:justify-center lg:px-0",
                      isGroupActive &&
                        "bg-white/[0.1] text-[#FDE7A3] shadow-[inset_0_0_0_1px_rgba(246,200,95,0.35)]",
                    )}
                    aria-expanded={isGroupOpen}
                    title={collapsed ? group.label : undefined}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <GroupIcon className="h-5 w-5 shrink-0 text-[#F6C85F]" />
                      <span
                        className={cn("truncate", collapsed && "lg:sr-only")}
                      >
                        {group.label}
                      </span>
                    </span>
                    <ChevronRight
                      className={cn(
                        "admin-sidebar__ease h-4 w-4 shrink-0 text-[#F6C85F] transition-transform duration-200",
                        isGroupOpen && "rotate-90",
                        collapsed && "lg:hidden",
                      )}
                    />
                  </button>

                  <div
                    aria-hidden={!isGroupOpen}
                    className={cn(
                      "admin-sidebar__ease grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none",
                      isGroupOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "pointer-events-none grid-rows-[0fr] opacity-0",
                      collapsed && "lg:hidden",
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="space-y-0.5 pb-0.5 pl-3 pt-1">
                        {group.items.map((item) => {
                          const isActive = isNavItemActive(pathname, item);

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setIsOpen(false)}
                              aria-current={isActive ? "page" : undefined}
                              tabIndex={isGroupOpen ? undefined : -1}
                              className={cn(
                                "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-[background-color,color,transform] duration-150 ease-out hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] active:scale-[0.96] motion-reduce:transition-none",
                                isActive
                                  ? "bg-white/[0.1] text-[#FDE7A3] shadow-[inset_0_0_0_1px_rgba(246,200,95,0.22)]"
                                  : "text-[#D7EEE6] hover:bg-white/[0.07] hover:text-white",
                              )}
                            >
                              <item.icon
                                className={cn(
                                  "h-4 w-4 shrink-0",
                                  isActive ? "text-[#F6C85F]" : "text-white/75",
                                )}
                              />
                              <span className="truncate">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        <div
          className={cn(
            "border-t border-white/10 p-2.5",
            collapsed && "lg:p-2",
          )}
        >
          <button
            type="button"
            onClick={logout}
            title={collapsed ? "Đăng xuất" : undefined}
            className={cn(
              "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-[#F6C85F] transition-[background-color,color,transform] duration-150 ease-out hover:bg-[#F6C85F] hover:text-[#063B2E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#064E3B] active:scale-[0.96] motion-reduce:transition-none",
              collapsed && "lg:justify-center lg:px-0",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={cn(collapsed && "lg:sr-only")}>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {isOpen ? (
        <div
          className="fixed inset-0 z-30 bg-[#032B22]/60 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}
