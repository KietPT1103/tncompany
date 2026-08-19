"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleCheck,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SelectBox, type SelectBoxOption } from "@/components/ui/SelectBox";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { getAccountPermissionCount } from "@/features/accounts/accountPermissions";
import {
  getDefaultPermissionsForRole,
  getPermissionDefinition,
  MANAGED_PERMISSION_GROUPS,
  normalizePermissionList,
} from "@/lib/permissions";
import {
  createManagedUser,
  deleteManagedUser,
  getManagedUsers,
  type ManagedUser,
  updateManagedUser,
} from "@/services/users.api";
import type { AppPermission, UserRole } from "@/types/auth";
import {
  AccountDetails,
  AccountEditorModal,
  type AccountDetailTab,
  type AccountFormState,
  INVENTORY_AREA_OPTIONS,
  PermissionEditorModal,
  ROLE_OPTIONS,
  STORE_OPTIONS,
  roleLabel,
  storeSummary,
} from "@/features/accounts/account-management-ui";

const INVENTORY_ACCOUNT_PERMISSIONS = new Set<AppPermission>([
  "inventory_receipts.access",
  "inventory_receipts.view",
  "inventory_receipts.create",
  "inventory_receipts.update",
  "inventory_receipts.complete",
  "inventory_receipts.cancel",
  "inventory_receipts.upload_image",
  "products.create",
  "products.attach_area",
]);

const DEFAULT_FORM: AccountFormState = {
  email: "",
  username: "",
  displayName: "",
  password: "",
  role: "manager",
  storeId: "cafe",
  storeIds: [],
  isActive: true,
  permissions: getDefaultPermissionsForRole("manager"),
};

type AccountStatusFilter = "all" | "active" | "locked";

const STATUS_FILTER_OPTIONS: readonly SelectBoxOption<AccountStatusFilter>[] = [
  { value: "all", label: "Tất cả trạng thái", icon: Filter },
  { value: "active", label: "Đang hoạt động", icon: CircleCheck },
  { value: "locked", label: "Đã khóa", icon: ShieldCheck },
];

function requiresAssignedStore(role: UserRole, permissions: AppPermission[]) {
  return role === "bartender" || permissions.some((permission) => INVENTORY_ACCOUNT_PERMISSIONS.has(permission));
}

function formFromUser(item: ManagedUser): AccountFormState {
  const permissions = normalizePermissionList(item.permissions);
  const storeIds = item.storeIds?.length
    ? item.storeIds
    : item.storeId
      ? [item.storeId]
      : requiresAssignedStore(item.role, permissions)
        ? INVENTORY_AREA_OPTIONS.map((option) => option.value)
        : [];
  return {
    email: item.email,
    username: item.username || "",
    displayName: item.displayName || "",
    password: "",
    role: item.role,
    storeId: item.storeId || "",
    storeIds,
    isActive: item.isActive,
    permissions,
  };
}

function permissionCount(user: Pick<ManagedUser, "role" | "permissions">) {
  return getAccountPermissionCount(user);
}

