"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addEmployee,
  deleteEmployee,
  Employee,
  getEmployees,
  updateEmployee,
} from "@/services/employees.firebase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { ChevronRight, Pencil, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import {
  formatCurrency,
  getDefaultRoleForStore,
  getRoleGroupsForStore,
  ROLE_GROUPS,
} from "./payrollShared";
import EmployeeSalaryFields, {
  buildEmployeeMutationPayload,
  createEmployeeSalaryFormValues,
  EmployeeSalaryFormValues,
  resolveEmployeeSalaryType,
  validateEmployeeSalaryForm,
} from "./EmployeeSalaryFields";

function getRoleBadge(role: string) {
  if (ROLE_GROUPS.Chung.includes(role)) return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  if (ROLE_GROUPS.Bep.includes(role)) return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  if (ROLE_GROUPS.Farm.includes(role)) return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function getCompensationSummary(employee: Employee) {
  const salaryType = resolveEmployeeSalaryType(employee);

  if (salaryType === "monthly") {
    return {
      badgeClass: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
      badgeLabel: "Lương tháng",
      primary: formatCurrency(employee.monthlySalary || 0),
      secondary: `Ngày công ${employee.expectedWorkDays || 30} • Phép ${employee.paidLeaveDays || 0} • OT ${formatCurrency(employee.hourlyRate || 0)}/h`,
    };
  }

  return {
    badgeClass: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    badgeLabel: "Theo giờ",
    primary: formatCurrency(employee.hourlyRate || 0),
    secondary: "Tính lương theo tổng giờ làm thực tế.",
  };
}

export default function EmployeeManager({
  storeId,
  refreshKey = 0,
}: {
  storeId: string;
  refreshKey?: number;
}) {
  const roleGroups = useMemo(() => getRoleGroupsForStore(storeId), [storeId]);
  const defaultRole = useMemo(() => getDefaultRoleForStore(storeId), [storeId]);
  const availableRoles = useMemo(() => Object.values(roleGroups).flat(), [roleGroups]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formValues, setFormValues] = useState<EmployeeSalaryFormValues>(() =>
    createEmployeeSalaryFormValues(defaultRole)
  );

  useEffect(() => {
    void loadEmployees();
  }, [storeId, refreshKey]);

  useEffect(() => {
    setFormValues((current) => {
      if (!availableRoles.includes(current.role)) return { ...current, role: defaultRole };
      return current;
    });
  }, [availableRoles, defaultRole]);

  async function loadEmployees() {
    if (!storeId) return;
    try {
      setLoadError("");
      setLoading(true);
      setEmployees(await getEmployees(storeId));
    } catch (error) {
      console.error(error);
      setEmployees([]);
      setLoadError(error instanceof Error ? error.message : "Không tải được danh sách nhân viên.");
    } finally {
      setLoading(false);
    }
  }

  function hasDuplicateCode(code: string, excludeId?: string) {
    const normalized = code.trim().toLowerCase();
    return employees.some(
      (employee) => employee.id !== excludeId && (employee.employeeCode || "").trim().toLowerCase() === normalized
    );
  }

  function openCreateDialog() {
    setEditingId(null);
    setDialogError("");
    setFormValues(createEmployeeSalaryFormValues(defaultRole));
    setDialogOpen(true);
  }

  function openEditDialog(employee: Employee) {
    setEditingId(employee.id || null);
    setDialogError("");
    setFormValues(createEmployeeSalaryFormValues(defaultRole, employee));
    setDialogOpen(true);
  }

  function closeDialog() {
    if (submitting) return;
    setDialogOpen(false);
    setEditingId(null);
    setDialogError("");
  }

  async function handleSaveEmployee() {
    const validationError = validateEmployeeSalaryForm(formValues);
    if (validationError) {
      setDialogError(validationError);
      return;
    }

    if (hasDuplicateCode(formValues.employeeCode, editingId || undefined)) {
      setDialogError("Mã nhân viên đã tồn tại.");
      return;
    }

    setSubmitting(true);
    setDialogError("");

    try {
      const payload = buildEmployeeMutationPayload(formValues);
      if (editingId) {
        const updatedEmployee = await updateEmployee(editingId, payload);
        if (updatedEmployee?.id) {
          setEmployees((current) =>
            current.map((employee) =>
              employee?.id === updatedEmployee.id ? updatedEmployee : employee
            )
          );
        } else {
          await loadEmployees();
        }
      } else {
        await addEmployee({ storeId, ...payload });
        await loadEmployees();
      }
      setDialogOpen(false);
      setEditingId(null);
    } catch (error) {
      console.error(error);
      setDialogError("Không thể lưu nhân viên.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bạn có chắc muốn xóa nhân viên này?")) return;
    try {
      await deleteEmployee(id);
      await loadEmployees();
    } catch (error) {
      console.error(error);
      alert("Không thể xóa nhân viên.");
    }
  }

  const filteredEmployees = employees.filter((employee) => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return true;
    return (
      employee.name.toLowerCase().includes(keyword) ||
      employee.role.toLowerCase().includes(keyword) ||
      (employee.employeeCode || "").toLowerCase().includes(keyword)
    );
  });
  return (
    <>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <UserPlus className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950">Danh sách nhân sự</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {employees.length} nhân viên. Cấu hình lương được dùng lại cho các kỳ lương sau.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:items-center">
            <div className="relative w-full lg:w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm theo mã, tên hoặc vai trò"
                aria-label="Tìm nhân viên"
                className="h-10 rounded-md border-slate-300 bg-slate-50 pl-10"
              />
            </div>
            <Button className="h-10 gap-2 rounded-md px-4" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Thêm nhân viên
            </Button>
          </div>
        </div>

        {loadError ? (
          <div className="m-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            {loadError}
          </div>
        ) : null}

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-slate-50/80">
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-semibold">Mã NV</th>
                <th className="px-4 py-3 font-semibold">Nhân viên</th>
                <th className="px-4 py-3 font-semibold">Vai trò</th>
                <th className="px-4 py-3 font-semibold">Cấu hình lương</th>
                <th className="sticky right-0 bg-slate-50/95 px-4 py-3 text-right font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEmployees.map((employee) => {
                const compensation = getCompensationSummary(employee);
                return (
                  <tr key={employee.id} className="group align-middle hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-slate-700">
                        {employee.employeeCode || "--"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-950">{employee.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", getRoleBadge(employee.role))}>
                        {employee.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", compensation.badgeClass)}>
                          {compensation.badgeLabel}
                        </span>
                        <span className="font-semibold tabular-nums text-slate-950">{compensation.primary}</span>
                      </div>
                      <div className="mt-1 max-w-xl text-xs leading-5 text-slate-500">{compensation.secondary}</div>
                    </td>
                    <td className="sticky right-0 bg-white px-4 py-3 text-right group-hover:bg-slate-50">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-md text-slate-500 hover:bg-slate-100"
                          onClick={() => openEditDialog(employee)}
                          aria-label={'Sửa ' + employee.name}
                          title="Sửa"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => handleDelete(employee.id!)}
                          aria-label={'Xóa ' + employee.name}
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="text-sm font-semibold text-slate-900">Không có nhân viên phù hợp</div>
                    <p className="mt-1 text-sm text-slate-500">Thử từ khóa khác hoặc thêm hồ sơ nhân sự mới.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-200 md:hidden">
          {filteredEmployees.map((employee) => {
            const compensation = getCompensationSummary(employee);
            return (
              <button
                key={employee.id}
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                onClick={() => setViewingEmployee(employee)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-950">{employee.name}</span>
                    <span className={cn("inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", getRoleBadge(employee.role))}>
                      {employee.role}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono">{employee.employeeCode || "--"}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium tabular-nums text-slate-700">{compensation.primary}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>
            );
          })}
          {!loading && filteredEmployees.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <div className="text-sm font-semibold text-slate-900">Không có nhân viên phù hợp</div>
              <p className="mt-1 text-sm text-slate-500">Thử từ khóa khác hoặc thêm hồ sơ mới.</p>
            </div>
          ) : null}
        </div>
      </section>

      {viewingEmployee ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setViewingEmployee(null)}
            aria-label="Đóng chi tiết nhân viên"
          />
          <aside
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-lg bg-white shadow-2xl"
            aria-label="Chi tiết nhân viên"
          >
            <div className="sticky top-0 flex items-start justify-between border-b border-slate-200 bg-white px-4 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-950">{viewingEmployee.name}</h3>
                <p className="mt-0.5 font-mono text-xs text-slate-500">{viewingEmployee.employeeCode || "--"}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-md"
                onClick={() => setViewingEmployee(null)}
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {(() => {
              const compensation = getCompensationSummary(viewingEmployee);
              return (
                <div className="space-y-4 p-4">
                  <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between gap-4 px-3 py-3">
                      <dt className="text-sm text-slate-500">Vai trò</dt>
                      <dd className="text-sm font-semibold text-slate-900">{viewingEmployee.role}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 px-3 py-3">
                      <dt className="text-sm text-slate-500">Hình thức lương</dt>
                      <dd className="text-sm font-semibold text-slate-900">{compensation.badgeLabel}</dd>
                    </div>
                    <div className="px-3 py-3">
                      <dt className="text-sm text-slate-500">Mức lương</dt>
                      <dd className="mt-1 text-base font-semibold tabular-nums text-slate-950">{compensation.primary}</dd>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{compensation.secondary}</p>
                    </div>
                  </dl>
                  <Button
                    className="h-10 w-full gap-2 rounded-md"
                    onClick={() => {
                      const employee = viewingEmployee;
                      setViewingEmployee(null);
                      openEditDialog(employee);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Chỉnh sửa nhân viên
                  </Button>
                </div>
              );
            })()}
          </aside>
        </div>
      ) : null}

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-lg border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:rounded-lg">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  {editingId ? "Cập nhật nhân viên" : "Thêm nhân viên"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Cấu hình này được dùng lại khi tạo kỳ lương mới.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-md text-slate-500 hover:bg-slate-100"
                onClick={closeDialog}
                disabled={submitting}
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 overflow-y-auto px-4 py-5 sm:px-5">
              <div className="space-y-4">
                <EmployeeSalaryFields
                  roleGroups={roleGroups}
                  values={formValues}
                  onChange={(changes) => setFormValues((current) => ({ ...current, ...changes }))}
                />
                {dialogError ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                    {dialogError}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
              <Button variant="outline" className="h-10 rounded-md" onClick={closeDialog} disabled={submitting}>
                Hủy
              </Button>
              <Button className="h-10 rounded-md" isLoading={submitting} onClick={() => void handleSaveEmployee()}>
                {editingId ? "Lưu cập nhật" : "Lưu nhân viên"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}