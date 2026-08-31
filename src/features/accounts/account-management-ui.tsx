import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  KeyRound,
  Pencil,
  Search,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  getAccountPermissionCount,
  getAccountPermissionGroups,
} from "@/features/accounts/accountPermissions";
import {
  getDefaultPermissionsForRole,
  MANAGED_PERMISSION_GROUPS,
  normalizePermissionList,
} from "@/lib/permissions";
import type { ManagedUser } from "@/services/users.api";
import type { AppPermission, UserRole } from "@/types/auth";

export const STORE_OPTIONS = [
  { value: "", label: "Không gắn cửa hàng" },
  { value: "cafe", label: "Cafe" },
  { value: "restaurant", label: "Lẩu / Bếp" },
  { value: "bakery", label: "Tiệm bánh" },
  { value: "farm", label: "Farm" },
  { value: "warehouse", label: "Kho thợ" },
];

export const INVENTORY_AREA_OPTIONS = [
  { value: "cafe", label: "Cafe" },
  { value: "restaurant", label: "Lẩu / Bếp" },
  { value: "farm", label: "Farm" },
  { value: "warehouse", label: "Kho thợ" },
];

export const ROLE_OPTIONS: Array<{
  value: UserRole;
  label: string;
  description: string;
}> = [
  { value: "admin", label: "Quản trị viên", description: "Toàn quyền hệ thống" },
  { value: "manager", label: "Quản lý", description: "Điều hành theo quyền được cấp" },
  { value: "user", label: "Thu ngân", description: "Bán hàng và xử lý giao dịch" },
  { value: "server", label: "Phục vụ", description: "Tạo và theo dõi bill" },
  { value: "bartender", label: "Pha chế", description: "Quầy bar và kho nguyên liệu" },
];

export type AccountFormState = {
  email: string;
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
  storeId: string;
  storeIds: string[];
  isActive: boolean;
  permissions: AppPermission[];
};

export type AccountDetailTab = "info" | "permissions" | "access";

const CATEGORY_LABELS: Record<string, string> = {
  "Tong quan": "Tổng quan",
  "Giao dich": "Giao dịch",
  "Hang hoa": "Hàng hóa",
  "Kho hang": "Kho hàng",
  "Bao cao": "Báo cáo",
  "Quan tri": "Quản trị",
  "Nhan su": "Nhân sự",
  "He thong": "Hệ thống",
  "Ke toan": "Kế toán",
};

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] || category;
}

export function roleLabel(role: ManagedUser["role"]) {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label || role;
}

export function storeSummary(user: Pick<ManagedUser, "storeId" | "storeIds">) {
  const storeIds = user.storeIds?.length
    ? user.storeIds
    : user.storeId
      ? [user.storeId]
      : [];
  if (!storeIds.length) return "Chưa gắn khu vực";
  return storeIds
    .map(
      (id) =>
        INVENTORY_AREA_OPTIONS.find((option) => option.value === id)?.label || id,
    )
    .join(", ");
}

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  size?: "lg" | "xl";
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
};

function Modal({
  open,
  title,
  description,
  size = "lg",
  children,
  footer,
  onClose,
}: ModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-dialog-title"
        className={`flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-sm bg-white shadow-2xl sm:rounded-sm ${
          size === "xl" ? "sm:max-w-6xl 2xl:max-w-7xl" : "sm:max-w-2xl"
        }`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="account-dialog-title" className="truncate text-lg font-semibold text-slate-950">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          <Button
            ref={closeRef}
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Đóng"
            title="Đóng"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-3 sm:px-6">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>
  );
}

type AccountDetailsProps = {
  item: ManagedUser;
  tab: AccountDetailTab;
  canManageAccess: boolean;
  deletingDisabled: boolean;
  onTabChange: (tab: AccountDetailTab) => void;
  onEditAccount: () => void;
  onEditPermissions: () => void;
  onDelete: () => void;
};

