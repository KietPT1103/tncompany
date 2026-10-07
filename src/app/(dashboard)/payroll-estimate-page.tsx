"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  getPayrollEntries,
  getSavedEstimateSchedule,
  getSavedEstimateSchedules,
  type PayrollEntry,
  saveImportedPayroll,
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
import { SavedEstimateSchedules } from "./payroll/_components/SavedEstimateSchedules";
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  History,
  Check,
  Clock3,
  ImageDown,
  Loader2,
  Plus,
  Search,
  Save,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";

const CAFE_ESTIMATE_ROLES = ["Thu ngân", "Phục vụ", "Pha chế"];
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
  "h-10 self-end gap-2 rounded-lg border-slate-200 bg-white px-3.5 text-xs font-semibold text-[#064E3B] shadow-sm transition-[background-color,border-color,box-shadow,color,transform] duration-150 hover:border-[#064E3B] hover:bg-emerald-50/70 hover:text-[#064E3B] hover:shadow-md focus-visible:border-[#D6A621] focus-visible:ring-[#E1B23D]/35 active:scale-[0.97] [&_svg]:text-[#064E3B]";

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
    role?: string;
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
  return `${currencyFormatter.format(Math.round(value))} đ`;
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

function getEmployeeKey(employee: Employee) {
  return employee.id || employee.employeeCode || employee.name;
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

function getShiftIdFromStoredShift(shift: EstimateSummary["shifts"][number]) {
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
): Partial<PayrollEntry> {
  const salaryType = resolveEmployeeSalaryType(item.employee);
  const isMonthly = salaryType === "monthly";

  return {
    employeeId: item.employee.id || `manual_${item.employeeKey}`,
    employeeCode: item.employee.employeeCode || "",
    employeeName: item.employee.name,
    role: item.assignedRoles[0] || item.employee.role,
    hourlyRate: isMonthly ? 0 : item.employee.hourlyRate || 0,
    totalHours: item.totalHours,
    weekendHours: 0,
    salary: isMonthly ? 0 : item.totalSalary,
    allowances: [],
    note: `Ước tính từ lịch phân ca ${startDate} đến ${endDate}`,
    salaryType,
    fixedSalary: isMonthly ? item.employee.monthlySalary || 0 : 0,
    standardHours: isMonthly ? item.employee.standardHours || 0 : 0,
    shifts: item.shifts,
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
    shifts?: EstimateSummary["shifts"];
  }>,
  employees: Employee[],
  estimateRoles: string[],
) {
  const schedule: ScheduleState = {};
  let minDate = "";
  let maxDate = "";
  let suggestedRole: EstimateRole | null = null;

  entries.forEach((entry) => {
    const matchedEmployee = employees.find((employee) => {
      if (entry.employeeId && employee.id && entry.employeeId === employee.id) {
        return true;
      }

      const entryCode = (entry.employeeCode || "").trim().toLowerCase();
      const employeeCode = (employee.employeeCode || "").trim().toLowerCase();
      if (entryCode && employeeCode && entryCode === employeeCode) {
        return true;
      }

      return (
        employee.name.trim().toLowerCase() ===
        entry.employeeName.trim().toLowerCase()
      );
    });

    if (!matchedEmployee) return;

    const employeeKey = getEmployeeKey(matchedEmployee);
    (entry.shifts || []).forEach((shift) => {
      if (!shift.isValid) return;
      const role = shift.role || entry.role;
      if (!estimateRoles.includes(role)) return;
      const shiftId = getShiftIdFromStoredShift(shift);
      if (!shiftId) return;

      const date = normalizeStoredShiftDate(
        shift.date || shift.inTime.slice(0, 10),
      );
      if (!date) return;

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
    startDate: minDate,
    endDate: maxDate,
    selectedRole: suggestedRole,
  };
}

function RoleScheduleTable({
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
  activeCell: ActiveCell | null;
  employeeByKey: Map<string, Employee>;
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
  const captureKey = `${role}__${week.key}`;
  const [captureStatus, setCaptureStatus] = useState<"idle" | "capturing" | "done" | "error">("idle");

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
      );
      const captureHeight = section.scrollHeight;
      const canvas = await html2canvas(section, {
        backgroundColor: "#ffffff",
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        width: captureWidth + 4,
        height: captureHeight + 4,
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
              element.style.whiteSpace = "nowrap";
              element.style.lineHeight = "20px";
              element.style.height = "20px";
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
      link.download = `lich-phan-ca-${sanitizeFileName(role)}-${week.days[0].date}-${week.days[week.days.length - 1].date}.png`;
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
      className="overflow-hidden rounded border border-slate-200 bg-white shadow-[5px_7px_12px_rgba(15,23,42,0.16)]"
    >
      <div
        className={cn(
          "flex flex-col gap-4 border-b bg-gradient-to-r px-4 py-3 2xl:flex-row 2xl:items-center 2xl:justify-between",
          ROLE_THEME,
        )}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">Lịch phân ca</p>
          <h3 className="text-lg font-bold">{role}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-3" data-html2canvas-ignore="true">
            <Button
              type="button"
              variant="outline"
              className="h-12 gap-2 rounded-[3px] border-2 border-slate-950 bg-red-100 px-4 text-sm font-bold text-red-800 shadow-[5px_6px_0_#0F172A] transition-[background-color,box-shadow,transform] duration-150 hover:translate-x-px hover:translate-y-px hover:border-slate-950 hover:bg-red-200 hover:text-red-900 hover:shadow-[3px_4px_0_#0F172A] focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2 active:translate-x-[3px] active:translate-y-[4px] active:shadow-[1px_2px_0_#0F172A] disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[5px_6px_0_#0F172A]"
              disabled={saving}
              onClick={onDelete}
              aria-label={`Xoá lịch phân ca ${role}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />Xoá lịch
            </Button>
            <Button
              type="button"
              className="h-12 gap-2 rounded-[3px] border-2 border-slate-950 bg-[#F6C85F] px-4 text-sm font-bold text-[#064E3B] shadow-[5px_6px_0_#0F172A] transition-[background-color,box-shadow,transform] duration-150 hover:translate-x-px hover:translate-y-px hover:border-slate-950 hover:bg-[#E1B23D] hover:text-[#064E3B] hover:shadow-[3px_4px_0_#0F172A] focus-visible:ring-2 focus-visible:ring-[#064E3B] focus-visible:ring-offset-2 active:translate-x-[3px] active:translate-y-[4px] active:shadow-[1px_2px_0_#0F172A] disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[5px_6px_0_#0F172A]"
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
              className="h-12 gap-2 rounded-[3px] border-2 border-slate-950 bg-[#087A62] px-4 text-sm font-bold text-white shadow-[5px_6px_0_#0F172A] transition-[background-color,box-shadow,transform] duration-150 hover:translate-x-px hover:translate-y-px hover:border-slate-950 hover:bg-[#066B56] hover:text-white hover:shadow-[3px_4px_0_#0F172A] focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-2 active:translate-x-[3px] active:translate-y-[4px] active:shadow-[1px_2px_0_#0F172A] disabled:translate-x-0 disabled:translate-y-0 disabled:shadow-[5px_6px_0_#0F172A]"
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
          <div className="rounded border border-emerald-900/15 bg-white/75 px-3 py-2 text-right shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800/70">
              Khoảng ngày
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm font-bold tabular-nums text-emerald-950">
              <CalendarDays className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              <span>
                {fullDateFormatter.format(parseDateKey(week.days[0].date))}
                {" – "}
                {fullDateFormatter.format(
                  parseDateKey(week.days[week.days.length - 1].date),
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div data-schedule-scroll="true" className="overflow-x-auto">
        <table className="w-full min-w-[920px] table-fixed border-separate border-spacing-0 2xl:min-w-[1080px]">
          <thead className="bg-slate-50/80">
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
              <th className="sticky left-0 z-20 min-w-[110px] border-b border-r border-slate-200 bg-white px-3 py-3 2xl:min-w-[130px] 2xl:px-4 2xl:py-4">
                Ca
              </th>
              {week.days.map((day) => (
                <th
                  key={day.date}
                  className={cn(
                    "min-w-[115px] border-b border-slate-200 px-2.5 py-3 2xl:min-w-[135px] 2xl:px-3",
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
                    {day.shortDateLabel}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {SHIFT_DEFINITIONS.map((shift) => {
              const maxEmployeesInRow = Math.max(
                0,
                ...week.days.map(
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

                {week.days.map((day) => {
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
                      className={cn(
                        "h-full border-b border-slate-200 px-2 py-3 align-top",
                        !day.inRange && "bg-slate-50",
                      )}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectCell(cell)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelectCell(cell);
                          }
                        }}
                        className={cn(
                          "rounded-lg border bg-white p-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 2xl:p-2.5",
                          isActive
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50",
                        )}
                        style={{ height: synchronizedCellHeight }}
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
                                    className="min-w-0 flex-1 truncate text-xs font-semibold leading-5"
                                  >
                                    {employee.name}
                                  </span>
                                  <button
                                    type="button"
                                    className="mt-1 shrink-0 rounded-full text-slate-400 transition hover:text-rose-600"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onRemoveEmployee(cell, employeeKey);
                                    }}
                                    aria-label={`Xóa ${employee.name}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
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
  const { storeId, storeName } = useStore();
  const router = useRouter();
  const location = useLocation();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [schedule, setSchedule] = useState<ScheduleState>({});
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [cellSearch, setCellSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [editingPayrollId, setEditingPayrollId] = useState("");
  const [range, setRange] = useState(getCurrentWeekRange);
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
  const [managedEstimateRoles, setManagedEstimateRoles] = useState<string[]>([]);

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
        : getEstimateRolesForStore(storeId)
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

    getEmployees(storeId)
      .then((items) => {
        if (ignore) return;
        setEmployees(items);
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
    setManagedEstimateRoles([]);
    getEmployeeRoles(storeId)
      .then((items) => {
        if (!ignore) setManagedEstimateRoles(items.map((item) => item.name));
      })
      .catch((error) => console.error(error));
    return () => {
      ignore = true;
    };
  }, [storeId]);

  useEffect(() => {
    setSelectedRole(estimateRoles[0] || "");
    setActiveCell(null);
    setSchedule({});
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

  const visibleDateSet = useMemo(() => {
    const next = new Set<string>();
    weekSegments.forEach((segment) => {
      segment.days.forEach((day) => {
        if (day.inRange) next.add(day.date);
      });
    });
    return next;
  }, [weekSegments]);

  useEffect(() => {
    if (activeCell && !visibleDateSet.has(activeCell.date)) {
      setActiveCell(null);
    }
  }, [activeCell, visibleDateSet]);

  const supportedEmployees = useMemo(
    () =>
      employees
        .filter(
          (employee) =>
            getEmployeeRoleNames(employee).some((role) => estimateRoles.includes(role)),
        )
        .sort((left, right) => left.name.localeCompare(right.name, "vi")),
    [employees, estimateRoles],
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
    if (!queryPayrollId || supportedEmployees.length === 0) return;

    let ignore = false;
    setLoadingSavedEstimate(true);
    setSubmitError("");

    getSavedEstimateSchedule(storeId, queryPayrollId)
      .then(({ entries, schedule: savedSchedule }) => {
        if (ignore) return;
        const restored = buildScheduleFromEntries(
          entries,
          supportedEmployees,
          estimateRoles,
        );
        setSchedule(restored.schedule);
        savedDraft.current = JSON.stringify({ schedule: restored.schedule, range: {
          startDate: savedSchedule.startDate, endDate: savedSchedule.endDate,
        } });
        if (savedSchedule.startDate && savedSchedule.endDate) {
          setRange({
            startDate: savedSchedule.startDate,
            endDate: savedSchedule.endDate,
          });
        }
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
  }, [estimateRoles, queryPayrollId, supportedEmployees, storeId, openSavedRevision]);

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

  const estimateSummaries = useMemo(() => {
    const summaryMap = new Map<string, EstimateSummary>();

    visibleDateSet.forEach((date) => {
      estimateRoles.forEach((roleName) => {
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

    return Array.from(summaryMap.values()).sort((left, right) => {
      const roleDiff =
        getRoleOrder(left.assignedRoles[0] || left.employee.role, estimateRoles) -
        getRoleOrder(right.assignedRoles[0] || right.employee.role, estimateRoles);
      if (roleDiff !== 0) return roleDiff;
      return left.employee.name.localeCompare(right.employee.name, "vi");
    });
  }, [employeeByKey, estimateRoles, schedule, visibleDateSet]);

  const totalEstimate = estimateSummaries.reduce(
    (sum, item) => sum + item.totalSalary,
    0,
  );
  const totalHours = estimateSummaries.reduce(
    (sum, item) => sum + item.totalHours,
    0,
  );
  const totalsByRole = useMemo(() => {
    return estimateRoles.map((roleName) => {
      const entries = estimateSummaries.filter(
        (item) => item.assignedRoles.includes(roleName),
      );
      return {
        role: roleName,
        employees: entries.length,
        totalHours: entries.reduce((sum, item) => sum + (item.roleTotals[roleName]?.hours || 0), 0),
        totalSalary: entries.reduce((sum, item) => sum + (item.roleTotals[roleName]?.salary || 0), 0),
      };
    });
  }, [estimateRoles, estimateSummaries]);

  const selectedRoleTotal = totalsByRole.find(
    (item) => item.role === selectedRole,
  ) || {
    role: selectedRole,
    employees: 0,
    totalHours: 0,
    totalSalary: 0,
  };

  const selectedRoleSummaries = estimateSummaries.filter(
    (item) => item.assignedRoles.includes(selectedRole),
  );

  const activeCellEmployees = activeCell
    ? employeesByRole[activeCell.role] || []
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
    const keyword = cellSearch.trim().toLowerCase();
    if (!keyword) return true;

    return (
      employee.name.toLowerCase().includes(keyword) ||
      (employee.employeeCode || "").toLowerCase().includes(keyword)
    );
  });
  const canAccessPayroll = hasPermission(user, "payroll.access");

  function updateCellEmployees(
    cell: ActiveCell,
    updater: (current: string[]) => string[],
  ) {
    if (saving || loadingSavedEstimate) return;
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
    if (saving || loadingSavedEstimate) return;
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
    setSchedule({});
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
    const draft = JSON.stringify({ schedule, range: normalizedRange });
    if ((editingPayrollId || Object.values(schedule).some(employees => employees.length > 0)) && draft !== savedDraft.current) setConfirmNewSchedule(true);
    else createNewSchedule();
  }

  function deleteRoleSchedule() {
    if (!pendingDeleteRole || saving || loadingSavedEstimate) return;
    const remaining = displayedScheduleRoles.filter(role => role !== pendingDeleteRole);
    setSchedule(current => removeEstimateRole(current,pendingDeleteRole));
    setScheduleBoardRoles(remaining);
    if (selectedRole === pendingDeleteRole && remaining.length > 0) setSelectedRole(remaining[0]);
    setActiveCell(null);
    setSaveMessage("");
    setSubmitError("");
    setPendingDeleteRole(null);
  }

  async function handleSaveEstimate() {
    if (!storeId || saving || loadingSavedEstimate || employeesLoading || loadError) return false;

    if (estimateSummaries.length === 0 && !editingPayrollId) {
      setSubmitError("Chưa có lịch phân ca để ước lượng.");
      setSaveMessage("");
      return false;
    }

    setSaving(true);
    setSubmitError("");
    setSaveMessage("");

    try {
      const payrollName = `Ước tính lương ${shortDateFormatter.format(
        parseDateKey(normalizedRange.startDate),
      )} - ${shortDateFormatter.format(parseDateKey(normalizedRange.endDate))}`;
      const nextEntries = estimateSummaries.map((item) =>
        buildEstimateEntryPayload(
          item,
          normalizedRange.startDate,
          normalizedRange.endDate,
        ),
      );

      if (editingPayrollId) {
        const currentEntries = await getPayrollEntries(editingPayrollId);
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
            currentEntryMap.delete(matchKey);
          } else {
            await addPayrollEntry(editingPayrollId, entry);
          }
        }

        for (const entry of currentEntryMap.values()) {
          if (entry.id) {
            await deletePayrollEntry(entry.id);
          }
        }

        await updatePayroll(editingPayrollId, {
          name: payrollName,
          startDate: normalizedRange.startDate,
          endDate: normalizedRange.endDate,
        });

        setSaveMessage("Đã cập nhật bản ước tính hiện tại.");
      } else {
        const payrollId = await saveImportedPayroll({
          source: "payroll_estimate",
          storeId,
          name: payrollName,
          startDate: normalizedRange.startDate,
          endDate: normalizedRange.endDate,
          entries: nextEntries,
        });

        setEditingPayrollId(payrollId);
        router.replace(
          `/payroll-estimate?payrollId=${encodeURIComponent(payrollId)}`,
        );
        setSaveMessage("Đã lưu bản ước tính và có thể mở lại để sửa tiếp.");
      }

      setSavedSchedulesRevision(value => value + 1);
      savedDraft.current = JSON.stringify({ schedule, range: normalizedRange });
      return true;
    } catch (error) {
      console.error(error);
      setSubmitError(
        error instanceof Error ? error.message : "Không thể lưu bản ước tính.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

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

            <div className={cn("min-w-0 flex-wrap gap-2 sm:flex-row sm:items-end sm:self-end xl:shrink-0", workspaceView === "saved" ? "hidden" : "flex flex-col")}>
              <DateRangePicker
                label="Khoảng ngày"
                startDate={range.startDate}
                endDate={range.endDate}
                onChange={(startDate, endDate) => setRange({ startDate, endDate })}
                disabled={saving || loadingSavedEstimate}
                className="w-full sm:w-80"
                triggerClassName="h-10 rounded-lg border-slate-200 bg-white text-emerald-900 shadow-sm hover:border-[#064E3B] focus-visible:border-[#064E3B] focus-visible:ring-0 [&_svg]:text-emerald-800"
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
            <section className={cn("border border-slate-200 bg-white p-4 shadow-[5px_7px_12px_rgba(15,23,42,0.16)] rounded", workspaceView === "saved" && "hidden")}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg bg-emerald-50/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                      <Wallet className="h-4 w-4 text-emerald-600" />
                      Tổng toàn khoảng
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-slate-900">
                      {formatCurrency(totalEstimate)}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {estimateSummaries.length} người •{" "}
                      {formatHours(totalHours)}
                    </div>
                  </div>

                  <div className="rounded-lg bg-sky-50/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                      <Clock3 className="h-4 w-4 text-sky-600" />
                      Đang xem: {selectedRole}
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-slate-900">
                      {formatCurrency(selectedRoleTotal.totalSalary)}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {selectedRoleTotal.employees} người •{" "}
                      {formatHours(selectedRoleTotal.totalHours)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="w-full border-slate-200 md:w-[280px] md:border-l md:pl-6">
                    <span className="mb-2 block text-sm font-medium text-slate-600">
                      Vai trò
                    </span>
                    <SelectBox
                      value={selectedRole}
                      options={roleOptions}
                      onValueChange={setSelectedRole}
                      ariaLabel="Chọn vai trò phân ca và xem tổng lương"
                      disabled={saving || loadingSavedEstimate}
                      className="w-full"
                      triggerClassName="h-14 rounded-xl border-slate-200 bg-white px-4 text-base font-bold text-slate-950 shadow-sm hover:border-[#064E3B] hover:bg-white focus-visible:border-[#064E3B] focus-visible:ring-0 [&_svg]:h-5 [&_svg]:w-5 [&_svg:first-child]:text-slate-500"
                      openTriggerClassName="!border-[#064E3B] !ring-0"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className={cn(WEEK_SHORTCUT_BUTTON_CLASS,"h-14")}
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
                      clearDateCollection(Array.from(visibleDateSet));
                    }}
                    disabled={estimateSummaries.length === 0}
                  >
                    <Eraser className="h-4 w-4" />
                    Xóa lịch
                  </Button> */}
                </div>
              </div>
            </section>

            <nav
              className="flex overflow-x-auto border-b border-slate-200 bg-slate-50"
              aria-label="Nội dung ước lượng lương"
            >
              <button
                type="button"
                onClick={() => setWorkspaceView("schedule")}
                aria-current={workspaceView === "schedule" ? "page" : undefined}
                className={cn(
                  "inline-flex h-12 rounded shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-inset",
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
                aria-current={workspaceView === "summary" ? "page" : undefined}
                className={cn(
                  "inline-flex h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-inset",
                  workspaceView === "summary"
                    ? "border-[#E1B23D] bg-[#064E3B] text-[#F6C85F]"
                    : "border-transparent text-slate-500 hover:bg-white hover:text-slate-800",
                )}
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                Tổng hợp nhân viên
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
                aria-current={workspaceView === "saved" ? "page" : undefined}
                className={cn(
                  "inline-flex h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-inset",
                  workspaceView === "saved"
                    ? "border-[#E1B23D] bg-[#064E3B] text-[#F6C85F]"
                    : "border-transparent text-slate-500 hover:border-[#064E3B] hover:bg-white hover:text-[#064E3B]",
                )}
              >
                <History className="h-4 w-4" aria-hidden="true" />
                Lịch phân ca đã lưu
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
                setEditingPayrollId("");
                setSchedule({});
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
              displayedScheduleRoles.flatMap(role => weekSegments.map((week,weekIndex) => (
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
                    key={`${week.key}-${role}`}
                    activeCell={activeCell}
                    employeeByKey={employeeByKey}
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

          <aside className={workspaceView === "summary" ? "block" : "hidden"}>
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
                              ) : null}
                            </div>

                            <div className="flex items-center gap-3">
                              {fixedSalary ? (
                                <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                                  Không tính theo ca
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
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
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
                        className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50/30"
                      >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className="truncate font-semibold text-slate-900"
                            title={item.employee.name}
                          >
                            {item.employee.name}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">
                            {item.assignedRoles.join(", ")}
                            {!fixedSalary ? (
                              <> • {formatCurrency(item.employee.hourlyRate || 0)}/giờ</>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right">
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
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
                    className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-10 pr-10 text-sm focus:bg-white"
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
                          onClick={() =>
                            toggleEmployeeInActiveCell(employeeKey)
                          }
                          className={cn(
                            "group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                            selected
                              ? "border-emerald-300 bg-emerald-50/80"
                              : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50",
                          )}
                        >
                          <div className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                            selected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600",
                          )}>
                            {employee.name.trim().slice(0, 2).toLocaleUpperCase("vi-VN")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-slate-900" title={employee.name}>
                              {employee.name}
                            </span>
                            {!fixedSalary ? (
                              <div className="mt-0.5 truncate text-xs text-slate-500">
                                {formatCurrency(employee.hourlyRate || 0)}/giờ
                              </div>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            {fixedSalary ? (
                              <div className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                                Không tính theo ca
                              </div>
                            ) : (
                              <div className="text-right">
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
                      className="h-9 rounded-lg px-3 text-xs"
                      onClick={() => clearCell(activeCell)}
                      disabled={activeSelection.length === 0}
                    >
                      Xóa lựa chọn
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 rounded-lg px-4 text-xs"
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
          description="Tất cả phân ca của vai trò này trong bản đang chỉnh sẽ bị bỏ. Các vai trò khác được giữ nguyên. Bấm Lưu ước tính để cập nhật bản đã lưu."
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
