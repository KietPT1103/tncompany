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
import { Pencil, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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
      secondary: `Ngày công ${employee.expectedWorkDays || 30} • Phép ${employee.paidLeaveDays || 0} ? OT ${formatCurrency(employee.hourlyRate || 0)}/h`,
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
      <Card className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-600">
              <UserPlus className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">Nhân sự</span>
            </div>
            <CardTitle className="mt-3 text-lg text-slate-900">Danh sách nhân sự</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              {employees.length} nhân viên. Cấu hình lương được lưu trên hồ sơ để dùng cho các kỳ lương sau.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
            <div className="relative w-full md:w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm theo mã, tên hoặc vai trò" className="h-11 rounded-2xl bg-slate-50 pl-10" />
            </div>
            <Button className="h-11 gap-2 rounded-2xl" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />Thêm nhân viên
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {loadError ? <div className="mb-4 rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div> : null}
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">Mã NV</th>
                  <th className="pb-3 pr-4 font-semibold">Nhân viên</th>
                  <th className="pb-3 pr-4 font-semibold">Vai trò</th>
                  <th className="pb-3 pr-4 font-semibold">Cấu hình lương</th>
                  <th className="pb-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((employee) => {
                  const compensation = getCompensationSummary(employee);
                  return (
                    <tr key={employee.id} className="align-top">
                      <td className="py-4 pr-4"><span className="font-mono font-semibold text-slate-700">{employee.employeeCode || "--"}</span></td>
                      <td className="py-4 pr-4"><div className="font-semibold text-slate-900">{employee.name}</div></td>
                      <td className="py-4 pr-4"><span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", getRoleBadge(employee.role))}>{employee.role}</span></td>
                      <td className="py-4 pr-4">
                        <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", compensation.badgeClass)}>{compensation.badgeLabel}</span>
                            <span className="font-semibold text-slate-900">{compensation.primary}</span>
                          </div>
                          <div className="mt-2 text-xs leading-5 text-slate-500">{compensation.secondary}</div>
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-slate-500 hover:bg-slate-100" onClick={() => openEditDialog(employee)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-rose-500 hover:bg-rose-50" onClick={() => handleDelete(employee.id!)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && filteredEmployees.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center"><div className="mx-auto max-w-sm"><div className="text-lg font-semibold text-slate-900">Không có nhân viên phù hợp</div><p className="mt-2 text-sm text-slate-500">Thử tìm bằng từ khóa khác hoặc thêm hồ sơ nhân sự mới.</p></div></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Hồ sơ nhân viên</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">{editingId ? "Cập nhật nhân viên" : "Thêm nhân viên"}</h3>
                <p className="mt-2 text-sm text-slate-500">Thông tin lương lưu ở đây sẽ được dùng lại khi tạo kỳ lương mới hoặc chỉnh sửa từ bảng lương.</p>
              </div>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-slate-500 hover:bg-slate-100" onClick={closeDialog} disabled={submitting}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-6 px-6 py-6">
              <EmployeeSalaryFields roleGroups={roleGroups} values={formValues} onChange={(changes) => setFormValues((current) => ({ ...current, ...changes }))} />
              {dialogError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{dialogError}</div> : null}
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end">
              <Button variant="outline" className="rounded-2xl" onClick={closeDialog} disabled={submitting}>Hủy</Button>
              <Button className="rounded-2xl" isLoading={submitting} onClick={() => void handleSaveEmployee()}>{editingId ? "Lưu cập nhật" : "Lưu nhân viên"}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
