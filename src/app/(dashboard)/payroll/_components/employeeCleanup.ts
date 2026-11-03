export type PayrollDateFilter = "all" | "before" | "range" | "never";
type PayrollRecency = { lastPayrollDate?: string | null; payrollCount?: number };

export function matchesPayrollDate(employee: PayrollRecency, mode: PayrollDateFilter, from: string, to: string): boolean {
  if (mode === "all") return true;
  if (mode === "never") return employee.payrollCount === 0;
  const date = employee.lastPayrollDate;
  if (!date) return false;
  if (mode === "before") return !to || date < to;
  return (!from || date >= from) && (!to || date <= to);
}

export function formatLastPayrollDate(employee: PayrollRecency): string {
  if (!employee.lastPayrollDate) return employee.payrollCount === 0 ? "Chưa từng tính lương" : "Chưa có ngày kỳ lương";
  const [year, month, day] = employee.lastPayrollDate.split("-");
  return `${day}/${month}/${year}`;
}
