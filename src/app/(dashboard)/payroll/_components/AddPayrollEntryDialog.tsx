"use client";

import { useEffect, useMemo, useState } from "react";
import type { StoreType } from "@/context/StoreContext";
import { Employee } from "@/services/employees.firebase";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Check, Search, UserPlus, Users, X } from "lucide-react";
import { formatCurrency, getDefaultRoleForStore, getRoleGroupsForStore } from "./payrollShared";
import EmployeeSalaryFields, {
  createEmployeeSalaryFormValues,
  EmployeeSalaryFormValues,
  resolveEmployeeSalaryType,
  validateEmployeeSalaryForm,
} from "./EmployeeSalaryFields";

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
    salaryType: "hourly" | "monthly";
    monthlySalary: number;
    expectedWorkDays: number;
    paidLeaveDays: number;
    standardHours: number;
  }) => Promise<void>;
};

function getExistingEmployeeSummary(employee: Employee) {
  const salaryType = resolveEmployeeSalaryType(employee);
  if (salaryType === "monthly") {
    return {
      badgeClass: "bg-sky-100 text-sky-800 ring-1 ring-sky-200",
      badgeLabel: "Lương tháng",
      detail: `${formatCurrency(employee.monthlySalary || 0)} • ${employee.expectedWorkDays || 30} ngày công • OT ${formatCurrency(employee.hourlyRate || 0)}/h`,
    };
  }
  return {
    badgeClass: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    badgeLabel: "Theo giờ",
    detail: `${formatCurrency(employee.hourlyRate || 0)}/h`,
  };
}

export default function AddPayrollEntryDialog({ open, employees, storeId, onAddExisting, onClose, onCreateNew }: AddPayrollEntryDialogProps) {
  const roleGroups = useMemo(() => getRoleGroupsForStore(storeId), [storeId]);
  const defaultRole = useMemo(() => getDefaultRoleForStore(storeId), [storeId]);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [formValues, setFormValues] = useState<EmployeeSalaryFormValues>(() => createEmployeeSalaryFormValues(defaultRole));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMode("existing");
    setSearchTerm("");
    setSelectedEmployeeId(employees[0]?.id || "");
    setFormValues(createEmployeeSalaryFormValues(defaultRole));
    setError("");
  }, [defaultRole, employees, open]);

  const filteredEmployees = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return employees;
    return employees.filter((employee) => {
      const code = (employee.employeeCode || "").toLowerCase();
      const employeeName = (employee.name || "").toLowerCase();
      const employeeRole = (employee.role || "").toLowerCase();
      return code.includes(keyword) || employeeName.includes(keyword) || employeeRole.includes(keyword);
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
        const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId);
        if (!selectedEmployee) throw new Error("Vui lòng chọn nhân viên đã lưu.");
        await onAddExisting(selectedEmployee);
        return;
      }

      const validationError = validateEmployeeSalaryForm(formValues);
      if (validationError) throw new Error(validationError);

      await onCreateNew({
        employeeCode: formValues.employeeCode.trim(),
        hourlyRate: formValues.hourlyRate,
        name: formValues.name.trim(),
        role: formValues.role,
        salaryType: formValues.salaryType,
        monthlySalary: formValues.salaryType === "monthly" ? formValues.monthlySalary : 0,
        expectedWorkDays: formValues.salaryType === "monthly" ? formValues.expectedWorkDays || 30 : 0,
        paidLeaveDays: formValues.salaryType === "monthly" ? formValues.paidLeaveDays : 0,
        standardHours: formValues.salaryType === "monthly" ? formValues.standardHours : 0,
      });
    } catch (submitError) {
      if (submitError instanceof Error) setError(submitError.message);
      else setError("Không thể thêm nhân viên vào bảng lương.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Kỳ lương</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">Thêm nhân viên vào kỳ lương</h3>
            <p className="mt-2 text-sm text-slate-500">Chọn từ danh sách nhân viên đã lưu hoặc tạo hồ sơ mới ngay tại đây.</p>
          </div>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-slate-500 hover:bg-slate-100" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setMode("existing")} className={cn("rounded-[24px] border px-4 py-4 text-left transition-all", mode === "existing" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white")}>
              <div className="flex items-start gap-3">
                <div className={cn("rounded-2xl p-2", mode === "existing" ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600")}><Users className="h-4 w-4" /></div>
                <div><div className="font-semibold">Chọn nhân viên đã lưu</div><p className="mt-1 text-sm text-inherit/80">Danh sách đã tự loại các nhân viên đang có trong kỳ lương này.</p></div>
              </div>
            </button>
            <button type="button" onClick={() => setMode("new")} className={cn("rounded-[24px] border px-4 py-4 text-left transition-all", mode === "new" ? "border-sky-200 bg-sky-50 text-sky-900" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white")}>
              <div className="flex items-start gap-3">
                <div className={cn("rounded-2xl p-2", mode === "new" ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-600")}><UserPlus className="h-4 w-4" /></div>
                <div><div className="font-semibold">Tạo nhân viên mới</div><p className="mt-1 text-sm text-inherit/80">Lưu hồ sơ mới và thêm ngay vào bảng lương bằng mã `EnNo`.</p></div>
              </div>
            </button>
          </div>

          {mode === "existing" ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm theo mã, tên hoặc vai trò" className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100" />
              </div>
              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {filteredEmployees.map((employee) => {
                  const selected = employee.id === selectedEmployeeId;
                  const summary = getExistingEmployeeSummary(employee);
                  return (
                    <button key={employee.id} type="button" onClick={() => setSelectedEmployeeId(employee.id || "")} className={cn("flex w-full items-start justify-between gap-3 rounded-[24px] border px-4 py-4 text-left transition-all", selected ? "border-emerald-200 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50")}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-900 px-3 py-1 font-mono text-xs font-semibold text-white">{employee.employeeCode || "--"}</span>
                          <span className="font-semibold text-slate-900">{employee.name}</span>
                          <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", summary.badgeClass)}>{summary.badgeLabel}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500"><span>{employee.role || defaultRole}</span><span className="text-slate-300">?</span><span>{summary.detail}</span></div>
                      </div>
                      <span className={cn("mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border", selected ? "border-emerald-200 bg-emerald-600 text-white" : "border-slate-200 bg-white text-transparent")}><Check className="h-4 w-4" /></span>
                    </button>
                  );
                })}
                {filteredEmployees.length === 0 ? <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center"><div className="text-lg font-semibold text-slate-900">Không còn nhân viên nào để thêm</div><p className="mt-2 text-sm text-slate-500">Toàn bộ nhân viên đã được thêm vào kỳ lương này, hoặc thử từ khóa khác.</p></div> : null}
              </div>
            </div>
          ) : (
            <EmployeeSalaryFields roleGroups={roleGroups} values={formValues} onChange={(changes) => setFormValues((current) => ({ ...current, ...changes }))} />
          )}

          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:justify-end">
          <Button variant="outline" className="rounded-2xl" onClick={onClose} disabled={submitting}>Đóng</Button>
          <Button className="rounded-2xl" isLoading={submitting} onClick={() => void handleSubmit()} disabled={mode === "existing" && !selectedEmployeeId}>{mode === "existing" ? "Thêm vào bảng lương" : "Tạo và thêm ngay"}</Button>
        </div>
      </div>
    </div>
  );
}
