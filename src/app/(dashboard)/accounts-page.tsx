"use client";

import { useEffect, useMemo, useState } from "react";
import { Shield, UserCog, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
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

const STORE_OPTIONS = [
  { value: "", label: "KhÃ´ng gáº¯n cá»­a hÃ ng" },
  { value: "cafe", label: "Cafe" },
  { value: "restaurant", label: "Láº©u / Báº¿p" },
  { value: "bakery", label: "Tiá»‡m bÃ¡nh" },
  { value: "farm", label: "Farm" },
];

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "user", label: "Thu ngÃ¢n" },
  { value: "server", label: "Phá»¥c vá»¥" },
] as const;

type FormState = {
  email: string;
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
  storeId: string;
  isActive: boolean;
  permissions: AppPermission[];
};

const DEFAULT_FORM: FormState = {
  email: "",
  username: "",
  displayName: "",
  password: "",
  role: "manager",
  storeId: "cafe",
  isActive: true,
  permissions: getDefaultPermissionsForRole("manager"),
};

function mapRoleLabel(role: ManagedUser["role"]) {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label || role;
}

function mapPermissionSummary(user: ManagedUser) {
  if (user.role === "admin") {
    return "Toan quyen";
  }

  return `${normalizePermissionList(user.permissions).length} chuc nang`;
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
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<FormState>({
    ...DEFAULT_FORM,
    storeId,
  });

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const users = await getManagedUsers();
      setItems(users);
    } catch (loadErr) {
      console.error(loadErr);
      setError(loadErr instanceof Error ? loadErr.message : "KhÃ´ng táº£i Ä‘Æ°á»£c tÃ i khoáº£n.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    if (!editingId) {
      setForm((current) => ({
        ...current,
        storeId: current.storeId || storeId,
      }));
    }
  }, [editingId, storeId]);

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;

    return items.filter((item) => {
      const permissionText = normalizePermissionList(item.permissions)
        .map((permission) => getPermissionDefinition(permission)?.label || permission)
        .join(" ")
        .toLowerCase();

      return (
        item.email.toLowerCase().includes(keyword) ||
        (item.username || "").toLowerCase().includes(keyword) ||
        (item.displayName || "").toLowerCase().includes(keyword) ||
        item.role.toLowerCase().includes(keyword) ||
        (item.storeId || "").toLowerCase().includes(keyword) ||
        permissionText.includes(keyword)
      );
    });
  }, [items, search]);

  function startCreate() {
    setEditingId("");
    setForm({
      ...DEFAULT_FORM,
      storeId,
      permissions: getDefaultPermissionsForRole(DEFAULT_FORM.role),
    });
    setError("");
    setMessage("");
  }

  function startEdit(item: ManagedUser) {
    setEditingId(item.id);
    setForm({
      email: item.email,
      username: item.username || "",
      displayName: item.displayName || "",
      password: "",
      role: item.role,
      storeId: item.storeId || "",
      isActive: item.isActive,
      permissions: normalizePermissionList(item.permissions),
    });
    setError("");
    setMessage("");
  }

  function handleRoleChange(nextRole: UserRole) {
    setForm((current) => ({
      ...current,
      role: nextRole,
      permissions: getDefaultPermissionsForRole(nextRole),
    }));
  }

  function handlePermissionToggle(permission: AppPermission) {
    if (form.role === "admin") {
      return;
    }

    setForm((current) => {
      const exists = current.permissions.includes(permission);
      return {
        ...current,
        permissions: exists
          ? current.permissions.filter((item) => item !== permission)
          : normalizePermissionList([...current.permissions, permission]),
      };
    });
  }

  function handleResetPermissions() {
    setForm((current) => ({
      ...current,
      permissions: getDefaultPermissionsForRole(current.role),
    }));
  }

  function handleSelectAllPermissions() {
    if (form.role === "admin") {
      return;
    }

    setForm((current) => ({
      ...current,
      permissions: normalizePermissionList(
        MANAGED_PERMISSION_GROUPS.flatMap((group) => group.items.map((item) => item.id))
      ),
    }));
  }

  function handleClearPermissions() {
    if (form.role === "admin") {
      return;
    }

    setForm((current) => ({
      ...current,
      permissions: [],
    }));
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (editingId) {
        const updated = await updateManagedUser(editingId, {
          email: form.email,
          username: form.username,
          displayName: form.displayName,
          storeId: form.storeId,
          isActive: form.isActive,
          ...(canManageAccess
            ? {
                role: form.role,
                permissions: form.permissions,
              }
            : {}),
          ...(form.password ? { password: form.password } : {}),
        });

        setItems((current) =>
          current.map((item) => (item.id === updated.id ? updated : item))
        );
        setMessage("ÄÃ£ cáº­p nháº­t tÃ i khoáº£n.");
      } else {
        const created = await createManagedUser({
          email: form.email,
          username: form.username,
          displayName: form.displayName,
          password: form.password,
          storeId: form.storeId,
          isActive: form.isActive,
          ...(canManageAccess
            ? {
                role: form.role,
                permissions: form.permissions,
              }
            : {}),
        });

        setItems((current) => [created, ...current]);
        setMessage("ÄÃ£ táº¡o tÃ i khoáº£n má»›i.");
        setEditingId(created.id);
        setForm((current) => ({ ...current, password: "" }));
      }
    } catch (submitErr) {
      console.error(submitErr);
      setError(submitErr instanceof Error ? submitErr.message : "KhÃ´ng lÆ°u Ä‘Æ°á»£c tÃ i khoáº£n.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("XÃ³a tÃ i khoáº£n nÃ y?")) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await deleteManagedUser(id);
      setItems((current) => current.filter((item) => item.id !== id));

      if (editingId === id) {
        startCreate();
      }

      setMessage("ÄÃ£ xÃ³a tÃ i khoáº£n.");
    } catch (deleteErr) {
      console.error(deleteErr);
      setError(deleteErr instanceof Error ? deleteErr.message : "KhÃ´ng xÃ³a Ä‘Æ°á»£c tÃ i khoáº£n.");
    } finally {
      setSaving(false);
    }
  }

  const managedPermissionCount = MANAGED_PERMISSION_GROUPS.flatMap((group) =>
    group.items.map((item) => item.id)
  ).length;
  const currentPermissionCount =
    form.role === "admin" ? managedPermissionCount : form.permissions.length;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
              <Shield className="h-4 w-4" />
              Quáº£n lÃ½ tÃ i khoáº£n Ä‘Äƒng nháº­p
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">
              TÃ i khoáº£n há»‡ thá»‘ng
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Admin cÃ³ thá»ƒ táº¡o, sá»­a, khÃ³a hoáº·c xÃ³a tÃ i khoáº£n, Ä‘á»“ng thá»i báº­t/táº¯t
              tá»«ng module mÃ  táº¡i khoáº£n Ä‘Æ°á»£c dÃ¹ng.
            </p>
          </div>

          <Button className="gap-2 rounded-2xl" onClick={startCreate}>
            <UserPlus className="h-4 w-4" />
            Táº¡o tÃ i khoáº£n má»›i
          </Button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="rounded-[28px] border-slate-200">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-xl text-slate-900">Danh sÃ¡ch tÃ i khoáº£n</CardTitle>
                <p className="mt-2 text-sm text-slate-500">
                  {items.length} tÃ i khoáº£n, Ä‘Äƒng nháº­p hiá»‡n táº¡i:{" "}
                  <span className="font-medium text-slate-700">
                    {user?.displayName || user?.email}
                  </span>
                </p>
              </div>
              <div className="w-full max-w-sm">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="TÃ¬m theo email, tÃªn, username, role, quyá»n"
                  className="h-11 rounded-2xl border-slate-200 bg-white"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-slate-500">
                  Äang táº£i tÃ i khoáº£n...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-slate-500">
                  KhÃ´ng cÃ³ tÃ i khoáº£n phÃ¹ há»£p.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[24px] border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-base font-semibold text-slate-900">
                              {item.displayName || item.username || item.email}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {mapRoleLabel(item.role)}
                            </span>
                            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                              {mapPermissionSummary(item)}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                item.isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {item.isActive ? "Äang hoáº¡t Ä‘á»™ng" : "ÄÃ£ khÃ³a"}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-slate-500">{item.email}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {item.username ? `@${item.username}` : "KhÃ´ng cÃ³ username"} â€¢{" "}
                            {item.storeId || "KhÃ´ng gáº¯n cá»­a hÃ ng"}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            className="rounded-2xl"
                            onClick={() => startEdit(item)}
                          >
                            Sá»­a
                          </Button>
                          <Button
                            variant="destructive"
                            className="rounded-2xl"
                            onClick={() => void handleDelete(item.id)}
                            disabled={item.id === user?.id}
                          >
                            XÃ³a
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-slate-200">
            <CardHeader>
              <div className="flex items-center gap-3">
                <UserCog className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-xl text-slate-900">
                  {editingId ? "Sá»­a tÃ i khoáº£n" : "Táº¡o tÃ i khoáº£n"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="manager@admin.local"
                className="h-11 rounded-2xl border-slate-200"
              />

              <Input
                label="Username"
                value={form.username}
                onChange={(event) =>
                  setForm((current) => ({ ...current, username: event.target.value }))
                }
                placeholder="manager"
                className="h-11 rounded-2xl border-slate-200"
              />

              <Input
                label="TÃªn hiá»ƒn thá»‹"
                value={form.displayName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, displayName: event.target.value }))
                }
                placeholder="Quáº£n lÃ½ ca"
                className="h-11 rounded-2xl border-slate-200"
              />

              <Input
                type="password"
                label={editingId ? "Äáº·t máº­t kháº©u má»›i" : "Máº­t kháº©u"}
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder={editingId ? "Äá»ƒ trá»‘ng náº¿u khÃ´ng Ä‘á»•i" : "Nháº­p máº­t kháº©u"}
                className="h-11 rounded-2xl border-slate-200"
              />

              {canManageAccess ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Vai trÃ²</span>
                  <select
                    value={form.role}
                    onChange={(event) => handleRoleChange(event.target.value as UserRole)}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  >
                    {ROLE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-medium text-slate-900">Vai trÃ²</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Chỉ admin mới được sửa vai trò tài khoản.
                  </div>
                </div>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Cá»­a hÃ ng</span>
                <select
                  value={form.storeId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, storeId: event.target.value }))
                  }
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                >
                  {STORE_OPTIONS.map((item) => (
                    <option key={item.value || "none"} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">PhÃ¢n quyá»n chá»©c nÄƒng</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Báº­t module nÃ o thÃ¬ tÃ i khoáº£n chá»‰ dÃ¹ng Ä‘Æ°á»£c module Ä‘Ã³, cÃ¡c
                      module cÃ²n láº¡i sáº½ bá»‹ khÃ³a.
                    </div>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                    {currentPermissionCount}/{managedPermissionCount} module
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    onClick={handleSelectAllPermissions}
                    disabled={!canManageAccess || form.role === "admin"}
                  >
                    Báº­t táº¥t cáº£
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    onClick={handleClearPermissions}
                    disabled={!canManageAccess || form.role === "admin"}
                  >
                    Bá» háº¿t
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    onClick={handleResetPermissions}
                    disabled={!canManageAccess}
                  >
                    Máº·c Ä‘á»‹nh theo vai trÃ²
                  </Button>
                </div>

                {!canManageAccess ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                    Chỉ admin mới được sửa phân quyền chức năng.
                  </div>
                ) : form.role === "admin" ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    TÃ i khoáº£n admin luÃ´n cÃ³ toÃ n quyá»n Ä‘á»ƒ trÃ¡nh tá»± khÃ³a há»‡
                    thá»‘ng quáº£n trá»‹.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {MANAGED_PERMISSION_GROUPS.map((group) => (
                      <div
                        key={group.category}
                        className="rounded-2xl border border-white bg-white p-3 shadow-sm"
                      >
                        <div className="mb-3 text-sm font-semibold text-slate-900">
                          {group.category}
                        </div>
                        <div className="space-y-2">
                          {group.items.map((item) => {
                            const checked = form.permissions.includes(item.id);

                            return (
                              <label
                                key={item.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition ${
                                  checked
                                    ? "border-emerald-200 bg-emerald-50"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handlePermissionToggle(item.id)}
                                  className="mt-1 h-4 w-4"
                                />
                                <div>
                                  <div className="text-sm font-medium text-slate-900">
                                    {item.label}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {item.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">Tráº¡ng thÃ¡i Ä‘Äƒng nháº­p</div>
                  <div className="text-xs text-slate-500">
                    Táº¯t Ä‘á»ƒ khÃ³a tÃ i khoáº£n vÃ  Ã©p Ä‘Äƒng xuáº¥t náº¿u Ä‘ang dÃ¹ng.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                  className="h-4 w-4"
                />
              </label>

              <div className="flex gap-3">
                <Button
                  className="flex-1 rounded-2xl"
                  onClick={() => void handleSubmit()}
                  isLoading={saving}
                >
                  {editingId ? "LÆ°u thay Ä‘á»•i" : "Táº¡o tÃ i khoáº£n"}
                </Button>
                {editingId ? (
                  <Button variant="outline" className="rounded-2xl" onClick={startCreate}>
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
