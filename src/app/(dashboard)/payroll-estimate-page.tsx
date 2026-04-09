"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { getEmployees, Employee } from "@/services/employees.firebase";
import {
  addPayrollEntry,
  deletePayrollEntry,
  getPayrollEntries,
  saveImportedPayroll,
  updatePayroll,
  updatePayrollEntry,
} from "@/services/payrolls.firebase";
import { resolveEmployeeSalaryType } from "./payroll/_components/EmployeeSalaryFields";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronRight,
  Clock3,
  Eraser,
  Save,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";

const ESTIMATE_ROLES = ["Thu ngân", "Phục vụ", "Pha chế"] as const;
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

const ROLE_THEME: Record<EstimateRole, string> = {
  "Thu ngân":
    "from-amber-500/15 to-orange-500/10 text-amber-900 border-amber-200",
  "Phục vụ":
    "from-emerald-500/15 to-teal-500/10 text-emerald-900 border-emerald-200",
  "Pha chế": "from-sky-500/15 to-cyan-500/10 text-sky-900 border-sky-200",
};

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

type EstimateRole = (typeof ESTIMATE_ROLES)[number];
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
  totalHours: number;
  totalSalary: number;
  shiftCount: number;
  shifts: Array<{
    id: string;
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

function getRoleOrder(role: string) {
  const index = ESTIMATE_ROLES.indexOf(role as EstimateRole);
  return index === -1 ? ESTIMATE_ROLES.length : index;
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
) {
  return {
    employeeId: item.employee.id || `manual_${item.employeeKey}`,
    employeeCode: item.employee.employeeCode || "",
    employeeName: item.employee.name,
    role: item.employee.role,
    hourlyRate: item.employee.hourlyRate || 0,
    totalHours: item.totalHours,
    weekendHours: 0,
    salary: item.totalSalary,
    allowances: [],
    note: `Ước tính từ lịch phân ca ${startDate} đến ${endDate}`,
    salaryType: "hourly" as const,
    fixedSalary: 0,
    standardHours: 0,
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
) {
  const schedule: ScheduleState = {};
  let minDate = "";
  let maxDate = "";
  let suggestedRole: EstimateRole | null = null;

  entries.forEach((entry) => {
    if (!ESTIMATE_ROLES.includes(entry.role as EstimateRole)) return;

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
      const shiftId = getShiftIdFromStoredShift(shift);
      if (!shiftId) return;

      const date = normalizeStoredShiftDate(
        shift.date || shift.inTime.slice(0, 10),
      );
      if (!date) return;

      const cellKey = makeCellKey(date, entry.role as EstimateRole, shiftId);
      schedule[cellKey] = Array.from(
        new Set([...(schedule[cellKey] || []), employeeKey]),
      );

      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
      if (!suggestedRole) suggestedRole = entry.role as EstimateRole;
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
  onSelectCell,
  role,
  schedule,
  week,
}: {
  activeCell: ActiveCell | null;
  employeeByKey: Map<string, Employee>;
  onRemoveEmployee: (cell: ActiveCell, employeeKey: string) => void;
  onSelectCell: (cell: ActiveCell) => void;
  role: EstimateRole;
  schedule: ScheduleState;
  week: WeekSegment;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div
        className={cn(
          "flex items-center justify-between rounded-t-[28px] border-b bg-gradient-to-r px-5 py-4",
          ROLE_THEME[role],
        )}
      >
        <h3 className="text-lg font-semibold">{role}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full table-fixed border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
              <th className="sticky left-0 z-20 min-w-[130px] border-b border-r border-slate-200 bg-white px-4 py-4">
                Ca
              </th>
              {week.days.map((day) => (
                <th
                  key={day.date}
                  className={cn(
                    "min-w-[135px] border-b border-slate-200 px-4 py-4",
                    day.inRange ? "bg-white" : "bg-slate-50 text-slate-400",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>{day.weekdayLabel}</span>
                    {day.isToday ? (
                      <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-white">
                        Hôm nay
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm font-semibold normal-case text-slate-800">
                    {day.shortDateLabel}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {SHIFT_DEFINITIONS.map((shift) => (
              <tr key={shift.id}>
                <td
                  className={cn(
                    "sticky left-0 z-10 border-r border-slate-200 px-4 py-4 align-top",
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
                    <div className="text-sm font-medium text-slate-800">
                      {shift.hours} giờ
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
                      sum + (employee.hourlyRate || 0) * shift.hours,
                    0,
                  );

                  return (
                    <td
                      key={day.date}
                      className={cn(
                        "border-b border-slate-200 px-2 py-3 align-top",
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
                          "min-h-[170px] border bg-white px-2.5 py-2 text-left transition",
                          isActive
                            ? "border-slate-900 bg-slate-50"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50",
                        )}
                      >
                        {/* <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              {selectedEmployees.length} người
                            </span>
                            {selectedEmployees.length > 0 ? (
                              <span className="text-[10px] font-semibold text-emerald-700">
                                {formatCurrency(cellEstimate)}
                              </span>
                            ) : null}
                          </div> */}

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
                                  className="flex w-full items-start gap-1 border-b border-slate-100 py-1 text-slate-900 last:border-b-0"
                                  title={employee.name}
                                >
                                  <span className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-5">
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
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function SalaryEstimatePage() {
  const { user, role, loading } = useAuth();
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
    ESTIMATE_ROLES[0],
  );
  const [loadingSavedEstimate, setLoadingSavedEstimate] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (role !== "admin" && role !== "manager") {
        router.push("/pos");
      }
    }
  }, [loading, role, router, user]);

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
    setCellSearch("");
  }, [activeCell?.date, activeCell?.role, activeCell?.shiftId]);

  useEffect(() => {
    if (activeCell && activeCell.role !== selectedRole) {
      setActiveCell(null);
    }
  }, [activeCell, selectedRole]);

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
            ESTIMATE_ROLES.includes(employee.role as EstimateRole) &&
            resolveEmployeeSalaryType(employee) === "hourly",
        )
        .sort((left, right) => left.name.localeCompare(right.name, "vi")),
    [employees],
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

    getPayrollEntries(queryPayrollId)
      .then((entries) => {
        if (ignore) return;
        const restored = buildScheduleFromEntries(entries, supportedEmployees);
        setSchedule(restored.schedule);
        if (restored.startDate && restored.endDate) {
          setRange({
            startDate: restored.startDate,
            endDate: restored.endDate,
          });
        }
        if (restored.selectedRole) {
          setSelectedRole(restored.selectedRole);
        }
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
  }, [queryPayrollId, supportedEmployees]);

  const employeesByRole = useMemo(() => {
    const next = {
      "Thu ngân": [] as Employee[],
      "Phục vụ": [] as Employee[],
      "Pha chế": [] as Employee[],
    };

    supportedEmployees.forEach((employee) => {
      if (ESTIMATE_ROLES.includes(employee.role as EstimateRole)) {
        next[employee.role as EstimateRole].push(employee);
      }
    });

    return next;
  }, [supportedEmployees]);

  const estimateSummaries = useMemo(() => {
    const summaryMap = new Map<string, EstimateSummary>();

    visibleDateSet.forEach((date) => {
      ESTIMATE_ROLES.forEach((roleName) => {
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
              totalHours: 0,
              totalSalary: 0,
              shiftCount: 0,
              shifts: [],
            };

            nextSummary.totalHours += shift.hours;
            nextSummary.totalSalary += shift.hours * (employee.hourlyRate || 0);
            nextSummary.shiftCount += 1;
            nextSummary.shifts.push({
              id: `${employeeKey}-${date}-${shift.id}`,
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
        getRoleOrder(left.employee.role) - getRoleOrder(right.employee.role);
      if (roleDiff !== 0) return roleDiff;
      return left.employee.name.localeCompare(right.employee.name, "vi");
    });
  }, [employeeByKey, schedule, visibleDateSet]);

  const totalEstimate = estimateSummaries.reduce(
    (sum, item) => sum + item.totalSalary,
    0,
  );
  const totalHours = estimateSummaries.reduce(
    (sum, item) => sum + item.totalHours,
    0,
  );
  const totalsByRole = useMemo(() => {
    return ESTIMATE_ROLES.map((roleName) => {
      const entries = estimateSummaries.filter(
        (item) => item.employee.role === roleName,
      );
      return {
        role: roleName,
        employees: entries.length,
        totalHours: entries.reduce((sum, item) => sum + item.totalHours, 0),
        totalSalary: entries.reduce((sum, item) => sum + item.totalSalary, 0),
      };
    });
  }, [estimateSummaries]);

  const selectedRoleTotal = totalsByRole.find(
    (item) => item.role === selectedRole,
  ) || {
    role: selectedRole,
    employees: 0,
    totalHours: 0,
    totalSalary: 0,
  };

  const selectedRoleSummaries = estimateSummaries.filter(
    (item) => item.employee.role === selectedRole,
  );

  const activeCellEmployees = activeCell
    ? employeesByRole[activeCell.role]
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

  function updateCellEmployees(
    cell: ActiveCell,
    updater: (current: string[]) => string[],
  ) {
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

  async function handleSaveEstimate() {
    if (!storeId) return;

    if (estimateSummaries.length === 0) {
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

  async function handleSaveFromPicker() {
    const saved = await handleSaveEstimate();
    if (saved) {
      setActiveCell(null);
    }
  }

  if (loading || !user || !storeId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-[1680px] space-y-6 p-4 lg:p-6">
        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <Link href="/payroll">
                <Button
                  variant="ghost"
                  className="h-10 gap-2 px-0 text-slate-500"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Về tính lương
                </Button>
              </Link>

              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Trang riêng để ước lượng lương
                </div>
                <h1 className="mt-3 text-3xl font-semibold text-slate-900">
                  Lịch phân ca và ước tính lương
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Chọn khoảng ngày, xếp người vào từng ca theo tuần, hệ thống sẽ
                  cộng giờ làm và tính ra lương ước tính dựa trên lương giờ của
                  từng nhân viên.
                </p>
                <p className="mt-2 text-sm font-medium text-slate-700">
                  {storeName} • Ca 1: 5 giờ • Ca 2: 5 giờ • Ca 3: 6 giờ
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_220px_auto_auto_auto]">
              <Input
                type="date"
                label="Từ ngày"
                value={range.startDate}
                onChange={(event) =>
                  setRange((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
                className="h-11 rounded-2xl border-slate-200"
              />
              <Input
                type="date"
                label="Đến ngày"
                value={range.endDate}
                onChange={(event) =>
                  setRange((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
                className="h-11 rounded-2xl border-slate-200"
              />
              <Button
                variant="outline"
                className="h-11 gap-2 rounded-2xl self-end"
                onClick={handleApplyCurrentWeek}
              >
                <CalendarDays className="h-4 w-4" />
                Tuần này
              </Button>
              <Button
                variant="outline"
                className="h-11 gap-2 rounded-2xl self-end"
                onClick={handleApplyNextWeek}
              >
                <CalendarRange className="h-4 w-4" />
                Tuần sau
              </Button>
            </div>
          </div>
        </section>

        {loadError ? (
          <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </div>
        ) : null}

        {submitError ? (
          <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {submitError}
          </div>
        ) : null}

        {saveMessage ? (
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {saveMessage}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
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

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
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
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-600">
                      Chọn bảng cần xem
                    </span>
                    <select
                      value={selectedRole}
                      onChange={(event) =>
                        setSelectedRole(event.target.value as EstimateRole)
                      }
                      className="h-11 min-w-[180px] rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    >
                      {ESTIMATE_ROLES.map((roleName) => (
                        <option key={roleName} value={roleName}>
                          {roleName}
                        </option>
                      ))}
                    </select>
                  </label>

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
                  Trang này đang chia lịch cho 3 vai trò: Thu ngân, Phục vụ, Pha
                  chế. Hãy kiểm tra lại vai trò trong mục Nhân sự nếu cần.
                </p>
              </div>
            ) : (
              weekSegments.map((week) => (
                <section key={week.key} className="space-y-4">
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
                    key={`${week.key}-${selectedRole}`}
                    activeCell={activeCell}
                    employeeByKey={employeeByKey}
                    onRemoveEmployee={removeEmployeeFromCell}
                    onSelectCell={handleSelectScheduleCell}
                    role={selectedRole}
                    schedule={schedule}
                    week={week}
                  />
                </section>
              ))
            )}
          </div>

          <aside className="space-y-4 self-start xl:sticky xl:top-6">
            <section className="hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
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
                        const shiftCost =
                          (employee.hourlyRate || 0) * activeShift.hours;

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
                              <div className="mt-1 text-sm text-slate-500">
                                {employee.employeeCode || "Không có mã"} •{" "}
                                {formatCurrency(employee.hourlyRate || 0)}/giờ
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="text-sm font-semibold text-slate-900">
                                  {formatCurrency(shiftCost)}
                                </div>
                                <div className="text-xs text-slate-400">
                                  Chi phí cho ca này
                                </div>
                              </div>
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

            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">
                Tổng hợp theo nhân viên
              </h2>
              <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {selectedRoleSummaries.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    Chưa có ai được xếp lịch cho bảng này.
                  </div>
                ) : (
                  selectedRoleSummaries.map((item) => (
                    <div
                      key={item.employeeKey}
                      className="rounded-[22px] border border-slate-200 px-4 py-3"
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
                            {item.employee.role} •{" "}
                            {formatCurrency(item.employee.hourlyRate || 0)}/giờ
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-emerald-700">
                            {formatCurrency(item.totalSalary)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {item.shiftCount} ca
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-slate-500">
                        {formatHours(item.totalHours)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>

        {activeCell && activeShift ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Chọn nhân viên
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
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

                <button
                  type="button"
                  className="rounded-full bg-slate-100 p-2 text-slate-500 transition hover:bg-slate-200"
                  onClick={() => setActiveCell(null)}
                  aria-label="Đóng popup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4 px-6 py-5">
                <Input
                  value={cellSearch}
                  onChange={(event) => setCellSearch(event.target.value)}
                  placeholder="Tìm tên hoặc mã"
                  className="h-11 rounded-2xl border-slate-200 bg-slate-50"
                />

                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {filteredActiveEmployees.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                      Không có nhân viên phù hợp với ô đang chọn.
                    </div>
                  ) : (
                    filteredActiveEmployees.map((employee) => {
                      const employeeKey = getEmployeeKey(employee);
                      const selected = activeSelection.includes(employeeKey);
                      const shiftCost =
                        (employee.hourlyRate || 0) * activeShift.hours;

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
                            <div className="mt-1 text-sm text-slate-500">
                              {employee.employeeCode || "Không có mã"} •{" "}
                              {formatCurrency(employee.hourlyRate || 0)}/giờ
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm font-semibold text-slate-900">
                                {formatCurrency(shiftCost)}
                              </div>
                              <div className="text-xs text-slate-400">
                                Chi phí ca này
                              </div>
                            </div>
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
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-500">
                  {estimateSummaries.length > 0
                    ? `${formatCurrency(totalEstimate)} • ${formatHours(totalHours)}`
                    : "Chọn nhân viên rồi lưu bản nháp tại đây"}
                </div>
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => clearCell(activeCell)}
                    disabled={activeSelection.length === 0}
                  >
                    Xóa ô này
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => setActiveCell(null)}
                  >
                    Đóng
                  </Button>
                  <Button
                    className="gap-2 rounded-2xl"
                    isLoading={saving}
                    onClick={() => void handleSaveFromPicker()}
                    disabled={
                      estimateSummaries.length === 0 || loadingSavedEstimate
                    }
                  >
                    <Save className="h-4 w-4" />
                    {editingPayrollId ? "Lưu thay đổi" : "Lưu bản nháp"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
