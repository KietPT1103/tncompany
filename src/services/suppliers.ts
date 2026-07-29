import { apiRequest } from "@/lib/api";

export type Supplier = {
  id: string;
  supplierCode: string;
  supplierName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  taxCode: string;
  note: string;
  isActive: boolean;
  storeId: string;
  ingredientCount: number;
};

export type SupplierInput = Omit<Supplier, "id" | "ingredientCount">;

export async function getSuppliers(storeId: string, search = "") {
  const query = new URLSearchParams({ storeId });
  if (search) query.set("search", search);
  return apiRequest<{ items: Supplier[] }>(`/suppliers.php?${query.toString()}`);
}

export async function getNextSupplierCode(storeId: string) {
  const result = await apiRequest<{ suggestedCode: string }>(
    `/suppliers.php?action=next-code&storeId=${encodeURIComponent(storeId)}`
  );
  return result.suggestedCode;
}

export async function createSupplier(input: Partial<SupplierInput> & Pick<SupplierInput, "storeId" | "supplierCode" | "supplierName">) {
  return apiRequest("/suppliers.php", { method: "POST", body: JSON.stringify(input) });
}

export async function updateSupplier(code: string, input: Partial<SupplierInput> & { storeId: string }) {
  return apiRequest("/suppliers.php", {
    method: "PATCH",
    body: JSON.stringify({ ...input, supplierCode: code }),
  });
}

export async function deleteSupplier(storeId: string, code: string) {
  return apiRequest(
    `/suppliers.php?storeId=${encodeURIComponent(storeId)}&supplierCode=${encodeURIComponent(code)}`,
    { method: "DELETE" }
  );
}
