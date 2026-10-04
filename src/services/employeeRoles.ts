import { apiRequest } from "@/lib/api";

export type EmployeeRole = {
  id: string;
  storeId: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  employeeCount: number;
  createdAt?: unknown;
};

export async function getEmployeeRoles(storeId: string) {
  const response = await apiRequest<{ items: EmployeeRole[] }>(
    `/employee-roles.php?storeId=${encodeURIComponent(storeId)}`,
  );
  return response.items || [];
}

export async function addEmployeeRole(storeId: string, name: string) {
  return apiRequest<{ id: string }>("/employee-roles.php", {
    method: "POST",
    body: JSON.stringify({ storeId, name }),
  });
}

export async function updateEmployeeRole(id: string, name: string) {
  return apiRequest<{ updated: boolean }>("/employee-roles.php", {
    method: "PATCH",
    body: JSON.stringify({ id, name }),
  });
}

export async function deleteEmployeeRole(id: string) {
  return apiRequest<{ deleted: boolean }>(
    `/employee-roles.php?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
