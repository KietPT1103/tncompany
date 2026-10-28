import type { AppPermission, AppUser, UserRole } from "@/types/auth";

type PermissionDefinition = {
  id: AppPermission;
  label: string;
  description: string;
  category: string;
  path: string;
  hidden?: boolean;
  adminOnly?: boolean;
  routePermission?: boolean;
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    id: "revenue_hub.view",
    label: "Xem doanh thu liên hệ thống",
    description: "Quyền cấp riêng để truy cập URL /doanh-thu.",
    category: "Hệ thống",
    path: "/doanh-thu",
  },
  {
    id: "stores.switch",
    label: "Thay đổi quầy trực tiếp",
    description: "Đổi quầy trên web trong phạm vi khu vực được cấp, bất kể vai trò.",
    category: "Hệ thống",
    path: "/admin",
    routePermission: false,
  },
  {
    id: "dashboard.access",
    label: "Tổng quan và sổ quỹ",
    description: "Xem tổng quan vận hành và nhập báo cáo sổ quỹ. Chỉ dành cho quản trị viên.",
    category: "Tổng quan",
    path: "/cost",
    adminOnly: true,
  },
  {
    id: "bills.access",
    label: "Sử dụng POS và hóa đơn",
    description: "Xem và thao tác danh sách hóa đơn.",
    category: "Giao dịch",
    path: "/pos",
  },
  {
    id: "bills.cancelled.view",
    label: "Xem hóa đơn đã hủy",
    description: "Mở bộ lọc riêng và xem chi tiết các hóa đơn đã hủy.",
    category: "Giao dịch",
    path: "/admin/bills/cancelled",
  },
  {
    id: "cash_vouchers.cancel",
    label: "Hủy phiếu thu/chi",
    description: "Hủy mềm phiếu thu/chi, lưu người hủy, thời điểm và lý do.",
    category: "Giao dịch",
    path: "/admin/bills",
  },
  {
    id: "cash_vouchers.cancelled.view",
    label: "Xem phiếu thu/chi đã hủy",
    description: "Mở bộ lọc riêng và xem các phiếu thu/chi đã hủy.",
    category: "Giao dịch",
    path: "/admin/bills/cancelled-vouchers",
  },
  {
    id: "bar.access",
    label: "Màn hình pha chế",
    description: "Xem và cập nhật tiến độ các bill pha chế.",
    category: "Giao dịch",
    path: "/bar",
  },
  {
    id: "bar.checkout",
    label: "Pha chế bấm bill",
    description: "Chọn món, thanh toán và in bill tại quầy pha chế.",
    category: "Giao dịch",
    path: "/pos",
  },
  {
    id: "virtual_bills.access",
    label: "Tạo bill ảo",
    description: "Sinh bill ảo theo tổng doanh thu và số lượng bill.",
    category: "Giao dịch",
    path: "/virtual-bills",
    hidden: true,
  },
  {
    id: "sample_bills.access",
    label: "Tạo bill mẫu",
    description: "Quản lý sản phẩm và tạo file bill mẫu. Chỉ dành cho quản trị viên.",
    category: "Giao dịch",
    path: "/sample-bills",
    adminOnly: true,
  },
  {
    id: "payroll_estimate.access",
    label: "Ước lượng lương",
    description: "Lập lịch và ước lượng lương.",
    category: "Nhân sự",
    path: "/payroll-estimate",
  },
  {
    id: "payroll.access",
    label: "Tính lương",
    description: "Quản lý bảng lương và nhân sự.",
    category: "Nhân sự",
    path: "/payroll",
  },
  {
    id: "timesheet.access",
    label: "Chấm công",
    description: "Xem và cập nhật bảng chấm công.",
    category: "Nhân sự",
    path: "/timesheet",
  },
  {
    id: "reports.access",
    label: "Tất cả báo cáo",
    description: "Xem và lưu toàn bộ báo cáo doanh thu, lợi nhuận, hàng hóa và cost.",
    category: "Báo cáo",
    path: "/reports",
    routePermission: false,
  },
  {
    id: "reports.revenue.view",
    label: "Doanh thu theo ngày",
    description: "Xem và xuất báo cáo doanh thu theo ngày.",
    category: "Báo cáo",
    path: "/reports/revenue",
  },
  {
    id: "reports.ingredient_usage.view",
    label: "Món bán và nguyên liệu đã dùng",
    description: "Xem số món bán, nguyên liệu tiêu hao và đồng bộ công thức còn thiếu.",
    category: "Báo cáo",
    path: "/reports/ingredient-usage",
  },
  {
    id: "reports.profit.access",
    label: "Báo cáo lợi nhuận",
    description: "Xem, nhập chi phí và lưu báo cáo lợi nhuận.",
    category: "Báo cáo",
    path: "/reports/profit",
  },
  {
    id: "reports.cost.access",
    label: "Báo cáo cost",
    description: "Xem, tạo, cập nhật và xóa báo cáo cost.",
    category: "Báo cáo",
    path: "/reports",
  },
  {
    id: "reports.products.view",
    label: "Xem báo cáo hàng hóa",
    description: "Chỉ xem và xuất Báo cáo / Hàng hóa, không mở các báo cáo khác.",
    category: "Báo cáo",
    path: "/reports/products",
  },
  {
    id: "cash_flow.access",
    label: "Dòng tiền",
    description: "Theo dõi dòng tiền và tổng hợp thu chi.",
    category: "Báo cáo",
    path: "/cash-flow",
  },
  {
    id: "product.access",
    label: "Sản phẩm",
    description: "Quản lý danh mục sản phẩm và giá bán.",
    category: "Hàng hóa",
    path: "/product",
  },
  {
    id: "products.selling.view",
    label: "Xem sản phẩm đang bán",
    description: "Xem danh sách các sản phẩm đang bán nhưng không được thay đổi thông tin.",
    category: "Hàng hóa",
    path: "/product",
  },
  {
    id: "products.components.update",
    label: "Sửa thành phần sản phẩm",
    description: "Sửa nguyên liệu và định lượng trong sản phẩm đang bán; không được sửa giá, danh mục hoặc trạng thái.",
    category: "Hàng hóa",
    path: "/product",
  },
  {
    id: "ingredients.access",
    label: "Nguyên liệu",
    description: "Xem và quản lý danh sách nguyên liệu, quy đổi và bán thành phẩm.",
    category: "Kho và nguyên liệu",
    path: "/product/ingredients",
  },
  {
    id: "suppliers.access",
    label: "Nhà phân phối",
    description: "Xem và quản lý danh sách nhà phân phối nguyên liệu.",
    category: "Kho và nguyên liệu",
    path: "/product/suppliers",
  },
  {
    id: "inventory_checks.access",
    label: "Xem kiểm kho",
    description: "Xem danh sách và chi tiết các đợt kiểm kho.",
    category: "Kho và nguyên liệu",
    path: "/product/checks",
  },
  {
    id: "inventory_checks.create",
    label: "Tạo đợt kiểm kho",
    description: "Tạo đợt, nhập số đếm và lưu nháp lần đầu.",
    category: "Kho và nguyên liệu",
    path: "/product/checks",
    routePermission: false,
  },
  {
    id: "inventory_checks.update",
    label: "Sửa nháp / giải trình kiểm kho",
    description: "Sửa số đếm và giải trình chênh lệch của bản nháp.",
    category: "Kho và nguyên liệu",
    path: "/product/checks",
    routePermission: false,
  },
  {
    id: "inventory_checks.complete",
    label: "Chốt kiểm kho",
    description: "Xác nhận chốt và cập nhật tồn thực vào kho.",
    category: "Kho và nguyên liệu",
    path: "/product/checks",
    routePermission: false,
  },
  {
    id: "inventory_checks.delete",
    label: "Xoá bản nháp kiểm kho",
    description: "Xoá đợt kiểm kho đang ở trạng thái nháp.",
    category: "Kho và nguyên liệu",
    path: "/product/checks",
    routePermission: false,
  },
  {
    id: "inventory_closings.edit_past",
    label: "Sửa chốt kho quá ngày",
    description: "Cho phép chỉnh lại tồn nguyên liệu và tồn bán thành phẩm sau khi ngày chốt đã kết thúc.",
    category: "Kho và nguyên liệu",
    path: "/inventory/closing-history",
  },
  {
    id: "inventory_stock.view",
    label: "Xem tồn kho",
    description: "Xem tồn kho nguyên liệu tại kho và quầy pha chế.",
    category: "Kho và nguyên liệu",
    path: "/inventory",
  },
  {
    id: "inventory_history.access",
    label: "Lịch sử xuất nhập kho",
    description: "Xem lịch sử và chi tiết các phiếu nhập, xuất kho.",
    category: "Kho và nguyên liệu",
    path: "/inventory",
  },
  {
    id: "preparation_receipts.access",
    label: "Nhập kho pha chế",
    description: "Nhận nguyên liệu từ phiếu xuất kho vào quầy pha chế.",
    category: "Kho và nguyên liệu",
    path: "/inventory",
  },
  {
    id: "inventory_raw_closings.access",
    label: "Chốt tồn nguyên liệu pha chế",
    description: "Nhập và chốt số lượng nguyên liệu còn lại tại quầy cuối ngày.",
    category: "Kho và nguyên liệu",
    path: "/inventory",
  },
  {
    id: "inventory_prepared_closings.access",
    label: "Chốt tồn bán thành phẩm",
    description: "Nhập và chốt số lượng bán thành phẩm còn lại cuối ngày.",
    category: "Kho và nguyên liệu",
    path: "/inventory",
  },
  {
    id: "preparation_inventory.access",
    label: "Kho pha chế",
    description: "Nhận nguyên liệu vào quầy và chốt tồn pha chế cuối ngày.",
    category: "Hàng hóa",
    path: "/inventory/preparation-stock",
    hidden: true,
  },
  {
    id: "inventory_issues.access",
    label: "Xuất kho (đầy đủ)",
    description: "Xem, lập và hoàn thành phiếu xuất kho tại các khu vực được cấp.",
    category: "Hàng hóa",
    path: "/product/issues",
  },
  {
    id: "inventory_receipts.access",
    label: "Nhập kho (đầy đủ)",
    description: "Xem, lập, chỉnh sửa và hoàn thành phiếu nhập kho tại các khu vực được cấp.",
    category: "Hàng hóa",
    path: "/product/receipts",
  },
  {
    id: "inventory_receipts.view",
    label: "Xem minh chứng và phiếu nhập",
    description: "Xem danh sách, chi tiết và ảnh phiếu nhập.",
    category: "Hàng hóa",
    path: "/inventory-receipts",
  },
  {
    id: "inventory_receipts.create",
    label: "Tạo phiếu nhập hiện trường",
    description: "Tạo phiếu chụp nhanh hoặc phiếu đầy đủ.",
    category: "Hàng hóa",
    path: "/inventory-receipts",
  },
  {
    id: "inventory_receipts.update",
    label: "Chỉnh sửa minh chứng",
    description: "Chỉnh sửa kho nhập, nhà phân phối, người nhập và ghi chú minh chứng.",
    category: "Hàng hóa",
    path: "/inventory-receipts",
  },
  {
    id: "inventory_receipts.explain",
    label: "Giải trình hàng hóa",
    description: "Thêm, sửa, xóa hàng hóa trên minh chứng trước khi hoàn thành.",
    category: "Hàng hóa",
    path: "/inventory-receipts",
    routePermission: false,
  },
  {
    id: "inventory_receipts.lock",
    label: "Khóa minh chứng",
    description: "Khóa phiếu để ngừng chỉnh sửa và giải trình.",
    category: "Hàng hóa",
    path: "/inventory-receipts",
    routePermission: false,
  },
  {
    id: "inventory_receipts.unlock",
    label: "Mở khóa minh chứng",
    description: "Mở khóa để tiếp tục chỉnh sửa và giải trình.",
    category: "Hàng hóa",
    path: "/inventory-receipts",
    routePermission: false,
  },
  {
    id: "inventory_receipts.complete",
    label: "Hoàn thành nhập kho",
    description: "Chốt phiếu và cập nhật tồn kho.",
    category: "Hàng hóa",
    path: "/inventory-receipts",
  },
  {
    id: "inventory_receipts.cancel",
    label: "Hủy phiếu nhập",
    description: "Hủy phiếu chưa hoàn thành.",
    category: "Hàng hóa",
    path: "/inventory-receipts",
  },
  {
    id: "inventory_receipts.upload_image",
    label: "Tải ảnh phiếu nhập",
    description: "Tải ảnh watermark lên phiếu nhập.",
    category: "Hàng hóa",
    path: "/inventory-receipts",
  },
  {
    id: "products.create",
    label: "Tạo hàng hóa",
    description: "Tạo sản phẩm mới trong lúc giải trình.",
    category: "Hàng hóa",
    path: "/inventory-receipts",
  },
  {
    id: "products.attach_area",
    label: "Liên kết hàng hóa vào khu",
    description: "Cho phép sử dụng sản phẩm có sẵn tại khu hiện tại.",
    category: "Hàng hóa",
    path: "/inventory-receipts",
  },
  {
    id: "categories.access",
    label: "Danh mục",
    description: "Quản lý nhóm danh mục hàng hóa.",
    category: "Hàng hóa",
    path: "/categories",
  },
  {
    id: "internal_invoices.access",
    label: "Hóa đơn nội bộ",
    description: "Quản lý hóa đơn nội bộ.",
    category: "Kế toán",
    path: "/internal-invoices",
  },
  {
    id: "tax_invoices.access",
    label: "Hóa đơn thuế",
    description: "Quản lý hóa đơn thuế.",
    category: "Kế toán",
    path: "/tax-invoices",
  },
  {
    id: "social_listening.access",
    label: "Social listening",
    description: "Theo dõi và tổng hợp dữ liệu social listening.",
    category: "Marketing",
    path: "/social-listening",
  },
  {
    id: "gesture_studio.access",
    label: "Gesture studio",
    description: "Dùng khung 4 ngón tay để thay đổi vùng ảnh bằng AI.",
    category: "Marketing",
    path: "/gesture-studio",
  },
  {
    id: "seo_articles.access",
    label: "Bài viết SEO",
    description: "Quản lý bài viết SEO.",
    category: "Marketing",
    path: "/seo-articles",
  },
  {
    id: "activity_logs.access",
    label: "Nhật ký máy",
    description: "Xem lịch sử hoạt động máy trạm.",
    category: "Hệ thống",
    path: "/activity-logs",
  },
  {
    id: "accounts.access",
    label: "Tài khoản",
    description: "Tạo, sửa, khóa và phân quyền tài khoản.",
    category: "Hệ thống",
    path: "/accounts",
  },
];

