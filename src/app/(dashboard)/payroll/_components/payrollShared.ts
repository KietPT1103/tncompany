import type { StoreType } from "@/context/StoreContext";
import { PayrollEntry } from "@/services/payrolls.firebase";

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
};

const currencyFormatter = new Intl.NumberFormat("vi-VN");
const hourFormatter = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function getRoleGroupsForStore(storeId?: StoreType | string) {
  const groupKeys = STORE_ROLE_GROUPS[(storeId as StoreType) || "cafe"] || STORE_ROLE_GROUPS.cafe;
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

export function getWorkingDays(entry: PayrollEntry) {
  const dates = new Set(
    (entry.shifts || [])
      .filter((shift) => shift.isValid && shift.inTime && shift.outTime)
      .map((shift) => getShiftDateKey(shift))
      .filter(Boolean)
  );
  return dates.size;
}

export function getAbsentDays(entry: PayrollEntry) {
  const expectedWorkDays = Math.max(
    0,
    resolvePayrollSalaryType(entry) === "monthly"
      ? entry.expectedWorkDays || 30
      : entry.expectedWorkDays || 0
  );
  if (!expectedWorkDays) return 0;
  return Math.max(0, expectedWorkDays - getWorkingDays(entry));
}

export function getUnpaidLeaveDays(entry: PayrollEntry) {
  return Math.max(0, getAbsentDays(entry) - Math.max(0, entry.paidLeaveDays || 0));
}

export function getAttendanceBonusValue(entry: PayrollEntry) {
  if (!entry.attendanceBonusEnabled) return 0;
  const bonusAmount = Math.max(0, entry.attendanceBonusAmount || 0);
  const bonusDays = Math.max(0, entry.attendanceBonusDays || 0);
  if (!bonusAmount) return 0;
  if (!bonusDays) return bonusAmount;
  const absentDays = getAbsentDays(entry);
  const remainingRatio = Math.max(0, bonusDays - absentDays) / bonusDays;
  return bonusAmount * remainingRatio;
}

export function getPayrollBreakdown(entry: PayrollEntry) {
  const salaryType = resolvePayrollSalaryType(entry);
  const allowanceTotal = getAllowanceTotal(entry);
  const attendanceBonus = getAttendanceBonusValue(entry);
  const workingDays = getWorkingDays(entry);
  const absentDays = getAbsentDays(entry);
  const unpaidLeaveDays = getUnpaidLeaveDays(entry);
  const weekendBonus = salaryType === "hourly" ? (entry.weekendHours || 0) * 1000 : 0;
  const standardHours = Math.max(0, entry.standardHours || 0);
  const overtimeHours =
    salaryType === "monthly" && standardHours > 0
      ? Math.max(0, (entry.totalHours || 0) - standardHours)
      : 0;
  const overtimeRate = salaryType === "monthly" ? Math.max(0, entry.hourlyRate || 0) : 0;
  const overtimePay = overtimeHours * overtimeRate;
  let baseSalary = 0;
  let deduction = 0;
  if (salaryType === "monthly") {
    baseSalary = entry.monthlySalary || entry.fixedSalary || 0;
    deduction = unpaidLeaveDays * (baseSalary / 30);
  } else {
    baseSalary = (entry.totalHours || 0) * (entry.hourlyRate || 0);
  }
  const rawSalary = Math.max(
    0,
    baseSalary - deduction + overtimePay + weekendBonus + allowanceTotal + attendanceBonus
  );
  return {
    absentDays,
    allowanceTotal,
    attendanceBonus,
    baseSalary,
    deduction,
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
