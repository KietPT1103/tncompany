import { apiRequest } from "@/lib/api";

export type Employee = {
  id?: string;
  storeId: string;
  employeeCode?: string;
  name: string;
  role: string;
  hourlyRate: number;
  createdAt?: any;
};

type EmployeesResponse = {
  items: Employee[];
};

type EmployeeMutationResponse = {
  id: string;
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
  data: Partial<Omit<Employee, "id" | "storeId" | "createdAt">>
) {
  await apiRequest<{ updated: boolean }>("/employees.php", {
    method: "PATCH",
    body: JSON.stringify({
      id,
      ...data,
    }),
  });
}

export async function deleteEmployee(id: string) {
  await apiRequest<{ deleted: boolean }>(
    `/employees.php?id=${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );
}
