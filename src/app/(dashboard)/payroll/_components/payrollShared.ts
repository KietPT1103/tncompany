import type { StoreType } from "@/context/StoreContext";
import { PayrollEntry } from "@/services/payrolls.firebase";

export const ROLE_GROUPS: Record<string, string[]> = {
  Cafe: ["Phục vụ", "Pha chế", "Thu ngân"],
  Bếp: ["Bếp", "Thu ngân bếp", "Phục vụ bếp", "Rửa chén"],
  Farm: [
    "Chăm sóc thú",
    "Thú y",
    "Thu ngân farm",
    "Soát vé",
    "Thời vụ",
    "Bán hàng",
  ],
  Chung: ["Leader", "MKT"],
};

export const DEFAULT_ROLE = ROLE_GROUPS.Cafe[0];

const STORE_ROLE_GROUPS: Record<StoreType, Array<keyof typeof ROLE_GROUPS>> = {
  cafe: ["Cafe", "Chung"],
  restaurant: ["Bếp", "Chung"],
  farm: ["Farm", "Chung"],
  bakery: ["Cafe", "Chung"],
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
  return `${currencyFormatter.format(value || 0)} đ`;
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

export function calculatePayrollSalary(entry: PayrollEntry) {
  const allowanceTotal = getAllowanceTotal(entry);
  const weekendBonus = (entry.weekendHours || 0) * 1000;

  let rawSalary = 0;

  if (entry.salaryType === "fixed") {
    const fixedSalary = entry.fixedSalary || 0;
    const standardHours = entry.standardHours || 0;
    const totalHours = entry.totalHours || 0;
    const hourlyRate = entry.hourlyRate || 0;
    const overtimeHours = Math.max(0, totalHours - standardHours);
    rawSalary = fixedSalary + overtimeHours * hourlyRate + weekendBonus;
  } else {
    rawSalary = (entry.totalHours || 0) * (entry.hourlyRate || 0) + weekendBonus;
  }

  return Math.ceil((rawSalary + allowanceTotal) / 1000) * 1000;
}
