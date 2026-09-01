import type { StoreType } from "@/context/StoreContext";
import { PayrollEntry } from "@/services/payrolls";
import type { RoleStartTimeSetting } from "@/services/roleStartTimes";

export const ROLE_GROUPS: Record<string, string[]> = {
  Cafe: ["Phục vụ", "Pha chế", "Thu ngân"],
  Bep: ["Bếp", "Thu ngân bếp", "Phục vụ bếp", "Rửa chén"],
  Farm: ["Chăm sóc thú", "Thú y", "Thu ngân farm", "Soát vé", "Thời vụ", "Bán hàng"],
  Chung: ["Leader", "MKT"],
};

export const DEFAULT_ROLE = ROLE_GROUPS["Cafe"][0];

const STORE_ROLE_GROUPS: Record<StoreType, Array<keyof typeof ROLE_GROUPS>> = {
  cafe: ["Cafe", "Chung"],
  restaurant: ["Bep", "Chung"],
  farm: ["Farm", "Chung"],
  bakery: ["Cafe", "Chung"],
  warehouse: ["Chung"],
};

const currencyFormatter = new Intl.NumberFormat("vi-VN");
const hourFormatter = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function getRoleGroupsForStore(storeId?: StoreType | string) {
  const groupKeys =
    STORE_ROLE_GROUPS[(storeId as StoreType) || "cafe"] || STORE_ROLE_GROUPS.cafe;
  return groupKeys.reduce((result, key) => {
    result[key] = ROLE_GROUPS[key];
    return result;
  }, {} as Record<string, string[]>);
}

export function getRolesForStore(storeId?: StoreType | string) {
  return Object.values(getRoleGroupsForStore(storeId)).flat();
}

export function getDefaultRoleForStore(storeId?: StoreType | string) {
  const roleGroups = getRoleGroupsForStore(storeId);
  const primaryGroup = Object.keys(roleGroups).find((group) => group !== "Chung");
  if (primaryGroup && roleGroups[primaryGroup]?.length) {
    return roleGroups[primaryGroup][0];
  }
  return DEFAULT_ROLE;
}

export function formatCurrency(value: number | undefined) {
  return currencyFormatter.format(value || 0) + " đ";
}

export function formatHours(value: number | undefined) {
  return hourFormatter.format(value || 0);
}

export function formatTimestampDate(value: any) {
  if (!value) return "Vừa tạo";
  if (typeof value?.toDate === "function") {
    return value.toDate().toLocaleDateString("vi-VN");
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Vừa tạo";
  }
  return date.toLocaleDateString("vi-VN");
}

export function getAllowanceTotal(entry: PayrollEntry) {
  return (entry.allowances || []).reduce((sum, item) => sum + item.amount, 0);
}

export function normalizePayrollSalaryType(value?: PayrollEntry["salaryType"]) {
  return value === "fixed" ? "monthly" : value || "hourly";
}

export function resolvePayrollSalaryType(entry?: Partial<PayrollEntry>) {
  const normalized = normalizePayrollSalaryType(entry?.salaryType);
  if ((entry?.salaryType || "") === "hourly") return "hourly";
  if (normalized === "monthly") return "monthly";

  const hasMonthlySignals =
    (entry?.monthlySalary || entry?.fixedSalary || 0) > 0 ||
    (entry?.expectedWorkDays || 0) > 0 ||
    (entry?.standardHours || 0) > 0;

  return hasMonthlySignals ? "monthly" : "hourly";
}

