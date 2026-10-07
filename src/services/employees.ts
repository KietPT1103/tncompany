
import { apiRequest } from "@/lib/api";

export type EmployeeAllowance = {
  name: string;
  amount: number;
  period?: "all" | "1" | "2";
};

export type Employee = {
  id?: string;
  storeId: string;
  employeeCode?: string;
  name: string;
  role: string;
  roles?: string[];
  hourlyRate: number;
  salaryType?: "hourly" | "monthly";
  monthlySalary?: number;
  expectedWorkDays?: number;
  paidLeaveDays?: number;
  attendanceBonusEnabled?: boolean;
  attendanceBonusDays?: number;
  attendanceBonusAmount?: number;
  standardHours?: number;
  allowances?: EmployeeAllowance[];
  createdAt?: any;
};

export function getEmployeeRoleNames(
  employee?: Partial<Pick<Employee, "role" | "roles">> | null,
): string[] {
  const values = [employee?.role, ...(employee?.roles || [])]
    .map((role) => String(role || "").trim())
    .filter(Boolean);

  return Array.from(new Set(values));
}

type EmployeesResponse = {
  items: Employee[];
};

type EmployeeMutationResponse = {
  id: string;
  employeeCode: string;
};

type EmployeeUpdateResponse = {
  updated: boolean;
  item?: Employee;
};

export async function getEmployees(storeId: string): Promise<Employee[]> {
  const response = await apiRequest<EmployeesResponse>(
    `/employees.php?storeId=${encodeURIComponent(storeId)}`,
    {
      method: "GET",
    }
  );

  return response.items || [];
}

export function createEmployee(employee: Omit<Employee, "id">) {
  return apiRequest<EmployeeMutationResponse>("/employees.php", {
    method: "POST",
    body: JSON.stringify(employee),
  });
}

export async function addEmployee(employee: Omit<Employee, "id">) {
  return (await createEmployee(employee)).id;
}

export async function updateEmployee(
  id: string,
  data: Partial<Omit<Employee, "id" | "createdAt">>
) {
  const response = await apiRequest<EmployeeUpdateResponse>("/employees.php", {
    method: "PATCH",
    body: JSON.stringify({
      id,
      ...data,
    }),
  });

  return response.item || null;
}

export async function deleteEmployee(id: string) {
  await apiRequest<{ deleted: boolean }>(
    `/employees.php?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );
}