export const ALL_APP_PERMISSIONS = PERMISSION_DEFINITIONS.map(
  (item) => item.id
) as AppPermission[];

export const MANAGED_PERMISSION_GROUPS = PERMISSION_DEFINITIONS.filter(
  (item) => !item.hidden
).reduce<Array<{ category: string; items: PermissionDefinition[] }>>((groups, item) => {
  const existing = groups.find((group) => group.category === item.category);
  if (existing) {
    existing.items.push(item);
    return groups;
  }

  groups.push({
    category: item.category,
    items: [item],
  });
  return groups;
}, []);

const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, AppPermission[]> = {
  admin: [...ALL_APP_PERMISSIONS],
  manager: ["payroll_estimate.access"],
  user: ["bills.access", "inventory_receipts.access", "inventory_issues.access"],
  server: ["bills.access"],
  bartender: [
    "bar.access",
    "bar.checkout",
    "preparation_receipts.access",
    "inventory_raw_closings.access",
    "inventory_prepared_closings.access",
  ],
};

const PATH_PERMISSION_RULES = [...PERMISSION_DEFINITIONS]
  .filter((item) => item.routePermission !== false)
  .sort((left, right) => right.path.length - left.path.length)
  .map((item) => ({
    path: item.path,
    permission: item.id,
  }));

