"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { debounce } from "lodash";
import {
  addPayrollEntry,
  deletePayrollEntry,
  getPayrollEntries,
  PayrollEntry,
  updatePayrollEntry,
} from "@/services/payrolls.firebase";
import {
  addEmployee,
  Employee,
  getEmployees,
  updateEmployee,
} from "@/services/employees.firebase";
import { useStore } from "@/context/StoreContext";
import ShiftDetailModal, {
  Shift,
} from "@/app/(dashboard)/timesheet/ShiftDetailModal";
import InputMoney from "@/components/InputMoney";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Columns3,
  Loader2,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  calculatePayrollSalary,
  formatCurrency,
  formatHours,
  getDefaultRoleForStore,
  getAllowanceTotal,
  getRoleGroupsForStore,
} from "./payrollShared";
import AddPayrollEntryDialog from "./AddPayrollEntryDialog";
import AllowanceDialog from "./AllowanceDialog";
import PayrollSettingsDialog from "./PayrollSettingsDialog";

type VisibleColumns = {
  name: boolean;
  role: boolean;
  hours: boolean;
  rate: boolean;
  bonus: boolean;
  allowance: boolean;
  total: boolean;
  note: boolean;
};

const DEFAULT_COLUMNS: VisibleColumns = {
  name: true,
  role: true,
  hours: true,
  rate: true,
  bonus: true,
  allowance: true,
  total: true,
  note: true,
};

const COLUMN_OPTIONS: { key: keyof VisibleColumns; label: string }[] = [
  { key: "name", label: "Nhân viên" },
  { key: "role", label: "Vai trò" },
  { key: "hours", label: "Giờ làm" },
  { key: "rate", label: "Đơn giá" },
  { key: "bonus", label: "Cuối tuần" },
  { key: "allowance", label: "Phụ cấp" },
  { key: "total", label: "Tổng lương" },
  { key: "note", label: "Ghi chú" },
];

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
      className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
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

const hasInvalidShift = (entry: PayrollEntry) =>
  (entry.shifts || []).some((shift) => !shift.isValid || !shift.inTime || !shift.outTime);

const isEmployeeAlreadyInPayroll = (entry: PayrollEntry, employee: Employee) => {
  if (entry.employeeId && employee.id && entry.employeeId === employee.id) return true;
  const entryCode = (entry.employeeCode || "").trim().toLowerCase();
  const employeeCode = (employee.employeeCode || "").trim().toLowerCase();
  if (entryCode && employeeCode && entryCode === employeeCode) return true;
  if (!entryCode && !employeeCode) {
    return entry.employeeName.trim().toLowerCase() === employee.name.trim().toLowerCase();
  }
  return false;
};

