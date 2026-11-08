"use client";
import { normalizeSearchText as adminSearchText } from "@/lib/utils";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { getEmployeeRoleNames, getEmployees, Employee } from "@/services/employees";
import { getEmployeeRoles } from "@/services/employeeRoles";
import {
  addPayrollEntry,
  deletePayrollEntry,
  getEstimateDayLocks,
  getPayrollEntries,
  getSavedEstimateSchedule,
  getSavedEstimateSchedules,
  type PayrollEntry,
  type Shift,
  saveImportedPayroll,
  setEstimateDayLock,
  updatePayroll,
  updatePayrollEntry,
} from "@/services/payrolls";
import { resolveEmployeeSalaryType } from "./payroll/_components/EmployeeSalaryFields";
import { getRoleGroupsForStore } from "./payroll/_components/payrollShared";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { Input } from "@/components/ui/Input";
import { SelectBox, type SelectBoxOption } from "@/components/ui/SelectBox";
import { Toast } from "@/components/ui/Toast";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { removeEstimateRole } from "@/lib/estimateSchedule";
import { getMonthlyEstimateCosts } from "@/lib/estimateMonthlySalary";
import { SavedEstimateSchedules } from "./payroll/_components/SavedEstimateSchedules";
import {
  ArrowLeft,
  ChartNoAxesColumnIncreasing,
  CalendarDays,
  ChefHat,
  Coffee,
  Lock,
  LockOpen,
  CalendarRange,
  History,
  Check,
  Clock3,
  ImageDown,
  Loader2,
  PawPrint,
  Plus,
  Search,
  Save,
  ShoppingCart,
  Trash2,
  Users,
  Utensils,
  Wallet,
  X,
} from "lucide-react";

const CAFE_ESTIMATE_ROLES = ["Thu ngân", "Phục vụ", "Pha chế"];
const ROLE_OVERVIEW_STYLES = {
  "Phục vụ": { icon: ShoppingCart, color: "bg-sky-100 text-sky-700" },
  "Pha chế": { icon: Coffee, color: "bg-indigo-100 text-indigo-700" },
  "Thu ngân": { icon: Wallet, color: "bg-emerald-100 text-emerald-700" },
  "Chăm sóc thú": { icon: PawPrint, color: "bg-amber-100 text-amber-800" },
  "Bếp": { icon: ChefHat, color: "bg-rose-100 text-rose-700" },
  "Phục vụ bếp": { icon: Utensils, color: "bg-blue-100 text-blue-700" },
};
const SHIFT_DEFINITIONS = [
  { id: "shift_1", label: "Ca 1", hours: 5 },
  { id: "shift_2", label: "Ca 2", hours: 5 },
  { id: "shift_3", label: "Ca 3", hours: 6 },
] as const;

const SHIFT_TIME_RANGES: Record<ShiftId, { start: string; end: string }> = {
  shift_1: { start: "07:00", end: "12:00" },
  shift_2: { start: "12:00", end: "17:00" },
  shift_3: { start: "17:00", end: "23:00" },
};

const ROLE_THEME =
  "from-[#FFC107] via-[#FFE6A0] via-30% to-white to-60% text-[#064E3B] border-[#E5AE21]";

const WEEK_SHORTCUT_BUTTON_CLASS =
  "h-11 w-full gap-1.5 rounded-lg border-slate-200 bg-white px-2 text-xs font-semibold text-[#064E3B] shadow-sm transition-[background-color,border-color,box-shadow,color,transform] duration-150 hover:border-[#064E3B] hover:bg-emerald-50/70 hover:text-[#064E3B] hover:shadow-md focus-visible:border-[#D6A621] focus-visible:ring-[#E1B23D]/35 active:scale-[0.97] sm:h-10 sm:w-auto sm:self-end sm:gap-2 sm:px-3.5 [&_svg]:text-[#064E3B]";

const SHIFT_THEME: Record<ShiftId, { badge: string; surface: string }> = {
  shift_1: {
    badge: "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
    surface: "bg-sky-50/80",
  },
  shift_2: {
    badge: "bg-orange-100 text-orange-700 ring-1 ring-orange-200",
    surface: "bg-orange-50/80",
  },
  shift_3: {
    badge: "bg-fuchsia-100 text-fuchsia-700 ring-1 ring-fuchsia-200",
    surface: "bg-fuchsia-50/80",
  },
};

const weekdayFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
});

const shortDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
});

const fullDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const longDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("vi-VN");
const hoursFormatter = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

type EstimateRole = string;
type WorkspaceView = "schedule" | "summary" | "saved";
type ShiftId = (typeof SHIFT_DEFINITIONS)[number]["id"];
type ScheduleState = Record<string, string[]>;

type ActiveCell = {
  date: string;
  role: EstimateRole;
  shiftId: ShiftId;
};

type WeekDay = {
  date: string;
  inRange: boolean;
  isToday: boolean;
  weekdayLabel: string;
  shortDateLabel: string;
};

type WeekSegment = {
  key: string;
  label: string;
  days: WeekDay[];
};

