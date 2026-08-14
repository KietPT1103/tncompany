
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

type EmployeesResponse = {
  items: Employee[];
};

type EmployeeMutationResponse = {
  id: string;
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

export async function addEmployee(employee: Omit<Employee, "id">) {
  const response = await apiRequest<EmployeeMutationResponse>("/employees.php", {
    method: "POST",
    body: JSON.stringify(employee),
  });

  return response.id;
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


