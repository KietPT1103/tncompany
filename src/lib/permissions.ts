import type { AppPermission, AppUser, UserRole } from "@/types/auth";

type PermissionDefinition = {
  id: AppPermission;
  label: string;
  description: string;
  category: string;
  path: string;
  hidden?: boolean;
};

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    id: "dashboard.access",
    label: "Dashboard",
    description: "Xem trang dashboard tong hop.",
    category: "Tong quan",
    path: "/",
    hidden: true,
  },
  {
    id: "bills.access",
    label: "Hoa don",
    description: "Xem va thao tac danh sach hoa don.",
    category: "Giao dich",
    path: "/pos",
  },
  {
    id: "bar.access",
    label: "Màn hình pha chế",
    description: "Xem và cập nhật tiến độ các bill pha chế.",
    category: "Giao dịch",
    path: "/bar",
    hidden: true,
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
    label: "Tao bill ao",
    description: "Sinh bill ao theo tong doanh thu va so luong bill.",
    category: "Giao dich",
    path: "/virtual-bills",
    hidden: true,
  },
  {
    id: "sample_bills.access",
    label: "Tao bill mau",
    description: "Quan ly san pham va tao file bill mau.",
    category: "Giao dich",
    path: "/sample-bills",
  },
  {
    id: "payroll_estimate.access",
    label: "Uoc luong luong",
    description: "Lap lich va uoc luong luong.",
    category: "Nhan su",
    path: "/payroll-estimate",
  },
  {
    id: "payroll.access",
    label: "Tinh luong",
    description: "Quan ly bang luong va nhan su.",
    category: "Nhan su",
    path: "/payroll",
  },
  {
    id: "timesheet.access",
    label: "Cham cong",
    description: "Xem va cap nhat bang cham cong.",
    category: "Nhan su",
    path: "/timesheet",
  },
  {
    id: "reports.access",
    label: "Bao cao",
    description: "Xem va luu bao cao doanh thu, chi phi.",
    category: "Bao cao",
    path: "/reports",
  },
  {
    id: "cash_flow.access",
    label: "Dong tien",
    description: "Theo doi dong tien va tong hop thu chi.",
    category: "Bao cao",
    path: "/cash-flow",
  },
  {
    id: "product.access",
    label: "San pham",
    description: "Quan ly danh muc san pham va gia ban.",
    category: "Hang hoa",
    path: "/product",
  },
  {
    id: "inventory_checks.access",
    label: "Kiem kho",
    description: "Lap va quan ly phieu kiem kho.",
    category: "Hang hoa",
    path: "/product/checks",
  },
  {
    id: "inventory_receipts.access",
    label: "Nhap hang",
    description: "Lap va quan ly phieu nhap kho.",
    category: "Hang hoa",
    path: "/product/receipts",
    hidden: true,
  },
  {
    id: "inventory_receipts.view",
    label: "Xem phiếu nhập hiện trường",
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
    label: "Giải trình phiếu nhập",
    description: "Thêm, sửa và xóa dòng hàng khi phiếu chưa khóa.",
    category: "Hàng hóa",
    path: "/inventory-receipts",
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
    label: "Danh muc",
    description: "Quan ly nhom danh muc hang hoa.",
    category: "Hang hoa",
    path: "/categories",
  },
  {
    id: "internal_invoices.access",
    label: "Hoa don noi bo",
    description: "Quan ly hoa don noi bo.",
    category: "Ke toan",
    path: "/internal-invoices",
  },
  {
    id: "tax_invoices.access",
    label: "Hoa don thue",
    description: "Quan ly hoa don thue.",
    category: "Ke toan",
    path: "/tax-invoices",
  },
  {
    id: "social_listening.access",
    label: "Social listening",
    description: "Theo doi va tong hop du lieu social listening.",
    category: "Marketing",
    path: "/social-listening",
  },
  {
    id: "gesture_studio.access",
    label: "Gesture studio",
    description: "Dung khung 4 ngon tay de thay doi vung anh bang AI.",
    category: "Marketing",
    path: "/gesture-studio",
  },
  {
    id: "seo_articles.access",
    label: "Bai viet SEO",
    description: "Quan ly bai viet SEO.",
    category: "Marketing",
    path: "/seo-articles",
  },
  {
    id: "activity_logs.access",
    label: "Nhat ky may",
    description: "Xem lich su hoat dong may tram.",
    category: "He thong",
    path: "/activity-logs",
  },
  {
    id: "accounts.access",
    label: "Tai khoan",
    description: "Tao, sua, khoa va phan quyen tai khoan.",
    category: "He thong",
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
  user: ["bills.access"],
  server: ["bills.access"],
  bartender: ["bar.access", "bar.checkout"],
};

const PATH_PERMISSION_RULES = [...PERMISSION_DEFINITIONS]
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

  if (source.role === "admin") {
    return [...ALL_APP_PERMISSIONS];
  }

  if (Array.isArray(source.permissions)) {
    const normalized = normalizePermissionList(source.permissions);
    if (
      (source.role === "user" || source.role === "server") &&
      !normalized.includes("bills.access")
    ) {
      normalized.push("bills.access");
    }
    if (normalized.includes("inventory_receipts.access")) {
      const inherited: AppPermission[] = [
        "inventory_receipts.view", "inventory_receipts.create", "inventory_receipts.update",
        "inventory_receipts.complete", "inventory_receipts.cancel", "inventory_receipts.upload_image",
        "products.create", "products.attach_area",
      ];
      return ALL_APP_PERMISSIONS.filter((permission) => normalized.includes(permission) || inherited.includes(permission));
    }
    return normalized;
  }

  return getDefaultPermissionsForRole(source.role);
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
  const permission = getPermissionForPath(pathname);
  if (!permission) {
    return true;
  }

  return hasPermission(source, permission);
}

const DEFAULT_ROUTE_ORDER = [
  "/",
  "/pos",
  "/sample-bills/products",
  "/payroll-estimate",
  "/payroll",
  "/timesheet",
  "/reports",
  "/cash-flow",
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

  const matchedPath = DEFAULT_ROUTE_ORDER.find((path) => canAccessPath(user, path));
  return matchedPath || "/pos";
}
