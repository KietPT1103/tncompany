
import { apiRequest } from "@/lib/api";
import { Employee } from "./employees";

export type Payroll = {
  id?: string;
  storeId: string;
  name: string;
  status: "draft" | "locked";
  startDate?: string;
  endDate?: string;
  createdAt?: any;
};

export interface Shift {
  id: string;
  role?: string;
  date: string;
  inTime: string;
  outTime: string;
  hours: number;
  hourlyRateOverride?: number;
  isWeekend: boolean;
  isValid: boolean;
}

export type PayrollAllowance = {
  name: string;
  amount: number;
  period?: "all" | "1" | "2";
};

export type PayrollDeduction = {
  date: string;
  reason: string;
  amount: number;
};

export type PayrollEntry = {
  id?: string;
  payrollId: string;
  employeeId: string;
  employeeCode?: string;
  employeeName: string;
  role: string;
  hourlyRate: number;
  hourlyMultiplier?: number;
  totalHours: number;
  weekendHours: number;
  salary: number;
  allowances?: PayrollAllowance[];
  deductions?: PayrollDeduction[];
  note: string;
  salaryType?: "hourly" | "monthly" | "fixed";
  monthlySalary?: number;
  expectedWorkDays?: number;
  payrollPeriodDays?: number;
  prorateMonthlyByAttendance?: boolean;
  paidLeaveDays?: number;
  attendanceBonusEnabled?: boolean;
  attendanceBonusDays?: number;
  attendanceBonusAmount?: number;
  fixedSalary?: number;
  standardHours?: number;
  shifts?: Shift[];
};

type PayrollListResponse = {
  items: Payroll[];
};

type PayrollEntryListResponse = {
  items: PayrollEntry[];
};

type PayrollMutationResponse = {
  id: string;
};

export type SavedEstimateSchedule = Payroll & {
  id: string;
  updatedAt: string;
  employeeCount: number;
  totalHours: number;
  totalSalary: number;
  roles: string[];
};
export type SavedEstimateTotals = {
  startDate: string; endDate: string; scheduleCount: number; employeeCount: number; totalHours: number; totalSalary: number;
};
export function getSavedEstimateSchedules(storeId: string, page = 1, range?: {startDate: string; endDate: string}) {
  return apiRequest<{ items: SavedEstimateSchedule[]; total: number; page: number; summary: SavedEstimateTotals | null }>(
    `/payrolls.php?${new URLSearchParams({ resource: 'estimates', storeId, page: String(page), ...(range ?? {}) })}`,
  );
}
export function getSavedEstimateSchedule(storeId: string, id: string) {
  return apiRequest<{ schedule: SavedEstimateSchedule; entries: PayrollEntry[] }>(
    `/payrolls.php?${new URLSearchParams({ resource: 'estimate', storeId, id })}`,
  );
}

export function deleteSavedEstimateSchedule(storeId: string, id: string) {
  return apiRequest<{ deleted: boolean }>(
    `/payrolls.php?${new URLSearchParams({ resource: 'estimate', storeId, id })}`,
    { method: 'DELETE' },
  );
}

export function deleteSavedEstimateSchedules(storeId: string, ids: string[]) {
  return apiRequest<{ deleted: boolean; count: number }>(
    `/payrolls.php?${new URLSearchParams({ resource: 'estimates', storeId })}`,
    { method: 'DELETE', body: JSON.stringify({ ids }) },
  );
}

export async function getPayrolls(storeId: string): Promise<Payroll[]> {
  const response = await apiRequest<PayrollListResponse>(
    `/payrolls.php?storeId=${encodeURIComponent(storeId)}`,
    {
      method: "GET",
    }
  );

  return response.items || [];
}

export async function createPayroll(
  storeId: string,
  name: string,
  employees: Employee[]
) {
  const response = await apiRequest<PayrollMutationResponse>("/payrolls.php", {
    method: "POST",
    body: JSON.stringify({
      storeId,
      name,
      employees,
    }),
  });

  return response.id;
}

export async function saveImportedPayroll({
  storeId,
  name,
  startDate,
  endDate,
  entries,
  source = "timesheet_import",
}: {
  storeId: string;
  name: string;
  startDate: string;
  endDate: string;
  entries: Array<Partial<PayrollEntry>>;
  source?: "timesheet_import" | "payroll_estimate";
}) {
  const response = await apiRequest<PayrollMutationResponse>("/payrolls.php", {
    method: "POST",
    body: JSON.stringify({
      storeId,
      name,
      startDate,
      endDate,
      status: "draft",
      entries,
      source,
    }),
  });

  return response.id;
}

export async function deletePayroll(payrollId: string) {
  await apiRequest<{ deleted: boolean }>(
    `/payrolls.php?id=${encodeURIComponent(payrollId)}`,
    {
      method: "DELETE",
    }
  );
}

export async function updatePayroll(id: string, data: Partial<Payroll>) {
  await apiRequest<{ updated: boolean }>("/payrolls.php", {
    method: "PATCH",
    body: JSON.stringify({
      id,
      ...data,
    }),
  });
}

export async function getPayrollEntries(payrollId: string): Promise<PayrollEntry[]> {
  const response = await apiRequest<PayrollEntryListResponse>(
    `/payrolls.php?resource=entries&payrollId=${encodeURIComponent(payrollId)}`,
    {
      method: "GET",
    }
  );

  return response.items || [];
}

export async function updatePayrollEntry(
  entryId: string,
  data: Partial<PayrollEntry>
) {
  await apiRequest<{ updated: boolean }>("/payrolls.php", {
    method: "PATCH",
    body: JSON.stringify({
      resource: "entry",
      id: entryId,
      ...data,
    }),
  });
}

export async function addPayrollEntry(
  payrollId: string,
  seed?: Partial<PayrollEntry>
) {
  const response = await apiRequest<PayrollMutationResponse>("/payrolls.php", {
    method: "POST",
    body: JSON.stringify({
      resource: "entry",
      payrollId,
      seed,
    }),
  });

  return response.id;
}

export async function deletePayrollEntry(entryId: string) {
  await apiRequest<{ deleted: boolean }>(
    `/payrolls.php?entryId=${encodeURIComponent(entryId)}`,
    {
      method: "DELETE",
    }
  );
}