export default function AccountManagementPage() {
  const { user } = useAuth();
  const { storeId } = useStore();
  const canManageAccess = user?.role === "admin";
  const [items, setItems] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccountStatusFilter>("all");
  const [expandedId, setExpandedId] = useState("");
  const [detailTab, setDetailTab] = useState<AccountDetailTab>("info");
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [permissionTargetId, setPermissionTargetId] = useState("");
  const [form, setForm] = useState<AccountFormState>({ ...DEFAULT_FORM, storeId });

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      setItems(await getManagedUsers());
    } catch (loadErr) {
      console.error(loadErr);
      setError(loadErr instanceof Error ? loadErr.message : "Không tải được tài khoản.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const permissionTarget = useMemo(() => items.find((item) => item.id === permissionTargetId) || null, [items, permissionTargetId]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === "active" && !item.isActive) return false;
      if (statusFilter === "locked" && item.isActive) return false;
      if (!keyword) return true;
      const permissionText = normalizePermissionList(item.permissions)
        .map((permission) => getPermissionDefinition(permission)?.label || permission)
        .join(" ")
        .toLowerCase();
      return [item.email, item.username, item.displayName, item.role, item.storeId, storeSummary(item), permissionText]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [items, search, statusFilter]);

  const counts = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.isActive).length,
    locked: items.filter((item) => !item.isActive).length,
  }), [items]);

  function openCreate() {
    setSearch("");
    setEditingId("");
    setForm({ ...DEFAULT_FORM, storeId, permissions: getDefaultPermissionsForRole("manager") });
    setError("");
    setMessage("");
    setAccountModalOpen(true);
  }

  function closeAccountEditor() {
    setAccountModalOpen(false);
    if (!editingId) setSearch("");
  }

  function openEdit(item: ManagedUser) {
    setEditingId(item.id);
    setForm(formFromUser(item));
    setError("");
    setMessage("");
    setAccountModalOpen(true);
  }

  function openPermissionEditor(item: ManagedUser) {
    setPermissionTargetId(item.id);
    setEditingId(item.id);
    setForm(formFromUser(item));
    setError("");
    setPermissionModalOpen(true);
  }

  function toggleExpanded(item: ManagedUser) {
    setExpandedId((current) => current === item.id ? "" : item.id);
    setDetailTab("info");
  }

  function handleRoleChange(nextRole: UserRole) {
    setForm((current) => ({
      ...current,
      role: nextRole,
      permissions: getDefaultPermissionsForRole(nextRole),
      ...(nextRole === "bartender" ? { storeId: "cafe", storeIds: ["cafe"] } : {}),
    }));
  }

  function handlePermissionToggle(permission: AppPermission) {
    if (form.role === "admin") return;
    setForm((current) => {
      const exists = current.permissions.includes(permission);
      return {
        ...current,
        permissions: exists
          ? current.permissions.filter((item) => item !== permission)
          : normalizePermissionList([...current.permissions, permission]),
        storeIds: !exists && INVENTORY_ACCOUNT_PERMISSIONS.has(permission) && current.storeIds.length === 0
          ? INVENTORY_AREA_OPTIONS.map((option) => option.value)
          : current.storeIds,
      };
    });
  }

  function handleResetPermissions() {
    setForm((current) => ({ ...current, permissions: getDefaultPermissionsForRole(current.role) }));
  }

  function handleSelectAllPermissions() {
    if (form.role === "admin") return;
    setForm((current) => ({
      ...current,
      permissions: normalizePermissionList(MANAGED_PERMISSION_GROUPS.flatMap((group) => group.items.map((item) => item.id))),
      storeIds: current.storeIds.length ? current.storeIds : INVENTORY_AREA_OPTIONS.map((option) => option.value),
    }));
  }

  function handleClearPermissions() {
    if (form.role === "admin") return;
    setForm((current) => ({ ...current, permissions: [] }));
  }

  function patchForm(patch: Partial<AccountFormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function handleSubmit() {
    setError("");
    setMessage("");
    if (!form.email.trim()) {
      setError("Vui lòng nhập email tài khoản.");
      return;
    }
    if (!editingId && !form.password) {
      setError("Vui lòng nhập mật khẩu cho tài khoản mới.");
      return;
    }
    if (requiresAssignedStore(form.role, form.permissions) && form.storeIds.length === 0) {
      setError("Tài khoản có chức năng kho phải được cấp ít nhất một khu vực.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateManagedUser(editingId, {
          email: form.email,
          username: form.username,
          displayName: form.displayName,
          storeId: form.storeId,
          storeIds: form.storeIds,
          isActive: form.isActive,
          ...(canManageAccess ? { role: form.role, permissions: form.permissions } : {}),
          ...(form.password ? { password: form.password } : {}),
        });
        setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
        setMessage("Đã cập nhật tài khoản.");
      } else {
        const created = await createManagedUser({
          email: form.email,
          username: form.username,
          displayName: form.displayName,
          password: form.password,
          role: form.role,
          storeId: form.storeId,
          storeIds: form.storeIds,
          isActive: form.isActive,
          permissions: form.permissions,
        });
        setItems((current) => [created, ...current]);
        setEditingId(created.id);
        setMessage("Đã tạo tài khoản mới.");
      }
      setAccountModalOpen(false);
    } catch (submitErr) {
      console.error(submitErr);
      setError(submitErr instanceof Error ? submitErr.message : "Không lưu được tài khoản.");
    } finally {
      setSaving(false);
    }
  }

  async function savePermissions() {
    if (!permissionTargetId || !canManageAccess) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateManagedUser(permissionTargetId, { role: form.role, permissions: form.permissions });
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
      setPermissionModalOpen(false);
      setMessage("Đã cập nhật phân quyền.");
    } catch (saveErr) {
      console.error(saveErr);
      setError(saveErr instanceof Error ? saveErr.message : "Không lưu được phân quyền.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: ManagedUser) {
    if (item.id === user?.id || !confirm(`Xóa tài khoản ${item.displayName || item.username || item.email}?`)) return;
    setSaving(true);
    setError("");
    try {
      await deleteManagedUser(item.id);
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      setExpandedId("");
      setMessage("Đã xóa tài khoản.");
    } catch (deleteErr) {
      console.error(deleteErr);
      setError(deleteErr instanceof Error ? deleteErr.message : "Không xóa được tài khoản.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-50 px-4 py-5 sm:px-6 lg:px-8 2xl:px-10 2xl:py-7">
      <div className="mx-auto max-w-[1440px] space-y-5 2xl:max-w-[1720px] 2xl:space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Thiết lập hệ thống</span><span aria-hidden="true">/</span><span className="font-medium text-slate-700">Tài khoản</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-800 text-[#F6C85F]"><UsersRound className="h-5 w-5" /></span>
              <div><h1 className="font-smooch text-4xl font-bold leading-none text-emerald-800 sm:text-6xl">Tài khoản hệ thống</h1><p className="mt-1 text-sm text-slate-500">Quản lý người dùng, vai trò và quyền truy cập trong cửa hàng.</p></div>
            </div>
          </div>
          <Button type="button" className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800 sm:w-auto" onClick={openCreate}><Plus className="h-4 w-4" />Tạo tài khoản</Button>
        </header>

        {error && !accountModalOpen && !permissionModalOpen ? <div role="alert" className="rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {message ? <div role="status" className="rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

        <section className="grid grid-cols-1 overflow-hidden rounded-sm border border-slate-200 bg-white sm:grid-cols-3">
          <SummaryCell label="Tổng tài khoản" value={counts.total} icon={<UserRound className="h-4 w-4" />} />
          <SummaryCell label="Đang hoạt động" value={counts.active} icon={<CircleCheck className="h-4 w-4" />} tone="green" />
          <SummaryCell label="Đã khóa" value={counts.locked} icon={<ShieldCheck className="h-4 w-4" />} tone="slate" />
        </section>

        <section className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between lg:px-5">
            <div><h2 className="font-semibold text-slate-950">Danh sách tài khoản</h2><p className="mt-1 text-sm text-slate-500">Chọn một tài khoản để xem thông tin và phân quyền.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-0 sm:w-80"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input type="search" name="account-list-search" autoComplete="off" aria-label="Tìm tài khoản" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, email, vai trò..." className="h-10 rounded-sm pl-9" /></label>
              <SelectBox<AccountStatusFilter> value={statusFilter} options={STATUS_FILTER_OPTIONS} onValueChange={setStatusFilter} ariaLabel="Lọc trạng thái tài khoản" className="w-full sm:w-48" triggerClassName="h-10 rounded-sm border-slate-200 bg-white text-slate-700 shadow-none" />
            </div>
          </div>

          <div className="hidden grid-cols-[minmax(180px,1.3fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(130px,.8fr)_minmax(120px,.7fr)] gap-4 bg-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 md:grid 2xl:grid-cols-[minmax(280px,1.5fr)_minmax(220px,1fr)_minmax(240px,1fr)_minmax(180px,.8fr)_minmax(160px,.7fr)] 2xl:px-7">
            <span>Tên hiển thị</span><span>Tên đăng nhập</span><span>Phạm vi</span><span>Vai trò</span><span>Trạng thái</span>
          </div>

          {loading ? <div className="space-y-3 p-5"><div className="h-14 animate-pulse rounded-sm bg-slate-100" /><div className="h-14 animate-pulse rounded-sm bg-slate-100" /><div className="h-14 animate-pulse rounded-sm bg-slate-100" /></div> : filteredItems.length === 0 ? <div className="px-5 py-16 text-center"><UserRound className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-700">Không có tài khoản phù hợp</p><p className="mt-1 text-sm text-slate-500">Thử thay đổi bộ lọc hoặc tạo tài khoản mới.</p></div> : <div className="divide-y divide-slate-200">
            {filteredItems.map((item) => {
              const expanded = expandedId === item.id;
              return <div key={item.id} className={`overflow-hidden transition-colors ${expanded ? "bg-emerald-50/40" : "hover:bg-emerald-50"}`}>
                <button type="button" className={`grid w-full grid-cols-1 gap-2 px-4 py-4 text-left transition-colors duration-150 hover:bg-emerald-50 focus-visible:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 md:grid-cols-[minmax(180px,1.3fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(130px,.8fr)_minmax(120px,.7fr)] md:items-center md:gap-4 md:px-5 2xl:grid-cols-[minmax(280px,1.5fr)_minmax(220px,1fr)_minmax(240px,1fr)_minmax(180px,.8fr)_minmax(160px,.7fr)] 2xl:gap-5 2xl:px-7 2xl:py-5 ${expanded ? "bg-emerald-50" : ""}`} onClick={() => toggleExpanded(item)} aria-expanded={expanded}>
                  <span className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-800 text-[#F6C85F]"><UserRound className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{item.displayName || item.username || item.email}</span><span className="mt-0.5 block truncate text-xs text-slate-600 md:hidden">{item.email}</span></span></span>
                  <span className="hidden truncate text-sm text-slate-700 md:block">{item.username || "Chưa có"}</span>
                  <span className="hidden truncate text-sm text-slate-700 md:block">{storeSummary(item)}</span>
                  <span className="flex items-center gap-2 text-sm text-slate-700"><span className="md:hidden text-xs text-slate-500">Vai trò:</span>{roleLabel(item.role)}</span>
                  <span className="flex items-center justify-between gap-3 md:justify-start"><span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium ${item.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}><span className={`h-1.5 w-1.5 rounded-full ${item.isActive ? "bg-emerald-600" : "bg-slate-500"}`} />{item.isActive ? "Đang hoạt động" : "Đã khóa"}</span><span className="text-xs text-emerald-800 md:hidden">{permissionCount(item)} quyền</span></span>
                </button>
                {expanded ? <AccountDetails item={item} tab={detailTab} canManageAccess={canManageAccess} deletingDisabled={item.id === user?.id || saving} onTabChange={setDetailTab} onEditAccount={() => openEdit(item)} onEditPermissions={() => openPermissionEditor(item)} onDelete={() => void handleDelete(item)} /> : null}
              </div>;
            })}
          </div>}
        </section>
      </div>

      <AccountEditorModal open={accountModalOpen} editingId={editingId} form={form} canManageAccess={canManageAccess} saving={saving} error={error} onClose={closeAccountEditor} onChange={patchForm} onRoleChange={handleRoleChange} onSave={() => void handleSubmit()} />
      <PermissionEditorModal open={permissionModalOpen} target={permissionTarget} canManageAccess={canManageAccess} permissions={form.permissions} role={form.role} saving={saving} error={error} onClose={() => setPermissionModalOpen(false)} onRoleChange={handleRoleChange} onToggle={handlePermissionToggle} onReset={handleResetPermissions} onSelectAll={handleSelectAllPermissions} onClear={handleClearPermissions} onSave={() => void savePermissions()} />
    </div>
  );
}

function SummaryCell({ label, value, icon, tone = "emerald" }: { label: string; value: number; icon: React.ReactNode; tone?: "emerald" | "green" | "slate" }) {
  const toneClass = tone === "green" ? "text-emerald-600" : tone === "slate" ? "text-slate-500" : "text-emerald-700";
  return <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:last:border-r-0"><span className={toneClass}>{icon}</span><div><div className="text-xs text-slate-500">{label}</div><div className="mt-0.5 text-lg font-semibold text-slate-950">{value}</div></div></div>;
}