export function normalizePermissionList(value: unknown): AppPermission[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set<AppPermission>(ALL_APP_PERMISSIONS);
  const unique = new Set<AppPermission>();

  value.forEach((item) => {
    if (typeof item !== "string") {
      return;
    }

    const normalized = item.trim() as AppPermission;
    if (!allowed.has(normalized) || unique.has(normalized)) {
      return;
    }

    unique.add(normalized);
  });

  return ALL_APP_PERMISSIONS.filter((permission) => unique.has(permission));
}

export function getDefaultPermissionsForRole(
  role: UserRole | null | undefined
): AppPermission[] {
  if (!role) {
    return [];
  }

  return [...(DEFAULT_ROLE_PERMISSIONS[role] || [])];
}

export function getEffectivePermissions(
  source:
    | Pick<AppUser, "role" | "permissions">
    | UserRole
    | null
    | undefined
): AppPermission[] {
  if (!source) {
    return [];
  }

  if (typeof source === "string") {
    return getDefaultPermissionsForRole(source);
  }

  if (String(source.role).trim().toLowerCase() === "admin") {
    return [...ALL_APP_PERMISSIONS];
  }

  if (Array.isArray(source.permissions)) {
    const normalized = normalizePermissionList(source.permissions);
    const inherited = new Set<AppPermission>();
    if (normalized.some(permission => ["inventory_checks.create","inventory_checks.update","inventory_checks.complete","inventory_checks.delete"].includes(permission))) inherited.add("inventory_checks.access");
    if (normalized.includes("reports.access")) {
      inherited.add("reports.products.view");
      inherited.add("reports.revenue.view");
      inherited.add("reports.ingredient_usage.view");
      inherited.add("reports.profit.access");
      inherited.add("reports.cost.access");
    }
    if (normalized.includes("inventory_receipts.access")) {
      [
        "inventory_receipts.view", "inventory_receipts.create", "inventory_receipts.update",
        "inventory_receipts.complete", "inventory_receipts.cancel", "inventory_receipts.upload_image",
        "inventory_receipts.explain", "inventory_receipts.lock", "inventory_receipts.unlock",
        "products.create", "products.attach_area",
      ].forEach((permission) => inherited.add(permission as AppPermission));
    }
    if (normalized.includes("preparation_inventory.access")) {
      [
        "preparation_receipts.access",
        "inventory_raw_closings.access",
        "inventory_prepared_closings.access",
      ].forEach((permission) => inherited.add(permission as AppPermission));
    }
    if (normalized.includes("products.components.update")) {
      inherited.add("products.selling.view");
    }
    return ALL_APP_PERMISSIONS.filter((permission) => normalized.includes(permission) || inherited.has(permission));
  }

  return getEffectivePermissions({ role: source.role, permissions: getDefaultPermissionsForRole(source.role) });
}

