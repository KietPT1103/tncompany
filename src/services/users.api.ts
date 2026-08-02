import { apiRequest } from "@/lib/api";
import { AppPermission, UserRole } from "@/types/auth";

export type ManagedUser = {
  id: string;
  email: string;
  username?: string | null;
  displayName?: string | null;
  role: UserRole;
  storeId?: string | null;
  storeIds: string[];
  isActive: boolean;
  permissions: AppPermission[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

export async function getManagedUsers() {
  const response = await apiRequest<{ items: ManagedUser[] }>("/users.php", {
    method: "GET",
  });

  return response.items || [];
}

export async function createManagedUser(payload: {
  email: string;
  username?: string;
  displayName?: string;
  password: string;
  role: UserRole;
  storeId?: string;
  storeIds?: string[];
  isActive?: boolean;
  permissions?: AppPermission[];
}) {
  const response = await apiRequest<{ item: ManagedUser }>("/users.php", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.item;
}

export async function updateManagedUser(
  id: string,
  payload: Partial<{
    email: string;
    username: string;
    displayName: string;
    password: string;
    role: UserRole;
    storeId: string;
    storeIds: string[];
    isActive: boolean;
    permissions: AppPermission[];
  }>
) {
  const response = await apiRequest<{ item: ManagedUser }>("/users.php", {
    method: "PATCH",
    body: JSON.stringify({
      id,
      ...payload,
    }),
  });

  return response.item;
}

export async function deleteManagedUser(id: string) {
  return apiRequest<{ deleted: boolean }>(`/users.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
