import { apiRequest } from "@/lib/api";
import { Employee } from "./employees.firebase";

export type Payroll = {
  id?: string;
  storeId: string;
  name: string;
  status: "draft" | "locked";
  createdAt?: any;
};

export interface Shift {
  id: string;
  date: string;
  inTime: string;
  outTime: string;
  hours: number;
  isWeekend: boolean;
  isValid: boolean;
}

export type PayrollEntry = {
  id?: string;
  payrollId: string;
  employeeId: string;
  employeeCode?: string;
  employeeName: string;
  role: string;
  hourlyRate: number;
  totalHours: number;
  weekendHours: number;
  salary: number;
  allowances?: { name: string; amount: number }[];
  note: string;
  salaryType?: "hourly" | "fixed";
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
}: {
  storeId: string;
  name: string;
  startDate: string;
  endDate: string;
  entries: Array<Partial<PayrollEntry>>;
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
