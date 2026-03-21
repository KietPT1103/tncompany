"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoreType } from "@/context/StoreContext";
import { Employee } from "@/services/employees.firebase";
import InputMoney from "@/components/InputMoney";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { Check, Search, UserPlus, Users, X } from "lucide-react";
import {
  formatCurrency,
  getDefaultRoleForStore,
  getRoleGroupsForStore,
} from "./payrollShared";

function RoleSelect({
  roleGroups,
  value,
  onChange,
}: {
  roleGroups: Record<string, string[]>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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

type AddPayrollEntryDialogProps = {
  open: boolean;
  employees: Employee[];
  storeId: StoreType | string;
  onAddExisting: (employee: Employee) => Promise<void>;
  onClose: () => void;
  onCreateNew: (payload: {
    employeeCode: string;
    hourlyRate: number;
    name: string;
    role: string;
  }) => Promise<void>;
};

export default function AddPayrollEntryDialog({
  open,
  employees,
  storeId,
  onAddExisting,
  onClose,
  onCreateNew,
}: AddPayrollEntryDialogProps) {
  const roleGroups = useMemo(() => getRoleGroupsForStore(storeId), [storeId]);
  const defaultRole = useMemo(() => getDefaultRoleForStore(storeId), [storeId]);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("existing");
    setSearchTerm("");
    setSelectedEmployeeId(employees[0]?.id || "");
    setEmployeeCode("");
    setName("");
    setRole(defaultRole);
    setHourlyRate(0);
    setError("");
  }, [defaultRole, employees, open]);

  const filteredEmployees = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return employees;

    return employees.filter((employee) => {
      const code = (employee.employeeCode || "").toLowerCase();
      const employeeName = (employee.name || "").toLowerCase();
      const employeeRole = (employee.role || "").toLowerCase();
      return (
        code.includes(keyword) ||
        employeeName.includes(keyword) ||
        employeeRole.includes(keyword)
      );
    });
  }, [employees, searchTerm]);

  useEffect(() => {
    if (!filteredEmployees.length) {
      setSelectedEmployeeId("");
      return;
    }

    if (!filteredEmployees.some((employee) => employee.id === selectedEmployeeId)) {
      setSelectedEmployeeId(filteredEmployees[0]?.id || "");
    }
  }, [filteredEmployees, selectedEmployeeId]);

  if (!open) return null;

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    try {
      if (mode === "existing") {
        const selectedEmployee = employees.find(
          (employee) => employee.id === selectedEmployeeId
        );
        if (!selectedEmployee) {
          throw new Error("Vui lòng chọn nhân viên đã lưu.");
        }

        await onAddExisting(selectedEmployee);
        return;
      }

      if (!employeeCode.trim() || !name.trim() || !hourlyRate) {
        throw new Error("Vui lòng nhập mã nhân viên, tên và lương theo giờ.");
      }

      await onCreateNew({
        employeeCode: employeeCode.trim(),
        hourlyRate,
        name: name.trim(),
        role,
      });
    } catch (submitError) {
      if (submitError instanceof Error) {
        setError(submitError.message);
      } else {
        setError("Không thể thêm nhân viên vào bảng lương.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Payroll entry
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">
              Thêm nhân viên vào kỳ lương
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Chọn từ danh sách nhân viên đã lưu hoặc tạo hồ sơ mới ngay tại đây.
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-2xl text-slate-500 hover:bg-slate-100"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={cn(
                "rounded-[24px] border px-4 py-4 text-left transition-all",
                mode === "existing"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "rounded-2xl p-2",
                    mode === "existing"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  )}
                >
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold">Chọn nhân viên đã lưu</div>
                  <p className="mt-1 text-sm text-inherit/80">
                    Danh sách đã tự loại các nhân viên đang có trong kỳ lương này.
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("new")}
              className={cn(
                "rounded-[24px] border px-4 py-4 text-left transition-all",
                mode === "new"
                  ? "border-sky-200 bg-sky-50 text-sky-900"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "rounded-2xl p-2",
                    mode === "new"
                      ? "bg-sky-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  )}
                >
                  <UserPlus className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold">Tạo nhân viên mới</div>
                  <p className="mt-1 text-sm text-inherit/80">
                    Lưu hồ sơ mới và thêm ngay vào bảng lương bằng mã `EnNo`.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {mode === "existing" ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm theo mã, tên hoặc vai trò"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {filteredEmployees.map((employee) => {
                  const selected = employee.id === selectedEmployeeId;

                  return (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => setSelectedEmployeeId(employee.id || "")}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-[24px] border px-4 py-4 text-left transition-all",
                        selected
                          ? "border-emerald-200 bg-emerald-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-900 px-3 py-1 font-mono text-xs font-semibold text-white">
                            {employee.employeeCode || "--"}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {employee.name}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                          <span>{employee.role || defaultRole}</span>
                          <span className="text-slate-300">•</span>
                          <span>{formatCurrency(employee.hourlyRate || 0)}</span>
                        </div>
                      </div>

                      <span
                        className={cn(
                          "mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border",
                          selected
                            ? "border-emerald-200 bg-emerald-600 text-white"
                            : "border-slate-200 bg-white text-transparent"
                        )}
                      >
                        <Check className="h-4 w-4" />
                      </span>
                    </button>
                  );
                })}

                {filteredEmployees.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
                    <div className="text-lg font-semibold text-slate-900">
                      Không còn nhân viên nào để thêm
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      Toàn bộ nhân viên đã được thêm vào kỳ lương này, hoặc thử từ khóa khác.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
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
            </div>
          )}

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={onClose}
            disabled={submitting}
          >
            Đóng
          </Button>
          <Button
            className="rounded-2xl"
            isLoading={submitting}
            onClick={handleSubmit}
            disabled={mode === "existing" && !selectedEmployeeId}
          >
            {mode === "existing" ? "Thêm vào bảng lương" : "Tạo và thêm ngay"}
          </Button>
        </div>
      </div>
    </div>
  );
}
