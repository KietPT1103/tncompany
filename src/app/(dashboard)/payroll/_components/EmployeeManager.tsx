"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addEmployee,
  deleteEmployee,
  Employee,
  getEmployees,
  updateEmployee,
} from "@/services/employees.firebase";
import InputMoney from "@/components/InputMoney";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { Pencil, Save, Search, Trash2, UserPlus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  formatCurrency,
  getDefaultRoleForStore,
  getRoleGroupsForStore,
  ROLE_GROUPS,
} from "./payrollShared";

function RoleSelect({
  roleGroups,
  value,
  onChange,
  className,
}: {
  roleGroups: Record<string, string[]>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100",
        className
      )}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {Object.entries(roleGroups).map(([group, roles]) => (
        <optgroup key={group} label={group}>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function getRoleBadge(role: string) {
  if (ROLE_GROUPS.Chung.includes(role)) {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }
  if (ROLE_GROUPS.Bếp.includes(role)) {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  }
  if (ROLE_GROUPS.Farm.includes(role)) {
    return "bg-sky-50 text-sky-700 ring-1 ring-sky-200";
  }

  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

export default function EmployeeManager({ storeId }: { storeId: string }) {
  const roleGroups = useMemo(() => getRoleGroupsForStore(storeId), [storeId]);
  const defaultRole = useMemo(() => getDefaultRoleForStore(storeId), [storeId]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeCode, setEmployeeCode] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmployeeCode, setEditEmployeeCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState(defaultRole);

  useEffect(() => {
    setRole((current) => (current && Object.values(roleGroups).flat().includes(current) ? current : defaultRole));
    setEditRole((current) =>
      current && Object.values(roleGroups).flat().includes(current) ? current : defaultRole
    );
  }, [defaultRole, roleGroups]);
  const [editHourlyRate, setEditHourlyRate] = useState(0);

  useEffect(() => {
    loadEmployees();
  }, [storeId]);

  async function loadEmployees() {
    if (!storeId) return;
    setEmployees(await getEmployees(storeId));
  }

  function hasDuplicateCode(code: string, excludeId?: string) {
    const normalized = code.trim().toLowerCase();
    return employees.some(
      (employee) =>
        employee.id !== excludeId &&
        (employee.employeeCode || "").trim().toLowerCase() === normalized
    );
  }

  async function handleAdd() {
    if (!employeeCode.trim() || !name.trim() || !hourlyRate) {
      alert("Vui lòng nhập mã nhân viên, tên và mức lương theo giờ.");
      return;
    }
    if (hasDuplicateCode(employeeCode)) {
      alert("Mã nhân viên đã tồn tại.");
      return;
    }

    setLoading(true);
    try {
      await addEmployee({
        storeId,
        employeeCode: employeeCode.trim(),
        name: name.trim(),
        role,
        hourlyRate,
      });
      setEmployeeCode("");
      setName("");
      setRole(defaultRole);
      setHourlyRate(0);
      await loadEmployees();
    } catch (error) {
      console.error(error);
      alert("Không thể thêm nhân viên.");
    } finally {
      setLoading(false);
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

  function handleEdit(employee: Employee) {
    setEditingId(employee.id || null);
    setEditEmployeeCode(employee.employeeCode || "");
    setEditName(employee.name);
    setEditRole(employee.role || defaultRole);
    setEditHourlyRate(employee.hourlyRate || 0);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditEmployeeCode("");
    setEditName("");
    setEditRole(defaultRole);
    setEditHourlyRate(0);
  }

  async function handleSaveEdit() {
    if (!editingId || !editEmployeeCode.trim() || !editName.trim() || !editHourlyRate) {
      alert("Vui lòng hoàn tất thông tin trước khi lưu.");
      return;
    }
    if (hasDuplicateCode(editEmployeeCode, editingId)) {
      alert("Mã nhân viên đã tồn tại.");
      return;
    }

    try {
      await updateEmployee(editingId, {
        employeeCode: editEmployeeCode.trim(),
        name: editName.trim(),
        role: editRole,
        hourlyRate: editHourlyRate,
      });
      handleCancelEdit();
      await loadEmployees();
    } catch (error) {
      console.error(error);
      alert("Không thể cập nhật nhân viên.");
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
    <div className="grid gap-5 xl:grid-cols-[340px,1fr]">
      <Card className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <CardHeader className="space-y-2 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            Thêm nhân viên
          </CardTitle>
          <p className="text-sm leading-6 text-slate-500">
            Mã `EnNo` sẽ được dùng làm khóa chính khi import và tính lương.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Mã nhân viên (EnNo)
            </label>
            <Input
              value={employeeCode}
              onChange={(event) => setEmployeeCode(event.target.value)}
              placeholder="Ví dụ: 00125"
              className="h-11 rounded-2xl"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Tên nhân viên
            </label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ví dụ: Nguyễn Văn A"
              className="h-11 rounded-2xl"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Vai trò
            </label>
            <RoleSelect roleGroups={roleGroups} value={role} onChange={setRole} />
          </div>

          <InputMoney
            label="Lương theo giờ"
            set={setHourlyRate}
            value={hourlyRate}
            className="h-11 rounded-2xl"
          />

          <Button
            onClick={handleAdd}
            isLoading={loading}
            className="h-11 w-full gap-2 rounded-2xl"
          >
            <UserPlus className="h-4 w-4" />
            Lưu nhân viên
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[24px] border border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="text-lg text-slate-900">Danh sách nhân sự</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              {employees.length} nhân viên. Tìm theo mã, tên hoặc vai trò.
            </p>
          </div>

          <div className="relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm theo mã, tên hoặc vai trò"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            />
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                  <th className="pb-3 pr-4 font-semibold">Mã NV</th>
                  <th className="pb-3 pr-4 font-semibold">Nhân viên</th>
                  <th className="pb-3 pr-4 font-semibold">Vai trò</th>
                  <th className="pb-3 pr-4 text-right font-semibold">Lương / giờ</th>
                  <th className="pb-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((employee) => {
                  const isEditing = editingId === employee.id;

                  return (
                    <tr key={employee.id} className="align-top">
                      <td className="py-4 pr-4">
                        {isEditing ? (
                          <Input
                            value={editEmployeeCode}
                            onChange={(event) => setEditEmployeeCode(event.target.value)}
                            className="h-10 rounded-2xl"
                          />
                        ) : (
                          <span className="font-mono font-semibold text-slate-700">
                            {employee.employeeCode || "--"}
                          </span>
                        )}
                      </td>

                      <td className="py-4 pr-4">
                        {isEditing ? (
                          <Input
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            className="h-10 rounded-2xl"
                          />
                        ) : (
                          <div className="font-semibold text-slate-900">{employee.name}</div>
                        )}
                      </td>

                      <td className="py-4 pr-4">
                        {isEditing ? (
                          <RoleSelect
                            roleGroups={roleGroups}
                            value={editRole}
                            onChange={setEditRole}
                            className="h-10 rounded-2xl"
                          />
                        ) : (
                          <span
                            className={cn(
                              "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                              getRoleBadge(employee.role)
                            )}
                          >
                            {employee.role}
                          </span>
                        )}
                      </td>

                      <td className="py-4 pr-4 text-right">
                        {isEditing ? (
                          <div className="ml-auto max-w-[180px]">
                            <InputMoney
                              value={editHourlyRate}
                              set={setEditHourlyRate}
                              className="h-10 rounded-2xl"
                            />
                          </div>
                        ) : (
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(employee.hourlyRate)}
                          </span>
                        )}
                      </td>

                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <Button
                                size="icon"
                                className="h-10 w-10 rounded-2xl"
                                onClick={handleSaveEdit}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-2xl text-slate-500 hover:bg-slate-100"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-2xl text-slate-500 hover:bg-slate-100"
                                onClick={() => handleEdit(employee)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-2xl text-rose-500 hover:bg-rose-50"
                                onClick={() => handleDelete(employee.id!)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <div className="mx-auto max-w-sm">
                        <div className="text-lg font-semibold text-slate-900">
                          Không có nhân viên phù hợp
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          Thử tìm bằng từ khóa khác hoặc thêm hồ sơ nhân sự mới.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