export function hasPermission(
  source:
    | Pick<AppUser, "role" | "permissions">
    | UserRole
    | null
    | undefined,
  permission: AppPermission
) {
  return getEffectivePermissions(source).includes(permission);
}

export function hasAnyPermission(
  source:
    | Pick<AppUser, "role" | "permissions">
    | UserRole
    | null
    | undefined,
  permissions: AppPermission[]
) {
  if (permissions.length === 0) {
    return true;
  }

  const effectivePermissions = new Set(getEffectivePermissions(source));
  return permissions.some((permission) => effectivePermissions.has(permission));
}

export function getPermissionDefinition(permission: AppPermission) {
  return PERMISSION_DEFINITIONS.find((item) => item.id === permission) || null;
}

export function getPermissionForPath(pathname: string): AppPermission | null {
  const normalizedPath = pathname.split(/[?#]/, 1)[0] || "/";
  if (normalizedPath === "/reports/kitchen-reconciliation") return "reports.ingredient_usage.view";

  const matchedRule = PATH_PERMISSION_RULES.find(({ path }) => {
    if (path === "/") {
      return normalizedPath === "/";
    }

    return normalizedPath === path || normalizedPath.startsWith(`${path}/`);
  });

  return matchedRule?.permission || null;
}

export function canAccessPath(
  source:
    | Pick<AppUser, "role" | "permissions">
    | UserRole
    | null
    | undefined,
  pathname: string
) {
  if (pathname.split(/[?#]/, 1)[0] === "/reports/kitchen-reconciliation") {
    return (typeof source === "string" ? source : source?.role) === "admin";
  }
  if (pathname.split(/[?#]/, 1)[0] === "/inventory" && hasPermission(source, "inventory_checks.access")) return true;
  if (pathname.split(/[?#]/, 1)[0] === "/pos") return hasAnyPermission(source, ["bills.access", "bar.checkout"]);
  const permission = getPermissionForPath(pathname);
  if (!permission) {
    return true;
  }

  return hasPermission(source, permission);
}

const DEFAULT_ROUTE_ORDER = [
  "/pos",
  "/sample-bills/products",
  "/payroll-estimate",
  "/payroll",
  "/timesheet",
  "/reports",
  "/reports/products",
  "/reports/revenue",
  "/reports/ingredient-usage",
  "/reports/profit",
  "/cash-flow",
  "/product/ingredients",
  "/product/suppliers",
  "/inventory",
  "/product",
  "/product/checks",
  "/product/receipts",
  "/inventory-receipts",
  "/categories",
  "/internal-invoices",
  "/tax-invoices",
  "/social-listening",
  "/gesture-studio",
  "/seo-articles",
  "/activity-logs",
  "/accounts",
] as const;

export function getDefaultRouteForUser(user: AppUser | null | undefined) {
  if (!user) {
    return "/login";
  }

  if (user.role === "bartender") {
    return "/bar";
  }

  if (user.role === "admin") {
    return "/admin/overview";
  }

  if (!hasPermission(user, "bills.access") && hasAnyPermission(user, ["inventory_checks.access", "inventory_receipts.view", "inventory_issues.access", "inventory_stock.view", "inventory_history.access"])) return "/inventory";
  const matchedPath = DEFAULT_ROUTE_ORDER.find((path) => canAccessPath(user, path));
  if (matchedPath) {
    return matchedPath;
  }
  if (hasPermission(user, "products.selling.view")) {
    return "/product";
  }
  if (hasAnyPermission(user, [
    "inventory_receipts.view",
    "inventory_issues.access",
    "inventory_stock.view",
    "inventory_history.access",
    "preparation_receipts.access",
    "inventory_raw_closings.access",
    "inventory_prepared_closings.access",
    "preparation_inventory.access",
  ])) {
    return "/inventory";
  }
  return "/login";
}

// Preserve existing admin/manager switching; other roles require an explicit grant.
export function canSwitchStore(user: AppUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === "admin" || user.role === "manager" || hasPermission(user, "stores.switch");
}

// null means unrestricted for the existing admin/manager selector.
export function getSelectableStoreIds(user: AppUser | null | undefined): string[] | null {
  if (user?.role === "admin" || user?.role === "manager") return null;
  const validIds = ["cafe", "restaurant", "bakery", "farm", "warehouse"];
  const assignedIds = user?.storeIds?.length ? user.storeIds : user?.storeId ? [user.storeId] : [];
  return [...new Set(assignedIds.filter((id) => validIds.includes(id)))];
}
