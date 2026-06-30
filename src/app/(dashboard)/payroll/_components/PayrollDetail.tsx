"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { debounce } from "lodash";
import * as XLSX from "xlsx";

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
import {
  getRoleStartTimes,
  type RoleStartTimeSetting,
} from "@/services/roleStartTimes";

import { useStore } from "@/context/StoreContext";

import ShiftDetailModal, {
  Shift,
} from "@/app/(dashboard)/timesheet/ShiftDetailModal";

import InputMoney from "@/components/InputMoney";

import { Button } from "@/components/ui/Button";

import { Card, CardContent } from "@/components/ui/Card";

import { Input } from "@/components/ui/Input";

import { cn, preventNumberInputScroll } from "@/lib/utils";

import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Columns3,
  Download,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  calculatePayrollSalary,
  formatCurrency,
  formatHours,
  getAllowanceTotal,
  getAttendanceBonusProgress,
  getAttendanceBonusValue,
  getDefaultRoleForStore,
  getEntryLateSummary,
  getExpectedWorkDays,
  getPayrollBreakdown,
  getRoleGroupsForStore,
  normalizePayrollSalaryType,
  resolvePayrollSalaryType,
} from "./payrollShared";

import AddPayrollEntryDialog from "./AddPayrollEntryDialog";

import AllowanceDialog from "./AllowanceDialog";

import PayrollSettingsDialog from "./PayrollSettingsDialog";

type VisibleColumns = {
  name: boolean;

  role: boolean;

  late: boolean;

  hours: boolean;

  workDays: boolean;

  rate: boolean;

  weekend: boolean;

  allowance: boolean;

  total: boolean;

  note: boolean;

  action: boolean;
};

const DEFAULT_COLUMNS: VisibleColumns = {
  name: true,

  role: true,

  late: true,

  hours: true,

  workDays: true,

  rate: true,

  weekend: true,

  allowance: true,

  total: true,

  note: true,

  action: true,
};

const COLUMN_OPTIONS: { key: keyof VisibleColumns; label: string }[] = [
  { key: "name", label: "Nhân viên" },
  { key: "role", label: "Vai trò" },
  { key: "late", label: "Đi trễ" },
  { key: "hours", label: "Giờ làm" },
  { key: "workDays", label: "Ngày công" },
  { key: "rate", label: "Đơn giá" },
  { key: "weekend", label: "Cuối tuần" },
  { key: "allowance", label: "Phụ cấp" },
  { key: "total", label: "Tổng lương" },
  { key: "note", label: "Ghi chú" },
  { key: "action", label: "Tác vụ" },
];