function getShiftDateKey(shift: NonNullable<PayrollEntry["shifts"]>[number]) {
  if (shift?.date) {
    return shift.date.replace(/\//g, "-");
  }
  if (!shift?.inTime) return "";
  const date = new Date(shift.inTime);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function parseShiftDate(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const normalized = raw.replace(/\//g, "-");
  const isoMatch = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const localMatch = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (localMatch) {
    const [, day, month, year] = localMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inferMonthlyExpectedWorkDays(entry: PayrollEntry) {
  const configuredExpectedWorkDays = Math.max(0, entry.expectedWorkDays || 0);
  if (configuredExpectedWorkDays > 0 && configuredExpectedWorkDays !== 30) {
    return configuredExpectedWorkDays;
  }

  const monthCounts = new Map<string, number>();
  for (const shift of entry.shifts || []) {
    const date = parseShiftDate(shift.date || shift.inTime);
    if (!date) continue;

    const key = `${date.getFullYear()}-${date.getMonth()}`;
    monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
  }

  if (monthCounts.size > 0) {
    const [dominantMonthKey] = [...monthCounts.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0];
    const [yearText, monthIndexText] = dominantMonthKey.split("-");
    const year = Number(yearText);
    const monthIndex = Number(monthIndexText);
    if (Number.isFinite(year) && Number.isFinite(monthIndex)) {
      return new Date(year, monthIndex + 1, 0).getDate();
    }
  }

  return configuredExpectedWorkDays || 30;
}

export function getExpectedWorkDays(entry: PayrollEntry) {
  if (
    resolvePayrollSalaryType(entry) === 'monthly' &&
    (entry.payrollPeriodDays || 0) > 0
  ) {
    return Math.max(0, entry.payrollPeriodDays || 0);
  }

  return Math.max(
    0,
    resolvePayrollSalaryType(entry) === "monthly"
      ? inferMonthlyExpectedWorkDays(entry)
      : entry.expectedWorkDays || 0,
  );
}

export function getWorkingDays(entry: PayrollEntry) {
  const isMonthly = resolvePayrollSalaryType(entry) === 'monthly';
  const dates = new Set(
    (entry.shifts || [])
      .filter((shift) =>
        isMonthly
          ? Boolean(shift.inTime || shift.outTime)
          : Boolean(shift.isValid && shift.inTime && shift.outTime),
      )
      .map((shift) => getShiftDateKey(shift))
      .filter(Boolean),
  );
  return dates.size;
}

export function getAbsentDays(entry: PayrollEntry) {
  const expectedWorkDays = getExpectedWorkDays(entry);
  if (!expectedWorkDays) return 0;
  return Math.max(0, expectedWorkDays - getWorkingDays(entry));
}

export function getUnpaidLeaveDays(entry: PayrollEntry) {
  if (entry.prorateMonthlyByAttendance) {
    return getAbsentDays(entry);
  }
  return Math.max(0, getAbsentDays(entry) - Math.max(0, entry.paidLeaveDays || 0));
}

export function getAttendanceBonusValue(entry: PayrollEntry) {
  if (!entry.attendanceBonusEnabled) return 0;
  const bonusAmount = Math.max(0, entry.attendanceBonusAmount || 0);
  const bonusDays = Math.max(0, entry.attendanceBonusDays || 0);
  if (!bonusAmount) return 0;
  if (!bonusDays) return Math.round(bonusAmount);
  const absentDays = getAbsentDays(entry);
  const remainingRatio = Math.max(0, bonusDays - absentDays) / bonusDays;
  return Math.round(bonusAmount * remainingRatio);
}

export function getAttendanceBonusProgress(entry: PayrollEntry) {
  if (!entry.attendanceBonusEnabled) return null;
  const targetDays = Math.max(0, entry.attendanceBonusDays || 0);
  if (!targetDays) return null;
  const absentDays = getAbsentDays(entry);
  const qualifiedDays = Math.max(0, targetDays - absentDays);
  return {
    qualifiedDays,
    targetDays,
  };
}

function parseTimeToMinutes(value?: string) {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function extractShiftStartTime(value?: string) {
  if (!value) return "";
  if (value.includes(" ")) {
    return value.split(" ")[1]?.slice(0, 5) || "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function getConfiguredShiftStartTimes(
  setting?: Partial<RoleStartTimeSetting>,
  useWeekendSchedule = false,
) {
  return [
    {
      key: "shift1Start",
      label: useWeekendSchedule ? "Cuối tuần ca 1" : "Ca 1",
      time: useWeekendSchedule
        ? setting?.weekendShift1Start || ""
        : setting?.shift1Start || "",
    },
    {
      key: "shift2Start",
      label: useWeekendSchedule ? "Cuối tuần ca 2" : "Ca 2",
      time: useWeekendSchedule
        ? setting?.weekendShift2Start || ""
        : setting?.shift2Start || "",
    },
    {
      key: "shift3Start",
      label: useWeekendSchedule ? "Cuối tuần ca 3" : "Ca 3",
      time: useWeekendSchedule
        ? setting?.weekendShift3Start || ""
        : setting?.shift3Start || "",
    },
  ].filter((item) => item.time !== "");
}

function getDisplayConfiguredShiftStartTimes(setting?: Partial<RoleStartTimeSetting>) {
  return [
    ...getConfiguredShiftStartTimes(setting, false),
    ...(setting?.weekendEnabled
      ? getConfiguredShiftStartTimes(setting, true)
      : []),
  ];
}

function resolveShiftStartTimesForShift(
  shiftStartSetting: Partial<RoleStartTimeSetting> | undefined,
  shift?: NonNullable<PayrollEntry["shifts"]>[number],
) {
  if (!shiftStartSetting) return shiftStartSetting;
  if (!shift?.inTime && !shift?.date) return shiftStartSetting;

  let isWeekend = false;
  if (typeof shift?.isWeekend === "boolean") {
    isWeekend = shift.isWeekend;
  } else if (shift?.inTime) {
    const date = new Date(shift.inTime);
    if (!Number.isNaN(date.getTime())) {
      isWeekend = date.getDay() === 0 || date.getDay() === 6;
    }
  }

  if (!isWeekend || !shiftStartSetting.weekendEnabled) {
    return shiftStartSetting;
  }

  return {
    ...shiftStartSetting,
    shift1Start: shiftStartSetting.weekendShift1Start || "",
    shift2Start: shiftStartSetting.weekendShift2Start || "",
    shift3Start: shiftStartSetting.weekendShift3Start || "",
  };
}

export function getEntryLateSummary(
  entry: PayrollEntry,
  shiftStartSetting?: Partial<RoleStartTimeSetting>,
) {
  const configuredShiftStarts = getConfiguredShiftStartTimes(shiftStartSetting)
    .map((item) => ({
      ...item,
      minutes: parseTimeToMinutes(item.time),
    }))
    .filter((item) => item.minutes !== null) as Array<{
    key: string;
    label: string;
    time: string;
    minutes: number;
  }>;

  if (configuredShiftStarts.length === 0) {
    return {
      configuredStartTimes: [],
      lateShiftCount: 0,
      totalLateMinutes: 0,
      maxLateMinutes: 0,
      lateShifts: [],
    };
  }

  const lateShifts = (entry.shifts || [])
    .filter((shift) => shift.isValid && shift.inTime && shift.outTime)
    .map((shift) => {
      const resolvedShiftStartSetting = resolveShiftStartTimesForShift(
        shiftStartSetting,
        shift,
      );
      const configuredShiftStartsForShift = getConfiguredShiftStartTimes(
        resolvedShiftStartSetting,
      )
        .map((item) => ({
          ...item,
          minutes: parseTimeToMinutes(item.time),
        }))
        .filter((item) => item.minutes !== null) as Array<{
        key: string;
        label: string;
        time: string;
        minutes: number;
      }>;
      const actualStartTime = extractShiftStartTime(shift.inTime);
      const actualMinutes = parseTimeToMinutes(actualStartTime);
      const matchedConfiguredShift =
        actualMinutes === null
          ? null
          : configuredShiftStartsForShift.reduce((bestMatch, currentShift) => {
              if (!bestMatch) return currentShift;
              const bestDiff = Math.abs(actualMinutes - bestMatch.minutes);
              const currentDiff = Math.abs(actualMinutes - currentShift.minutes);
              return currentDiff < bestDiff ? currentShift : bestMatch;
            }, null as (typeof configuredShiftStarts)[number] | null);
      const lateMinutes =
        actualMinutes === null || !matchedConfiguredShift
          ? 0
          : Math.max(0, actualMinutes - matchedConfiguredShift.minutes);

      return {
        id: shift.id,
        date: getShiftDateKey(shift) || shift.date || "",
        actualStartTime,
        matchedShiftLabel: matchedConfiguredShift?.label || "",
        matchedScheduledStartTime: matchedConfiguredShift?.time || "",
        lateMinutes,
      };
    })
    .filter((shift) => shift.lateMinutes > 0);

  return {
    configuredStartTimes: getDisplayConfiguredShiftStartTimes(shiftStartSetting).map((item) => ({
      label: item.label,
      time: item.time,
    })),
    lateShiftCount: lateShifts.length,
    totalLateMinutes: lateShifts.reduce((sum, shift) => sum + shift.lateMinutes, 0),
    maxLateMinutes: lateShifts.reduce(
      (max, shift) => Math.max(max, shift.lateMinutes),
      0,
    ),
    lateShifts,
  };
}

export function calculateShiftLateMinutes(
  inTime: string,
  shiftStartSetting?: Partial<RoleStartTimeSetting>,
) {
  const actualStartTime = extractShiftStartTime(inTime);
  const actualMinutes = parseTimeToMinutes(actualStartTime);
  if (actualMinutes === null) return 0;

  const shiftDate = new Date(inTime);
  const resolvedShiftStartSetting = resolveShiftStartTimesForShift(
    shiftStartSetting,
    {
      id: "",
      date: "",
      inTime,
      outTime: "",
      hours: 0,
      isWeekend:
        !Number.isNaN(shiftDate.getTime()) &&
        (shiftDate.getDay() === 0 || shiftDate.getDay() === 6),
      isValid: true,
    },
  );

  const configuredShiftStarts = getConfiguredShiftStartTimes(resolvedShiftStartSetting)
    .map((item) => ({
      ...item,
      minutes: parseTimeToMinutes(item.time),
    }))
    .filter((item) => item.minutes !== null) as Array<{
    label: string;
    time: string;
    minutes: number;
  }>;

  if (configuredShiftStarts.length === 0) return 0;

  const matchedConfiguredShift = configuredShiftStarts.reduce((bestMatch, currentShift) => {
    if (!bestMatch) return currentShift;
    const bestDiff = Math.abs(actualMinutes - bestMatch.minutes);
    const currentDiff = Math.abs(actualMinutes - currentShift.minutes);
    return currentDiff < bestDiff ? currentShift : bestMatch;
  }, null as (typeof configuredShiftStarts)[number] | null);

  if (!matchedConfiguredShift) return 0;
  return Math.max(0, actualMinutes - matchedConfiguredShift.minutes);
}

export function getPayrollBreakdown(entry: PayrollEntry) {
  const salaryType = resolvePayrollSalaryType(entry);
  const expectedWorkDays = getExpectedWorkDays(entry);
  const allowanceTotal = getAllowanceTotal(entry);
  const attendanceBonus = getAttendanceBonusValue(entry);
  const workingDays = getWorkingDays(entry);
  const absentDays = getAbsentDays(entry);
  const unpaidLeaveDays = getUnpaidLeaveDays(entry);
  const standardHours = Math.max(0, entry.standardHours || 0);
  const overtimeHours =
    !entry.prorateMonthlyByAttendance &&
    salaryType === "monthly" && standardHours > 0
      ? Math.max(0, (entry.totalHours || 0) - standardHours)
      : 0;
  const overtimeRate =
    salaryType === "monthly" ? Math.max(0, entry.hourlyRate || 0) : 0;
  const salaryMultiplier =
    typeof entry.hourlyMultiplier === "number" &&
    Number.isFinite(entry.hourlyMultiplier)
      ? Math.max(0, entry.hourlyMultiplier || 0)
      : 1;
  let overtimePay = overtimeHours * overtimeRate;
  let weekendBonus = salaryType === "hourly" ? (entry.weekendHours || 0) * 1000 : 0;
  let baseSalary = 0;
  let deduction = 0;
  if (salaryType === "monthly") {
    const fullMonthlySalary = entry.monthlySalary || entry.fixedSalary || 0;
    baseSalary = entry.prorateMonthlyByAttendance
      ? (fullMonthlySalary / 30) * Math.min(expectedWorkDays, 30)
      : fullMonthlySalary;
    deduction = Math.round(unpaidLeaveDays * (fullMonthlySalary / 30));
  } else {
    baseSalary = (entry.totalHours || 0) * (entry.hourlyRate || 0);
  }

  if (salaryMultiplier !== 1) {
    baseSalary *= salaryMultiplier;
    deduction *= salaryMultiplier;
    overtimePay *= salaryMultiplier;
    weekendBonus *= salaryMultiplier;
  }
  const rawSalary = Math.max(
    0,
    baseSalary -
      deduction +
      overtimePay +
      weekendBonus +
      allowanceTotal +
      attendanceBonus,
  );
  return {
    absentDays,
    allowanceTotal,
    attendanceBonus,
    baseSalary,
    deduction,
    expectedWorkDays,
    hourlyMultiplier: salaryMultiplier,
    overtimeHours,
    overtimePay,
    overtimeRate,
    roundedSalary: Math.ceil(rawSalary / 1000) * 1000,
    salaryType,
    standardHours,
    unpaidLeaveDays,
    weekendBonus,
    workingDays,
  };
}

export function calculatePayrollSalary(entry: PayrollEntry) {
  return getPayrollBreakdown(entry).roundedSalary;
}
