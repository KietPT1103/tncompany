"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  addEmployeeRole,
  deleteEmployeeRole,
  type EmployeeRole,
  updateEmployeeRole,
} from "@/services/employeeRoles";
import { Pencil, Plus, Tags, Trash2, X } from "lucide-react";

type Props = {
  storeId: string;
  roles: EmployeeRole[];
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
};

export default function EmployeeRoleManager({
  storeId,
  roles,
  loading,
  error,
  onRefresh,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<EmployeeRole | null>(null);
  const [name, setName] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function openCreate() {
    setEditingRole(null);
    setName("");
    setDialogError("");
    setDialogOpen(true);
  }

  function openEdit(role: EmployeeRole) {
    setEditingRole(role);
    setName(role.name);
    setDialogError("");
    setDialogOpen(true);
  }

  async function saveRole() {
    const normalizedName = name.trim().replace(/\s+/g, " ");
    if (!normalizedName) {
      setDialogError("Vui lòng nhập tên vai trò.");
      return;
    }
    setSubmitting(true);
    setDialogError("");
    try {
      if (editingRole) {
        await updateEmployeeRole(editingRole.id, normalizedName);
      } else {
        await addEmployeeRole(storeId, normalizedName);
      }
      await onRefresh();
      setDialogOpen(false);
    } catch (reason) {
      setDialogError(
        reason instanceof Error ? reason.message : "Không thể lưu vai trò.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function removeRole(role: EmployeeRole) {
    if (
      !confirm(
        `Xóa vai trò “${role.name}”? Vai trò đang có nhân viên sẽ không thể xóa.`,
      )
    ) return;
    try {
      await deleteEmployeeRole(role.id);
      await onRefresh();
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Không thể xóa vai trò.");
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <Tags className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-950">Danh sách vai trò</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {roles.length} vai trò dùng khi tạo và cập nhật nhân viên.
              </p>
            </div>
          </div>
          <Button
            onClick={openCreate}
            className="h-9 gap-1.5 rounded border border-emerald-800 bg-white px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-800 hover:text-white"
          >
            <Plus className="h-4 w-4" /> Thêm vai trò
          </Button>
        </div>

        {error ? (
          <div className="m-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="divide-y divide-slate-200">
          {roles.map((role) => (
            <div key={role.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/70">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-950">{role.name}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {role.employeeCount} nhân viên{role.isDefault ? " · Vai trò mặc định" : ""}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-slate-500"
                onClick={() => openEdit(role)}
                aria-label={`Sửa ${role.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                onClick={() => void removeRole(role)}
                aria-label={`Xóa ${role.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!loading && roles.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              Chưa có vai trò nào. Hãy tạo vai trò đầu tiên.
            </div>
          ) : null}
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">Đang tải vai trò...</div>
          ) : null}
        </div>
      </section>

      {dialogOpen && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  {editingRole ? "Cập nhật vai trò" : "Thêm vai trò"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editingRole
                    ? "Tên mới sẽ được cập nhật cho các nhân viên đang dùng vai trò này."
                    : "Vai trò mới sẽ xuất hiện trong biểu mẫu nhân viên."}
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setDialogOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-5">
              <Input
                label="Tên vai trò"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ví dụ: Tổ trưởng"
                className="h-10 rounded-md"
                autoFocus
              />
              {dialogError ? (
                <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {dialogError}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Hủy</Button>
              <Button onClick={() => void saveRole()} isLoading={submitting}>Lưu vai trò</Button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