const sanitizeWorksheetName = (value: string, fallback: string) => {
  const normalized = value
    .replace(/[\\/?*[\]:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (normalized || fallback).slice(0, 31);
};

const sanitizeExportFileName = (value: string, fallback: string) => {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return normalized || fallback;
};

type TimesheetImportRow = {
  employeeCode: string;
  employeeName: string;
  dateTime: string;
};

type EmployeeImportDialogState = {
  entryId: string;
  employeeCode: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  fileName: string;
};

type EmployeeImportPreview = {
  entryId: string;
  startDate: string;
  endDate: string;
  oldHours: number;
  newHours: number;
  oldShiftCount: number;
  newShiftCount: number;
  replacedShiftCount: number;
  importedShiftCount: number;
};

type EntryImportSnapshot = {
  shifts: Shift[];
  totalHours: number;
  weekendHours: number;
  preview: EmployeeImportPreview;
};

type PayrollEntryUiMeta = {
  hasPendingSave?: boolean;
  isImported?: boolean;
  isManualEdited?: boolean;
  lastImportPreview?: EmployeeImportPreview | null;
  lastImportSnapshot?: EntryImportSnapshot | null;
  lastSavedAt?: number | null;
};

type PreparedEmployeeImport = {
  importedShifts: Shift[];
  mergedShifts: Shift[];
  preview: EmployeeImportPreview;
  totals: {
    totalHours: number;
    weekendHours: number;
  };
};

const formatDateInput = (date: Date) => {
  const local = new Date(date.getTime());
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().split("T")[0];
};

const normalizeTimesheetHeader = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

const normalizeDateOnly = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const firstToken = raw.replace("T", " ").split(" ")[0] || "";
  if (!firstToken) return "";

  const normalizedToken = firstToken.replace(/\//g, "-").replace(/\./g, "-");
  const isoMatch = normalizedToken.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const localMatch = normalizedToken.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (localMatch) {
    const [, day, month, year] = localMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(
    parsed.getDate(),
  ).padStart(2, "0")}`;
};

const isDateWithinRange = (date: string, startDate: string, endDate: string) => {
  if (!date) return false;
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return true;
};

const parseTimesheetDateTime = (value: string) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const parsed = new Date(raw.replace(" ", "T"));
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const match = raw.match(
    /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) {
    return null;
  }

  const [, day, month, year, hour, minute, second] = match;
  const localDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second || 0),
  );
  return Number.isNaN(localDate.getTime()) ? null : localDate;
};

const buildShiftId = (prefix: string, index: number, suffix: string) =>
  `${prefix}-${index}-${suffix}`;

const cloneShifts = (shifts: Shift[] = []) => shifts.map((shift) => ({ ...shift }));

const summarizeImportedShifts = (
  rows: TimesheetImportRow[],
  employeeKey: string,
): Shift[] => {
  const sortedRows = [...rows].sort((left, right) => {
    const leftTime = parseTimesheetDateTime(left.dateTime)?.getTime() || 0;
    const rightTime = parseTimesheetDateTime(right.dateTime)?.getTime() || 0;
    return leftTime - rightTime;
  });

  const shifts: Shift[] = [];
  let pointer = 0;

  while (pointer < sortedRows.length) {
    const current = sortedRows[pointer];
    const inTime = parseTimesheetDateTime(current.dateTime);
    let matched = false;

    if (inTime && pointer + 1 < sortedRows.length) {
      const next = sortedRows[pointer + 1];
      const outTime = parseTimesheetDateTime(next.dateTime);

      if (outTime) {
        const limitDate = new Date(inTime);
        if (limitDate.getHours() >= 5) {
          limitDate.setDate(limitDate.getDate() + 1);
        }
        limitDate.setHours(5, 0, 0, 0);

        if (outTime <= limitDate) {
          const diffMs = outTime.getTime() - inTime.getTime();
          const hours = diffMs / (1000 * 60 * 60);

          if (hours > 0) {
            const isWeekend = inTime.getDay() === 0 || inTime.getDay() === 6;
            shifts.push({
              id: buildShiftId(employeeKey, pointer, "ok"),
              date: normalizeDateOnly(current.dateTime).replace(/-/g, "/"),
              inTime: current.dateTime,
              outTime: next.dateTime,
              hours: Number.parseFloat(hours.toFixed(2)),
              isWeekend,
              isValid: true,
            });
            pointer += 2;
            matched = true;
          }
        }
      }
    }

    if (!matched) {
      shifts.push({
        id: buildShiftId(employeeKey, pointer, "invalid"),
        date: normalizeDateOnly(current.dateTime).replace(/-/g, "/"),
        inTime: current.dateTime,
        outTime: "",
        hours: 0,
        isWeekend: false,
        isValid: false,
      });
      pointer += 1;
    }
  }

  return shifts;
};

const mergeShiftsByDateRange = (
  existingShifts: Shift[],
  importedShifts: Shift[],
  startDate: string,
  endDate: string,
) => {
  const preserved = existingShifts.filter((shift) => {
    const shiftDate = normalizeDateOnly(shift.date || shift.inTime || "");
    return !isDateWithinRange(shiftDate, startDate, endDate);
  });

  return [...preserved, ...importedShifts].sort((left, right) => {
    const leftTime = parseTimesheetDateTime(left.inTime || left.date)?.getTime() || 0;
    const rightTime = parseTimesheetDateTime(right.inTime || right.date)?.getTime() || 0;
    return leftTime - rightTime;
  });
};

const summarizeShiftTotals = (shifts: Shift[]) =>
  shifts.reduce(
    (result, shift) => {
      if (!shift.isValid) return result;
      result.totalHours += shift.hours || 0;
      if (shift.isWeekend) {
        result.weekendHours += shift.hours || 0;
      }
      return result;
    },
    { totalHours: 0, weekendHours: 0 },
  );

const getEntryShiftDateDefaults = (entry: PayrollEntry) => {
  const dates = (entry.shifts || [])
    .map((shift) => normalizeDateOnly(shift.date || shift.inTime || ""))
    .filter(Boolean)
    .sort();

  const today = formatDateInput(new Date());
  return {
    startDate: dates[0] || today,
    endDate: dates[dates.length - 1] || today,
  };
};

const parsePlainTextTimesheetRows = async (
  file: File,
): Promise<TimesheetImportRow[]> => {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const rows: TimesheetImportRow[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    const delimiter = line.includes("\t")
      ? "\t"
      : line.includes(";")
        ? ";"
        : ",";
    const values = line.split(delimiter);
    if (values.length < 7) continue;

    const dateTimeValue = String(values[6] ?? "").trim();
    if (!dateTimeValue || !parseTimesheetDateTime(dateTimeValue)) {
      continue;
    }

    rows.push({
      employeeCode: String(values[2] ?? "").trim(),
      employeeName: String(values[3] ?? "").trim(),
      dateTime: dateTimeValue,
    });
  }

  return rows;
};

const parseTimesheetImportFile = async (file: File): Promise<TimesheetImportRow[]> => {
  const fileName = file.name.trim().toLowerCase();
  if (fileName.endsWith(".txt") || fileName.endsWith(".csv")) {
    return parsePlainTextTimesheetRows(file);
  }

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

  const headerIndex = rows.findIndex((row) => {
    if (!Array.isArray(row)) return false;
    const headers = row.map(normalizeTimesheetHeader);
    return headers.includes("enno") && headers.includes("datetime");
  });

  if (headerIndex === -1) {
    throw new Error("Không tìm thấy header file chấm công hợp lệ.");
  }

  const headerRow = rows[headerIndex] || [];
  const dataRows = rows.slice(headerIndex + 1);
  const employeeCodeIndex = headerRow.findIndex(
    (cell) => normalizeTimesheetHeader(cell) === "enno",
  );
  const employeeNameIndex = headerRow.findIndex(
    (cell) => normalizeTimesheetHeader(cell) === "name",
  );
  const dateTimeIndex = headerRow.findIndex(
    (cell) => normalizeTimesheetHeader(cell) === "datetime",
  );

  if (employeeCodeIndex === -1 || dateTimeIndex === -1) {
    throw new Error("Thiếu cột mã nhân viên hoặc thời gian chấm công.");
  }

  return dataRows
    .map((row) => ({
      employeeCode: String(row[employeeCodeIndex] ?? "").trim(),
      employeeName: String(employeeNameIndex >= 0 ? row[employeeNameIndex] : "").trim(),
      dateTime: String(row[dateTimeIndex] ?? "").trim(),
    }))
    .filter((row) => row.dateTime && parseTimesheetDateTime(row.dateTime));
};

const prepareEmployeeImportData = async ({
  dialog,
  file,
  targetEntry,
}: {
  dialog: EmployeeImportDialogState;
  file: File;
  targetEntry: PayrollEntry;
}): Promise<PreparedEmployeeImport> => {
  const importedRows = await parseTimesheetImportFile(file);
  const normalizedCode = (dialog.employeeCode || "").trim().toLowerCase();
  const normalizedName = dialog.employeeName.trim().toLowerCase();

  const matchedRows = importedRows.filter((row) => {
    const rowDate = normalizeDateOnly(row.dateTime);
    if (!isDateWithinRange(rowDate, dialog.startDate, dialog.endDate)) {
      return false;
    }

    const rowCode = row.employeeCode.trim().toLowerCase();
    const rowName = row.employeeName.trim().toLowerCase();

    if (normalizedCode) {
      return rowCode === normalizedCode;
    }

    return rowName === normalizedName;
  });

  if (matchedRows.length === 0) {
    throw new Error(
      "Không tìm thấy dữ liệu chấm công của nhân viên này trong khoảng đã chọn.",
    );
  }

  const importedShifts = summarizeImportedShifts(
    matchedRows,
    targetEntry.employeeCode || targetEntry.employeeId || targetEntry.employeeName,
  );
  const mergedShifts = mergeShiftsByDateRange(
    (targetEntry.shifts || []) as Shift[],
    importedShifts,
    dialog.startDate,
    dialog.endDate,
  );
  const totals = summarizeShiftTotals(mergedShifts);
  const replacedShiftCount = (targetEntry.shifts || []).filter((shift) =>
    isDateWithinRange(
      normalizeDateOnly(shift.date || shift.inTime || ""),
      dialog.startDate,
      dialog.endDate,
    ),
  ).length;

  return {
    importedShifts,
    mergedShifts,
    preview: {
      entryId: dialog.entryId,
      startDate: dialog.startDate,
      endDate: dialog.endDate,
      oldHours: Number((targetEntry.totalHours || 0).toFixed(2)),
      newHours: Number(totals.totalHours.toFixed(2)),
      oldShiftCount: (targetEntry.shifts || []).length,
      newShiftCount: mergedShifts.length,
      replacedShiftCount,
      importedShiftCount: importedShifts.length,
    },
    totals,
  };
};

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
  (entry.shifts || []).some(
    (shift) => !shift.isValid || !shift.inTime || !shift.outTime,
  );

const hasEntryError = (entry: PayrollEntry) => hasInvalidShift(entry);

const isEmployeeAlreadyInPayroll = (
  entry: PayrollEntry,
  employee: Employee,
) => {
  if (entry.employeeId && employee.id && entry.employeeId === employee.id)
    return true;

  const entryCode = (entry.employeeCode || "").trim().toLowerCase();
  const employeeCode = (employee.employeeCode || "").trim().toLowerCase();
  const entryLegacyCode = (entry.employeeId || "").trim().toLowerCase();

  if (entryCode && employeeCode && entryCode === employeeCode) return true;
  if (
    !entryCode &&
    entryLegacyCode &&
    employeeCode &&
    entryLegacyCode === employeeCode
  )
    return true;

  if (!entryCode && !employeeCode) {
    return (
      entry.employeeName.trim().toLowerCase() ===
      employee.name.trim().toLowerCase()
    );
  }
  return false;
};

const findLinkedEmployee = (entry: PayrollEntry, employees: Employee[]) => {
  if (entry.employeeId && !entry.employeeId.startsWith("manual_")) {
    const matchedById = employees.find(
      (employee) => employee.id === entry.employeeId,
    );
    if (matchedById) return matchedById;

    const legacyEmployeeCode = entry.employeeId.trim().toLowerCase();
    const matchedByLegacyCode = employees.find(
      (employee) =>
        (employee.employeeCode || "").trim().toLowerCase() ===
        legacyEmployeeCode,
    );
    if (matchedByLegacyCode) return matchedByLegacyCode;
  }

  const entryCode = (entry.employeeCode || "").trim().toLowerCase();
  if (entryCode) {
    const matchedByCode = employees.find(
      (employee) =>
        (employee.employeeCode || "").trim().toLowerCase() === entryCode,
    );
    if (matchedByCode) return matchedByCode;
  }

  const entryName = entry.employeeName.trim().toLowerCase();
  if (!entryName) return undefined;
  return employees.find(
    (employee) => employee.name.trim().toLowerCase() === entryName,
  );
};

const buildPayrollEntryPayload = (
  entry: PayrollEntry,
): Partial<PayrollEntry> => {
  const salaryType = resolvePayrollSalaryType(entry);
  const monthlySalary =
    salaryType === "monthly"
      ? entry.monthlySalary || entry.fixedSalary || 0
      : 0;

  return {
    employeeId: entry.employeeId,
    employeeCode: entry.employeeCode || "",
    employeeName: entry.employeeName,
    role: entry.role,
    hourlyRate: entry.hourlyRate || 0,
    hourlyMultiplier: entry.hourlyMultiplier ?? 1,
    totalHours: entry.totalHours || 0,
    weekendHours: entry.weekendHours || 0,
    salary: entry.salary || 0,
    allowances: entry.allowances || [],
    shifts: cloneShifts(entry.shifts || []),
    note: entry.note || "",
    salaryType,
    monthlySalary,
    fixedSalary: salaryType === "monthly" ? monthlySalary : 0,
    expectedWorkDays:
      salaryType === "monthly" ? entry.expectedWorkDays || 30 : 0,
    paidLeaveDays: salaryType === "monthly" ? entry.paidLeaveDays || 0 : 0,
    attendanceBonusEnabled: entry.attendanceBonusEnabled || false,
    attendanceBonusDays: entry.attendanceBonusDays || 0,
    attendanceBonusAmount: entry.attendanceBonusAmount || 0,
    standardHours: salaryType === "monthly" ? entry.standardHours || 0 : 0,
  };
};

const hasProfileAllowances = (employee?: Employee) =>
  Array.isArray(employee?.allowances) &&
  (employee?.allowances || []).some(
    (allowance) => (allowance?.amount || 0) > 0 || (allowance?.name || "").trim() !== "",
  );

const mergeEntryWithEmployeeProfile = (
  entry: PayrollEntry,
  employees: Employee[],
) => {
  const linkedEmployee = findLinkedEmployee(entry, employees);
  if (!linkedEmployee) return entry;

  const entrySalaryType = resolvePayrollSalaryType(entry);
  const employeeSalaryType = resolvePayrollSalaryType(
    linkedEmployee as Partial<PayrollEntry>,
  );
  const needsMonthlyProfileHydration =
    employeeSalaryType === "monthly" &&
    (entry.monthlySalary || entry.fixedSalary || 0) === 0 &&
    (entry.expectedWorkDays || 0) === 0 &&
    (entry.paidLeaveDays || 0) === 0 &&
    (entry.standardHours || 0) === 0 &&
    !entry.attendanceBonusEnabled &&
    (entry.attendanceBonusDays || 0) === 0 &&
    (entry.attendanceBonusAmount || 0) === 0;
  const needsAllowanceHydration =
    hasProfileAllowances(linkedEmployee) &&
    (!Array.isArray(entry.allowances) || entry.allowances.length === 0);
  const shouldUseEmployeeProfile =
    needsAllowanceHydration ||
    needsMonthlyProfileHydration ||
    (employeeSalaryType === "monthly" && entrySalaryType !== "monthly");

  if (!shouldUseEmployeeProfile) return entry;

  const nextEntry: PayrollEntry = {
    ...entry,
    employeeId: linkedEmployee.id || entry.employeeId,
    employeeCode: linkedEmployee.employeeCode || entry.employeeCode,
    salaryType: employeeSalaryType,
    monthlySalary: linkedEmployee.monthlySalary || 0,
    fixedSalary: linkedEmployee.monthlySalary || 0,
    expectedWorkDays:
      employeeSalaryType === "monthly"
        ? linkedEmployee.expectedWorkDays || 30
        : linkedEmployee.expectedWorkDays || 0,
    paidLeaveDays: linkedEmployee.paidLeaveDays || 0,
    attendanceBonusEnabled: linkedEmployee.attendanceBonusEnabled || false,
    attendanceBonusDays: linkedEmployee.attendanceBonusDays || 0,
    attendanceBonusAmount: linkedEmployee.attendanceBonusAmount || 0,
    standardHours: linkedEmployee.standardHours || 0,
    allowances:
      needsAllowanceHydration && linkedEmployee.allowances
        ? linkedEmployee.allowances.map((allowance) => ({
            name: allowance.name,
            amount: allowance.amount,
            period: allowance.period,
          }))
        : entry.allowances || [],
  };
  nextEntry.salary = calculatePayrollSalary(nextEntry);
  return nextEntry;
};

export default function PayrollDetail({
  payrollId,
  onBack,
  onEmployeesChanged,
}: {
  payrollId: string;
  onBack: () => void;
  onEmployeesChanged?: () => void;
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

  const [currentShiftEntry, setCurrentShiftEntry] =
    useState<PayrollEntry | null>(null);

  const [shiftModalOpen, setShiftModalOpen] = useState(false);

  const [settingsEntryId, setSettingsEntryId] = useState<string | null>(null);

  const [settingsData, setSettingsData] = useState({
    salaryType: "hourly" as "hourly" | "monthly",
    monthlySalary: 0,
    expectedWorkDays: 30,
    paidLeaveDays: 0,
    standardHours: 0,
    overtimeRate: 0,
    hourlyMultiplier: 1,
  });
  const [batchHourlyMultiplier, setBatchHourlyMultiplier] = useState(1);
  const [isApplyingBatchMultiplier, setIsApplyingBatchMultiplier] =
    useState(false);
  const [showBatchMultiplierDialog, setShowBatchMultiplierDialog] =
    useState(false);

  const [allowanceEntryId, setAllowanceEntryId] = useState<string | null>(null);

  const [editAllowances, setEditAllowances] = useState<
    { name: string; amount: number }[]
  >([]);

  const [attendanceBonusEnabled, setAttendanceBonusEnabled] = useState(false);

  const [attendanceBonusDays, setAttendanceBonusDays] = useState(0);

  const [attendanceBonusAmount, setAttendanceBonusAmount] = useState(0);

  const [salaryDetailEntryId, setSalaryDetailEntryId] = useState<string | null>(
    null,
  );
  const [employeeImportDialog, setEmployeeImportDialog] =
    useState<EmployeeImportDialogState | null>(null);
  const [employeeImportFile, setEmployeeImportFile] = useState<File | null>(null);
  const [employeeImportPreview, setEmployeeImportPreview] =
    useState<EmployeeImportPreview | null>(null);
  const [employeeImportError, setEmployeeImportError] = useState("");
  const [isImportingEmployeeHours, setIsImportingEmployeeHours] = useState(false);
  const [entryUiMeta, setEntryUiMeta] = useState<Record<string, PayrollEntryUiMeta>>(
    {},
  );
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const entrySaveQueuesRef = useRef<Record<string, Promise<void>>>({});
  const saveHighlightTimeoutsRef = useRef<Record<string, number>>({});

  const [hasLoadedColumnPrefs, setHasLoadedColumnPrefs] = useState(false);

  const [filterError, setFilterError] = useState(false);
  const [filterLateOnly, setFilterLateOnly] = useState(false);
  const [filterImportedOnly, setFilterImportedOnly] = useState(false);
  const [filterHourlyOnly, setFilterHourlyOnly] = useState(false);
  const [filterMonthlyOnly, setFilterMonthlyOnly] = useState(false);
  const [roleStartTimes, setRoleStartTimes] = useState<
    Record<string, RoleStartTimeSetting>
  >({});

  const updateEntryUiMeta = useCallback(
    (
      entryId: string,
      updater:
        | Partial<PayrollEntryUiMeta>
        | ((current: PayrollEntryUiMeta) => PayrollEntryUiMeta),
    ) => {
      setEntryUiMeta((current) => {
        const previous = current[entryId] || {};
        const next =
          typeof updater === "function"
            ? updater(previous)
            : { ...previous, ...updater };
        return {
          ...current,
          [entryId]: next,
        };
      });
    },
    [],
  );

  const markEntrySaved = useCallback(
    (entryId: string) => {
      const currentTimer = saveHighlightTimeoutsRef.current[entryId];
      if (currentTimer) {
        window.clearTimeout(currentTimer);
      }

      updateEntryUiMeta(entryId, {
        hasPendingSave: false,
        lastSavedAt: Date.now(),
      });

      saveHighlightTimeoutsRef.current[entryId] = window.setTimeout(() => {
        setEntryUiMeta((current) => {
          const meta = current[entryId];
          if (!meta) return current;
          return {
            ...current,
            [entryId]: {
              ...meta,
              lastSavedAt: null,
            },
          };
        });
        delete saveHighlightTimeoutsRef.current[entryId];
      }, 4500);
    },
    [updateEntryUiMeta],
  );

  useEffect(() => {
    loadEntries();
  }, [payrollId]);

  useEffect(() => {
    if (storeId) loadSavedEmployees();
  }, [storeId]);
  useEffect(() => {
    if (!storeId) return;
    void loadRoleStartTimeConfig();
  }, [storeId]);
  useEffect(() => {
    if (savedEmployees.length === 0) return;
    setEntries((current) =>
      current.map((entry) => {
        const mergedEntry = mergeEntryWithEmployeeProfile(
          entry,
          savedEmployees,
        );
        return mergedEntry === entry ? entry : mergedEntry;
      }),
    );
  }, [savedEmployees]);

  useEffect(() => {
    const saved = localStorage.getItem("payroll_visible_columns_v2");

    if (saved) {
      try {
        setVisibleColumns({
          ...DEFAULT_COLUMNS,
          ...JSON.parse(saved),
        });
      } catch (error) {
        console.error(error);
      }
    }

    setHasLoadedColumnPrefs(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedColumnPrefs) return;

    localStorage.setItem(
      "payroll_visible_columns_v2",
      JSON.stringify(visibleColumns),
    );
  }, [visibleColumns, hasLoadedColumnPrefs]);

  useEffect(
    () => () => {
      Object.values(saveHighlightTimeoutsRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
    },
    [],
  );

  useEffect(() => {
    if (!openActionMenuId) return;

    const closeMenu = () => setOpenActionMenuId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [openActionMenuId]);

  useEffect(() => {
    if (!employeeImportDialog || !employeeImportFile) {
      setEmployeeImportPreview(null);
      return;
    }

    const targetEntry = entries.find((entry) => entry.id === employeeImportDialog.entryId);
    if (!targetEntry) {
      setEmployeeImportPreview(null);
      return;
    }

    let cancelled = false;

    void prepareEmployeeImportData({
      dialog: employeeImportDialog,
      file: employeeImportFile,
      targetEntry,
    })
      .then((result) => {
        if (cancelled) return;
        setEmployeeImportPreview(result.preview);
        setEmployeeImportError("");
      })
      .catch((error) => {
        if (cancelled) return;
        setEmployeeImportPreview(null);
        setEmployeeImportError(
          error instanceof Error
            ? error.message
            : "KhÃ´ng thá»ƒ xem trÆ°á»›c dá»¯ liá»‡u import.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [employeeImportDialog, employeeImportFile, entries]);

  function queueEntryPersist(
    nextEntry: PayrollEntry,
    changes: Partial<PayrollEntry>,
    employeeChanges?: Partial<Employee>,
  ) {
    if (!nextEntry.id) {
      return Promise.resolve();
    }

    const entryId = nextEntry.id;
    const previousTask =
      entrySaveQueuesRef.current[entryId] || Promise.resolve();
    const queuedTask = previousTask
      .catch(() => undefined)
      .then(() => persistEntryPatch(nextEntry, changes, employeeChanges));
    const trackedTask = queuedTask.finally(() => {
      if (entrySaveQueuesRef.current[entryId] === trackedTask) {
        delete entrySaveQueuesRef.current[entryId];
      }
    });

    entrySaveQueuesRef.current[entryId] = trackedTask;
    return trackedTask;
  }

  const debouncedUpdate = useCallback(
    debounce(
      async (nextEntry: PayrollEntry, employeeData?: Partial<Employee>) => {
        await queueEntryPersist(
          nextEntry,
          buildPayrollEntryPayload(nextEntry),
          employeeData,
        );
      },
      350,
    ),

    [savedEmployees, storeId],
  );

  useEffect(() => {
    const flushPendingUpdates = () => debouncedUpdate.flush();

    window.addEventListener("pagehide", flushPendingUpdates);

    window.addEventListener("beforeunload", flushPendingUpdates);

    return () => {
      window.removeEventListener("pagehide", flushPendingUpdates);

      window.removeEventListener("beforeunload", flushPendingUpdates);

      debouncedUpdate.flush();
    };
  }, [debouncedUpdate]);

  async function loadEntries() {
    setLoading(true);
    try {
      const loadedEntries = await getPayrollEntries(payrollId);
      const normalizedEntries = loadedEntries.map((entry) => {
        const normalizedEntry: PayrollEntry = {
          ...entry,
          salaryType: resolvePayrollSalaryType(entry),
          hourlyMultiplier: entry.hourlyMultiplier ?? 1,
          monthlySalary: entry.monthlySalary || entry.fixedSalary || 0,
          fixedSalary: entry.fixedSalary || entry.monthlySalary || 0,
        };
        normalizedEntry.salary = calculatePayrollSalary(normalizedEntry);
        return normalizedEntry;
      });
      setEntries(
        savedEmployees.length > 0
          ? normalizedEntries.map((entry) =>
              mergeEntryWithEmployeeProfile(entry, savedEmployees),
            )
          : normalizedEntries,
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedEmployees() {
    if (!storeId) return;
    setSavedEmployees(await getEmployees(storeId));
  }

  async function loadRoleStartTimeConfig() {
    if (!storeId) return;
    try {
      const items = await getRoleStartTimes(storeId);
      setRoleStartTimes(
        items.reduce<Record<string, RoleStartTimeSetting>>((result, item) => {
          result[item.role] = item;
          return result;
        }, {}),
      );
    } catch (error) {
      console.error(error);
      setRoleStartTimes({});
    }
  }

  const availableEmployees = useMemo(
    () =>
      savedEmployees.filter(
        (employee) =>
          !entries.some((entry) => isEmployeeAlreadyInPayroll(entry, employee)),
      ),
    [entries, savedEmployees],
  );

  async function persistEntryPatch(
    nextEntry: PayrollEntry,
    changes: Partial<PayrollEntry>,
    employeeChanges?: Partial<Employee>,
  ) {
    if (!nextEntry.id) return;
    setSavingId(nextEntry.id);
    try {
      let latestEmployees = savedEmployees;
      let linkedEmployee = findLinkedEmployee(nextEntry, latestEmployees);

      if ((!linkedEmployee || latestEmployees.length === 0) && storeId) {
        latestEmployees = await getEmployees(storeId);
        setSavedEmployees(latestEmployees);
        linkedEmployee = findLinkedEmployee(nextEntry, latestEmployees);
      }

      const profileEmployeeId =
        linkedEmployee?.id ||
        (nextEntry.employeeId && !nextEntry.employeeId.startsWith("manual_")
          ? nextEntry.employeeId
          : "");
      const resolvedEmployeeId = profileEmployeeId || nextEntry.employeeId;
      const resolvedEmployeeCode =
        linkedEmployee?.employeeCode ||
        latestEmployees.find((employee) => employee.id === profileEmployeeId)
          ?.employeeCode ||
        nextEntry.employeeCode ||
        "";
      const resolvedSalaryType = resolvePayrollSalaryType(nextEntry);
      const persistedEntry: PayrollEntry = {
        ...nextEntry,
        employeeId: resolvedEmployeeId,
        employeeCode: resolvedEmployeeCode,
        salaryType: resolvedSalaryType,
        monthlySalary:
          resolvedSalaryType === "monthly"
            ? nextEntry.monthlySalary || nextEntry.fixedSalary || 0
            : 0,
        fixedSalary:
          resolvedSalaryType === "monthly"
            ? nextEntry.fixedSalary || nextEntry.monthlySalary || 0
            : 0,
        expectedWorkDays:
          resolvedSalaryType === "monthly"
            ? nextEntry.expectedWorkDays || 30
            : 0,
        paidLeaveDays:
          resolvedSalaryType === "monthly" ? nextEntry.paidLeaveDays || 0 : 0,
        standardHours:
          resolvedSalaryType === "monthly" ? nextEntry.standardHours || 0 : 0,
        hourlyMultiplier:
          resolvedSalaryType === "hourly" ? nextEntry.hourlyMultiplier ?? 1 : 1,
      };
      persistedEntry.salary = calculatePayrollSalary(persistedEntry);

      await updatePayrollEntry(
        nextEntry.id,
        buildPayrollEntryPayload(persistedEntry),
      );

      if (employeeChanges && profileEmployeeId) {
        const updatedEmployee = await updateEmployee(profileEmployeeId, {
          ...employeeChanges,
          storeId,
          employeeCode:
            resolvedEmployeeCode ||
            employeeChanges.employeeCode ||
            nextEntry.employeeCode ||
            "",
        });
        onEmployeesChanged?.();
        if (updatedEmployee?.id) {
          setSavedEmployees((current) =>
            current.map((employee) =>
              employee.id === profileEmployeeId ? updatedEmployee : employee,
            ),
          );
        } else {
          await loadSavedEmployees();
        }
      }

      if (
        resolvedEmployeeId !== nextEntry.employeeId ||
        resolvedEmployeeCode !== (nextEntry.employeeCode || "")
      ) {
        setEntries((current) =>
          current.map((entry) =>
            entry.id === nextEntry.id
              ? {
                  ...entry,
                  employeeId: resolvedEmployeeId,
                  employeeCode: resolvedEmployeeCode,
                }
              : entry,
            ),
        );
      }
      markEntrySaved(nextEntry.id);
    } catch (error) {
      console.error(error);
      updateEntryUiMeta(nextEntry.id, {
        hasPendingSave: false,
        lastSavedAt: null,
      });
    } finally {
      setSavingId((current) => (current === nextEntry.id ? null : current));
    }
  }

  async function savePayrollSettings() {
    if (!settingsEntryId) return;
    const currentEntry = entries.find((entry) => entry.id === settingsEntryId);
    if (!currentEntry) return;

    const resolvedSalaryType = settingsData.salaryType;
    const resolvedExpectedWorkDays =
      resolvedSalaryType === "monthly"
        ? settingsData.expectedWorkDays || 30
        : 0;

    applyEntryPatch(
      settingsEntryId,
      {
        salaryType: resolvedSalaryType,
        monthlySalary:
          resolvedSalaryType === "monthly" ? settingsData.monthlySalary : 0,
        fixedSalary:
          resolvedSalaryType === "monthly" ? settingsData.monthlySalary : 0,
        paidLeaveDays:
          resolvedSalaryType === "monthly" ? settingsData.paidLeaveDays : 0,
        expectedWorkDays: resolvedExpectedWorkDays,
        standardHours:
          resolvedSalaryType === "monthly" ? settingsData.standardHours : 0,
        hourlyMultiplier:
          resolvedSalaryType === "hourly" ? settingsData.hourlyMultiplier : 1,
        hourlyRate:
          resolvedSalaryType === "monthly"
            ? settingsData.overtimeRate
            : currentEntry.hourlyRate,
      },
      {
        salaryType: resolvedSalaryType,
        monthlySalary:
          resolvedSalaryType === "monthly" ? settingsData.monthlySalary : 0,
        paidLeaveDays:
          resolvedSalaryType === "monthly" ? settingsData.paidLeaveDays : 0,
        expectedWorkDays: resolvedExpectedWorkDays,
        standardHours:
          resolvedSalaryType === "monthly" ? settingsData.standardHours : 0,
        hourlyRate:
          resolvedSalaryType === "monthly"
            ? settingsData.overtimeRate
            : currentEntry.hourlyRate,
      },
      { immediate: true },
    );

    setSettingsEntryId(null);
  }

  function applyEntryPatch(
    entryId: string,

    changes: Partial<PayrollEntry>,

    employeeChanges?: Partial<Employee>,

    options?: {
      immediate?: boolean;
      meta?: Partial<PayrollEntryUiMeta>;
      skipManualFlag?: boolean;
    },
  ) {
    const currentEntry = entries.find((entry) => entry.id === entryId);

    if (!currentEntry?.id) return;

    const nextEntry: PayrollEntry = {
      ...currentEntry,

      ...changes,

      salaryType: resolvePayrollSalaryType({ ...currentEntry, ...changes }),
    };

    nextEntry.salary = calculatePayrollSalary(nextEntry);

    setEntries((current) =>
      current.map((entry) => (entry.id === entryId ? nextEntry : entry)),
    );

    updateEntryUiMeta(entryId, (current) => ({
      ...current,
      hasPendingSave: true,
      isManualEdited: options?.skipManualFlag ? current.isManualEdited : true,
      ...options?.meta,
    }));

    if (options?.immediate) {
      debouncedUpdate.cancel();

      void queueEntryPersist(nextEntry, changes, employeeChanges);

      return;
    }

    debouncedUpdate(
      nextEntry,

      employeeChanges,
    );
  }

  async function handleAddExistingEmployee(employee: Employee) {
    if (!employee.id) throw new Error("Không tìm thấy nhân viên đã lưu.");
    await addPayrollEntry(payrollId, {
      employeeId: employee.id,

      employeeCode: employee.employeeCode || "",

      employeeName: employee.name,

      role: employee.role || defaultRole,

      hourlyRate: employee.hourlyRate || 0,

      hourlyMultiplier: 1,

      totalHours: 0,

      weekendHours: 0,

      salary: 0,

      allowances: employee.allowances || [],

      note: "",

      salaryType: employee.salaryType || "hourly",

      monthlySalary: employee.monthlySalary || 0,

      expectedWorkDays:
        employee.salaryType === "monthly"
          ? employee.expectedWorkDays || 30
          : employee.expectedWorkDays || 0,

      paidLeaveDays: employee.paidLeaveDays || 0,

      attendanceBonusEnabled: employee.attendanceBonusEnabled || false,

      attendanceBonusDays: employee.attendanceBonusDays || 0,

      attendanceBonusAmount: employee.attendanceBonusAmount || 0,

      standardHours: employee.standardHours || 0,

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
    salaryType: "hourly" | "monthly";
    monthlySalary: number;
    expectedWorkDays: number;
    paidLeaveDays: number;
    attendanceBonusEnabled: boolean;
    attendanceBonusDays: number;
    attendanceBonusAmount: number;
    standardHours: number;
    allowances?: Employee["allowances"];
  }) {
    if (!storeId) throw new Error("Chưa chọn cửa hàng.");

    const normalizedCode = payload.employeeCode.trim().toLowerCase();

    if (
      savedEmployees.some(
        (employee) =>
          (employee.employeeCode || "").trim().toLowerCase() === normalizedCode,
      )
    ) {
      throw new Error("Mã nhân viên đã tồn tại.");
    }

    const isMonthly = payload.salaryType === "monthly";

    const employeeId = await addEmployee({
      storeId,
      employeeCode: payload.employeeCode.trim(),
      name: payload.name.trim(),
      role: payload.role,
      hourlyRate: payload.hourlyRate,
      salaryType: payload.salaryType,
      monthlySalary: isMonthly ? payload.monthlySalary : 0,
      expectedWorkDays: isMonthly ? payload.expectedWorkDays || 30 : 0,
      paidLeaveDays: isMonthly ? payload.paidLeaveDays : 0,
      attendanceBonusEnabled: payload.attendanceBonusEnabled,
      attendanceBonusDays: payload.attendanceBonusEnabled
        ? payload.attendanceBonusDays
        : 0,
      attendanceBonusAmount: payload.attendanceBonusEnabled
        ? payload.attendanceBonusAmount
        : 0,
      standardHours: isMonthly ? payload.standardHours : 0,
      allowances: payload.allowances || [],
    });

    await addPayrollEntry(payrollId, {
      employeeId,
      employeeCode: payload.employeeCode.trim(),
      employeeName: payload.name.trim(),
      role: payload.role,
      hourlyRate: payload.hourlyRate,
      hourlyMultiplier: 1,
      totalHours: 0,
      weekendHours: 0,
      salary: 0,
      allowances: payload.allowances || [],
      note: "",
      salaryType: payload.salaryType,
      monthlySalary: isMonthly ? payload.monthlySalary : 0,
      expectedWorkDays: isMonthly ? payload.expectedWorkDays || 30 : 0,
      paidLeaveDays: isMonthly ? payload.paidLeaveDays : 0,
      attendanceBonusEnabled: payload.attendanceBonusEnabled,
      attendanceBonusDays: payload.attendanceBonusEnabled
        ? payload.attendanceBonusDays
        : 0,
      attendanceBonusAmount: payload.attendanceBonusEnabled
        ? payload.attendanceBonusAmount
        : 0,
      standardHours: isMonthly ? payload.standardHours : 0,
      shifts: [],
    });

    await Promise.all([loadEntries(), loadSavedEmployees()]);
    onEmployeesChanged?.();

    setShowAddDialog(false);
  }

  async function handleDeleteEntry(entryId: string) {
    if (!confirm("Bạn có chắc muốn xóa nhân viên này khỏi bảng lương?")) return;

    try {
      await deletePayrollEntry(entryId);

      setEntries((current) => current.filter((entry) => entry.id !== entryId));
      setEntryUiMeta((current) => {
        if (!current[entryId]) return current;
        const next = { ...current };
        delete next[entryId];
        return next;
      });
    } catch (error) {
      console.error(error);

      alert("Không thể xóa dòng lương.");
    }
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

    applyEntryPatch(
      currentShiftEntry.id,
      {
        shifts: newShifts,
        totalHours: Number(totalHours.toFixed(2)),
        weekendHours: Number(weekendHours.toFixed(2)),
      },
      undefined,
      { immediate: true },
    );
    setShiftModalOpen(false);
  }

  function openEmployeeImportDialog(entry: PayrollEntry) {
    const defaults = getEntryShiftDateDefaults(entry);
    setEmployeeImportDialog({
      entryId: entry.id || "",
      employeeCode: entry.employeeCode || "",
      employeeName: entry.employeeName,
      startDate: defaults.startDate,
      endDate: defaults.endDate,
      fileName: "",
    });
    setEmployeeImportFile(null);
    setEmployeeImportPreview(null);
    setEmployeeImportError("");
  }

  function openPayrollSettings(entry: PayrollEntry) {
    setSettingsEntryId(entry.id || null);
    const entrySalaryType = resolvePayrollSalaryType(entry);
    setSettingsData({
      salaryType: entrySalaryType,
      monthlySalary: entry.monthlySalary || entry.fixedSalary || 0,
      expectedWorkDays:
        entrySalaryType === "monthly" ? entry.expectedWorkDays || 30 : 30,
      paidLeaveDays: entrySalaryType === "monthly" ? entry.paidLeaveDays || 0 : 0,
      standardHours: entrySalaryType === "monthly" ? entry.standardHours || 0 : 0,
      overtimeRate: entry.hourlyRate || 0,
      hourlyMultiplier: entry.hourlyMultiplier ?? 1,
    });
    setOpenActionMenuId(null);
  }

  function handleUndoEmployeeImport(entryId: string) {
    const snapshot = entryUiMeta[entryId]?.lastImportSnapshot;
    if (!snapshot) return;

    applyEntryPatch(
      entryId,
      {
        shifts: cloneShifts(snapshot.shifts),
        totalHours: snapshot.totalHours,
        weekendHours: snapshot.weekendHours,
      },
      undefined,
      {
        immediate: true,
        meta: {
          isImported: false,
          lastImportPreview: null,
          lastImportSnapshot: null,
        },
      },
    );
    setOpenActionMenuId(null);
  }

  async function handleImportEmployeeHours() {
    if (!employeeImportDialog) return;
    if (!employeeImportDialog.entryId) {
      setEmployeeImportError("Không xác định được dòng lương cần import.");
      return;
    }
    if (!employeeImportDialog.startDate || !employeeImportDialog.endDate) {
      setEmployeeImportError("Vui lòng chọn khoảng ngày cần import.");
      return;
    }
    if (employeeImportDialog.startDate > employeeImportDialog.endDate) {
      setEmployeeImportError("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
      return;
    }
    if (!employeeImportFile) {
      setEmployeeImportError("Vui lòng chọn file chấm công.");
      return;
    }

    const targetEntry = entries.find((entry) => entry.id === employeeImportDialog.entryId);
    if (!targetEntry) {
      setEmployeeImportError("Không tìm thấy nhân viên trong bảng lương hiện tại.");
      return;
    }

    setIsImportingEmployeeHours(true);
    try {
      const importedRows = await parseTimesheetImportFile(employeeImportFile);
      const normalizedCode = (employeeImportDialog.employeeCode || "").trim().toLowerCase();
      const normalizedName = employeeImportDialog.employeeName.trim().toLowerCase();

      const matchedRows = importedRows.filter((row) => {
        const rowDate = normalizeDateOnly(row.dateTime);
        if (!isDateWithinRange(rowDate, employeeImportDialog.startDate, employeeImportDialog.endDate)) {
          return false;
        }

        const rowCode = row.employeeCode.trim().toLowerCase();
        const rowName = row.employeeName.trim().toLowerCase();

        if (normalizedCode) {
          return rowCode === normalizedCode;
        }

        return rowName === normalizedName;
      });

      if (matchedRows.length === 0) {
        throw new Error("Không tìm thấy dữ liệu chấm công của nhân viên này trong khoảng đã chọn.");
      }

      const importedShifts = summarizeImportedShifts(
        matchedRows,
        targetEntry.employeeCode || targetEntry.employeeId || targetEntry.employeeName,
      );
      const mergedShifts = mergeShiftsByDateRange(
        (targetEntry.shifts || []) as Shift[],
        importedShifts,
        employeeImportDialog.startDate,
        employeeImportDialog.endDate,
      );
      const totals = summarizeShiftTotals(mergedShifts);

      applyEntryPatch(
        targetEntry.id!,
        {
          shifts: mergedShifts,
          totalHours: Number(totals.totalHours.toFixed(2)),
          weekendHours: Number(totals.weekendHours.toFixed(2)),
        },
        undefined,
        { immediate: true },
      );

      setEmployeeImportDialog(null);
      setEmployeeImportFile(null);
      setEmployeeImportError("");
    } catch (error) {
      console.error(error);
      setEmployeeImportError(
        error instanceof Error ? error.message : "Không thể import lại giờ làm cho nhân viên này.",
      );
    } finally {
      setIsImportingEmployeeHours(false);
    }
  }

  async function handleImportEmployeeHoursV2() {
    if (!employeeImportDialog) return;
    if (!employeeImportDialog.entryId) {
      setEmployeeImportError("Không xác định được dòng lương cần import.");
      return;
    }
    if (!employeeImportDialog.startDate || !employeeImportDialog.endDate) {
      setEmployeeImportError("Vui lòng chọn khoảng ngày cần import.");
      return;
    }
    if (employeeImportDialog.startDate > employeeImportDialog.endDate) {
      setEmployeeImportError("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
      return;
    }
    if (!employeeImportFile) {
      setEmployeeImportError("Vui lòng chọn file chấm công.");
      return;
    }

    const targetEntry = entries.find(
      (entry) => entry.id === employeeImportDialog.entryId,
    );
    if (!targetEntry) {
      setEmployeeImportError(
        "Không tìm thấy nhân viên trong bảng lương hiện tại.",
      );
      return;
    }

    setIsImportingEmployeeHours(true);
    try {
      const preparedImport = await prepareEmployeeImportData({
        dialog: employeeImportDialog,
        file: employeeImportFile,
        targetEntry,
      });

      applyEntryPatch(
        targetEntry.id!,
        {
          shifts: preparedImport.mergedShifts,
          totalHours: Number(preparedImport.totals.totalHours.toFixed(2)),
          weekendHours: Number(preparedImport.totals.weekendHours.toFixed(2)),
        },
        undefined,
        {
          immediate: true,
          meta: {
            isImported: true,
            lastImportPreview: preparedImport.preview,
            lastImportSnapshot: {
              shifts: cloneShifts((targetEntry.shifts || []) as Shift[]),
              totalHours: targetEntry.totalHours || 0,
              weekendHours: targetEntry.weekendHours || 0,
              preview: preparedImport.preview,
            },
          },
        },
      );

      setEmployeeImportDialog(null);
      setEmployeeImportFile(null);
      setEmployeeImportPreview(null);
      setEmployeeImportError("");
      setOpenActionMenuId(null);
    } catch (error) {
      console.error(error);
      setEmployeeImportError(
        error instanceof Error
          ? error.message
          : "Không thể import lại giờ làm cho nhân viên này.",
      );
    } finally {
      setIsImportingEmployeeHours(false);
    }
  }

  const filteredEntries = entries
    .filter((entry) => {
      const keyword = searchTerm.trim().toLowerCase();
      const code = (entry.employeeCode || "").toLowerCase();
      const lateSummary = getEntryLateSummary(
        entry,
        roleStartTimes[entry.role || defaultRole],
      );

      const matchesSearch =
        !keyword ||
        entry.employeeName.toLowerCase().includes(keyword) ||
        code.includes(keyword) ||
        entry.role.toLowerCase().includes(keyword);

      const matchesRole = filterRole === "All" || entry.role === filterRole;

      const matchesError = !filterError || hasEntryError(entry);
      const matchesLate = !filterLateOnly || lateSummary.lateShiftCount > 0;
      const entryMeta = entry.id ? entryUiMeta[entry.id] : undefined;
      const matchesImported = !filterImportedOnly || Boolean(entryMeta?.isImported);
      const salaryType = resolvePayrollSalaryType(entry);
      const matchesHourly = !filterHourlyOnly || salaryType === "hourly";
      const matchesMonthly = !filterMonthlyOnly || salaryType === "monthly";

      return (
        matchesSearch &&
        matchesRole &&
        matchesError &&
        matchesLate &&
        matchesImported &&
        matchesHourly &&
        matchesMonthly
      );
    })
    .sort((left, right) => {
      if (sortBy === "name_asc")
        return left.employeeName.localeCompare(right.employeeName, "vi");

      if (sortBy === "role_asc")
        return left.role.localeCompare(right.role, "vi");

      if (sortBy === "salary_desc")
        return (right.salary || 0) - (left.salary || 0);

      if (sortBy === "days_desc")
        return (
          getPayrollBreakdown(right).workingDays -
          getPayrollBreakdown(left).workingDays
        );

      return (right.totalHours || 0) - (left.totalHours || 0);
    });

  const visibleCount = COLUMN_OPTIONS.filter(
    (option) => visibleColumns[option.key],
  ).length;

  const filteredTotal = filteredEntries.reduce(
    (sum, entry) => sum + (entry.salary || 0),
    0,
  );

  const filteredHours = filteredEntries.reduce(
    (sum, entry) => sum + (entry.totalHours || 0),
    0,
  );

  const filteredWorkDays = filteredEntries.reduce(
    (sum, entry) => sum + getPayrollBreakdown(entry).workingDays,
    0,
  );

  const warnings = entries.filter((entry) => hasInvalidShift(entry)).length;
  const lateSummaries = entries.map((entry) =>
    getEntryLateSummary(entry, roleStartTimes[entry.role || defaultRole]),
  );
  const lateEmployees = lateSummaries.filter(
    (summary) => summary.lateShiftCount > 0,
  ).length;
  const lateShiftCount = lateSummaries.reduce(
    (sum, summary) => sum + summary.lateShiftCount,
    0,
  );
  const importedEntriesCount = entries.filter(
    (entry) => entry.id && entryUiMeta[entry.id]?.isImported,
  ).length;
  const monthlyEntriesCount = entries.filter(
    (entry) => resolvePayrollSalaryType(entry) === "monthly",
  ).length;
  const hourlyEntriesCount = entries.filter(
    (entry) => resolvePayrollSalaryType(entry) === "hourly",
  ).length;

  const monthlyEntries = entries.filter(
    (entry) => resolvePayrollSalaryType(entry) === "monthly",
  ).length;
  const hourlyEntries = entries;
  const uniformHourlyMultiplier =
    hourlyEntries.length === 0
      ? 1
      : hourlyEntries.every(
            (entry) =>
              (entry.hourlyMultiplier ?? 1) ===
              (hourlyEntries[0]?.hourlyMultiplier ?? 1),
          )
        ? hourlyEntries[0]?.hourlyMultiplier ?? 1
        : null;

  const allowanceEntry = entries.find((entry) => entry.id === allowanceEntryId);

  const allowanceBreakdown = allowanceEntry
    ? getPayrollBreakdown(allowanceEntry)
    : null;

  const salaryDetailEntry = entries.find(
    (entry) => entry.id === salaryDetailEntryId,
  );

  const salaryDetailBreakdown = salaryDetailEntry
    ? getPayrollBreakdown(salaryDetailEntry)
    : null;
  const salaryDetailLateSummary = salaryDetailEntry
    ? getEntryLateSummary(
        salaryDetailEntry,
        roleStartTimes[salaryDetailEntry.role || defaultRole],
      )
    : null;
  const salaryDetailAttendanceProgress = salaryDetailEntry
    ? getAttendanceBonusProgress(salaryDetailEntry)
    : null;

  function handleExportPayrollExcel() {
    const exportDate = new Date().toISOString().slice(0, 10);
    const workbook = XLSX.utils.book_new();

    const summaryRows = filteredEntries.map((entry) => {
      const breakdown = getPayrollBreakdown(entry);
      const lateSummary = getEntryLateSummary(
        entry,
        roleStartTimes[entry.role || defaultRole],
      );
      const attendanceProgress = getAttendanceBonusProgress(entry);

      return {
        "Mã nhân viên": entry.employeeCode || "",
        "Tên nhân viên": entry.employeeName,
        "Vai trò": entry.role || "",
        "Loại lương":
          breakdown.salaryType === "monthly" ? "Lương tháng" : "Theo giờ",
        "Tổng giờ": Number((entry.totalHours || 0).toFixed(2)),
        "Giờ cuối tuần": Number((entry.weekendHours || 0).toFixed(2)),
        "Ngày công": breakdown.workingDays,
        "Ngày vắng": breakdown.absentDays,
        "Ngày nghỉ không lương": breakdown.unpaidLeaveDays,
        "Ngày phép": Math.max(0, entry.paidLeaveDays || 0),
        "Lương cơ bản": Math.round(breakdown.baseSalary || 0),
        "Khấu trừ": Math.round(breakdown.deduction || 0),
        "Giờ tăng ca": Number((breakdown.overtimeHours || 0).toFixed(2)),
        "Tiền tăng ca": Math.round(breakdown.overtimePay || 0),
        "Thưởng cuối tuần": Math.round(breakdown.weekendBonus || 0),
        "Phụ cấp": Math.round(breakdown.allowanceTotal || 0),
        "Chuyên cần": Math.round(breakdown.attendanceBonus || 0),
        "Tiến độ chuyên cần": attendanceProgress
          ? `${attendanceProgress.qualifiedDays}/${attendanceProgress.targetDays}`
          : "",
        "Hệ số lương giờ": breakdown.hourlyMultiplier ?? 1,
        "Lương giờ": Math.round(entry.hourlyRate || 0),
        "Lương tháng": Math.round(
          entry.monthlySalary || entry.fixedSalary || 0,
        ),
        "Số ca đi trễ": lateSummary.lateShiftCount,
        "Tổng phút đi trễ": lateSummary.totalLateMinutes,
        "Đi trễ nhiều nhất (phút)": lateSummary.maxLateMinutes,
        "Chi tiết đi trễ": lateSummary.lateShifts
          .map(
            (shift) =>
              `${shift.date}: ${shift.actualStartTime} > ${shift.matchedScheduledStartTime} (${shift.lateMinutes} phút)`,
          )
          .join(" | "),
        "Ghi chú": entry.note || "",
        "Tổng lương": Math.round(entry.salary || 0),
      };
    });

    const lateDetailRows = filteredEntries.flatMap((entry) => {
      const lateSummary = getEntryLateSummary(
        entry,
        roleStartTimes[entry.role || defaultRole],
      );

      return lateSummary.lateShifts.map((shift) => ({
        "Mã nhân viên": entry.employeeCode || "",
        "Tên nhân viên": entry.employeeName,
        "Vai trò": entry.role || "",
        Ngày: shift.date,
        "Ca áp dụng": shift.matchedShiftLabel,
        "Giờ chuẩn": shift.matchedScheduledStartTime,
        "Giờ vào": shift.actualStartTime,
        "Phút đi trễ": shift.lateMinutes,
      }));
    });

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(
      workbook,
      summarySheet,
      sanitizeWorksheetName("Bang luong", "BangLuong"),
    );

    const lateSheet = XLSX.utils.json_to_sheet(
      lateDetailRows.length > 0
        ? lateDetailRows
        : [
            {
              "Mã nhân viên": "",
              "Tên nhân viên": "",
              "Vai trò": "",
              Ngày: "",
              "Ca áp dụng": "",
              "Giờ chuẩn": "",
              "Giờ vào": "",
              "Phút đi trễ": 0,
            },
          ],
    );
    XLSX.utils.book_append_sheet(
      workbook,
      lateSheet,
      sanitizeWorksheetName("Chi tiet di tre", "DiTre"),
    );

    const exportBaseName = sanitizeExportFileName(
      `bang-luong-${payrollId}-${exportDate}`,
      "bang-luong",
    );
    XLSX.writeFile(workbook, `${exportBaseName}.xlsx`);
  }

  async function handleApplyBatchHourlyMultiplier() {
    if (hourlyEntries.length === 0) {
      alert("Bảng lương này không có nhân viên theo giờ để áp dụng hệ số.");
      return;
    }

    const nextMultiplier = Number(batchHourlyMultiplier);
    if (!Number.isFinite(nextMultiplier) || nextMultiplier < 0) {
      alert("Hệ số không hợp lệ.");
      return;
    }

    setIsApplyingBatchMultiplier(true);
    try {
      await Promise.resolve(debouncedUpdate.flush());

      const updatedHourlyEntries = hourlyEntries
        .filter((entry): entry is PayrollEntry & { id: string } => Boolean(entry.id))
        .map((entry) => {
          const nextEntry: PayrollEntry = {
            ...entry,
            hourlyMultiplier: nextMultiplier,
          };
          nextEntry.salary = calculatePayrollSalary(nextEntry);
          return nextEntry as PayrollEntry & { id: string };
        });
      const updatedMap = new Map(
        updatedHourlyEntries.map((entry) => [entry.id, entry]),
      );

      setEntries((current) =>
        current.map((entry) =>
          entry.id ? updatedMap.get(entry.id) || entry : entry,
        ),
      );

      await Promise.all(
        updatedHourlyEntries.map((entry) =>
          queueEntryPersist(entry, { hourlyMultiplier: nextMultiplier }),
        ),
      );
    } catch (error) {
      console.error(error);
      alert("Không thể áp dụng hệ số cho toàn bộ đợt lương.");
    } finally {
      setIsApplyingBatchMultiplier(false);
    }
  }

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
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              PAYROLL DETAIL
            </p>

            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Chi tiết bảng lương
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Nhân sự lương tháng được làm nổi bật, tự tính ngày công, nghỉ phép
              và chuyên cần ngay trên từng dòng.
            </p>
          </div>

          <Button variant="outline" className="rounded-2xl" onClick={onBack}>
            Danh sách bảng lương
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-[24px] bg-slate-900 p-5 text-white">
            <p className="text-sm text-slate-300">Nhân viên</p>
            <p className="mt-4 text-3xl font-semibold">{entries.length}</p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Lương tháng</p>
            <p className="mt-4 text-2xl font-semibold text-sky-700">
              {monthlyEntries}
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Tổng giờ</p>
            <p className="mt-4 text-2xl font-semibold text-slate-900">
              {formatHours(filteredHours)}h
            </p>
          </div>
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm text-amber-700">Đi trễ</p>
            <p className="mt-4 text-2xl font-semibold text-amber-800">
              {lateEmployees}
            </p>
            <p className="mt-1 text-xs text-amber-700/80">
              {lateShiftCount} ca đi trễ
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Tong ngay cong</p>
            <p className="mt-4 text-2xl font-semibold text-slate-900">
              {filteredWorkDays}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Tổng lương</p>
            <p className="mt-4 text-2xl font-semibold text-slate-900">
              {formatCurrency(filteredTotal)}
            </p>
          </div>
        </div>

        <div className="mt-4 hidden rounded-[24px] border border-amber-200 bg-amber-50/80 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Hệ số lương cho toàn đợt
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Áp dụng một lần cho toàn bộ nhân viên theo giờ của bảng lương
                này. Không ảnh hưởng hồ sơ nhân viên hay các đợt lương cũ.
              </p>
              <p className="mt-2 text-sm text-amber-800">
                {hourlyEntries.length === 0
                  ? "Hiện không có nhân viên theo giờ trong đợt này."
                  : uniformHourlyMultiplier === null
                    ? `Đợt này đang có nhiều hệ số khác nhau trên ${hourlyEntries.length} nhân viên theo giờ.`
                    : `Đợt này hiện đang dùng hệ số ${formatHours(
                        uniformHourlyMultiplier,
                      )} cho ${hourlyEntries.length} nhân viên theo giờ.`}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                type="number"
                min="0"
                step="0.1"
                label="Hệ số áp dụng"
                value={batchHourlyMultiplier}
                onChange={(event) =>
                  setBatchHourlyMultiplier(Number(event.target.value) || 0)
                }
                className="h-11 min-w-[180px] rounded-2xl bg-white text-right"
              />
              <Button
                className="h-11 rounded-2xl px-5"
                onClick={() => {
                  void handleApplyBatchHourlyMultiplier();
                }}
                isLoading={isApplyingBatchMultiplier}
                disabled={hourlyEntries.length === 0}
              >
                Áp dụng cho cả đợt
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-amber-200 bg-amber-50/80 p-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Hệ số lương cho toàn đợt
            </h3>
            <p className="mt-1 text-sm text-amber-800">
              {hourlyEntries.length === 0
                ? "Hiện không có nhân viên theo giờ trong đợt này."
                : uniformHourlyMultiplier === null
                  ? `Đợt này đang có nhiều hệ số khác nhau trên ${hourlyEntries.length} nhân viên theo giờ.`
                  : `Đợt này hiện đang dùng hệ số ${formatHours(
                      uniformHourlyMultiplier,
                    )} cho ${hourlyEntries.length} nhân viên theo giờ.`}
            </p>
          </div>

          <Button
            className="h-11 gap-2 rounded-2xl px-5"
            onClick={() => setShowBatchMultiplierDialog(true)}
            disabled={hourlyEntries.length === 0}
          >
            <Settings2 className="h-4 w-4" />
            Chỉnh hệ số toàn đợt
          </Button>
        </div>
      </section>

      <Card className="overflow-visible rounded-[28px] border border-slate-200 bg-white/90 shadow-sm">
        <CardContent className="p-0">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Bảng lương đang hiển thị
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredEntries.length}/{entries.length} nhân viên theo bộ
                  lọc hiện tại.
                </p>
              </div>

              <div className="flex flex-col gap-3 xl:items-end">
                <div className="grid gap-3 md:grid-cols-4 xl:w-[760px]">
                  <div className="relative md:col-span-2 xl:col-span-2">
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
                  <Button
                    variant={filterError ? "default" : "outline"}
                    className={cn(
                      "hidden h-11 gap-2 rounded-2xl",
                      filterError
                        ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                        : "text-slate-600",
                    )}
                    onClick={() => setFilterError((current) => !current)}
                    title="Chỉ hiện nhân viên có lỗi hoặc thiếu dữ liệu"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span>Lỗi</span>
                  </Button>
                  <Button
                    variant={filterLateOnly ? "default" : "outline"}
                    className={cn(
                      "hidden h-11 gap-2 rounded-2xl",
                      filterLateOnly
                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "text-slate-600",
                    )}
                    onClick={() => setFilterLateOnly((current) => !current)}
                    title="Chỉ hiện nhân viên đi trễ"
                  >
                    <CalendarClock className="h-4 w-4" />
                    <span>Đi trễ</span>
                  </Button>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="hours_desc">Giờ làm giảm dần</option>

                    <option value="salary_desc">Tổng lương giáº£m dáº§n</option>
                    <option value="days_desc">Ngày công giảm dần</option>

                    <option value="name_asc">Tên A-Z</option>

                    <option value="role_asc">Vai trò A-Z</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-2 xl:max-w-[760px]">
                  <Button
                    variant={filterLateOnly ? "default" : "outline"}
                    className={cn(
                      "h-9 rounded-full px-4 text-sm",
                      filterLateOnly
                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "text-slate-600",
                    )}
                    onClick={() => setFilterLateOnly((current) => !current)}
                  >
                    Đi trễ ({lateEmployees})
                  </Button>
                  <Button
                    variant={filterError ? "default" : "outline"}
                    className={cn(
                      "h-9 rounded-full px-4 text-sm",
                      filterError
                        ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        : "text-slate-600",
                    )}
                    onClick={() => setFilterError((current) => !current)}
                  >
                    Lỗi ca ({warnings})
                  </Button>
                  <Button
                    variant={filterImportedOnly ? "default" : "outline"}
                    className={cn(
                      "h-9 rounded-full px-4 text-sm",
                      filterImportedOnly
                        ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                        : "text-slate-600",
                    )}
                    onClick={() => setFilterImportedOnly((current) => !current)}
                  >
                    Đã import lại ({importedEntriesCount})
                  </Button>
                  <Button
                    variant={filterHourlyOnly ? "default" : "outline"}
                    className={cn(
                      "h-9 rounded-full px-4 text-sm",
                      filterHourlyOnly
                        ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                        : "text-slate-600",
                    )}
                    onClick={() =>
                      setFilterHourlyOnly((current) => {
                        const next = !current;
                        if (next) setFilterMonthlyOnly(false);
                        return next;
                      })
                    }
                  >
                    Theo giờ ({hourlyEntriesCount})
                  </Button>
                  <Button
                    variant={filterMonthlyOnly ? "default" : "outline"}
                    className={cn(
                      "h-9 rounded-full px-4 text-sm",
                      filterMonthlyOnly
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "text-slate-600",
                    )}
                    onClick={() =>
                      setFilterMonthlyOnly((current) => {
                        const next = !current;
                        if (next) setFilterHourlyOnly(false);
                        return next;
                      })
                    }
                  >
                    Lương tháng ({monthlyEntriesCount})
                  </Button>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="outline"
                    className="gap-2 rounded-2xl"
                    onClick={handleExportPayrollExcel}
                    disabled={filteredEntries.length === 0}
                  >
                    <Download className="h-4 w-4" />
                    Xuất Excel
                  </Button>
                  <div className="relative">
                    <Button
                      variant="outline"
                      className="gap-2 rounded-2xl"
                      onClick={() => setShowColumns((current) => !current)}
                    >
                      <Columns3 className="h-4 w-4" />
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

                  <Button
                    className="gap-2 rounded-2xl"
                    onClick={() => setShowAddDialog(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Thêm nhân viên
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="max-h-[72vh] overflow-auto px-6 pb-5">
            <table className="w-full min-w-[980px] text-sm border-separate border-spacing-0">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                  {visibleColumns.name ? (
                    <th className="sticky left-0 top-0 z-30 min-w-[240px] bg-slate-50 px-4 py-3 text-left shadow-[1px_0_0_0_rgba(226,232,240,1)]">
                      Tên nhân viên
                    </th>
                  ) : null}
                  {visibleColumns.role ? (
                    <th className="sticky top-0 z-20 bg-slate-50 px-4 py-3 text-left">
                      Vai trò
                    </th>
                  ) : null}
                  {visibleColumns.late ? (
                    <th className="sticky top-0 z-20 bg-slate-50 px-4 py-3 text-center">
                      Đi trễ
                    </th>
                  ) : null}
                  {visibleColumns.hours ? (
                    <th className="sticky top-0 z-20 bg-slate-50 px-4 py-3 text-center">
                      Số giờ
                    </th>
                  ) : null}

                  {visibleColumns.workDays ? (
                    <th className="sticky top-0 z-20 bg-slate-50 pb-3 pr-4 text-center">
                      Ngày công
                    </th>
                  ) : null}

                  {visibleColumns.rate ? (
                    <th className="sticky top-0 z-20 bg-slate-50 px-4 py-3 text-center">
                      Lương/h
                    </th>
                  ) : null}
                  {visibleColumns.weekend ? (
                    <th className="sticky top-0 z-20 bg-slate-50 px-4 py-3 text-center">
                      Bonus
                    </th>
                  ) : null}
                  {visibleColumns.allowance ? (
                    <th className="sticky top-0 z-20 bg-slate-50 pb-3 pr-4 text-center">
                      Phụ cấp
                    </th>
                  ) : null}

                  {visibleColumns.total ? (
                    <th className="sticky top-0 z-20 bg-slate-50 px-4 py-3 text-right text-emerald-700">
                      Tổng tiền
                    </th>
                  ) : null}
                  {visibleColumns.note ? (
                    <th className="sticky top-0 z-20 bg-slate-50 px-4 py-3 text-left">
                      Ghi chú
                    </th>
                  ) : null}

                  {visibleColumns.action ? (
                    <th className="sticky top-0 z-20 w-[152px] bg-slate-50 px-4 py-3 text-center">
                      Tác vụ
                    </th>
                  ) : null}
                </tr>
              </thead>

              <tbody>
                {filteredEntries.map((entry) => {
                  const breakdown = getPayrollBreakdown(entry);
                  const scheduledStartTimes =
                    roleStartTimes[entry.role || defaultRole];
                  const lateSummary = getEntryLateSummary(
                    entry,
                    scheduledStartTimes,
                  );

                  const isMonthly = breakdown.salaryType === "monthly";
                  const rowMeta = entry.id ? entryUiMeta[entry.id] : undefined;
                  const isRecentlySaved = Boolean(rowMeta?.lastSavedAt);
                  const rowStatus = hasEntryError(entry)
                    ? "error"
                    : lateSummary.lateShiftCount > 0
                      ? "warning"
                      : rowMeta?.isImported || rowMeta?.isManualEdited
                        ? "manual"
                        : "valid";
                  const rowBackground =
                    rowStatus === "error"
                      ? "bg-rose-50/80"
                      : rowStatus === "warning"
                        ? "bg-amber-50/80"
                        : rowStatus === "manual"
                          ? "bg-violet-50/70"
                          : "bg-emerald-50/50";
                  const stickyCellBackground =
                    rowStatus === "error"
                      ? "bg-rose-50"
                      : rowStatus === "warning"
                        ? "bg-amber-50"
                        : rowStatus === "manual"
                          ? "bg-violet-50"
                          : "bg-emerald-50";
                  const cellClass =
                    "border-b border-slate-200/90 px-4 py-5 align-middle";
                  const centeredCellClass = `${cellClass} text-center align-middle`;

                  return (
                    <tr
                      key={entry.id}
                      className={cn(
                        "align-top transition-colors",
                        rowBackground,
                        rowMeta?.hasPendingSave && "ring-2 ring-inset ring-sky-200",
                        isRecentlySaved &&
                          !rowMeta?.hasPendingSave &&
                          "ring-2 ring-inset ring-emerald-200",
                      )}
                    >
                      {visibleColumns.name ? (
                        <td
                          className={cn(
                            "sticky left-0 z-10 border-b border-slate-200 px-4 py-4 align-middle shadow-[1px_0_0_0_rgba(226,232,240,1)]",
                            stickyCellBackground,
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {hasInvalidShift(entry) ? (
                              <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                            ) : null}

                            <input
                              value={entry.employeeName}
                              onChange={(event) =>
                                applyEntryPatch(
                                  entry.id!,
                                  { employeeName: event.target.value },
                                  { name: event.target.value },
                                )
                              }
                              onBlur={() => debouncedUpdate.flush()}
                              className="min-w-0 w-full bg-transparent font-semibold text-slate-900 outline-none"
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium">
                            <span
                              className={cn(
                                "rounded-full px-2.5 py-1",
                                isMonthly
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-sky-100 text-sky-700",
                              )}
                            >
                              {isMonthly ? "Lương tháng" : "Theo giờ"}
                            </span>
                            {rowMeta?.isManualEdited ? (
                              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">
                                Đã chỉnh tay
                              </span>
                            ) : null}
                            {rowMeta?.isImported ? (
                              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-700">
                                Đã import lại
                              </span>
                            ) : null}
                            {rowMeta?.hasPendingSave ? (
                              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">
                                Chưa lưu
                              </span>
                            ) : null}
                            {isRecentlySaved ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                                <CheckCircle2 className="h-3 w-3" />
                                Đã cập nhật
                              </span>
                            ) : null}
                          </div>
                          {lateSummary.lateShiftCount > 0 ? (
                            <div className="mt-2 text-xs font-medium text-amber-700">
                              Trễ {lateSummary.lateShiftCount} ca
                              {lateSummary.totalLateMinutes > 0
                                ? ` • ${lateSummary.totalLateMinutes} phút`
                                : ""}
                            </div>
                          ) : null}
                        </td>
                      ) : null}

                      {visibleColumns.role ? (
                        <td className={centeredCellClass}>
                          <RoleSelect
                            roleGroups={roleGroups}
                            value={entry.role || defaultRole}
                            onChange={(value) =>
                              applyEntryPatch(
                                entry.id!,
                                { role: value },
                                { role: value },
                                { immediate: true },
                              )
                            }
                          />
                        </td>
                      ) : null}

                      {visibleColumns.late ? (
                        <td className={centeredCellClass}>
                          {scheduledStartTimes &&
                          lateSummary.configuredStartTimes.length > 0 ? (
                            lateSummary.lateShiftCount > 0 ? (
                              <div className="inline-flex min-w-[156px] flex-col rounded-[20px] border border-amber-200 bg-amber-50 px-3 py-2 text-left shadow-sm">
                                <span className="text-xs font-semibold text-amber-800">
                                  Trễ {lateSummary.lateShiftCount} ca
                                </span>
                                <span className="mt-1 text-xs text-amber-700/80">
                                  {lateSummary.configuredStartTimes
                                    .map((item) => `${item.label} ${item.time}`)
                                    .join(" • ")}
                                </span>
                              </div>
                            ) : (
                              <div className="inline-flex min-w-[156px] flex-col rounded-[20px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-left shadow-sm">
                                <span className="text-xs font-semibold text-emerald-700">
                                  Đúng giờ
                                </span>
                                <span className="mt-1 text-xs text-emerald-700/80">
                                  {lateSummary.configuredStartTimes
                                    .map((item) => `${item.label} ${item.time}`)
                                    .join(" • ")}
                                </span>
                              </div>
                            )
                          ) : (
                            <div className="inline-flex min-w-[156px] justify-center rounded-[20px] border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-400">
                              Chưa cấu hình
                            </div>
                          )}
                        </td>
                      ) : null}

                      {visibleColumns.hours ? (
                        <td className={centeredCellClass}>
                          <div className="inline-flex items-center justify-center gap-2">
                            <input
                              type="number"
                              onWheel={preventNumberInputScroll}
                              value={entry.totalHours || ""}
                              onChange={(event) =>
                                applyEntryPatch(entry.id!, {
                                  totalHours: Number(event.target.value) || 0,
                                })
                              }
                              onBlur={() => debouncedUpdate.flush()}
                              className="h-10 w-24 rounded-xl border border-slate-200 bg-white px-3 text-center shadow-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-xl border-slate-200 bg-white shadow-sm"
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

                      {visibleColumns.workDays ? (
                        <td className={centeredCellClass}>
                          <div
                            className={cn(
                              "mx-auto max-w-[120px] rounded-[20px] border px-4 py-3 text-left shadow-sm",
                              isMonthly
                                ? "border-sky-200 bg-white/80 shadow-sm shadow-sky-100"
                                : "border-slate-200 bg-slate-50",
                            )}
                          >
                            <div className="text-lg font-semibold text-slate-900">
                              {breakdown.workingDays}
                              {isMonthly ? (
                                <span className="text-sm text-slate-500">
                                  {" "}
                                  / {getExpectedWorkDays(entry)}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">
                              {isMonthly ? (
                                <>
                                  Nghỉ {breakdown.absentDays} ngày, vượt
                                  phép {breakdown.unpaidLeaveDays} ngày.
                                </>
                              ) : (
                                <>Tự tính từ dữ liệu chấm công.</>
                              )}
                            </div>
                          </div>
                        </td>
                      ) : null}

                      {visibleColumns.rate ? (
                        <td className={centeredCellClass}>
                          <div className="mx-auto max-w-[120px]">
                            <InputMoney
                              value={entry.hourlyRate}
                              set={(value) =>
                                applyEntryPatch(
                                  entry.id!,
                                  { hourlyRate: value },
                                  { hourlyRate: value },
                                )
                              }
                              onBlur={() => debouncedUpdate.flush()}
                              className="h-10 rounded-xl text-center"
                            />
                          </div>
                        </td>
                      ) : null}

                      {visibleColumns.weekend ? (
                        <td className={centeredCellClass}>
                          <div className="mx-auto max-w-[120px] rounded-[20px] border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                            <input
                            type="number"
                            onWheel={preventNumberInputScroll}
                            value={entry.weekendHours || ""}
                            onChange={(event) =>
                              applyEntryPatch(entry.id!, {
                                weekendHours: Number(event.target.value) || 0,
                              })
                            }
                            onBlur={() => debouncedUpdate.flush()}
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-center shadow-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          </div>
                        </td>
                      ) : null}

                      {visibleColumns.allowance ? (
                        <td className={centeredCellClass}>
                          <button
                            onClick={() => {
                              setAllowanceEntryId(entry.id || null);
                              setEditAllowances(entry.allowances || []);
                              setAttendanceBonusEnabled(
                                entry.attendanceBonusEnabled || false,
                              );
                              setAttendanceBonusDays(
                                entry.attendanceBonusDays || 0,
                              );
                              setAttendanceBonusAmount(
                                entry.attendanceBonusAmount || 0,
                              );
                            }}
                            className="mx-auto block w-full max-w-[148px] rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
                          >
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                              {(entry.allowances || []).length} khoản
                              {entry.attendanceBonusEnabled
                                ? " + chuyên cần"
                                : ""}
                            </div>
                            <div className="mt-1 font-semibold text-slate-900">
                              {formatCurrency(
                                getAllowanceTotal(entry) +
                                  getAttendanceBonusValue(entry),
                              )}
                            </div>
                          </button>
                        </td>
                      ) : null}

                      {visibleColumns.total ? (
                        <td className={centeredCellClass}>
                          <button
                            type="button"
                            onClick={() => setSalaryDetailEntryId(entry.id || null)}
                            className="mx-auto block min-w-[132px] rounded-[20px] border border-emerald-100 bg-white px-4 py-3 text-right shadow-sm transition hover:border-emerald-200 hover:opacity-90"
                            title="Xem chi tiết cách tính lương"
                          >
                            <div className="font-bold text-emerald-600 hover:underline">
                              {formatCurrency(entry.salary || 0)}
                            </div>
                          </button>
                          <div className="mt-2 text-center text-xs text-slate-400">
                            {formatHours(entry.totalHours || 0)}h x{" "}
                            {formatCurrency(entry.hourlyRate || 0)}
                            {breakdown.salaryType === "hourly" &&
                            breakdown.hourlyMultiplier !== 1
                              ? ` x ${formatHours(breakdown.hourlyMultiplier)}`
                              : ""}
                          </div>
                        </td>
                      ) : null}

                      {visibleColumns.note ? (
                        <td className={cellClass}>
                          <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                            <input
                            value={entry.note || ""}
                            onChange={(event) =>
                              applyEntryPatch(entry.id!, {
                                note: event.target.value,
                              })
                            }
                            onBlur={() => debouncedUpdate.flush()}
                            placeholder="Ghi chú..."
                            className="w-full bg-transparent text-sm italic text-slate-500 outline-none placeholder:text-slate-400"
                            />
                          </div>
                        </td>
                      ) : null}

                      {visibleColumns.action ? (
                        <td className={centeredCellClass}>
                          <div
                            className="relative flex items-center justify-center"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-100"
                              onClick={() =>
                                setOpenActionMenuId((current) =>
                                  current === entry.id ? null : entry.id || null,
                                )
                              }
                              title="Mở danh sách tác vụ"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>

                            {openActionMenuId === entry.id ? (
                              <div className="absolute right-0 top-11 z-30 w-56 rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-xl">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                                  onClick={() => openPayrollSettings(entry)}
                                  title="Chỉnh hệ số và cấu hình lương"
                                >
                                  <Settings2 className="h-4 w-4 text-slate-500" />
                                  Chỉnh hệ số
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-sky-50"
                                  onClick={() => openEmployeeImportDialog(entry)}
                                  title="Import lại giờ làm cho riêng nhân viên này"
                                >
                                  <Upload className="h-4 w-4 text-sky-600" />
                                  Import giờ làm
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-amber-50"
                                  onClick={() => {
                                    setCurrentShiftEntry(entry);
                                    setShiftModalOpen(true);
                                    setOpenActionMenuId(null);
                                  }}
                                  title="Mở chi tiết ca làm để chỉnh tay"
                                >
                                  <CalendarClock className="h-4 w-4 text-amber-600" />
                                  Sửa ca
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-emerald-50"
                                  onClick={() => {
                                    setAllowanceEntryId(entry.id || null);
                                    setEditAllowances(entry.allowances || []);
                                    setAttendanceBonusEnabled(
                                      entry.attendanceBonusEnabled || false,
                                    );
                                    setAttendanceBonusDays(
                                      entry.attendanceBonusDays || 0,
                                    );
                                    setAttendanceBonusAmount(
                                      entry.attendanceBonusAmount || 0,
                                    );
                                    setOpenActionMenuId(null);
                                  }}
                                  title="Mở popup phụ cấp và chuyên cần"
                                >
                                  <Plus className="h-4 w-4 text-emerald-600" />
                                  Phụ cấp
                                </button>
                                {rowMeta?.lastImportSnapshot ? (
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-violet-700 transition hover:bg-violet-50"
                                    onClick={() => handleUndoEmployeeImport(entry.id!)}
                                    title="Hoàn tác lần import giờ làm gần nhất"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                    Hoàn tác import
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50"
                                  onClick={() => handleDeleteEntry(entry.id!)}
                                  title="Xóa nhân viên này khỏi bảng lương"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Xóa dòng
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}

                {filteredEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(visibleCount, 1)}
                      className="py-16 text-center text-slate-500"
                    >
                      Không có nhân viên phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-slate-500">
              Có {warnings} dòng cần kiểm tra lại dữ liệu chấm công và{" "}
              {lateEmployees} nhân viên đi trễ ({lateShiftCount} ca).
              {filterLateOnly ? " Đang bật lọc chỉ xem người đi trễ." : ""}
            </p>
            <div className="flex flex-wrap gap-5 text-sm">
              <div>
                Giờ làm:{" "}
                <span className="font-semibold text-slate-900">
                  {formatHours(filteredHours)}h
                </span>
              </div>

              <div>
                Ngày công:{" "}
                <span className="font-semibold text-slate-900">
                  {filteredWorkDays}
                </span>
              </div>

              <div>
                Tổng lương:{" "}
                <span className="font-semibold text-emerald-700">
                  {formatCurrency(filteredTotal)}
                </span>
              </div>
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
      {employeeImportDialog ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/45 p-4"
          onClick={() => {
            if (isImportingEmployeeHours) return;
            setEmployeeImportDialog(null);
            setEmployeeImportFile(null);
            setEmployeeImportPreview(null);
            setEmployeeImportError("");
          }}
        >
          <div
            className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Import lại ngày làm
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Chỉ cập nhật giờ làm của {employeeImportDialog.employeeName} trong bảng lương này.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isImportingEmployeeHours) return;
                  setEmployeeImportDialog(null);
                  setEmployeeImportFile(null);
                  setEmployeeImportPreview(null);
                  setEmployeeImportError("");
                }}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                Hệ thống sẽ thay lại các ca trong khoảng ngày bạn chọn cho đúng nhân viên này,
                rồi tự tính lại tổng giờ, giờ cuối tuần và lương của riêng dòng này.
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Từ ngày"
                  type="date"
                  value={employeeImportDialog.startDate}
                  onChange={(event) =>
                    setEmployeeImportDialog((current) =>
                      current
                        ? {
                            ...current,
                            startDate: event.target.value,
                          }
                        : current,
                    )
                  }
                />
                <Input
                  label="Đến ngày"
                  type="date"
                  value={employeeImportDialog.endDate}
                  onChange={(event) =>
                    setEmployeeImportDialog((current) =>
                      current
                        ? {
                            ...current,
                            endDate: event.target.value,
                          }
                        : current,
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">
                  File chấm công
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 transition hover:border-sky-300 hover:bg-sky-50">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {employeeImportDialog.fileName || "Chọn file chấm công (.txt, .csv, .xls, .xlsx)"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Chỉ dùng cho nhân viên này và chỉ áp dụng cho kỳ lương đang mở.
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                    <Upload className="h-4 w-4" />
                    Chọn file
                  </div>
                  <input
                    type="file"
                    accept=".txt,.csv,.xls,.xlsx"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setEmployeeImportFile(file);
                      setEmployeeImportPreview(null);
                      setEmployeeImportError("");
                      setEmployeeImportDialog((current) =>
                        current
                          ? {
                              ...current,
                              fileName: file?.name || "",
                            }
                          : current,
                      );
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>

              {employeeImportPreview ? (
                <div className="grid gap-3 rounded-2xl border border-violet-200 bg-violet-50/80 p-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-violet-500">
                      Trước / sau
                    </div>
                    <div className="mt-1 text-sm font-semibold text-violet-900">
                      {formatHours(employeeImportPreview.oldHours)}h to{" "}
                      {formatHours(employeeImportPreview.newHours)}h
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-violet-500">
                      Ca bị thay
                    </div>
                    <div className="mt-1 text-sm font-semibold text-violet-900">
                      {employeeImportPreview.replacedShiftCount} ca
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-violet-500">
                      Ca mới từ file
                    </div>
                    <div className="mt-1 text-sm font-semibold text-violet-900">
                      {employeeImportPreview.importedShiftCount} ca
                    </div>
                  </div>
                </div>
              ) : null}

              {employeeImportError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {employeeImportError}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                className="rounded-2xl"
                disabled={isImportingEmployeeHours}
                onClick={() => {
                  setEmployeeImportDialog(null);
                  setEmployeeImportFile(null);
                  setEmployeeImportPreview(null);
                  setEmployeeImportError("");
                }}
              >
                Hủy
              </Button>
              <Button
                className="gap-2 rounded-2xl bg-sky-600 hover:bg-sky-700"
                onClick={() => {
                  void handleImportEmployeeHoursV2();
                }}
                isLoading={isImportingEmployeeHours}
              >
                <Upload className="h-4 w-4" />
                Import cho nhân viên này
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {salaryDetailEntry && salaryDetailBreakdown ? (
        <div
          className="fixed inset-0 z-[1000] flex justify-end bg-slate-900/45"
          onClick={() => setSalaryDetailEntryId(null)}
        >
          <div
            className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Chi tiết lương
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {salaryDetailEntry.employeeName} •{" "}
                  {salaryDetailEntry.role || "Nhân viên"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSalaryDetailEntryId(null)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              {salaryDetailBreakdown.baseSalary > 0 ? (
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-slate-600">
                  {salaryDetailBreakdown.salaryType === "monthly"
                    ? "Tiền lương cứng"
                    : "Tiền lương giờ"}
                </span>
                <div className="text-right">
                  <div className="font-semibold text-slate-900">
                    {formatCurrency(salaryDetailBreakdown.baseSalary)}
                  </div>
                  {salaryDetailBreakdown.salaryType === "hourly" ? (
                    <div className="mt-1 text-xs text-slate-500">
                      ({formatHours(salaryDetailEntry.totalHours || 0)}h x{" "}
                      {formatCurrency(salaryDetailEntry.hourlyRate || 0)}
                      {salaryDetailBreakdown.hourlyMultiplier !== 1
                        ? ` x ${formatHours(
                            salaryDetailBreakdown.hourlyMultiplier,
                          )}`
                        : ""}
                      )
                    </div>
                  ) : salaryDetailBreakdown.hourlyMultiplier !== 1 ? (
                    <div className="mt-1 text-xs text-slate-500">
                      (x {formatHours(salaryDetailBreakdown.hourlyMultiplier)})
                    </div>
                  ) : null}
                </div>
              </div>
              ) : null}

              {salaryDetailBreakdown.salaryType === "monthly" ? (
                salaryDetailBreakdown.overtimePay > 0 ? (
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">
                    Tiền OT
                    {salaryDetailBreakdown.overtimeHours > 0
                      ? ` (${formatHours(
                          salaryDetailBreakdown.overtimeHours,
                        )}h x ${formatCurrency(
                          salaryDetailBreakdown.overtimeRate,
                        )}${
                          salaryDetailBreakdown.hourlyMultiplier !== 1
                            ? ` x ${formatHours(
                                salaryDetailBreakdown.hourlyMultiplier,
                              )}`
                            : ""
                        })`
                      : ""}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(salaryDetailBreakdown.overtimePay)}
                  </span>
                </div>
                ) : null
              ) : salaryDetailBreakdown.weekendBonus > 0 ? (
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">Tiền cuối tuần</span>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(salaryDetailBreakdown.weekendBonus)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      ({formatHours(salaryDetailEntry.weekendHours || 0)}h x{" "}
                      {formatCurrency(1000)}
                      {salaryDetailBreakdown.hourlyMultiplier !== 1
                        ? ` x ${formatHours(
                            salaryDetailBreakdown.hourlyMultiplier,
                          )}`
                        : ""}
                      )
                    </div>
                  </div>
                </div>
              ) : null}

              {salaryDetailBreakdown.allowanceTotal > 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Tiền trợ cấp</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(salaryDetailBreakdown.allowanceTotal)}
                  </span>
                </div>
                {(salaryDetailEntry.allowances || []).length > 0 ? (
                  <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-slate-500">
                    {(salaryDetailEntry.allowances || []).map(
                      (allowance, index) => (
                        <div
                          key={`${allowance.name}-${index}`}
                          className="flex items-center justify-between"
                        >
                          <span>+ {allowance.name || `Trợ cấp ${index + 1}`}</span>
                          <span>{formatCurrency(allowance.amount)}</span>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
              ) : null}

              {salaryDetailBreakdown.attendanceBonus > 0 ? (
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3">
                  <span className="text-emerald-700">Thưởng chuyên cần</span>
                  <div className="text-right">
                    <div className="font-semibold text-emerald-800">
                      {formatCurrency(salaryDetailBreakdown.attendanceBonus)}
                    </div>
                    {salaryDetailAttendanceProgress ? (
                      <div className="mt-1 text-xs text-emerald-600/80">
                        {salaryDetailAttendanceProgress.qualifiedDays}/
                        {salaryDetailAttendanceProgress.targetDays} ngày
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {salaryDetailBreakdown.deduction > 0 ? (
                <div className="flex items-center justify-between rounded-2xl bg-rose-50 px-4 py-3">
                  <span className="text-rose-700">Khấu trừ nghỉ vượt phép</span>
                  <div className="text-right">
                    <div className="font-semibold text-rose-800">
                      - {formatCurrency(salaryDetailBreakdown.deduction)}
                    </div>
                    <div className="mt-1 text-xs text-rose-700/80">
                      {salaryDetailBreakdown.unpaidLeaveDays} ngày
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-4">
              <span className="text-base font-semibold text-slate-700">
                Tổng
              </span>
              <span className="text-xl font-bold text-sky-700">
                {formatCurrency(salaryDetailEntry.salary || 0)}
              </span>
            </div>

            {salaryDetailLateSummary?.configuredStartTimes?.length ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-amber-800">
                    Giờ vào chuẩn:{" "}
                    {salaryDetailLateSummary.configuredStartTimes
                      .map((item) => `${item.label} ${item.time}`)
                      .join(" • ")}
                  </span>
                  <span className="font-semibold text-amber-900">
                    {salaryDetailLateSummary.lateShiftCount > 0
                      ? `Trễ ${salaryDetailLateSummary.lateShiftCount} ca`
                      : "Đúng giờ"}
                  </span>
                </div>
                {salaryDetailLateSummary.lateShiftCount > 0 ? (
                  <div className="mt-2 text-xs text-amber-800/80">
                    Tổng trễ {salaryDetailLateSummary.totalLateMinutes} phút,
                    trễ nhiều nhất {salaryDetailLateSummary.maxLateMinutes} phút.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {allowanceEntryId ? (
        <AllowanceDialog
          allowances={editAllowances}
          attendanceBonusAmount={attendanceBonusAmount}
          attendanceBonusDays={attendanceBonusDays}
          attendanceBonusEnabled={attendanceBonusEnabled}
          computedAttendanceBonus={allowanceBreakdown?.attendanceBonus || 0}
          employeeName={allowanceEntry?.employeeName || "Nh\u00e2n vi\u00ean"}
          onAdd={() =>
            setEditAllowances((current) => [
              ...current,
              { name: "", amount: 0 },
            ])
          }
          onAmountChange={(index, value) =>
            setEditAllowances((current) =>
              current.map((allowance, allowanceIndex) =>
                allowanceIndex === index
                  ? { ...allowance, amount: value }
                  : allowance,
              ),
            )
          }
          onAttendanceBonusAmountChange={setAttendanceBonusAmount}
          onAttendanceBonusDaysChange={setAttendanceBonusDays}
          onAttendanceBonusEnabledChange={setAttendanceBonusEnabled}
          onClose={() => setAllowanceEntryId(null)}
          onNameChange={(index, value) =>
            setEditAllowances((current) =>
              current.map((allowance, allowanceIndex) =>
                allowanceIndex === index
                  ? { ...allowance, name: value }
                  : allowance,
              ),
            )
          }
          onRemove={(index) =>
            setEditAllowances((current) =>
              current.filter((_, allowanceIndex) => allowanceIndex !== index),
            )
          }
          onSave={() => {
            if (!allowanceEntryId) return;
            applyEntryPatch(
              allowanceEntryId,
              {
                allowances: editAllowances,
                attendanceBonusEnabled,
                attendanceBonusDays,
                attendanceBonusAmount,
              },
              {
                attendanceBonusEnabled,
                attendanceBonusDays,
                attendanceBonusAmount,
              },
              { immediate: true },
            );
            setAllowanceEntryId(null);
          }}
          workingDays={allowanceBreakdown?.workingDays || 0}
          absentDays={allowanceBreakdown?.absentDays || 0}
        />
      ) : null}

      {settingsEntryId ? (
        <PayrollSettingsDialog
          hourlyMultiplier={settingsData.hourlyMultiplier}
          monthlySalary={settingsData.monthlySalary}
          expectedWorkDays={settingsData.expectedWorkDays}
          onClose={() => setSettingsEntryId(null)}
          onExpectedWorkDaysChange={(value) =>
            setSettingsData((current) => ({
              ...current,
              expectedWorkDays: value || 30,
            }))
          }
          onHourlyMultiplierChange={(value) =>
            setSettingsData((current) => ({
              ...current,
              hourlyMultiplier: value,
            }))
          }
          onMonthlySalaryChange={(value) =>
            setSettingsData((current) => ({ ...current, monthlySalary: value }))
          }
          onOvertimeRateChange={(value) =>
            setSettingsData((current) => ({ ...current, overtimeRate: value }))
          }
          onPaidLeaveDaysChange={(value) =>
            setSettingsData((current) => ({ ...current, paidLeaveDays: value }))
          }
          onSave={() => {
            void savePayrollSettings();
          }}
          onSalaryTypeChange={(value) =>
            setSettingsData((current) => ({
              ...current,
              salaryType: value,
              expectedWorkDays:
                value === "monthly"
                  ? current.expectedWorkDays || 30
                  : current.expectedWorkDays,
            }))
          }
          onStandardHoursChange={(value) =>
            setSettingsData((current) => ({ ...current, standardHours: value }))
          }
          overtimeRate={settingsData.overtimeRate}
          paidLeaveDays={settingsData.paidLeaveDays}
          salaryType={settingsData.salaryType}
          standardHours={settingsData.standardHours}
        />
      ) : null}

      {showBatchMultiplierDialog ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/45 p-4"
          onClick={() => {
            if (isApplyingBatchMultiplier) return;
            setShowBatchMultiplierDialog(false);
          }}
        >
          <div
            className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Hệ số lương cho toàn đợt
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Áp dụng một lần cho toàn bộ nhân viên theo giờ của bảng lương này.
                  Không ảnh hưởng hồ sơ nhân viên hay các đợt lương cũ.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isApplyingBatchMultiplier) return;
                  setShowBatchMultiplierDialog(false);
                }}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {hourlyEntries.length === 0
                  ? "Hiện không có nhân viên theo giờ trong đợt này."
                  : uniformHourlyMultiplier === null
                    ? `Đợt này đang có nhiều hệ số khác nhau trên ${hourlyEntries.length} nhân viên theo giờ.`
                    : `Đợt này hiện đang dùng hệ số ${formatHours(
                        uniformHourlyMultiplier,
                      )} cho ${hourlyEntries.length} nhân viên theo giờ.`}
              </div>

              <Input
                type="number"
                min="0"
                step="0.1"
                label="Hệ số áp dụng"
                value={batchHourlyMultiplier}
                onChange={(event) =>
                  setBatchHourlyMultiplier(Number(event.target.value) || 0)
                }
                className="h-11 rounded-2xl bg-white text-right"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                className="rounded-2xl"
                disabled={isApplyingBatchMultiplier}
                onClick={() => setShowBatchMultiplierDialog(false)}
              >
                Hủy
              </Button>
              <Button
                className="rounded-2xl px-5"
                onClick={async () => {
                  await handleApplyBatchHourlyMultiplier();
                  setShowBatchMultiplierDialog(false);
                }}
                isLoading={isApplyingBatchMultiplier}
                disabled={hourlyEntries.length === 0}
              >
                Áp dụng cho cả đợt
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ShiftDetailModal
        isOpen={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        onSave={handleSaveShifts}
        employeeName={currentShiftEntry?.employeeName || ""}
        employeeId={
          currentShiftEntry?.employeeCode || currentShiftEntry?.employeeId || ""
        }
        initialShifts={currentShiftEntry?.shifts || []}
        scheduledStartTimes={
          currentShiftEntry
            ? roleStartTimes[currentShiftEntry.role || defaultRole]
            : undefined
        }
      />
    </div>
  );
}