type EstimateSummary = {
  employeeKey: string;
  employee: Employee;
  assignedRoles: string[];
  roleTotals: Record<string, { hours: number; salary: number; shiftCount: number }>;
  totalHours: number;
  totalSalary: number;
  shiftCount: number;
  shifts: Array<{
    id: string;
    role: EstimateRole;
    date: string;
    inTime: string;
    outTime: string;
    hours: number;
    isWeekend: boolean;
    isValid: boolean;
  }>;
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function addDays(value: string | Date, amount: number) {
  const date =
    typeof value === "string" ? parseDateKey(value) : new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function getWeekStart(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + offset);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getWeekEnd(date: Date) {
  return addDays(getWeekStart(date), 6);
}

function formatCurrency(value: number) {
  return `${currencyFormatter.format(Math.ceil(value / 1000) * 1000)} đ`;
}

function formatHours(value: number) {
  return `${hoursFormatter.format(value)} giờ`;
}

function formatShiftTime(value: string) {
  const [hour, minute] = value.split(":");
  return minute === "00" ? `${Number(hour)}h` : `${Number(hour)}h${minute}`;
}

function isVisibleEstimateRole(role: string) {
  return role.trim().toLocaleLowerCase("vi") !== "mkt";
}

function isFixedSalaryEmployee(employee: Employee) {
  return resolveEmployeeSalaryType(employee) === "monthly";
}

function getEstimatedHourlyRate(employee: Employee) {
  return isFixedSalaryEmployee(employee) ? 0 : employee.hourlyRate || 0;
}

function getScheduleCellHeight(employeeCount: number) {
  return Math.max(142, 52 + employeeCount * 30);
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("vi");
}

function getEstimateRolesForStore(storeId: string) {
  if (storeId === "cafe" || storeId === "bakery") {
    return CAFE_ESTIMATE_ROLES;
  }

  const roleGroups = getRoleGroupsForStore(storeId);
  return Object.entries(roleGroups)
    .filter(([groupName]) => groupName !== "Chung")
    .flatMap(([, roles]) => roles)
    .filter(isVisibleEstimateRole);
}

function getEstimateStoreIds(storeId: string) {
  if (storeId === "cafe") return ["cafe", "restaurant"];
  if (storeId === "restaurant") return ["restaurant", "cafe"];
  return [storeId];
}

function getEmployeeKey(employee: Employee) {
  return employee.id || employee.employeeCode || employee.name;
}

function getEstimateEmployeeStoreLabel(employee: Employee) {
  if (employee.storeId === "cafe") return "Cafe";
  if (employee.storeId === "restaurant") return "Bếp / Lẩu";
  return "";
}

function getCurrentWeekRange() {
  const today = new Date();
  const start = getWeekStart(today);
  const end = getWeekEnd(today);
  return {
    startDate: toDateKey(start),
    endDate: toDateKey(end),
  };
}

function buildWeekSegments(startDate: string, endDate: string): WeekSegment[] {
  const start = getWeekStart(parseDateKey(startDate));
  const end = getWeekEnd(parseDateKey(endDate));
  const segments: WeekSegment[] = [];

  for (
    let cursor = new Date(start);
    cursor <= end;
    cursor = addDays(cursor, 7)
  ) {
    const days: WeekDay[] = [];

    for (let index = 0; index < 7; index += 1) {
      const date = addDays(cursor, index);
      const dateKey = toDateKey(date);
      days.push({
        date: dateKey,
        inRange: dateKey >= startDate && dateKey <= endDate,
        isToday: dateKey === toDateKey(new Date()),
        weekdayLabel: weekdayFormatter
          .format(date)
          .replace(".", "")
          .replace("Th ", "T"),
        shortDateLabel: shortDateFormatter.format(date),
      });
    }

    const weekEnd = addDays(cursor, 6);
    segments.push({
      key: toDateKey(cursor),
      label: `${shortDateFormatter.format(cursor)} - ${shortDateFormatter.format(weekEnd)}`,
      days,
    });
  }

  return segments;
}

function getBoardKey(role: EstimateRole, weekKey: string) {
  return `${weekKey}-${role}`;
}

function getDailyRoleEstimates(summaries: EstimateSummary[]) {
  const totals = new Map<string, number>();
  for (const summary of summaries) {
    const shifts = summary.shifts.map(shift => ({
      ...shift,
      role: getBoardKey(shift.role, shift.date),
    }));
    if (isFixedSalaryEmployee(summary.employee)) {
      const { roleSalaries } = getMonthlyEstimateCosts(summary.employee.monthlySalary || 0, shifts);
      for (const [dateRoleKey, salary] of Object.entries(roleSalaries)) {
        totals.set(dateRoleKey, (totals.get(dateRoleKey) ?? 0) + salary);
      }
    } else {
      const hourlyRate = getEstimatedHourlyRate(summary.employee);
      for (const shift of shifts) {
        totals.set(shift.role, (totals.get(shift.role) ?? 0) + shift.hours * hourlyRate);
      }
    }
  }
  return totals;
}

function makeCellKey(date: string, role: EstimateRole, shiftId: ShiftId) {
  return `${date}__${role}__${shiftId}`;
}

function buildShiftDateTime(date: string, time: string) {
  return `${date}T${time}:00`;
}

function getRoleOrder(role: string, estimateRoles: string[]) {
  const index = estimateRoles.indexOf(role);
  return index === -1 ? estimateRoles.length : index;
}

function getShiftIdFromStoredShift(shift: Shift) {
  if (shift.id) {
    const matchedById = SHIFT_DEFINITIONS.find((item) =>
      shift.id.endsWith(`-${item.id}`),
    );
    if (matchedById) return matchedById.id;
  }

  const startTime = shift.inTime?.slice(11, 16) || "";
  const endTime = shift.outTime?.slice(11, 16) || "";
  const matchedByTime = SHIFT_DEFINITIONS.find((item) => {
    const window = SHIFT_TIME_RANGES[item.id];
    return window.start === startTime && window.end === endTime;
  });

  return matchedByTime?.id || null;
}

function normalizeStoredShiftDate(dateValue: string) {
  return dateValue.replace(/\//g, "-");
}

function buildEstimateEntryPayload(
  item: EstimateSummary,
  startDate: string,
  endDate: string,
  included: EstimateSummary | undefined,
  isExcluded: (shift: EstimateSummary["shifts"][number]) => boolean,
): Partial<PayrollEntry> {
  const salaryType = resolveEmployeeSalaryType(item.employee);
  const isMonthly = salaryType === "monthly";

  return {
    employeeId: item.employee.id || `manual_${item.employeeKey}`,
    employeeCode: item.employee.employeeCode || "",
    employeeName: item.employee.name,
    role: item.assignedRoles[0] || item.employee.role,
    hourlyRate: isMonthly ? 0 : item.employee.hourlyRate || 0,
    totalHours: included?.totalHours ?? 0,
    weekendHours: 0,
    salary: included?.totalSalary ?? 0,
    allowances: [],
    note: `Ước tính từ lịch phân ca ${startDate} đến ${endDate}`,
    salaryType,
    fixedSalary: isMonthly ? item.employee.monthlySalary || 0 : 0,
    standardHours: isMonthly ? item.employee.standardHours || 0 : 0,
    shifts: item.shifts.map(shift => isExcluded(shift) ? { ...shift, excludedFromEstimate: true } : shift),
  };
}

function getEstimateEntryMatchKey(entry: {
  employeeId?: string;
  employeeCode?: string;
  employeeName?: string;
}) {
  const employeeId = (entry.employeeId || "").trim();
  if (employeeId && !employeeId.startsWith("manual_")) {
    return `id:${employeeId}`;
  }

  const employeeCode = (entry.employeeCode || "").trim().toLowerCase();
  if (employeeCode) {
    return `code:${employeeCode}`;
  }

  return `name:${(entry.employeeName || "").trim().toLowerCase()}`;
}

function buildScheduleFromEntries(
  entries: Array<{
    employeeId?: string;
    employeeCode?: string;
    employeeName: string;
    role: string;
    shifts?: Shift[];
  }>,
  employees: Employee[],
  estimateRoles: string[],
) {
  const schedule: ScheduleState = {};
  const excludedBoards = new Set<string>();
  let minDate = "";
  let maxDate = "";
  let suggestedRole: EstimateRole | null = null;

  entries.forEach((entry) => {
    // Codes can repeat across stores, so resolve the saved ID before legacy fallbacks.
    const matchedEmployee =
      employees.find((employee) => employee.id && employee.id === entry.employeeId) ||
      employees.find((employee) => {
        const entryCode = (entry.employeeCode || "").trim().toLowerCase();
        return entryCode && entryCode === (employee.employeeCode || "").trim().toLowerCase();
      }) ||
      employees.find((employee) =>
        employee.name.trim().toLowerCase() === entry.employeeName.trim().toLowerCase(),
      );

    if (!matchedEmployee) return;

    const employeeKey = getEmployeeKey(matchedEmployee);
    (entry.shifts || []).forEach((shift) => {
      if (shift.isValid === false) return;
      const role = shift.role || entry.role;
      if (!estimateRoles.includes(role)) return;
      const shiftId = getShiftIdFromStoredShift(shift);
      if (!shiftId) return;

      const date = normalizeStoredShiftDate(
        shift.date || shift.inTime.slice(0, 10),
      );
      if (!date) return;

      if (shift.excludedFromEstimate === true) {
        excludedBoards.add(getBoardKey(role, toDateKey(getWeekStart(parseDateKey(date)))));
      }
      const cellKey = makeCellKey(date, role, shiftId);
      schedule[cellKey] = Array.from(
        new Set([...(schedule[cellKey] || []), employeeKey]),
      );

      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
      if (!suggestedRole) suggestedRole = role;
    });
  });

  return {
    schedule,
    excludedBoards,
    startDate: minDate,
    endDate: maxDate,
    selectedRole: suggestedRole,
  };
}

function RoleScheduleTable({
  filterDate,
  dailyRoleEstimates,
  includedInTotals,
  onToggleIncludedInTotals,
  lockedDates,
  onToggleDayLock,
  lockDisabled,
  activeCell,
  employeeByKey,
  onRemoveEmployee,
  onDelete,
  onSave,
  onSelectCell,
  saveDisabled,
  saving,
  role,
  schedule,
  week,
}: {
  filterDate?: string;
  dailyRoleEstimates: ReadonlyMap<string, number>;
  includedInTotals: boolean;
  onToggleIncludedInTotals: () => void;
  activeCell: ActiveCell | null;
  employeeByKey: Map<string, Employee>;
  lockedDates: ReadonlySet<string>;
  onToggleDayLock?: (date: string) => void;
  lockDisabled: boolean;
  onRemoveEmployee: (cell: ActiveCell, employeeKey: string) => void;
  onDelete: () => void;
  onSave: () => void;
  onSelectCell: (cell: ActiveCell) => void;
  saveDisabled: boolean;
  saving: boolean;
  role: EstimateRole;
  schedule: ScheduleState;
  week: WeekSegment;
}) {
  const captureRef = useRef<HTMLElement>(null);
  const shownDays = filterDate ? week.days.filter(day => day.date === filterDate) : week.days;
  const captureKey = `${role}__${week.key}`;
  const [captureStatus, setCaptureStatus] = useState<"idle" | "capturing" | "done" | "error">("idle");
  const [mobileDate, setMobileDate] = useState(() =>
    (week.days.find((day) => day.isToday && day.inRange) || week.days.find((day) => day.inRange) || week.days[0]).date,
  );
  const selectedMobileDate = week.days.some((day) => day.date === mobileDate && day.inRange)
    ? mobileDate
    : (week.days.find((day) => day.inRange) || week.days[0]).date;
  const dayEstimates = shownDays.map(day => dailyRoleEstimates.get(getBoardKey(role, day.date)) ?? 0);
  const boardEstimate = dayEstimates.reduce((total, amount) => total + amount, 0);

  async function handleCaptureSchedule() {
    const section = captureRef.current;
    if (!section || captureStatus === "capturing") return;

    setCaptureStatus("capturing");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const scheduleScroller = section.querySelector<HTMLElement>(
        '[data-schedule-scroll="true"]',
      );
      const captureWidth = Math.max(
        section.scrollWidth,
        scheduleScroller?.scrollWidth || 0,
        1080,
      );
      const captureHeight = Math.max(section.scrollHeight,
        (section.firstElementChild?.getBoundingClientRect().height || 0) + 80 +
        SHIFT_DEFINITIONS.reduce((height, shift) => height + 24 + getScheduleCellHeight(Math.max(0,
          ...shownDays.map((day) => (schedule[makeCellKey(day.date, role, shift.id)] || []).length))), 0));
      const canvas = await html2canvas(section, {
        backgroundColor: "#ffffff",
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        width: captureWidth + 4,
        windowWidth: captureWidth + 4,
        windowHeight: captureHeight + 4,
        onclone: (clonedDocument) => {
          const clonedSection = Array.from(
            clonedDocument.querySelectorAll<HTMLElement>('[data-schedule-capture]'),
          ).find((element) => element.dataset.scheduleCapture === captureKey);
          if (!clonedSection) return;
          clonedSection.style.width = `${captureWidth}px`;
          clonedSection.style.maxWidth = "none";
          clonedSection.style.overflow = "visible";
          clonedSection.querySelectorAll<HTMLElement>('[data-schedule-day]').forEach((element) => {
            element.style.display = "table-cell";
          });
          const clonedTable = clonedSection.querySelector<HTMLElement>('table');
          if (clonedTable) clonedTable.style.minWidth = "1080px";
          clonedSection.querySelector<HTMLElement>('[data-mobile-day-picker]')?.style.setProperty('display', 'none');
          clonedSection.querySelectorAll<HTMLElement>('[data-schedule-scroll="true"]').forEach(
            (element) => {
              element.style.overflow = "visible";
              element.style.width = `${captureWidth}px`;
            },
          );
          clonedSection.querySelectorAll<HTMLElement>('[data-employee-name="true"]').forEach(
            (element) => {
              element.style.overflow = "visible";
              element.style.textOverflow = "clip";
              element.style.whiteSpace = "normal";
              element.style.overflowWrap = "anywhere";
              element.style.lineHeight = "20px";
              element.style.height = "auto";
            },
          );
          clonedSection.querySelectorAll<HTMLElement>('[data-today-badge="true"]').forEach(
            (element) => {
              element.style.display = "inline-flex";
              element.style.alignItems = "center";
              element.style.justifyContent = "center";
              element.style.height = "20px";
              element.style.lineHeight = "20px";
              element.style.paddingTop = "0";
              element.style.paddingBottom = "0";
              element.style.overflow = "visible";
            },
          );
        },
      });
      const link = document.createElement("a");
      link.download = `lich-phan-ca-${sanitizeFileName(role)}-${filterDate || `${week.days[0].date}-${week.days[week.days.length - 1].date}`}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setCaptureStatus("done");
      window.setTimeout(() => setCaptureStatus("idle"), 1800);
    } catch (error) {
      console.error("Không thể chụp lịch phân ca", error);
      setCaptureStatus("error");
      window.setTimeout(() => setCaptureStatus("idle"), 2400);
    }
  }

  return (
    <section
      ref={captureRef}
      data-schedule-capture={captureKey}
      className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white shadow-[5px_7px_12px_rgba(15,23,42,0.16)]"
    >
      <div
        className={cn(
          "flex flex-col gap-4 border-b bg-gradient-to-r px-4 py-3 2xl:flex-row 2xl:items-center 2xl:justify-between",
          ROLE_THEME,
        )}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">Lịch phân ca</p>
          <div className="flex flex-wrap items-start gap-x-4 gap-y-1">
            <h3 className="flex min-h-8 min-w-0 items-center text-lg font-bold leading-tight">{role}</h3>
            <div className="flex shrink-0 flex-col items-start" data-html2canvas-ignore="true">
              <button
                type="button"
                role="switch"
                aria-checked={includedInTotals}
                aria-label={`Tính lịch ${role} tuần ${week.label} vào tổng ước tính`}
                onClick={onToggleIncludedInTotals}
                disabled={week.days.some(day => day.inRange && lockedDates.has(day.date))}
                title={week.days.some(day => day.inRange && lockedDates.has(day.date)) ? "Cần mở khóa ngày đã chốt lương để đổi trạng thái bảng" : undefined}
                className="inline-flex h-8 items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-6 w-14 items-center justify-between rounded-full px-1 text-[10px] font-bold",
                    includedInTotals ? "bg-emerald-700 pl-2 text-white" : "flex-row-reverse bg-slate-200 pr-2 text-slate-700",
                  )}
                >
                  {includedInTotals ? "ON" : "OFF"}
                  <span className="size-4 rounded-full bg-white shadow-sm" />
                </span>
              </button>
              <span className={cn("whitespace-nowrap text-xs font-semibold leading-4 tabular-nums", !includedInTotals && "text-emerald-950/75")}>
                <span className="sr-only">Ước tính của bảng: </span>
                {formatCurrency(boardEstimate)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="grid grid-cols-2 gap-3 pb-1 sm:flex sm:flex-wrap sm:items-center" data-html2canvas-ignore="true">
            <Button
              type="button"
              variant="outline"
              className="col-span-2 h-11 min-w-0 gap-1 rounded-[3px] border-2 border-slate-950 bg-red-100 px-2 text-xs font-bold text-red-800 sm:h-12 sm:gap-2 sm:px-4 sm:text-sm shadow-[5px_6px_0_#0F172A] transition-[background-color,box-shadow,transform] duration-150 hover:translate-x-px hover:translate-y-px hover:border-slate-950 hover:bg-red-200 hover:text-red-900 hover:shadow-[3px_4px_0_#0F172A] focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2 active:translate-x-[3px] active:translate-y-[4px] active:shadow-[1px_2px_0_#0F172A] disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[5px_6px_0_#0F172A]"
              disabled={saving}
              onClick={onDelete}
              aria-label={`Xoá lịch phân ca ${role}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />Xoá lịch
            </Button>
            <Button
              type="button"
              className="h-11 min-w-0 gap-1 rounded-[3px] border-2 border-slate-950 bg-[#F6C85F] px-2 text-xs font-bold text-[#064E3B] sm:h-12 sm:gap-2 sm:px-4 sm:text-sm shadow-[5px_6px_0_#0F172A] transition-[background-color,box-shadow,transform] duration-150 hover:translate-x-px hover:translate-y-px hover:border-slate-950 hover:bg-[#E1B23D] hover:text-[#064E3B] hover:shadow-[3px_4px_0_#0F172A] focus-visible:ring-2 focus-visible:ring-[#064E3B] focus-visible:ring-offset-2 active:translate-x-[3px] active:translate-y-[4px] active:shadow-[1px_2px_0_#0F172A] disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[5px_6px_0_#0F172A]"
              title="Lưu toàn bộ lịch phân ca trong khoảng ngày đã chọn"
              isLoading={saving}
              disabled={saveDisabled || saving}
              onClick={onSave}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Lưu ước tính
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-html2canvas-ignore="true"
              className="h-11 min-w-0 gap-1 rounded-[3px] border-2 border-slate-950 bg-[#087A62] px-2 text-xs font-bold text-white sm:h-12 sm:gap-2 sm:px-4 sm:text-sm shadow-[5px_6px_0_#0F172A] transition-[background-color,box-shadow,transform] duration-150 hover:translate-x-px hover:translate-y-px hover:border-slate-950 hover:bg-[#066B56] hover:text-white hover:shadow-[3px_4px_0_#0F172A] focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-2 active:translate-x-[3px] active:translate-y-[4px] active:shadow-[1px_2px_0_#0F172A] disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[5px_6px_0_#0F172A]"
              onClick={() => void handleCaptureSchedule()}
              disabled={captureStatus === "capturing"}
            >
              {captureStatus === "capturing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <ImageDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {captureStatus === "capturing"
                ? "Đang chụp..."
                : captureStatus === "done"
                  ? "Đã tải ảnh"
                  : captureStatus === "error"
                    ? "Thử lại"
                    : "Chụp lịch"}
            </Button>
          </div>
          <div className="order-first rounded border border-emerald-900/15 bg-white/75 px-3 py-2 text-left shadow-sm backdrop-blur-sm sm:order-none sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800/70">
              {filterDate ? "Ngày đang xem" : "Khoảng ngày"}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm font-bold tabular-nums text-emerald-950">
              <CalendarDays className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              <span>
                {fullDateFormatter.format(parseDateKey(shownDays[0].date))}
                {!filterDate && ` – ${fullDateFormatter.format(parseDateKey(shownDays[shownDays.length - 1].date))}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {!filterDate && <div className="border-b border-slate-200 bg-white p-3 md:hidden" data-mobile-day-picker="true" data-html2canvas-ignore="true">
        <p className="mb-2 text-sm font-medium text-slate-600">Chọn ngày phân ca</p>
        <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1" role="group" aria-label={`Ngày phân ca ${role}`}>
          {week.days.filter((day) => day.inRange).map((day) => (
            <button key={day.date} type="button" aria-pressed={day.date === selectedMobileDate}
              onClick={() => setMobileDate(day.date)}
              className={cn("min-h-14 min-w-14 shrink-0 rounded-lg border px-2 py-2 text-center text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700",
                day.date === selectedMobileDate ? "border-emerald-900 bg-emerald-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-900")}
              aria-label={`${longDateFormatter.format(parseDateKey(day.date))}${day.isToday ? ', hôm nay' : ''}`}>
              <span className="block">{day.weekdayLabel}</span>
              <span className="mt-1 block font-bold tabular-nums">{day.shortDateLabel}</span>
            </button>
          ))}
        </div>
      </div>}
      <div data-schedule-scroll="true" className="min-w-0 overflow-x-auto overscroll-x-contain">
        <table className={cn("w-full table-fixed border-separate border-spacing-0", !filterDate && "md:min-w-[920px] 2xl:min-w-[1080px]")}>
          <thead className="bg-slate-50/80">
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
              <th className="sticky left-0 z-20 w-24 border-b border-r border-slate-200 bg-white px-3 py-3 md:w-28 2xl:w-32 2xl:px-4 2xl:py-4">
                Ca
              </th>
              {shownDays.map((day, index) => (
                <th
                  key={day.date}
                  scope="col"
                  data-schedule-day={day.date}
                  className={cn(
                    "border-b border-slate-200 px-2.5 py-3 md:min-w-[115px] 2xl:min-w-[135px] 2xl:px-3",
                    !filterDate && day.date !== selectedMobileDate && "hidden md:table-cell",
                    day.inRange ? "bg-white" : "bg-slate-50 text-slate-400",
                  )}
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px] tracking-[0.12em]">
                    <span className="shrink-0">{day.weekdayLabel}</span>
                    {day.isToday ? (
                      <span
                        data-today-badge="true"
                        className="inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-slate-900 px-2 text-[9px] font-bold leading-none tracking-[0.06em] text-white"
                      >
                        Hôm nay
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 whitespace-nowrap text-[13px] font-semibold normal-case tracking-normal text-slate-800">
                    {onToggleDayLock && day.inRange ? (
                      <button
                        type="button"
                        disabled={lockDisabled}
                        aria-label={`${lockedDates.has(day.date) ? "Mở khóa" : "Khóa"} ngày ${day.shortDateLabel}`}
                        title={lockDisabled ? "Lưu lịch trước khi khóa hoặc mở khóa ngày" : undefined}
                        onClick={() => onToggleDayLock(day.date)}
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {day.shortDateLabel}
                        {lockedDates.has(day.date) ? <Lock className="h-3.5 w-3.5 text-emerald-800" /> : <LockOpen className="h-3.5 w-3.5 text-slate-500" />}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {day.shortDateLabel}
                        {lockedDates.has(day.date) && <Lock className="h-3.5 w-3.5 text-emerald-800" aria-label="Đã khóa" />}
                      </span>
                    )}
                  </div>
                  {day.inRange && (
                    <div className="mt-1 text-xs font-medium normal-case tracking-normal text-slate-600">
                      <span className="block">Tổng ngày</span>
                      <span className="block whitespace-nowrap text-sm font-bold tabular-nums text-emerald-900">
                        {formatCurrency(dayEstimates[index])}
                      </span>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {SHIFT_DEFINITIONS.map((shift) => {
              const maxEmployeesInRow = Math.max(
                0,
                ...shownDays.map(
                  (day) =>
                    (schedule[makeCellKey(day.date, role, shift.id)] || []).length,
                ),
              );
              const synchronizedCellHeight = getScheduleCellHeight(maxEmployeesInRow);

              return (
              <tr key={shift.id}>
                <td
                  className={cn(
                    "sticky left-0 z-10 border-r border-slate-200 px-3 py-3 align-top 2xl:px-4 2xl:py-4",
                    SHIFT_THEME[shift.id].surface,
                  )}
                >
                  <div className="space-y-2">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                        SHIFT_THEME[shift.id].badge,
                      )}
                    >
                      {shift.label}
                    </span>
                    <div>
                      <div className="whitespace-nowrap text-xs font-bold text-slate-800">
                        {formatShiftTime(SHIFT_TIME_RANGES[shift.id].start)}
                        {" – "}
                        {formatShiftTime(SHIFT_TIME_RANGES[shift.id].end)}
                      </div>
                      <div className="mt-1 text-xs font-medium text-slate-500">
                        {shift.hours} tiếng
                      </div>
                    </div>
                  </div>
                </td>

                {shownDays.map((day) => {
                  const cell: ActiveCell = {
                    date: day.date,
                    role,
                    shiftId: shift.id,
                  };
                  const cellKey = makeCellKey(day.date, role, shift.id);
                  const selectedEmployeeKeys = schedule[cellKey] || [];
                  const selectedEmployees = selectedEmployeeKeys
                    .map((employeeKey) => employeeByKey.get(employeeKey))
                    .filter(Boolean) as Employee[];
                  const isActive =
                    activeCell?.date === day.date &&
                    activeCell?.role === role &&
                    activeCell?.shiftId === shift.id;
                  const cellEstimate = selectedEmployees.reduce(
                    (sum, employee) =>
                      sum + getEstimatedHourlyRate(employee) * shift.hours,
                    0,
                  );
                  const hasHourlyEmployee = selectedEmployees.some(
                    (employee) => !isFixedSalaryEmployee(employee),
                  );

                  return (
                    <td
                      key={day.date}
                      data-schedule-day={day.date}
                      style={{ "--schedule-cell-height": `${synchronizedCellHeight}px` } as CSSProperties}
                      className={cn(
                        "h-px border-b border-slate-200 px-2 py-3 align-top",
                        !filterDate && day.date !== selectedMobileDate && "hidden md:table-cell",
                        !day.inRange && "bg-slate-50",
                      )}
                    >
                      <div
                        role="button"
                        tabIndex={!onToggleDayLock && lockedDates.has(day.date) ? -1 : 0}
                        aria-disabled={!onToggleDayLock && lockedDates.has(day.date)}
                        onClick={() => onSelectCell(cell)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelectCell(cell);
                          }
                        }}
                        className={cn(
                          "h-full min-h-24 rounded-lg border bg-white p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:min-h-[var(--schedule-cell-height)] md:p-2 2xl:p-2.5",
                          isActive
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {selectedEmployees.length > 0 ? `${selectedEmployees.length} người` : "Chưa xếp"}
                          </span>
                          {hasHourlyEmployee ? (
                            <span className="text-[10px] font-bold text-emerald-700">
                              {formatCurrency(cellEstimate)}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 space-y-0.5">
                          {selectedEmployees.length === 0 ? (
                            <span className="text-xs text-slate-400">
                              Chọn người
                            </span>
                          ) : (
                            selectedEmployees.map((employee) => {
                              const employeeKey = getEmployeeKey(employee);
                              return (
                                <div
                                  key={employeeKey}
                                  className="flex w-full items-center gap-1 py-1 text-slate-800"
                                  title={employee.name}
                                >
                                  <span
                                    data-employee-name="true"
                                    className="min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere] text-sm font-semibold leading-5 md:text-xs"
                                  >
                                    {employee.name}
                                  </span>
                                  {(onToggleDayLock || !lockedDates.has(day.date)) && <button
                                    type="button"
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:text-rose-600 md:mt-1 md:h-5 md:w-5"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onRemoveEmployee(cell, employeeKey);
                                    }}
                                    aria-label={`Xóa ${employee.name}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>}
                                </div>
                              );
                            })
                          )}
                        </div>

                      </div>
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function SalaryEstimatePage() {
  const { user, loading } = useAuth();
  const canViewMonthlyDailySalary = user?.role === "admin";
  const { storeId, storeName } = useStore();
  const canScheduleAcrossCafeAndKitchen = storeId === "cafe" || storeId === "restaurant";
  const router = useRouter();
  const location = useLocation();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [savedEmployees, setSavedEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [schedule, setSchedule] = useState<ScheduleState>({});
  const [excludedBoards, setExcludedBoards] = useState<Set<string>>(() => new Set());
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [cellSearch, setCellSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [dayLocks, setDayLocks] = useState<{ storeId: string; dates: string[] } | null>(null);
  const [updatingDayLock, setUpdatingDayLock] = useState(false);
  const lockedDates = useMemo(() => new Set(dayLocks?.storeId === storeId ? dayLocks.dates : []), [dayLocks, storeId]);
  const [saveMessage, setSaveMessage] = useState("");
  const [editingPayrollId, setEditingPayrollId] = useState("");
  const [range, setRange] = useState(getCurrentWeekRange);
  const [dateFilter, setDateFilter] = useState("");
  const [selectedRole, setSelectedRole] = useState<EstimateRole>(
    CAFE_ESTIMATE_ROLES[0],
  );
  const [scheduleBoardRoles, setScheduleBoardRoles] = useState<string[]>([CAFE_ESTIMATE_ROLES[0]]);
  const [pendingDeleteRole, setPendingDeleteRole] = useState<string | null>(null);
  const pendingBoardRole = useRef<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("schedule");
  const [loadingSavedEstimate, setLoadingSavedEstimate] = useState(false);
  const [savedSchedulesRevision, setSavedSchedulesRevision] = useState(0);
  const [savedSchedulesCount, setSavedSchedulesCount] = useState<{storeId: string; total: number} | null>(null);
  const [openSavedRevision, setOpenSavedRevision] = useState(0);
  const [confirmNewSchedule, setConfirmNewSchedule] = useState(false);
  const savedDraft = useRef("");
  const saveInFlight = useRef(false);
  const saveGeneration = useRef(0);
  const activeStore = useRef(storeId);
  if (activeStore.current !== storeId) {
    activeStore.current = storeId;
    saveGeneration.current += 1;
  }
  const editingIdRef = useRef("");
  const loadedScheduleKey = useRef("");
  const failedDraft = useRef("");
  const [autosaveError, setAutosaveError] = useState("");
  const [saveTick, setSaveTick] = useState(0);
  const saveLatest = useRef<() => Promise<boolean>>(async () => false);
  const [managedEstimateRoles, setManagedEstimateRoles] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  useEffect(() => () => { saveGeneration.current += 1; }, []);

  useEffect(() => {
    if (!storeId || loading || !user) return;
    let active = true;
    getEstimateDayLocks(storeId)
      .then(({ dates }) => { if (active) setDayLocks({ storeId, dates }); })
      .catch(error => { if (active) setSubmitError(error instanceof Error ? error.message : "Không tải được ngày đã khóa."); });
    return () => { active = false; };
  }, [storeId, loading, user?.id]);

  useEffect(() => {
    if (!storeId || loading || !user) return;
    let active = true;
    getSavedEstimateSchedules(storeId)
      .then(({total}) => { if (active) setSavedSchedulesCount({storeId,total}); })
      .catch(error => {
        if (!active) return;
        setSavedSchedulesCount(null);
        console.error(error);
      });
    return () => { active = false; };
  }, [storeId, loading, user?.id, savedSchedulesRevision]);

  const estimateRoles = useMemo(
    () =>
      (managedEstimateRoles.length > 0
        ? managedEstimateRoles
        : Array.from(new Set(getEstimateStoreIds(storeId).flatMap(getEstimateRolesForStore)))
      ).filter(isVisibleEstimateRole),
    [managedEstimateRoles, storeId],
  );
  const roleOptions = useMemo<readonly SelectBoxOption<EstimateRole>[]>(
    () =>
      estimateRoles.map((value) => ({
        value,
        label: value,
        icon: CalendarDays,
      })),
    [estimateRoles],
  );
  const displayedScheduleRoles = useMemo(
    () => Array.from(new Set(scheduleBoardRoles)).filter(role => estimateRoles.includes(role)),
    [scheduleBoardRoles, estimateRoles],
  );
  useEffect(() => {
    const role = pendingBoardRole.current;
    if (!role) return;
    const board = document.getElementById(`estimate-board-${encodeURIComponent(role)}`);
    if (!board) return;
    pendingBoardRole.current = null;
    board.focus({preventScroll:true});
    board.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
  }, [displayedScheduleRoles]);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      }
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!storeId) return;

    let ignore = false;
    setEmployeesLoading(true);
    setLoadError("");

    Promise.all(getEstimateStoreIds(storeId).map(getEmployees))
      .then((items) => {
        if (ignore) return;
        setEmployees(items.flat());
      })
      .catch((error) => {
        if (ignore) return;
        console.error(error);
        setEmployees([]);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Không tải được danh sách nhân viên.",
        );
      })
      .finally(() => {
        if (!ignore) {
          setEmployeesLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [storeId]);

  useEffect(() => {
    let ignore = false;
    setRolesLoading(true);
    setManagedEstimateRoles([]);
    Promise.all(getEstimateStoreIds(storeId).map(async (estimateStoreId) => {
      try {
        const items = await getEmployeeRoles(estimateStoreId);
        return items.length > 0
          ? items.map((item) => item.name)
          : getEstimateRolesForStore(estimateStoreId);
      } catch (error) {
        console.error(error);
        return getEstimateRolesForStore(estimateStoreId);
      }
    }))
      .then((items) => {
        if (!ignore) setManagedEstimateRoles(Array.from(new Set(items.flat())));
      })
      .catch((error) => console.error(error))
      .finally(() => { if (!ignore) setRolesLoading(false); });
    return () => {
      ignore = true;
    };
  }, [storeId]);

  useEffect(() => {
    saveGeneration.current += 1;
    editingIdRef.current = "";
    loadedScheduleKey.current = "";
    failedDraft.current = "";
    setAutosaveError("");
    setSelectedRole(estimateRoles[0] || "");
    setActiveCell(null);
    setSchedule({});
    setExcludedBoards(new Set());
    setSavedEmployees([]);
    setEditingPayrollId("");
    savedDraft.current = "";
    setScheduleBoardRoles(estimateRoles.length > 0 ? [estimateRoles[0]] : []);
  }, [estimateRoles, storeId]);

  useEffect(() => {
    setCellSearch("");
  }, [activeCell?.date, activeCell?.role, activeCell?.shiftId]);

  useEffect(() => {
    if (!activeCell) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeCell]);

  useEffect(() => {
    if (activeCell && !displayedScheduleRoles.includes(activeCell.role)) {
      setActiveCell(null);
    }
  }, [activeCell, displayedScheduleRoles]);

  const normalizedRange = useMemo(() => {
    if (range.startDate <= range.endDate) {
      return range;
    }

    return {
      startDate: range.endDate,
      endDate: range.startDate,
    };
  }, [range]);

  const weekSegments = useMemo(
    () => buildWeekSegments(normalizedRange.startDate, normalizedRange.endDate),
    [normalizedRange],
  );

  const visibleWeeksByDate = useMemo(() => {
    const next = new Map<string, string>();
    weekSegments.forEach((segment) => {
      segment.days.forEach((day) => {
        if (day.inRange) next.set(day.date, segment.key);
      });
    });
    return next;
  }, [weekSegments]);
  const filteredDate = workspaceView === "schedule" && visibleWeeksByDate.has(dateFilter) ? dateFilter : "";
  const displayedWeeks = filteredDate ? weekSegments.filter(week => week.key === visibleWeeksByDate.get(filteredDate)) : weekSegments;

  useEffect(() => {
    if (dateFilter && !visibleWeeksByDate.has(dateFilter)) setDateFilter("");
  }, [dateFilter, visibleWeeksByDate]);

  useEffect(() => {
    if (activeCell && !visibleWeeksByDate.has(activeCell.date)) {
      setActiveCell(null);
    }
  }, [activeCell, visibleWeeksByDate]);

  const supportedEmployees = useMemo(
    () =>
      Array.from(new Map([...employees, ...savedEmployees].map(employee => [getEmployeeKey(employee), employee])).values())
        .filter(
          (employee) =>
            getEmployeeRoleNames(employee).some((role) =>
              canScheduleAcrossCafeAndKitchen ? isVisibleEstimateRole(role) : estimateRoles.includes(role),
            ),
        )
        .sort((left, right) => left.name.localeCompare(right.name, "vi")),
    [employees, savedEmployees, estimateRoles, canScheduleAcrossCafeAndKitchen],
  );

  const queryPayrollId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("payrollId") || "";
  }, [location.search]);

  const employeeByKey = useMemo(() => {
    const next = new Map<string, Employee>();
    supportedEmployees.forEach((employee) => {
      next.set(getEmployeeKey(employee), employee);
    });
    return next;
  }, [supportedEmployees]);

  useEffect(() => {
    if (!queryPayrollId || employeesLoading || rolesLoading) return;
    const loadKey = `${storeId}:${queryPayrollId}:${openSavedRevision}`;
    if (loadedScheduleKey.current === loadKey) return;

    let ignore = false;
    saveGeneration.current += 1;
    setLoadingSavedEstimate(true);
    setSubmitError("");

    getSavedEstimateSchedule(storeId, queryPayrollId)
      .then(({ entries, schedule: savedSchedule }) => {
        if (ignore) return;
        const snapshotEmployees: Employee[] = entries.map(entry => {
          const current = employees.find(employee => employee.id === entry.employeeId);
          return {
            ...current,
            id: entry.employeeId,
            employeeCode: entry.employeeCode || current?.employeeCode,
            name: entry.employeeName,
            storeId: current?.storeId || storeId,
            role: entry.role,
            roles: Array.from(new Set([entry.role, ...(current?.roles || []), ...(entry.shifts || []).map(shift => shift.role || entry.role)])),
            hourlyRate: entry.hourlyRate ?? current?.hourlyRate ?? 0,
            salaryType: entry.salaryType || current?.salaryType,
            monthlySalary: entry.monthlySalary || entry.fixedSalary || 0,
          };
        });
        setSavedEmployees(snapshotEmployees);
        const restored = buildScheduleFromEntries(
          entries,
          snapshotEmployees,
          estimateRoles,
        );
        const startDate = savedSchedule.startDate || normalizedRange.startDate;
        const endDate = savedSchedule.endDate || normalizedRange.endDate;
        const restoredRange = startDate <= endDate ? { startDate, endDate } : { startDate: endDate, endDate: startDate };
        setSchedule(restored.schedule);
        setExcludedBoards(restored.excludedBoards);
        loadedScheduleKey.current = loadKey;
        editingIdRef.current = queryPayrollId;
        failedDraft.current = "";
        setAutosaveError("");
        savedDraft.current = JSON.stringify({ schedule: restored.schedule, range: restoredRange, excludedBoards: Array.from(restored.excludedBoards).sort() });
        setRange(restoredRange);
        if (restored.selectedRole) {
          setSelectedRole(restored.selectedRole);
        }
        setScheduleBoardRoles(savedSchedule.roles);
        setEditingPayrollId(queryPayrollId);
        setSaveMessage("Đã mở lại bản ước tính để tiếp tục sửa.");
      })
      .catch((error) => {
        if (ignore) return;
        console.error(error);
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Không mở được bản ước tính đã lưu.",
        );
      })
      .finally(() => {
        if (!ignore) {
          setLoadingSavedEstimate(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [estimateRoles, queryPayrollId, employeesLoading, rolesLoading, employees, storeId, openSavedRevision]);

  const employeesByRole = useMemo(() => {
    const next = Object.fromEntries(
      estimateRoles.map((roleName) => [roleName, [] as Employee[]]),
    ) as Record<EstimateRole, Employee[]>;

    supportedEmployees.forEach((employee) => {
      getEmployeeRoleNames(employee).forEach((role) => {
        if (estimateRoles.includes(role)) next[role].push(employee);
      });
    });

    return next;
  }, [estimateRoles, supportedEmployees]);

  const buildEstimateSummaries = useCallback((excludedBoards?: ReadonlySet<string>, onlyDate?: string) => {
    const summaryMap = new Map<string, EstimateSummary>();

    visibleWeeksByDate.forEach((weekKey, date) => {
      if (onlyDate && date !== onlyDate) return;
      estimateRoles.forEach((roleName) => {
        if (excludedBoards?.has(getBoardKey(roleName, weekKey))) return;
        SHIFT_DEFINITIONS.forEach((shift) => {
          const selectedEmployeeKeys =
            schedule[makeCellKey(date, roleName, shift.id)] || [];

          selectedEmployeeKeys.forEach((employeeKey) => {
            const employee = employeeByKey.get(employeeKey);
            if (!employee) return;

            const shiftWindow = SHIFT_TIME_RANGES[shift.id];
            const nextSummary = summaryMap.get(employeeKey) || {
              employeeKey,
              employee,
              assignedRoles: [],
              roleTotals: {},
              totalHours: 0,
              totalSalary: 0,
              shiftCount: 0,
              shifts: [],
            };

            nextSummary.totalHours += shift.hours;
            nextSummary.totalSalary += shift.hours * getEstimatedHourlyRate(employee);
            nextSummary.shiftCount += 1;
            if (!nextSummary.assignedRoles.includes(roleName)) {
              nextSummary.assignedRoles.push(roleName);
            }
            const currentRoleTotal = nextSummary.roleTotals[roleName] || {
              hours: 0,
              salary: 0,
              shiftCount: 0,
            };
            currentRoleTotal.hours += shift.hours;
            currentRoleTotal.salary += shift.hours * getEstimatedHourlyRate(employee);
            currentRoleTotal.shiftCount += 1;
            nextSummary.roleTotals[roleName] = currentRoleTotal;
            nextSummary.shifts.push({
              id: `${employeeKey}-${roleName}-${date}-${shift.id}`,
              role: roleName,
              date,
              inTime: buildShiftDateTime(date, shiftWindow.start),
              outTime: buildShiftDateTime(date, shiftWindow.end),
              hours: shift.hours,
              isWeekend: false,
              isValid: true,
            });

            summaryMap.set(employeeKey, nextSummary);
          });
        });
      });
    });

    for (const summary of summaryMap.values()) {
      if (!isFixedSalaryEmployee(summary.employee)) continue;
      const costs = getMonthlyEstimateCosts(summary.employee.monthlySalary || 0, summary.shifts);
      summary.totalSalary = costs.salary;
      for (const [role, salary] of Object.entries(costs.roleSalaries)) {
        summary.roleTotals[role].salary = salary;
      }
    }

    return Array.from(summaryMap.values()).sort((left, right) => {
      const roleDiff =
        getRoleOrder(left.assignedRoles[0] || left.employee.role, estimateRoles) -
        getRoleOrder(right.assignedRoles[0] || right.employee.role, estimateRoles);
      if (roleDiff !== 0) return roleDiff;
      return left.employee.name.localeCompare(right.employee.name, "vi");
    });
  }, [employeeByKey, estimateRoles, schedule, visibleWeeksByDate]);

  const estimateSummaries = useMemo(() => buildEstimateSummaries(), [buildEstimateSummaries]);
  const displayedSummaries = useMemo(
    () => excludedBoards.size > 0 ? buildEstimateSummaries(excludedBoards) : estimateSummaries,
    [buildEstimateSummaries, estimateSummaries, excludedBoards],
  );
  const dailyRoleEstimates = useMemo(
    () => getDailyRoleEstimates(estimateSummaries),
    [estimateSummaries],
  );
  const displayedDailyRoleEstimates = useMemo(
    () => displayedSummaries === estimateSummaries
      ? dailyRoleEstimates
      : getDailyRoleEstimates(displayedSummaries),
    [dailyRoleEstimates, displayedSummaries, estimateSummaries],
  );

  function toggleBoardInTotals(role: EstimateRole, weekKey: string) {
    const boardKey = getBoardKey(role, weekKey);
    setExcludedBoards(current => {
      const next = new Set(current);
      if (next.has(boardKey)) next.delete(boardKey);
      else next.add(boardKey);
      return next;
    });
  }

  const overviewSummaries = useMemo(
    () => filteredDate ? buildEstimateSummaries(excludedBoards, filteredDate) : displayedSummaries,
    [buildEstimateSummaries, displayedSummaries, excludedBoards, filteredDate],
  );
  const totalEstimate = overviewSummaries.reduce(
    (sum, item) => sum + item.totalSalary,
    0,
  );
  const totalHours = overviewSummaries.reduce(
    (sum, item) => sum + item.totalHours,
    0,
  );
  const totalsByRole = useMemo(() => {
    return estimateRoles.map((roleName) => {
      const entries = overviewSummaries.filter(
        (item) => item.assignedRoles.includes(roleName),
      );
      return {
        role: roleName,
        employees: entries.length,
        totalHours: entries.reduce((sum, item) => sum + (item.roleTotals[roleName]?.hours || 0), 0),
        totalSalary: entries.reduce((sum, item) => sum + (item.roleTotals[roleName]?.salary || 0), 0),
      };
    });
  }, [estimateRoles, overviewSummaries]);

  const displayedRoleTotals = totalsByRole.filter(
    item => displayedScheduleRoles.includes(item.role),
  );

  const selectedRoleSummaries = displayedSummaries.filter(
    (item) => item.assignedRoles.includes(selectedRole),
  );

  const activeCellEmployees = activeCell
    ? canScheduleAcrossCafeAndKitchen ? supportedEmployees : employeesByRole[activeCell.role] || []
    : [];
  const activeSelection = activeCell
    ? schedule[
        makeCellKey(activeCell.date, activeCell.role, activeCell.shiftId)
      ] || []
    : [];
  const activeShift = activeCell
    ? SHIFT_DEFINITIONS.find((shift) => shift.id === activeCell.shiftId) || null
    : null;

  const filteredActiveEmployees = activeCellEmployees.filter((employee) => {
    const keyword = adminSearchText(cellSearch.trim());
    if (!keyword) return true;

    return (
      adminSearchText(employee.name).includes(keyword) ||
      adminSearchText((employee.employeeCode || "")).includes(keyword)
    );
  }).sort((left, right) =>
    Number(activeSelection.includes(getEmployeeKey(right))) -
    Number(activeSelection.includes(getEmployeeKey(left))) ||
    Number(getEmployeeRoleNames(right).includes(activeCell?.role || "")) -
    Number(getEmployeeRoleNames(left).includes(activeCell?.role || "")),
  );
  const canAccessPayroll = hasPermission(user, "payroll.access");

  function updateCellEmployees(
    cell: ActiveCell,
    updater: (current: string[]) => string[],
  ) {
    if (loadingSavedEstimate || (!canViewMonthlyDailySalary && lockedDates.has(cell.date))) return;
    const cellKey = makeCellKey(cell.date, cell.role, cell.shiftId);

    setSchedule((current) => {
      const nextSelection = Array.from(
        new Set(updater(current[cellKey] || [])),
      );
      if (nextSelection.length === 0) {
        const next = { ...current };
        delete next[cellKey];
        return next;
      }

      return {
        ...current,
        [cellKey]: nextSelection,
      };
    });
  }

  function toggleEmployeeInActiveCell(employeeKey: string) {
    if (!activeCell) return;

    updateCellEmployees(activeCell, (current) => {
      if (current.includes(employeeKey)) {
        return current.filter((item) => item !== employeeKey);
      }

      return [...current, employeeKey];
    });
  }

  function removeEmployeeFromCell(cell: ActiveCell, employeeKey: string) {
    updateCellEmployees(cell, (current) =>
      current.filter((item) => item !== employeeKey),
    );
  }

  function clearCell(cell: ActiveCell) {
    updateCellEmployees(cell, () => []);
  }

  function clearDateCollection(dates: string[]) {
    const dateSet = new Set(dates);
    setSchedule((current) => {
      const next: ScheduleState = {};

      Object.entries(current).forEach(([cellKey, employeeKeys]) => {
        const [date] = cellKey.split("__");
        if (dateSet.has(date)) return;
        next[cellKey] = employeeKeys;
      });

      return next;
    });
  }

  function handleApplyCurrentWeek() {
    setRange(getCurrentWeekRange());
  }

  function handleApplyNextWeek() {
    const nextWeekStart = addDays(getWeekStart(new Date()), 7);
    const nextWeekEnd = addDays(nextWeekStart, 6);
    setRange({
      startDate: toDateKey(nextWeekStart),
      endDate: toDateKey(nextWeekEnd),
    });
  }

  function handleSelectScheduleCell(cell: ActiveCell) {
    if (loadingSavedEstimate || rolesLoading) return;
    if (!canViewMonthlyDailySalary && lockedDates.has(cell.date)) return;
    setRange((current) => {
      const orderedRange =
        current.startDate <= current.endDate
          ? current
          : { startDate: current.endDate, endDate: current.startDate };

      if (cell.date < orderedRange.startDate) {
        return {
          startDate: cell.date,
          endDate: orderedRange.endDate,
        };
      }

      if (cell.date > orderedRange.endDate) {
        return {
          startDate: orderedRange.startDate,
          endDate: cell.date,
        };
      }

      return current;
    });

    setActiveCell(cell);
  }

  function createNewSchedule() {
    setSavedEmployees([]);
    saveGeneration.current += 1;
    editingIdRef.current = "";
    loadedScheduleKey.current = "";
    failedDraft.current = "";
    setAutosaveError("");
    setSchedule({});
    setExcludedBoards(new Set());
    setEditingPayrollId("");
    savedDraft.current = "";
    setActiveCell(null);
    setScheduleBoardRoles(selectedRole ? [selectedRole] : []);
    setPendingDeleteRole(null);
    setSaveMessage("");
    setSubmitError("");
    setWorkspaceView("schedule");
    setConfirmNewSchedule(false);
    router.replace("/payroll-estimate");
  }

  function handleCreateSchedule() {
    if (saving || loadingSavedEstimate) return;
    if ((editingPayrollId || Object.values(schedule).some(employees => employees.length > 0)) && currentDraft !== savedDraft.current) setConfirmNewSchedule(true);
    else createNewSchedule();
  }

  function deleteRoleSchedule() {
    if (!pendingDeleteRole || saving || loadingSavedEstimate) return;
    if (!canViewMonthlyDailySalary && Object.keys(schedule).some(key => {
      const [date, role] = key.split("__");
      return role === pendingDeleteRole && lockedDates.has(date);
    })) {
      setPendingDeleteRole(null);
      setSubmitError("Lịch có ca trong ngày đã chốt lương. Chỉ admin có thể xóa.");
      return;
    }
    const remaining = displayedScheduleRoles.filter(role => role !== pendingDeleteRole);
    setSchedule(current => removeEstimateRole(current,pendingDeleteRole));
    setScheduleBoardRoles(remaining);
    if (selectedRole === pendingDeleteRole && remaining.length > 0) setSelectedRole(remaining[0]);
    setActiveCell(null);
    setSaveMessage("");
    setSubmitError("");
    setPendingDeleteRole(null);
  }

  async function handleSaveEstimate(automatic = false) {
    if (!storeId || saveInFlight.current || loadingSavedEstimate || employeesLoading || rolesLoading || loadError) return false;
    if (queryPayrollId && loadedScheduleKey.current !== `${storeId}:${queryPayrollId}:${openSavedRevision}`) return false;
    const generation = saveGeneration.current;
    const isCurrent = () => generation === saveGeneration.current && activeStore.current === storeId;
    const requestPayrollId = editingIdRef.current;
    const draft = currentDraft;

    if (estimateSummaries.length === 0 && !requestPayrollId) {
      setSubmitError("Chưa có lịch phân ca để ước lượng.");
      setSaveMessage("");
      return false;
    }

    saveInFlight.current = true;
    failedDraft.current = "";
    setAutosaveError("");
    setSaving(true);
    setSubmitError("");
    setSaveMessage("");

    try {
      const existingSchedules = await getSavedEstimateSchedules(storeId, 1, normalizedRange);
      if (!isCurrent()) return false;
      if (existingSchedules.items.some(item => item.id !== requestPayrollId)) {
        const current = requestPayrollId ? await getSavedEstimateSchedule(storeId, requestPayrollId) : null;
        if (!isCurrent()) return false;
        if (!current || current.schedule.startDate !== normalizedRange.startDate || current.schedule.endDate !== normalizedRange.endDate) {
          throw new Error("Đã có lịch ước tính lương cho khoảng ngày này tại cửa hàng. Vui lòng mở lịch trong Lịch phân ca đã lưu để chỉnh sửa.");
        }
      }
      const payrollName = `Ước tính lương ${shortDateFormatter.format(
        parseDateKey(normalizedRange.startDate),
      )} - ${shortDateFormatter.format(parseDateKey(normalizedRange.endDate))}`;
      const includedByEmployee = new Map(displayedSummaries.map(item => [item.employeeKey, item]));
      const nextEntries = estimateSummaries.map((item) =>
        buildEstimateEntryPayload(
          item,
          normalizedRange.startDate,
          normalizedRange.endDate,
          includedByEmployee.get(item.employeeKey),
          shift => excludedBoards.has(getBoardKey(shift.role, visibleWeeksByDate.get(shift.date)!)),
        ),
      );

      if (requestPayrollId) {
        const currentEntries = await getPayrollEntries(requestPayrollId);
        if (!isCurrent()) return false;
        const currentEntryMap = new Map(
          currentEntries.map((entry) => [
            getEstimateEntryMatchKey(entry),
            entry,
          ]),
        );

        for (const entry of nextEntries) {
          const matchKey = getEstimateEntryMatchKey(entry);
          const existingEntry = currentEntryMap.get(matchKey);
          if (existingEntry?.id) {
            await updatePayrollEntry(existingEntry.id, entry);
            if (!isCurrent()) return false;
            currentEntryMap.delete(matchKey);
          } else {
            await addPayrollEntry(requestPayrollId, entry);
            if (!isCurrent()) return false;
          }
        }

        for (const entry of currentEntryMap.values()) {
          if (entry.id) {
            await deletePayrollEntry(entry.id);
            if (!isCurrent()) return false;
          }
        }

        await updatePayroll(requestPayrollId, {
          name: payrollName,
          startDate: normalizedRange.startDate,
          endDate: normalizedRange.endDate,
        });
        if (!isCurrent()) return false;

        if (!automatic) setSaveMessage("Đã cập nhật bản ước tính hiện tại.");
      } else {
        const payrollId = await saveImportedPayroll({
          source: "payroll_estimate",
          storeId,
          name: payrollName,
          startDate: normalizedRange.startDate,
          endDate: normalizedRange.endDate,
          entries: nextEntries,
        });

        if (!isCurrent()) return false;
        editingIdRef.current = payrollId;
        loadedScheduleKey.current = `${storeId}:${payrollId}:${openSavedRevision}`;
        setEditingPayrollId(payrollId);
        router.replace(
          `/payroll-estimate?payrollId=${encodeURIComponent(payrollId)}`,
        );
        if (!automatic) setSaveMessage("Đã lưu bản ước tính và có thể mở lại để sửa tiếp.");
      }

      setSavedSchedulesRevision(value => value + 1);
      savedDraft.current = draft;
      return true;
    } catch (error) {
      if (!isCurrent()) return false;
      console.error(error);
      // Entry mutations can succeed before a later request fails. Force the
      // next edit/retry to reconcile even when it restores the previous draft.
      if (requestPayrollId) savedDraft.current = "";
      const message = error instanceof Error ? error.message : "Không thể lưu bản ước tính.";
      failedDraft.current = draft;
      setAutosaveError(message);
      if (!automatic) setSubmitError(message);
      return false;
    } finally {
      saveInFlight.current = false;
      setSaving(false);
      setSaveTick(value => value + 1);
    }
  }

  const currentDraft = JSON.stringify({ schedule, range: normalizedRange, excludedBoards: Array.from(excludedBoards).sort() });
  const hasSchedule = Boolean(editingPayrollId) || estimateSummaries.length > 0;
  const hasUnsavedChanges = hasSchedule && currentDraft !== savedDraft.current;

  async function toggleDayLock(date: string) {
    if (!canViewMonthlyDailySalary || !storeId || dayLocks?.storeId !== storeId
      || updatingDayLock || saveInFlight.current || loadingSavedEstimate || hasUnsavedChanges) return;
    setUpdatingDayLock(true);
    setSubmitError("");
    try {
      const { dates } = await setEstimateDayLock(storeId, date, !lockedDates.has(date));
      if (activeStore.current === storeId) setDayLocks({ storeId, dates });
    } catch (error) {
      if (activeStore.current === storeId) {
        setSubmitError(error instanceof Error ? error.message : "Không cập nhật được trạng thái khóa ngày.");
      }
    } finally {
      setUpdatingDayLock(false);
    }
  }
  saveLatest.current = () => handleSaveEstimate(true);
  useEffect(() => {
    const requestedKey = `${storeId}:${queryPayrollId}:${openSavedRevision}`;
    if (loading || !user || !storeId || saving || loadingSavedEstimate || employeesLoading || rolesLoading || loadError ||
      (queryPayrollId && loadedScheduleKey.current !== requestedKey) || !hasUnsavedChanges || failedDraft.current === currentDraft) return;
    setAutosaveError("");
    const timer = window.setTimeout(() => void saveLatest.current(), 1000);
    return () => window.clearTimeout(timer);
  }, [currentDraft, hasUnsavedChanges, saving, loading, user?.id, storeId, loadingSavedEstimate, employeesLoading, rolesLoading, loadError, queryPayrollId, openSavedRevision, saveTick]);

  useEffect(() => {
    if (!hasUnsavedChanges && !saving) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedChanges, saving]);

  if (loading || !user || !storeId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-700" />
      </div>
    );
  }

  return (
    <div className="min-h-full min-w-0 bg-slate-50/80">
      <div className="mx-auto w-full min-w-0 max-w-[1800px] space-y-5 p-3 sm:p-5 lg:p-6 2xl:px-8">
        <header className="border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-5 2xl:flex-row 2xl:flex-wrap 2xl:items-end 2xl:justify-between">
            <div>
              {canAccessPayroll ? (
                <Link href="/payroll" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                  <ArrowLeft className="h-4 w-4" />
                  Về tính lương
                </Link>
              ) : null}
              <h1 className="font-smooch text-4xl font-bold leading-none text-emerald-800 sm:text-5xl">
                Lịch phân ca và ước tính lương
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold text-[#b89220]">
                Xếp lịch theo ca, theo dõi giờ làm và dự tính chi phí lương tại {storeName}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                {SHIFT_DEFINITIONS.map((shift) => (
                  <span key={shift.id} className="rounded-md border border-slate-200 bg-white px-2.5 py-1">
                    {shift.label} · {shift.hours} giờ
                  </span>
                ))}
              </div>
            </div>

            <div className={cn("min-w-0 grid-cols-3 gap-2 sm:flex-wrap sm:items-end sm:self-end xl:shrink-0", workspaceView === "saved" ? "hidden" : "grid sm:flex")}>
              <DateRangePicker
                label="Khoảng ngày"
                startDate={range.startDate}
                endDate={range.endDate}
                onChange={(startDate, endDate) => setRange({ startDate, endDate })}
                disabled={saving || loadingSavedEstimate}
                className="col-span-3 w-full sm:w-80"
                triggerClassName="h-11 rounded-lg border-slate-200 bg-white text-emerald-900 shadow-sm hover:border-[#064E3B] focus-visible:border-[#064E3B] focus-visible:ring-0 sm:h-10 [&_svg]:text-emerald-800"
                openTriggerClassName="!border-emerald-800 !ring-0"
              />
              <Button
                variant="outline"
                className={WEEK_SHORTCUT_BUTTON_CLASS}
                onClick={handleCreateSchedule}
                disabled={saving || loadingSavedEstimate}
              >
                <Plus className="h-4 w-4" />
                Tạo lịch mới
              </Button>
              <Button
                variant="outline"
                className={WEEK_SHORTCUT_BUTTON_CLASS}
                onClick={handleApplyCurrentWeek}
                disabled={saving || loadingSavedEstimate}
              >
                <CalendarDays className="h-4 w-4" />
                Tuần này
              </Button>
              <Button
                variant="outline"
                className={WEEK_SHORTCUT_BUTTON_CLASS}
                onClick={handleApplyNextWeek}
                disabled={saving || loadingSavedEstimate}
              >
                <CalendarRange className="h-4 w-4" />
                Tuần sau
              </Button>
            </div>
          </div>
        </header>

        <div className="space-y-5">
          <div className="space-y-5">
            <section aria-labelledby="estimate-overview" className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-sky-900/10", workspaceView === "saved" && "hidden")}>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/60 p-4">
                <div className="flex items-center gap-3">
                  <ChartNoAxesColumnIncreasing className="size-7 shrink-0 text-sky-700" aria-hidden="true" />
                  <div>
                    <h2 id="estimate-overview" className="text-lg font-bold text-slate-950">Tổng quan ước tính lương</h2>
                    <p className="mt-0.5 text-sm text-slate-600">Chi phí lương, nhân sự và giờ làm theo vai trò.</p>
                  </div>
                </div>
                <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                  {workspaceView === "schedule" && (
                    <SelectBox
                      ariaLabel="Lọc theo ngày"
                      className="w-full min-w-0 sm:w-44"
                      triggerClassName="h-11 rounded-xl border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 hover:border-sky-700 hover:bg-white focus-visible:border-sky-700 [&_svg:first-child]:text-sky-700"
                      openTriggerClassName="!border-sky-700"
                      value={filteredDate}
                      options={[
                        { value: "", label: "Tất cả ngày", icon: CalendarDays },
                        ...Array.from(visibleWeeksByDate.keys(), date => ({
                          value: date,
                          label: fullDateFormatter.format(parseDateKey(date)),
                          icon: CalendarDays,
                        })),
                      ]}
                      onValueChange={date => {
                        setDateFilter(date);
                        setActiveCell(null);
                      }}
                    />
                  )}
                  <div className="w-full min-w-0 sm:w-36">
                    <SelectBox
                      value={selectedRole}
                      options={roleOptions}
                      onValueChange={setSelectedRole}
                      ariaLabel="Chọn vai trò phân ca và tổng hợp nhân viên"
                      disabled={saving || loadingSavedEstimate}
                      className="w-full"
                      triggerClassName="h-11 rounded-xl border-slate-200 bg-white px-3 text-sm font-bold text-slate-950 hover:border-sky-700 hover:bg-white focus-visible:border-sky-700 [&_svg:first-child]:text-sky-700"
                      openTriggerClassName="!border-sky-700"
                    />
                  </div>
                  <Button
                    className="h-11 gap-2 rounded-xl bg-sky-950 px-3 text-sm font-semibold text-white hover:bg-sky-900"
                    disabled={!selectedRole || displayedScheduleRoles.includes(selectedRole) || saving || loadingSavedEstimate || employeesLoading}
                    onClick={() => {
                      if (!selectedRole || displayedScheduleRoles.includes(selectedRole)) return;
                      pendingBoardRole.current = selectedRole;
                      setScheduleBoardRoles(current => [...current, selectedRole]);
                      setWorkspaceView("schedule");
                    }}
                  >
                    <Plus className="h-4 w-4" />Thêm lịch phân ca
                  </Button>

                  {/* <Button
                    variant="outline"
                    className="h-11 gap-2 rounded-2xl"
                    onClick={() => {
                      if (estimateSummaries.length === 0) return;
                      if (
                        !confirm(
                          "Xóa toàn bộ lịch đang hiển thị trong khoảng ngày đã chọn?",
                        )
                      ) {
                        return;
                      }
                      clearDateCollection(Array.from(visibleWeeksByDate.keys()));
                    }}
                    disabled={estimateSummaries.length === 0}
                  >
                    <Eraser className="h-4 w-4" />
                    Xóa lịch
                  </Button> */}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-[repeat(auto-fit,minmax(125px,1fr))]">
                {[
                  {
                    role: "Tổng tiền",
                    employees: overviewSummaries.length,
                    totalHours,
                    totalSalary: totalEstimate,
                  },
                  ...displayedRoleTotals,
                ].map((item, index) => {
                  const isTotal = index === 0;
                  const { icon: Icon, color } = isTotal
                    ? { icon: Wallet, color: "bg-white/20 text-white" }
                    : ROLE_OVERVIEW_STYLES[item.role as keyof typeof ROLE_OVERVIEW_STYLES]
                      ?? { icon: Users, color: "bg-slate-100 text-slate-700" };
                  return (
                    <div key={isTotal ? "overview-total" : item.role} className={cn(
                      "relative isolate flex min-w-0 flex-col overflow-hidden rounded-xl border px-3 pb-7 pt-3",
                      isTotal ? "border-sky-800 bg-gradient-to-br from-sky-700 to-sky-950 text-white" : "border-slate-200 bg-white text-slate-950",
                    )}>
                      <div className="flex min-h-9 items-center gap-2 text-xs font-semibold">
                        <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", color)}>
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span>{item.role}</span>
                      </div>
                      <p className="mb-3 mt-2 break-words text-base font-bold tabular-nums xl:text-lg">{formatCurrency(item.totalSalary)}</p>
                      <div className={cn("mt-auto flex flex-wrap gap-x-2 gap-y-1 border-t pt-2 text-xs tabular-nums", isTotal ? "border-white/35 text-white" : "border-slate-100 text-slate-600")}>
                        <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden="true" />{item.employees} người</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" aria-hidden="true" />{formatHours(item.totalHours)}</span>
                      </div>
                      <svg aria-hidden="true" viewBox="0 0 160 42" preserveAspectRatio="none" className={cn("pointer-events-none absolute bottom-0 right-0 -z-10 h-8 w-3/4 fill-current", isTotal ? "text-sky-300/25" : "text-sky-100/70")}>
                        <path d="M0 42C35 42 46 20 76 25S123 5 160 0V42Z" />
                      </svg>
                    </div>
                  );
                })}
              </div>
            </section>

            <nav
              className="grid grid-cols-3 gap-1 border-b border-slate-200 bg-slate-50 sm:flex"
              aria-label="Nội dung ước lượng lương"
            >
              <button
                type="button"
                onClick={() => setWorkspaceView("schedule")}
                aria-current={workspaceView === "schedule" ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-12 min-w-0 items-center justify-center gap-1 rounded border-b-2 px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-inset sm:h-12 sm:shrink-0 sm:gap-2 sm:px-4 sm:text-sm",
                  workspaceView === "schedule"
                    ? "border-[#E1B23D] bg-[#064E3B] text-[#F6C85F]"
                    : "border-transparent text-slate-500 hover:bg-white hover:text-slate-800",
                )}
              >
                <CalendarRange className="h-4 w-4" aria-hidden="true" />
                Lịch phân ca
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceView("summary")}
                aria-label="Tổng hợp nhân viên"
                aria-current={workspaceView === "summary" ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-12 min-w-0 items-center justify-center gap-1 border-b-2 px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-inset sm:h-12 sm:shrink-0 sm:gap-2 sm:px-4 sm:text-sm",
                  workspaceView === "summary"
                    ? "border-[#E1B23D] bg-[#064E3B] text-[#F6C85F]"
                    : "border-transparent text-slate-500 hover:bg-white hover:text-slate-800",
                )}
              >
                <Users className="hidden h-4 w-4 sm:block" aria-hidden="true" />
                <span className="sm:hidden">Nhân viên</span><span className="hidden sm:inline">Tổng hợp nhân viên</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px]",
                    workspaceView === "summary"
                      ? "bg-[#F6C85F] text-[#064E3B]"
                      : "bg-slate-200 text-slate-700",
                  )}
                >
                  {selectedRoleSummaries.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceView("saved")}
                aria-label="Lịch phân ca đã lưu"
                aria-current={workspaceView === "saved" ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-12 min-w-0 items-center justify-center gap-1 border-b-2 px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-inset sm:h-12 sm:shrink-0 sm:gap-2 sm:px-4 sm:text-sm",
                  workspaceView === "saved"
                    ? "border-[#E1B23D] bg-[#064E3B] text-[#F6C85F]"
                    : "border-transparent text-slate-500 hover:border-[#064E3B] hover:bg-white hover:text-[#064E3B]",
                )}
              >
                <History className="hidden h-4 w-4 sm:block" aria-hidden="true" />
                <span className="sm:hidden">Đã lưu</span><span className="hidden sm:inline">Lịch phân ca đã lưu</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px]",
                    workspaceView === "saved"
                      ? "bg-[#F6C85F] text-[#064E3B]"
                      : "bg-slate-200 text-slate-700",
                  )}
                >
                  {savedSchedulesCount?.storeId === storeId ? savedSchedulesCount.total : "—"}
                </span>
              </button>
            </nav>

            <div className="flex flex-wrap items-center gap-2 text-sm" role="status" aria-live="polite" data-autosave-status>
              <span className={autosaveError ? "text-red-700" : "text-slate-500"}>
                {saving ? "Đang lưu lịch…" : autosaveError ? `Chưa lưu được: ${autosaveError}` : hasUnsavedChanges ? "Có thay đổi · Sẽ tự động lưu…" : hasSchedule ? "Đã lưu lịch" : "Lịch sẽ tự động lưu khi bạn phân ca."}
              </span>
              {autosaveError && <Button variant="outline" size="sm" disabled={saving || loadingSavedEstimate} onClick={() => void handleSaveEstimate()}>Thử lưu lại</Button>}
            </div>

            {workspaceView === "saved" && <SavedEstimateSchedules
              key={storeId}
              storeId={storeId}
              revision={savedSchedulesRevision}
              initialRange={normalizedRange}
              onCreate={handleCreateSchedule}
              onRefresh={() => setSavedSchedulesRevision(value => value + 1)}
              opening={loadingSavedEstimate || saving}
              onDeleted={(id) => {
                if (id !== editingPayrollId && id !== queryPayrollId) return;
                saveGeneration.current += 1;
                editingIdRef.current = "";
                loadedScheduleKey.current = "";
                failedDraft.current = "";
                savedDraft.current = "";
                setAutosaveError("");
                setEditingPayrollId("");
                setSchedule({});
                setExcludedBoards(new Set());
                setSavedEmployees([]);
                setScheduleBoardRoles(selectedRole ? [selectedRole] : []);
                setActiveCell(null);
                setSaveMessage("");
                router.replace("/payroll-estimate");
              }}
              onOpen={(id) => {
                setActiveCell(null);
                setWorkspaceView("schedule");
                if (id === queryPayrollId) setOpenSavedRevision(value => value + 1);
                else router.replace(`/payroll-estimate?payrollId=${encodeURIComponent(id)}`);
              }}
            />}

            <div className={workspaceView === "schedule" ? "space-y-5" : "hidden"}>
            {employeesLoading ? (
              <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-14 text-center text-slate-500 shadow-sm">
                Đang tải nhân viên...
              </div>
            ) : supportedEmployees.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">
                  Chưa có nhân viên phù hợp để xếp lịch
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Trang này đang chia lịch cho {estimateRoles.length} vai trò: {" "}
                  {estimateRoles.join(", ")}. Hãy kiểm tra lại vai trò trong mục
                  Nhân sự nếu cần.
                </p>
              </div>
            ) : displayedScheduleRoles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center">
                <h2 className="font-semibold text-slate-900">Chưa có bảng lịch phân ca</h2>
                <p className="mt-2 text-sm text-slate-500">Chọn vai trò ở trên và bấm Thêm lịch phân ca để bắt đầu.</p>
                {editingPayrollId && <Button className="mt-4 gap-2 bg-[#F6C85F] text-[#064E3B] hover:bg-[#E1B23D]" isLoading={saving} disabled={saving || loadingSavedEstimate || Boolean(loadError)} onClick={() => void handleSaveEstimate()}>
                  <Save className="h-4 w-4" />Lưu ước tính
                </Button>}
              </div>
            ) : (
              displayedScheduleRoles.flatMap(role => displayedWeeks.map((week,weekIndex) => (
                <section key={`${role}-${week.key}`} id={weekIndex === 0 ? `estimate-board-${encodeURIComponent(role)}` : undefined} tabIndex={-1} aria-label={`Lịch phân ca ${role}, ${week.label}`} className="scroll-mt-5 space-y-4 focus:outline-none">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    {/* <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Tuần
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                        {week.label}
                      </h2>
                    </div> */}

                    {/* <Button
                      variant="outline"
                      className="h-11 gap-2 rounded-2xl"
                      onClick={() => {
                        const weekDates = week.days
                          .filter((day) => day.inRange)
                          .map((day) => day.date);
                        if (weekDates.length === 0) return;
                        if (!confirm("Xóa toàn bộ lịch của tuần này?")) return;
                        clearDateCollection(weekDates);
                      }}
                    >
                      <Eraser className="h-4 w-4" />
                      Xóa tuần này
                    </Button> */}
                  </div>

                  <RoleScheduleTable
                    filterDate={filteredDate}
                    dailyRoleEstimates={excludedBoards.has(getBoardKey(role, week.key))
                      ? dailyRoleEstimates : displayedDailyRoleEstimates}
                    includedInTotals={!excludedBoards.has(getBoardKey(role, week.key))}
                    onToggleIncludedInTotals={() => toggleBoardInTotals(role, week.key)}
                    activeCell={activeCell}
                    employeeByKey={employeeByKey}
                    lockedDates={lockedDates}
                    onToggleDayLock={canViewMonthlyDailySalary ? toggleDayLock : undefined}
                    lockDisabled={dayLocks?.storeId !== storeId || updatingDayLock || saving || loadingSavedEstimate || hasUnsavedChanges}
                    onRemoveEmployee={removeEmployeeFromCell}
                    onDelete={() => { if (!saving && !loadingSavedEstimate) setPendingDeleteRole(role); }}
                    onSave={() => void handleSaveEstimate()}
                    onSelectCell={handleSelectScheduleCell}
                    saveDisabled={(!editingPayrollId && estimateSummaries.length === 0) || loadingSavedEstimate || employeesLoading || Boolean(loadError)}
                    saving={saving}
                    role={role}
                    schedule={schedule}
                    week={week}
                  />
                </section>
              )))
            )}
            </div>
          </div>

          <aside className={workspaceView === "summary" ? "block min-w-0" : "hidden"}>
            <section hidden className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Trình chỉnh ô
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    {activeCell ? "Chọn người" : "Chọn một ô"}
                  </h2>
                </div>
                {activeCell ? (
                  <button
                    type="button"
                    className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                    onClick={() => setActiveCell(null)}
                    aria-label="Đóng trình chỉnh"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {activeCell && activeShift ? (
                <>
                  <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                        {activeCell.role}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          SHIFT_THEME[activeShift.id].badge,
                        )}
                      >
                        {activeShift.label} • {activeShift.hours} giờ
                      </span>
                    </div>
                    <div className="mt-3 text-sm font-medium text-slate-900">
                      {longDateFormatter.format(parseDateKey(activeCell.date))}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {activeSelection.length} người •{" "}
                      {formatHours(activeSelection.length * activeShift.hours)}
                    </div>
                  </div>

                  <div className="mt-4">
                    <Input
                      value={cellSearch}
                      onChange={(event) => setCellSearch(event.target.value)}
                      placeholder="Tìm tên hoặc mã"
                      className="h-11 rounded-2xl border-slate-200 bg-slate-50"
                    />
                  </div>

                  <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {filteredActiveEmployees.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        Không có nhân viên phù hợp với ô đang chọn.
                      </div>
                    ) : (
                      filteredActiveEmployees.map((employee) => {
                        const employeeKey = getEmployeeKey(employee);
                        const selected = activeSelection.includes(employeeKey);
                        const fixedSalary = isFixedSalaryEmployee(employee);
                        const shiftCost = getEstimatedHourlyRate(employee) * activeShift.hours;

                        return (
                          <button
                            key={employeeKey}
                            type="button"
                            onClick={() =>
                              toggleEmployeeInActiveCell(employeeKey)
                            }
                            className={cn(
                              "flex w-full items-center justify-between rounded-[22px] border px-4 py-3 text-left transition",
                              selected
                                ? "border-emerald-300 bg-emerald-50"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="truncate font-semibold text-slate-900"
                                  title={employee.name}
                                >
                                  {employee.name}
                                </span>
                                {canScheduleAcrossCafeAndKitchen && <span className="shrink-0 text-xs font-normal text-slate-500">{getEstimateEmployeeStoreLabel(employee)}</span>}
                                {selected ? (
                                  <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                                    Đã chọn
                                  </span>
                                ) : null}
                              </div>
                              {!fixedSalary ? (
                                <div className="mt-1 text-sm text-slate-500">
                                  {formatCurrency(employee.hourlyRate || 0)}/giờ
                                </div>
                              ) : canViewMonthlyDailySalary ? (
                                <div className="mt-1 text-sm text-slate-500">
                                  {formatCurrency(Math.max(0, employee.monthlySalary || 0) / 30)}/ngày
                                </div>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-3">
                              {fixedSalary ? (
                                <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                                  Lương tháng
                                </div>
                              ) : (
                                <div className="text-right">
                                  <div className="text-sm font-semibold text-slate-900">
                                    {formatCurrency(shiftCost)}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    Chi phí cho ca này
                                  </div>
                                </div>
                              )}
                              <div
                                className={cn(
                                  "flex h-9 w-9 items-center justify-center rounded-full border",
                                  selected
                                    ? "border-emerald-600 bg-emerald-600 text-white"
                                    : "border-slate-200 bg-white text-slate-400",
                                )}
                              >
                                <Check className="h-4 w-4" />
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4 flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 rounded-2xl"
                      onClick={() => clearCell(activeCell)}
                      disabled={activeSelection.length === 0}
                    >
                      Xóa ô này
                    </Button>
                    <Button
                      className="flex-1 rounded-2xl"
                      onClick={() => setActiveCell(null)}
                    >
                      Xong
                    </Button>
                  </div>
                </>
              ) : (
                <div className="mt-6 rounded-[22px] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                  Bấm vào một ô trong bảng để thêm, bỏ hoặc sửa danh sách nhân
                  viên cho ca đó.
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-[5px_7px_12px_rgba(15,23,42,0.16)]">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-base font-bold text-slate-900">Tổng hợp nhân viên</h2>
                <p className="mt-0.5 text-xs text-slate-500">{selectedRole} · {selectedRoleSummaries.length} người</p>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {selectedRoleSummaries.length === 0 ? (
                  <div className="flex min-h-44 flex-col items-center justify-center px-5 py-8 text-center sm:col-span-2 xl:col-span-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Users className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-slate-800">Chưa xếp nhân viên</h3>
                    <p className="mt-1 max-w-52 text-xs leading-5 text-slate-500">
                      Chọn một ô trong lịch để thêm nhân viên vào ca làm.
                    </p>
                  </div>
                ) : (
                  selectedRoleSummaries.map((item) => {
                    const fixedSalary = isFixedSalaryEmployee(item.employee);
                    return (
                      <div
                        key={item.employeeKey}
                        className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50/30"
                      >
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 sm:flex-1">
                          <div
                            className="break-words font-semibold text-slate-900 sm:truncate"
                            title={item.employee.name}
                          >
                            {item.employee.name}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {item.assignedRoles.join(", ")}
                            {!fixedSalary ? (
                              <> • {formatCurrency(item.employee.hourlyRate || 0)}/giờ</>
                            ) : canViewMonthlyDailySalary ? (
                              <> • {formatCurrency(Math.max(0, item.employee.monthlySalary || 0) / 30)}/ngày</>
                            ) : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                          {!fixedSalary ? (
                            <div className="font-semibold text-emerald-700">
                              {formatCurrency(item.totalSalary)}
                            </div>
                          ) : null}
                          <div className="text-xs text-slate-400">
                            {item.shiftCount} ca
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-slate-500">
                        {formatHours(item.totalHours)}
                      </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </aside>
        </div>

        <Toast
          open={Boolean(loadError || submitError || saveMessage)}
          title={loadError || submitError ? "Không thể hoàn tất" : "Đã lưu bản ước tính"}
          description={loadError || submitError || saveMessage}
          variant={loadError || submitError ? "error" : "success"}
          onDismiss={() => {
            setLoadError("");
            setSubmitError("");
            setSaveMessage("");
          }}
        />

        {activeCell && activeShift && typeof document !== "undefined"
          ? createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[2px] sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-picker-title"
          >
            <div className="flex max-h-[calc(100dvh-24px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.3)] sm:max-h-[min(780px,calc(100dvh-40px))]">
              <div className="shrink-0 border-b border-slate-200 px-4 py-4 sm:px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                      Xếp lịch làm việc
                    </p>
                    <h2 id="employee-picker-title" className="mt-1 text-lg font-bold text-slate-950">
                      Chọn nhân viên
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    onClick={() => setActiveCell(null)}
                    aria-label="Đóng popup"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                  <span className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                    {activeCell.role}
                  </span>
                  <span className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", SHIFT_THEME[activeShift.id].badge)}>
                    {activeShift.label} · {activeShift.hours} giờ
                  </span>
                  <span className="font-medium text-slate-700">
                    {longDateFormatter.format(parseDateKey(activeCell.date))}
                  </span>
                  <span className="ml-auto font-semibold text-emerald-700">
                    {activeSelection.length} đã chọn
                  </span>
                </div>
              </div>

              <div className="shrink-0 border-b border-slate-100 bg-white px-4 py-3 sm:px-5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <Input
                    value={cellSearch}
                    onChange={(event) => setCellSearch(event.target.value)}
                    placeholder="Tìm theo tên hoặc mã nhân viên"
                    className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-10 pr-10 text-base sm:h-10 sm:text-sm focus:bg-white"
                    autoFocus
                  />
                  {cellSearch ? (
                    <button
                      type="button"
                      onClick={() => setCellSearch("")}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                      aria-label="Xóa nội dung tìm kiếm"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {filteredActiveEmployees.length} nhân viên phù hợp
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
                <div className="space-y-2">
                  {filteredActiveEmployees.length === 0 ? (
                    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm">
                        <Users className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-800">Không tìm thấy nhân viên</p>
                      <p className="mt-1 text-xs text-slate-500">Thử tìm bằng tên hoặc mã khác.</p>
                    </div>
                  ) : (
                    filteredActiveEmployees.map((employee) => {
                      const employeeKey = getEmployeeKey(employee);
                      const selected = activeSelection.includes(employeeKey);
                      const fixedSalary = isFixedSalaryEmployee(employee);
                      const shiftCost = getEstimatedHourlyRate(employee) * activeShift.hours;

                      return (
                        <button
                          key={employeeKey}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            toggleEmployeeInActiveCell(employeeKey)
                          }
                          className={cn(
                            "group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:flex",
                            selected
                              ? "border-emerald-300 bg-emerald-50/80"
                              : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50",
                          )}
                        >
                          <div className={cn(
                            "hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xs font-bold sm:flex",
                            selected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600",
                          )}>
                            {employee.name.trim().slice(0, 2).toLocaleUpperCase("vi-VN")}
                          </div>
                          <div className="col-span-2 min-w-0 sm:flex-1">
                            <span className="block break-words text-sm font-semibold text-slate-900 sm:truncate" title={employee.name}>
                              {employee.name}
                            </span>
                            {canScheduleAcrossCafeAndKitchen && <div className="mt-0.5 text-xs text-slate-500">{getEstimateEmployeeStoreLabel(employee)}</div>}
                            {!fixedSalary ? (
                              <div className="mt-0.5 truncate text-xs text-slate-500">
                                {formatCurrency(employee.hourlyRate || 0)}/giờ
                              </div>
                            ) : canViewMonthlyDailySalary ? (
                              <div className="mt-0.5 truncate text-xs text-slate-500">
                                {formatCurrency(Math.max(0, employee.monthlySalary || 0) / 30)}/ngày
                              </div>
                            ) : null}
                          </div>
                          <div className="col-span-2 flex shrink-0 items-center justify-between gap-3 border-t border-slate-200/70 pt-2 sm:justify-start sm:border-0 sm:pt-0">
                            {fixedSalary ? (
                              <div className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                                Lương tháng
                              </div>
                            ) : (
                              <div className="text-left sm:text-right">
                                <div className="text-sm font-bold text-slate-900">
                                  {formatCurrency(shiftCost)}
                                </div>
                                <div className="text-[11px] text-slate-400">Chi phí ca</div>
                              </div>
                            )}
                            <div
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg border transition",
                                selected
                                  ? "border-emerald-600 bg-emerald-600 text-white"
                                  : "border-slate-200 bg-white text-slate-300 group-hover:border-emerald-300 group-hover:text-emerald-600",
                              )}
                            >
                              <Check className="h-4 w-4" />
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Ca đang chọn</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">
                      {activeSelection.length} người · {formatHours(activeSelection.length * activeShift.hours)}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      className="h-11 rounded-lg px-3 text-sm sm:h-9 sm:text-xs"
                      onClick={() => clearCell(activeCell)}
                      disabled={activeSelection.length === 0}
                    >
                      Xóa lựa chọn
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 rounded-lg px-4 text-sm sm:h-9 sm:text-xs"
                      onClick={() => setActiveCell(null)}
                    >
                      Đóng
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        ) : null}
        <ConfirmDialog
          open={pendingDeleteRole !== null}
          title={`Xoá lịch phân ca ${pendingDeleteRole ?? ""}?`}
          description="Tất cả phân ca của vai trò này trong bản đang chỉnh sẽ bị bỏ. Các vai trò khác được giữ nguyên. Thay đổi sẽ được tự động lưu."
          confirmLabel="Xoá lịch"
          cancelLabel="Huỷ"
          variant="destructive"
          onConfirm={deleteRoleSchedule}
          onCancel={() => setPendingDeleteRole(null)}
        />
        <ConfirmDialog
          open={confirmNewSchedule}
          title="Tạo lịch phân ca mới?"
          description="Lịch hiện tại có thay đổi chưa lưu. Tạo lịch mới sẽ bỏ các thay đổi này và giữ nguyên khoảng ngày đang chọn."
          confirmLabel="Tạo lịch mới"
          cancelLabel="Quay lại"
          onConfirm={createNewSchedule}
          onCancel={() => setConfirmNewSchedule(false)}
        />
      </div>
    </div>
  );
}