export default function PayrollDetail({
  payrollId,
  onBack,
}: {
  payrollId: string;
  onBack: () => void;
}) {
  const { storeId } = useStore();
  const roleGroups = useMemo(() => getRoleGroupsForStore(storeId), [storeId]);
  const defaultRole = useMemo(() => getDefaultRoleForStore(storeId), [storeId]);
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [savedEmployees, setSavedEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [sortBy, setSortBy] = useState("hours_desc");
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);
  const [showColumns, setShowColumns] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [currentShiftEntry, setCurrentShiftEntry] = useState<PayrollEntry | null>(null);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [settingsEntryId, setSettingsEntryId] = useState<string | null>(null);
  const [settingsData, setSettingsData] = useState({
    salaryType: "hourly" as "hourly" | "fixed",
    fixedSalary: 0,
    standardHours: 0,
  });
  const [allowanceEntryId, setAllowanceEntryId] = useState<string | null>(null);
  const [editAllowances, setEditAllowances] = useState<
    { name: string; amount: number }[]
  >([]);

  useEffect(() => {
    loadEntries();
  }, [payrollId]);

  useEffect(() => {
    if (storeId) loadSavedEmployees();
  }, [storeId]);

  useEffect(() => {
    const saved = localStorage.getItem("payroll_visible_columns");
    if (!saved) return;
    try {
      setVisibleColumns(JSON.parse(saved));
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("payroll_visible_columns", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const debouncedUpdate = useCallback(
    debounce(
      async (
        entryId: string,
        employeeId: string,
        data: Partial<PayrollEntry>,
        syncEmployee: boolean
      ) => {
        setSavingId(entryId);
        try {
          await updatePayrollEntry(entryId, data);
          if (syncEmployee && employeeId && !employeeId.startsWith("manual_")) {
            await updateEmployee(employeeId, {
              role: data.role,
              hourlyRate: data.hourlyRate,
            });
            setSavedEmployees((current) =>
              current.map((employee) =>
                employee.id === employeeId
                  ? {
                      ...employee,
                      role: data.role ?? employee.role,
                      hourlyRate: data.hourlyRate ?? employee.hourlyRate,
                    }
                  : employee
              )
            );
          }
        } catch (error) {
          console.error(error);
        } finally {
          setSavingId((current) => (current === entryId ? null : current));
        }
      },
      700
    ),
    []
  );

  useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);

  async function loadEntries() {
    setLoading(true);
    try {
      setEntries(await getPayrollEntries(payrollId));
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedEmployees() {
    if (!storeId) return;
    setSavedEmployees(await getEmployees(storeId));
  }

  const availableEmployees = useMemo(
    () =>
      savedEmployees.filter(
        (employee) => !entries.some((entry) => isEmployeeAlreadyInPayroll(entry, employee))
      ),
    [entries, savedEmployees]
  );

  async function handleAddExistingEmployee(employee: Employee) {
    if (!employee.id) throw new Error("Không tìm thấy nhân viên đã lưu.");
    await addPayrollEntry(payrollId, {
      employeeId: employee.id,
      employeeCode: employee.employeeCode || "",
      employeeName: employee.name,
      role: employee.role || defaultRole,
      hourlyRate: employee.hourlyRate || 0,
      totalHours: 0,
      weekendHours: 0,
      salary: 0,
      allowances: [],
      note: "",
      salaryType: "hourly",
      fixedSalary: 0,
      standardHours: 0,
      shifts: [],
    });
    await loadEntries();
    setShowAddDialog(false);
  }

  async function handleCreateEmployee(payload: {
    employeeCode: string;
    hourlyRate: number;
    name: string;
    role: string;
  }) {
    if (!storeId) throw new Error("Chưa chọn cửa hàng.");
    const normalizedCode = payload.employeeCode.trim().toLowerCase();
    if (
      savedEmployees.some(
        (employee) => (employee.employeeCode || "").trim().toLowerCase() === normalizedCode
      )
    ) {
      throw new Error("Mã nhân viên đã tồn tại.");
    }

    const employeeId = await addEmployee({
      storeId,
      employeeCode: payload.employeeCode.trim(),
      name: payload.name.trim(),
      role: payload.role,
      hourlyRate: payload.hourlyRate,
    });

    await addPayrollEntry(payrollId, {
      employeeId,
      employeeCode: payload.employeeCode.trim(),
      employeeName: payload.name.trim(),
      role: payload.role,
      hourlyRate: payload.hourlyRate,
      totalHours: 0,
      weekendHours: 0,
      salary: 0,
      allowances: [],
      note: "",
      salaryType: "hourly",
      fixedSalary: 0,
      standardHours: 0,
      shifts: [],
    });
    await Promise.all([loadEntries(), loadSavedEmployees()]);
    setShowAddDialog(false);
  }

  async function handleDeleteEntry(entryId: string) {
    if (!confirm("Bạn có chắc muốn xóa nhân viên này khỏi bảng lương?")) return;
    try {
      await deletePayrollEntry(entryId);
      setEntries((current) => current.filter((entry) => entry.id !== entryId));
    } catch (error) {
      console.error(error);
      alert("Không thể xóa dòng lương.");
    }
  }

  function handleUpdateById(
    entryId: string,
    field:
      | "allowances"
      | "employeeName"
      | "fixedSalary"
      | "hourlyRate"
      | "note"
      | "role"
      | "salaryType"
      | "standardHours"
      | "totalHours"
      | "weekendHours",
    value: any
  ) {
    const index = entries.findIndex((entry) => entry.id === entryId);
    if (index === -1) return;

    const nextEntries = [...entries];
    const nextEntry = { ...nextEntries[index] };
    if (field === "employeeName") nextEntry.employeeName = String(value);
    if (field === "role") nextEntry.role = String(value);
    if (field === "hourlyRate") nextEntry.hourlyRate = Number(value) || 0;
    if (field === "totalHours") nextEntry.totalHours = Number(value) || 0;
    if (field === "weekendHours") nextEntry.weekendHours = Number(value) || 0;
    if (field === "note") nextEntry.note = String(value);
    if (field === "allowances") nextEntry.allowances = value;
    if (field === "salaryType") nextEntry.salaryType = value;
    if (field === "fixedSalary") nextEntry.fixedSalary = Number(value) || 0;
    if (field === "standardHours") nextEntry.standardHours = Number(value) || 0;
    nextEntry.salary = calculatePayrollSalary(nextEntry);
    nextEntries[index] = nextEntry;
    setEntries(nextEntries);

    debouncedUpdate(
      entryId,
      nextEntry.employeeId,
      {
        employeeName: nextEntry.employeeName,
        role: nextEntry.role,
        hourlyRate: nextEntry.hourlyRate,
        totalHours: nextEntry.totalHours,
        weekendHours: nextEntry.weekendHours,
        allowances: nextEntry.allowances || [],
        note: nextEntry.note,
        salary: nextEntry.salary,
        salaryType: nextEntry.salaryType,
        fixedSalary: nextEntry.fixedSalary,
        standardHours: nextEntry.standardHours,
      },
      field === "role" || field === "hourlyRate"
    );
  }

  async function handleSaveShifts(newShifts: Shift[]) {
    if (!currentShiftEntry?.id) return;

    let totalHours = 0;
    let weekendHours = 0;
    newShifts.forEach((shift) => {
      if (!shift.isValid || !shift.inTime || !shift.outTime) return;
      const start = new Date(shift.inTime);
      let end = new Date(shift.outTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
      if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      totalHours += hours;
      if (shift.isWeekend) weekendHours += hours;
    });

    const nextEntries = entries.map((entry) => {
      if (entry.id !== currentShiftEntry.id) return entry;
      const nextEntry = {
        ...entry,
        shifts: newShifts,
        totalHours: Number(totalHours.toFixed(2)),
        weekendHours: Number(weekendHours.toFixed(2)),
      };
      nextEntry.salary = calculatePayrollSalary(nextEntry);
      return nextEntry;
    });

    setEntries(nextEntries);
    setShiftModalOpen(false);

    const updatedEntry = nextEntries.find((entry) => entry.id === currentShiftEntry.id);
    if (!updatedEntry) return;
    await updatePayrollEntry(currentShiftEntry.id, {
      shifts: newShifts as any[],
      totalHours: updatedEntry.totalHours,
      weekendHours: updatedEntry.weekendHours,
      salary: updatedEntry.salary,
    });
  }

  const filteredEntries = entries
    .filter((entry) => {
      const keyword = searchTerm.trim().toLowerCase();
      const code = (entry.employeeCode || "").toLowerCase();
      const matchesSearch =
        !keyword ||
        entry.employeeName.toLowerCase().includes(keyword) ||
        code.includes(keyword) ||
        entry.role.toLowerCase().includes(keyword);
      return matchesSearch && (filterRole === "All" || entry.role === filterRole);
    })
    .sort((left, right) => {
      if (sortBy === "name_asc") return left.employeeName.localeCompare(right.employeeName, "vi");
      if (sortBy === "role_asc") return left.role.localeCompare(right.role, "vi");
      if (sortBy === "salary_desc") return (right.salary || 0) - (left.salary || 0);
      return (right.totalHours || 0) - (left.totalHours || 0);
    });

  const visibleCount = COLUMN_OPTIONS.filter((option) => visibleColumns[option.key]).length;
  const filteredTotal = filteredEntries.reduce((sum, entry) => sum + (entry.salary || 0), 0);
  const filteredHours = filteredEntries.reduce((sum, entry) => sum + (entry.totalHours || 0), 0);
  const filteredWeekend = filteredEntries.reduce((sum, entry) => sum + (entry.weekendHours || 0), 0);
  const warnings = entries.filter((entry) => hasInvalidShift(entry)).length;
  const allowanceEntry = entries.find((entry) => entry.id === allowanceEntryId);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-[28px] border border-slate-200 bg-white/80 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Button variant="ghost" className="mb-4 gap-2 px-0 text-slate-500" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Quay lại danh sách bảng lương
            </Button>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Payroll detail
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Chi tiết bảng lương
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Kỳ lương dùng mã `EnNo` để nhận diện nhân viên, tên chỉ còn là phần hiển thị.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[460px]">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm theo mã, tên hoặc vai trò"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <select
              value={filterRole}
              onChange={(event) => setFilterRole(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            >
              <option value="All">Tất cả vai trò</option>
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

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            >
              <option value="hours_desc">Giờ làm giảm dần</option>
              <option value="salary_desc">Tổng lương giảm dần</option>
              <option value="name_asc">Tên A-Z</option>
              <option value="role_asc">Vai trò A-Z</option>
            </select>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] bg-slate-900 p-5 text-white">
            <p className="text-sm text-slate-300">Nhân viên</p>
            <p className="mt-4 text-3xl font-semibold">{entries.length}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Tổng giờ</p>
            <p className="mt-4 text-2xl font-semibold text-slate-900">
              {formatHours(entries.reduce((sum, entry) => sum + (entry.totalHours || 0), 0))}h
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Cảnh báo ca làm</p>
            <p className="mt-4 text-2xl font-semibold text-slate-900">{warnings}</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Tổng lương</p>
            <p className="mt-4 text-2xl font-semibold text-slate-900">
              {formatCurrency(entries.reduce((sum, entry) => sum + (entry.salary || 0), 0))}
            </p>
          </div>
        </div>
      </section>

      <Card className="overflow-visible rounded-[28px] border border-slate-200 bg-white/90 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Bảng lương đang hiển thị</h3>
              <p className="mt-1 text-sm text-slate-500">
                {filteredEntries.length}/{entries.length} nhân viên theo bộ lọc hiện tại.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Button
                  variant="outline"
                  className="gap-2 rounded-2xl"
                  onClick={() => setShowColumns((current) => !current)}
                >
                  <Columns3 className="h-4 w-4" />
                  Cột hiển thị
                </Button>
                {showColumns ? (
                  <div className="absolute right-0 top-14 z-20 w-60 rounded-[24px] border border-slate-200 bg-white p-4 shadow-xl">
                    <div className="space-y-3">
                      {COLUMN_OPTIONS.map((option) => (
                        <label
                          key={option.key}
                          className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700"
                        >
                          <span>{option.label}</span>
                          <input
                            type="checkbox"
                            checked={visibleColumns[option.key]}
                            onChange={(event) =>
                              setVisibleColumns((current) => ({
                                ...current,
                                [option.key]: event.target.checked,
                              }))
                            }
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <Button className="gap-2 rounded-2xl" onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4" />
                Thêm nhân viên
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto px-6 py-5">
            <table className="min-w-[1160px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                  {visibleColumns.name ? <th className="pb-3 pr-4">Nhân viên</th> : null}
                  {visibleColumns.role ? <th className="pb-3 pr-4">Vai trò</th> : null}
                  {visibleColumns.hours ? <th className="pb-3 pr-4 text-right">Giờ làm</th> : null}
                  {visibleColumns.rate ? <th className="pb-3 pr-4 text-right">Đơn giá</th> : null}
                  {visibleColumns.bonus ? <th className="pb-3 pr-4 text-right">Cuối tuần</th> : null}
                  {visibleColumns.allowance ? <th className="pb-3 pr-4">Phụ cấp</th> : null}
                  {visibleColumns.total ? <th className="pb-3 pr-4 text-right">Tổng lương</th> : null}
                  {visibleColumns.note ? <th className="pb-3">Ghi chú</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="align-top">
                    {visibleColumns.name ? (
                      <td className="py-4 pr-4">
                        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {hasInvalidShift(entry) ? (
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                                    <AlertCircle className="h-4 w-4" />
                                  </span>
                                ) : null}
                                <input
                                  value={entry.employeeName}
                                  onChange={(event) =>
                                    handleUpdateById(entry.id!, "employeeName", event.target.value)
                                  }
                                  className="h-10 w-full rounded-2xl border border-transparent bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                />
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 font-mono text-xs font-semibold text-white">
                                  {entry.employeeCode || "Chưa có mã"}
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                                    entry.salaryType === "fixed"
                                      ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                                      : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                  )}
                                >
                                  {entry.salaryType === "fixed" ? "Cố định" : "Theo giờ"}
                                </span>
                                {savingId === entry.id ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-600">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Đang lưu
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-2xl text-slate-500 hover:bg-slate-200"
                                onClick={() => {
                                  setSettingsEntryId(entry.id || null);
                                  setSettingsData({
                                    salaryType: entry.salaryType || "hourly",
                                    fixedSalary: entry.fixedSalary || 0,
                                    standardHours: entry.standardHours || 0,
                                  });
                                }}
                              >
                                <Settings2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-2xl text-rose-500 hover:bg-rose-50"
                                onClick={() => handleDeleteEntry(entry.id!)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </td>
                    ) : null}

                    {visibleColumns.role ? (
                      <td className="py-4 pr-4">
                        <RoleSelect
                          roleGroups={roleGroups}
                          value={entry.role || defaultRole}
                          onChange={(value) => handleUpdateById(entry.id!, "role", value)}
                        />
                      </td>
                    ) : null}

                    {visibleColumns.hours ? (
                      <td className="py-4 pr-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            value={entry.totalHours || ""}
                            onChange={(event) =>
                              handleUpdateById(entry.id!, "totalHours", event.target.value)
                            }
                            className="h-10 w-24 rounded-2xl border border-slate-200 bg-white px-3 text-right outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 no-spin"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-2xl"
                            onClick={() => {
                              setCurrentShiftEntry(entry);
                              setShiftModalOpen(true);
                            }}
                          >
                            <CalendarClock className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    ) : null}

                    {visibleColumns.rate ? (
                      <td className="py-4 pr-4 text-right">
                        {entry.salaryType === "fixed" ? (
                          <div className="ml-auto max-w-[210px] rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-3 text-right">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                              Fixed
                            </div>
                            <div className="mt-2 font-semibold text-slate-900">
                              {formatCurrency(entry.fixedSalary || 0)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Định mức {formatHours(entry.standardHours || 0)}h, OT{" "}
                              {formatCurrency(entry.hourlyRate || 0)}/h
                            </div>
                          </div>
                        ) : (
                          <div className="ml-auto max-w-[180px]">
                            <InputMoney
                              value={entry.hourlyRate}
                              set={(value) => handleUpdateById(entry.id!, "hourlyRate", value)}
                              className="h-10 rounded-2xl"
                            />
                          </div>
                        )}
                      </td>
                    ) : null}

                    {visibleColumns.bonus ? (
                      <td className="py-4 pr-4 text-right">
                        <input
                          type="number"
                          value={entry.weekendHours || ""}
                          onChange={(event) =>
                            handleUpdateById(entry.id!, "weekendHours", event.target.value)
                          }
                          className="ml-auto h-10 w-24 rounded-2xl border border-slate-200 bg-white px-3 text-right outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 no-spin"
                        />
                      </td>
                    ) : null}

                    {visibleColumns.allowance ? (
                      <td className="py-4 pr-4">
                        <button
                          onClick={() => {
                            setAllowanceEntryId(entry.id || null);
                            setEditAllowances(entry.allowances || []);
                          }}
                          className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
                        >
                          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                            {(entry.allowances || []).length} khoản
                          </div>
                          <div className="mt-1 font-semibold text-slate-900">
                            {formatCurrency(getAllowanceTotal(entry))}
                          </div>
                        </button>
                      </td>
                    ) : null}

                    {visibleColumns.total ? (
                      <td className="py-4 pr-4 text-right font-semibold text-emerald-700">
                        {formatCurrency(entry.salary || 0)}
                      </td>
                    ) : null}

                    {visibleColumns.note ? (
                      <td className="py-4">
                        <input
                          value={entry.note || ""}
                          onChange={(event) =>
                            handleUpdateById(entry.id!, "note", event.target.value)
                          }
                          placeholder="Ghi chú thêm"
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}

                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(visibleCount, 1)} className="py-16 text-center text-slate-500">
                      Không có nhân viên phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-slate-500">
              Có {warnings} dòng cần kiểm tra lại dữ liệu chấm công.
            </p>
            <div className="flex flex-wrap gap-5 text-sm">
              <div>Giờ làm: <span className="font-semibold text-slate-900">{formatHours(filteredHours)}h</span></div>
              <div>Cuối tuần: <span className="font-semibold text-slate-900">{formatHours(filteredWeekend)}h</span></div>
              <div>Tổng lương: <span className="font-semibold text-emerald-700">{formatCurrency(filteredTotal)}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddPayrollEntryDialog
        open={showAddDialog}
        employees={availableEmployees}
        storeId={storeId}
        onAddExisting={handleAddExistingEmployee}
        onClose={() => setShowAddDialog(false)}
        onCreateNew={handleCreateEmployee}
      />

      {allowanceEntryId ? (
        <AllowanceDialog
          allowances={editAllowances}
          employeeName={allowanceEntry?.employeeName || "Nhân viên"}
          onAdd={() => setEditAllowances((current) => [...current, { name: "", amount: 0 }])}
          onAmountChange={(index, value) =>
            setEditAllowances((current) =>
              current.map((allowance, allowanceIndex) =>
                allowanceIndex === index ? { ...allowance, amount: value } : allowance
              )
            )
          }
          onClose={() => setAllowanceEntryId(null)}
          onNameChange={(index, value) =>
            setEditAllowances((current) =>
              current.map((allowance, allowanceIndex) =>
                allowanceIndex === index ? { ...allowance, name: value } : allowance
              )
            )
          }
          onRemove={(index) =>
            setEditAllowances((current) =>
              current.filter((_, allowanceIndex) => allowanceIndex !== index)
            )
          }
          onSave={() => {
            if (!allowanceEntryId) return;
            handleUpdateById(allowanceEntryId, "allowances", editAllowances);
            setAllowanceEntryId(null);
          }}
        />
      ) : null}

      {settingsEntryId ? (
        <PayrollSettingsDialog
          fixedSalary={settingsData.fixedSalary}
          onClose={() => setSettingsEntryId(null)}
          onFixedSalaryChange={(value) =>
            setSettingsData((current) => ({ ...current, fixedSalary: value }))
          }
          onSave={() => {
            handleUpdateById(settingsEntryId, "salaryType", settingsData.salaryType);
            handleUpdateById(settingsEntryId, "fixedSalary", settingsData.fixedSalary);
            handleUpdateById(settingsEntryId, "standardHours", settingsData.standardHours);
            setSettingsEntryId(null);
          }}
          onSalaryTypeChange={(value) =>
            setSettingsData((current) => ({ ...current, salaryType: value }))
          }
          onStandardHoursChange={(value) =>
            setSettingsData((current) => ({ ...current, standardHours: value }))
          }
          salaryType={settingsData.salaryType}
          standardHours={settingsData.standardHours}
        />
      ) : null}

      <ShiftDetailModal
        isOpen={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        onSave={handleSaveShifts}
        employeeName={currentShiftEntry?.employeeName || ""}
        employeeId={currentShiftEntry?.employeeCode || currentShiftEntry?.employeeId || ""}
        initialShifts={currentShiftEntry?.shifts || []}
      />
    </div>
  );
}