export function AccountDetails({
  item,
  tab,
  canManageAccess,
  deletingDisabled,
  onTabChange,
  onEditAccount,
  onEditPermissions,
  onDelete,
}: AccountDetailsProps) {
  const permissionGroups = getAccountPermissionGroups(item)
    .map((group) => ({
      ...group,
      items: group.items.filter((permission) => permission.enabled),
    }))
    .filter((group) => group.items.length > 0);

  const tabs: Array<{ id: AccountDetailTab; label: string }> = [
    { id: "info", label: "Thông tin" },
    { id: "permissions", label: "Phân quyền" },
    { id: "access", label: "Phạm vi truy cập" },
  ];

  return (
    <div className="border-t border-emerald-200 bg-white">
      <div className="flex overflow-x-auto border-b border-slate-200 px-4 sm:px-6">
        {tabs.map((itemTab) => (
          <button
            key={itemTab.id}
            type="button"
            className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              tab === itemTab.id
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
            onClick={() => onTabChange(itemTab.id)}
          >
            {itemTab.label}
          </button>
        ))}
      </div>

      {tab === "info" ? (
        <div className="p-4 sm:p-6">
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
            <InfoValue label="Tên hiển thị" value={item.displayName || "Chưa có"} />
            <InfoValue label="Tên đăng nhập" value={item.username || "Chưa có"} />
            <InfoValue label="Email" value={item.email} />
            <InfoValue label="Vai trò" value={roleLabel(item.role)} />
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="justify-center text-rose-600 hover:bg-rose-50 hover:text-rose-700 sm:justify-start"
              disabled={deletingDisabled}
              onClick={onDelete}
            >
              Xóa tài khoản
            </Button>
            <Button type="button" className="gap-2 bg-emerald-700 hover:bg-emerald-800" onClick={onEditAccount}>
              <Pencil className="h-4 w-4" />
              Chỉnh sửa
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "permissions" ? (
        <div className="p-4 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-slate-950">Tính năng được sử dụng</h3>
              <p className="mt-1 text-sm text-slate-500">
                {roleLabel(item.role)} · {getAccountPermissionCount(item)} quyền đang có hiệu lực
              </p>
            </div>
            {canManageAccess ? (
              <Button type="button" className="gap-2 bg-emerald-700 hover:bg-emerald-800" onClick={onEditPermissions}>
                <Pencil className="h-4 w-4" />
                Chỉnh sửa
              </Button>
            ) : null}
          </div>

          {permissionGroups.length ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {permissionGroups.map((group) => (
                <div key={group.category} className="rounded-sm border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-slate-900">{categoryLabel(group.category)}</h4>
                    <span className="text-xs font-medium text-emerald-700">{group.items.length} quyền</span>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {group.items.map((permission) => (
                      <li key={permission.id} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{permission.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Tài khoản này chưa được cấp tính năng nào.
            </div>
          )}
        </div>
      ) : null}

      {tab === "access" ? (
        <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-6">
          <AccessItem icon={<Store className="h-5 w-5" />} label="Khu vực được truy cập" value={storeSummary(item)} />
          <AccessItem icon={<ShieldCheck className="h-5 w-5" />} label="Trạng thái" value={item.isActive ? "Đang hoạt động" : "Đã khóa"} />
          <AccessItem icon={<KeyRound className="h-5 w-5" />} label="Số quyền hiệu lực" value={`${getAccountPermissionCount(item)} tính năng`} />
        </div>
      ) : null}
    </div>
  );
}

function InfoValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-slate-200 pb-2">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm text-slate-900">{value}</div>
    </div>
  );
}

function AccessItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-sm border border-slate-200 bg-slate-50 p-4">
      <span className="text-emerald-700">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

type PermissionEditorProps = {
  open: boolean;
  target: ManagedUser | null;
  canManageAccess: boolean;
  permissions: AppPermission[];
  role: UserRole;
  saving: boolean;
  error: string;
  onClose: () => void;
  onRoleChange: (role: UserRole) => void;
  onToggle: (permission: AppPermission) => void;
  onReset: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onSave: () => void;
};

export function PermissionEditorModal({
  open,
  target,
  canManageAccess,
  permissions,
  role,
  saving,
  error,
  onClose,
  onRoleChange,
  onToggle,
  onReset,
  onSelectAll,
  onClear,
  onSave,
}: PermissionEditorProps) {
  const [mode, setMode] = useState<"role" | "custom">("role");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("role");
    setSearch("");
    setActiveCategory("");
  }, [open, target?.id]);

  const enabled = useMemo(() => new Set(permissions), [permissions]);
  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return MANAGED_PERMISSION_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!keyword) return true;
        return `${item.label} ${item.description} ${group.category}`.toLowerCase().includes(keyword);
      }),
    })).filter((group) => group.items.length > 0);
  }, [search]);

  const roleOption = ROLE_OPTIONS.find((item) => item.value === role);

  return (
    <Modal
      open={open}
      size="xl"
      title={`Sửa phân quyền của ${target?.username || target?.email || "tài khoản"}`}
      description="Chọn vai trò mặc định hoặc tinh chỉnh từng tính năng cho tài khoản."
      onClose={onClose}
      footer={
        <>
          {error ? <p className="mr-auto text-sm text-rose-600">{error}</p> : null}
          <Button type="button" variant="ghost" onClick={onClose}>Bỏ qua</Button>
          <Button type="button" className="bg-emerald-700 hover:bg-emerald-800" onClick={onSave} isLoading={saving} disabled={!canManageAccess}>
            Lưu phân quyền
          </Button>
        </>
      }
    >
      <div className="border-b border-slate-200 px-5 pt-3 sm:px-6">
        <div className="flex gap-6 overflow-x-auto">
          {[
            ["role", "Phân quyền theo vai trò"],
            ["custom", "Phân quyền khác"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`shrink-0 border-b-2 pb-3 text-sm font-medium ${
                mode === value ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500"
              }`}
              onClick={() => setMode(value as "role" | "custom")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 bg-slate-50 p-4 sm:p-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 rounded-sm border border-slate-200 bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-medium text-slate-500">Vai trò</span>
              <select
                value={role}
                onChange={(event) => onRoleChange(event.target.value as UserRole)}
                disabled={!canManageAccess}
                className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                {ROLE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onReset} disabled={!canManageAccess}>Mặc định</Button>
              <Button type="button" size="sm" variant="outline" onClick={onSelectAll} disabled={!canManageAccess || role === "admin"}>Bật tất cả</Button>
              <Button type="button" size="sm" variant="outline" onClick={onClear} disabled={!canManageAccess || role === "admin"}>Bỏ hết</Button>
            </div>
          </div>

          {!canManageAccess ? (
            <div className="mt-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Chỉ quản trị viên mới được chỉnh sửa phân quyền.
            </div>
          ) : null}
          {role === "admin" ? (
            <div className="mt-4 flex gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              Tài khoản quản trị viên luôn có toàn quyền hệ thống.
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {filteredGroups.map((group) => {
              const groupEnabled = group.items.filter((item) => enabled.has(item.id)).length;
              return (
                <section key={group.category} id={`permission-${permissionSlug(group.category)}`} className="scroll-mt-4 rounded-sm border border-slate-200 bg-white">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">{categoryLabel(group.category)}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">{groupEnabled}/{group.items.length} tính năng được bật</p>
                    </div>
                    <span className="text-xs text-slate-400">{roleOption?.description}</span>
                  </div>
                  <div className="space-y-2 p-3 sm:p-4">
                    {group.items.map((item) => {
                      const checked = role === "admin" || enabled.has(item.id);
                      return (
                        <label key={item.id} className={`flex items-start gap-3 rounded-sm border px-3 py-3 ${checked ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200"} ${role === "admin" ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/50"}`}>
                          <input type="checkbox" checked={checked} disabled={!canManageAccess || role === "admin"} onChange={() => onToggle(item.id)} className="mt-0.5 h-4 w-4 accent-emerald-700" />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-800">{item.label}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <aside className="order-first h-fit rounded-sm border border-slate-200 bg-white lg:order-last lg:w-56">
          <div className="border-b border-slate-200 p-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input type="search" name="permission-search" autoComplete="off" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm phân quyền" className="h-9 w-full rounded-sm border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-emerald-500" />
            </label>
          </div>
          <nav className="flex gap-1 overflow-x-auto p-2 lg:block lg:space-y-1">
            {MANAGED_PERMISSION_GROUPS.map((group) => {
              const slug = permissionSlug(group.category);
              return (
                <a key={group.category} href={`#permission-${slug}`} className={`block shrink-0 whitespace-nowrap px-3 py-2 text-xs font-medium ${activeCategory === slug ? "bg-emerald-50 text-emerald-700" : "text-slate-700 hover:bg-slate-50"}`} onClick={() => setActiveCategory(slug)}>
                  {categoryLabel(group.category)}
                </a>
              );
            })}
          </nav>
        </aside>
      </div>
    </Modal>
  );
}

function permissionSlug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

type AccountEditorProps = {
  open: boolean;
  editingId: string;
  form: AccountFormState;
  canManageAccess: boolean;
  saving: boolean;
  error: string;
  onClose: () => void;
  onChange: (patch: Partial<AccountFormState>) => void;
  onRoleChange: (role: UserRole) => void;
  onSave: () => void;
};

export function AccountEditorModal({
  open,
  editingId,
  form,
  canManageAccess,
  saving,
  error,
  onClose,
  onChange,
  onRoleChange,
  onSave,
}: AccountEditorProps) {
  const requiresAreas = form.role === "bartender" || form.permissions.some((permission) => permission.startsWith("inventory_"));
  const permissionCount = form.role === "admin" ? MANAGED_PERMISSION_GROUPS.reduce((count, group) => count + group.items.length, 0) : normalizePermissionList(form.permissions).length;
  const warehouseQuickPermissions = [
    { id: "inventory_receipts.access" as const, label: "Nhập kho", description: "Lập và hoàn thành phiếu nhập kho." },
    { id: "inventory_issues.access" as const, label: "Xuất kho", description: "Lập và hoàn thành phiếu xuất kho." },
  ];
  const toggleWarehousePermission = (permission: AppPermission) => {
    const checked = form.permissions.includes(permission);
    const permissions = checked
      ? form.permissions.filter((item) => item !== permission)
      : normalizePermissionList([...form.permissions, permission]);
    onChange({
      permissions,
      ...(!checked && form.storeIds.length === 0 && form.storeId
        ? { storeIds: [form.storeId] }
        : {}),
    });
  };

  return (
    <Modal open={open} title={editingId ? "Chỉnh sửa tài khoản" : "Tạo tài khoản mới"} description="Thông tin đăng nhập và phạm vi sử dụng của tài khoản." onClose={onClose} footer={
      <>
        {error ? <p className="mr-auto text-sm text-rose-600">{error}</p> : null}
        <Button type="button" variant="ghost" onClick={onClose}>Bỏ qua</Button>
        <Button type="button" className="bg-emerald-700 hover:bg-emerald-800" onClick={onSave} isLoading={saving}>{editingId ? "Lưu thay đổi" : "Tạo tài khoản"}</Button>
      </>
    }>
      <div className="space-y-6 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="managed-account-email" autoComplete="off" label="Email" value={form.email} onChange={(event) => onChange({ email: event.target.value })} placeholder="manager@admin.local" className="rounded-sm" />
          <Input name="managed-account-username" autoComplete="off" label="Tên đăng nhập" value={form.username} onChange={(event) => onChange({ username: event.target.value })} placeholder="manager" className="rounded-sm" />
          <Input name="managed-account-display-name" autoComplete="off" label="Tên hiển thị" value={form.displayName} onChange={(event) => onChange({ displayName: event.target.value })} placeholder="Quản lý ca" className="rounded-sm" />
          <Input type="password" name="managed-account-new-password" autoComplete="new-password" label={editingId ? "Mật khẩu mới" : "Mật khẩu"} value={form.password} onChange={(event) => onChange({ password: event.target.value })} placeholder={editingId ? "Để trống nếu không đổi" : "Nhập mật khẩu"} className="rounded-sm" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Vai trò</span>
            {canManageAccess ? <select value={form.role} onChange={(event) => onRoleChange(event.target.value as UserRole)} className="h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">{ROLE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select> : <div className="flex h-10 items-center rounded-sm border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">{roleLabel(form.role)} · chỉ admin được sửa</div>}
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Cửa hàng chính</span>
            <select value={form.storeId} onChange={(event) => onChange({ storeId: event.target.value })} className="h-10 w-full rounded-sm border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100">{STORE_OPTIONS.map((item) => <option key={item.value || "none"} value={item.value}>{item.label}</option>)}</select>
          </label>
        </div>

        {requiresAreas ? (
          <fieldset className="rounded-sm border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex items-start justify-between gap-3"><div><legend className="text-sm font-semibold text-emerald-950">Khu vực được truy cập</legend><p className="mt-1 text-xs text-emerald-800">Chọn ít nhất một khu vực cho tài khoản có quyền kho.</p></div><button type="button" className="text-xs font-semibold text-emerald-700" onClick={() => onChange({ storeIds: INVENTORY_AREA_OPTIONS.map((option) => option.value) })}>Chọn tất cả</button></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{INVENTORY_AREA_OPTIONS.map((option) => { const checked = form.storeIds.includes(option.value); return <label key={option.value} className={`flex cursor-pointer items-center gap-2 border px-3 py-2.5 text-sm ${checked ? "border-emerald-400 bg-white text-emerald-900" : "border-slate-200 bg-white/70 text-slate-600"}`}><input type="checkbox" checked={checked} onChange={() => onChange({ storeIds: checked ? form.storeIds.filter((id) => id !== option.value) : [...form.storeIds, option.value] })} className="h-4 w-4 accent-emerald-700" />{option.label}</label>; })}</div>
          </fieldset>
        ) : null}

        <div className="rounded-sm border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-slate-900">Phân quyền chức năng</h3><p className="mt-1 text-sm text-slate-500">Chỉnh sửa chi tiết trong tab Phân quyền sau khi lưu tài khoản.</p></div><span className="whitespace-nowrap bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">{permissionCount} tính năng</span></div>
          {form.role === "admin" ? <p className="mt-3 flex gap-2 text-sm text-emerald-800"><ShieldCheck className="h-4 w-4 shrink-0" />Admin luôn có toàn quyền hệ thống.</p> : null}
          {canManageAccess && form.role !== "admin" ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{warehouseQuickPermissions.map((permission) => {
            const checked = form.permissions.includes(permission.id);
            return <label key={permission.id} className={"flex cursor-pointer items-start gap-3 border bg-white p-3 " + (checked ? "border-emerald-400 text-emerald-950" : "border-slate-200 text-slate-700")}><input type="checkbox" checked={checked} onChange={() => toggleWarehousePermission(permission.id)} className="mt-0.5 h-4 w-4 accent-emerald-700" /><span><span className="block text-sm font-semibold">{permission.label}</span><span className="mt-1 block text-xs text-slate-500">{permission.description}</span></span></label>;
          })}</div> : null}
        </div>

        <label className="flex items-center justify-between rounded-sm border border-slate-200 px-4 py-3"><span><span className="block text-sm font-medium text-slate-900">Trạng thái đăng nhập</span><span className="mt-1 block text-xs text-slate-500">Tắt để khóa tài khoản.</span></span><input type="checkbox" checked={form.isActive} onChange={(event) => onChange({ isActive: event.target.checked })} className="h-4 w-4 accent-emerald-700" /></label>
      </div>
    </Modal>
  );
}
