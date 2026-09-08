import { apiRequest } from "@/lib/api";

export type Ingredient = {
  id: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  purchaseUnit: string;
  baseUnit: string;
  purchaseToBaseFactor: number;
  cost: number | null;
  directCost: number | null;
  conversionSourceIngredientId: string | null;
  conversionSourceCode?: string | null;
  conversionSourceName?: string | null;
  conversionSourceUnit?: string | null;
  conversionInputQuantity: number | null;
  conversionOutputQuantity: number | null;
  conversionComponents: Array<{ ingredientId: string; ingredientCode: string; ingredientName: string; unit: string; inputQuantity: number; cost: number | null }>;
  stockQuantity: number;
  preparationStockQuantity: number;
  supplierId: string | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  supplierItemCode: string;
  description: string;
  isActive: boolean;
  storeId: string;
};

export type IngredientInput = {
  storeId: string;
  ingredientCode: string;
  ingredientName: string;
  unit?: string;
  purchaseUnit?: string;
  baseUnit?: string;
  purchaseToBaseFactor?: number;
  conversionSourceIngredientId?: string | null;
  conversionInputQuantity?: number | null;
  conversionOutputQuantity?: number | null;
  conversionComponents?: Array<{ ingredientId: string; inputQuantity: number }>;
  cost?: number | null;
  stockQuantity?: number;
  supplierId?: string | null;
  supplierItemCode?: string;
  description?: string;
  isActive?: boolean;
};

export async function getIngredients(storeId: string, search = "", context?: "stock") {
  const query = new URLSearchParams({ storeId });
  if (search) query.set("search", search);
  if (context) query.set("context", context);
  return apiRequest<{ items: Ingredient[]; suggestedCode: string }>(
    `/ingredients.php?${query.toString()}`
  );
}

export async function getNextIngredientCode(storeId: string) {
  const result = await apiRequest<{ suggestedCode: string }>(
    `/ingredients.php?action=next-code&storeId=${encodeURIComponent(storeId)}`
  );
  return result.suggestedCode;
}

export async function createIngredient(input: IngredientInput) {
  return apiRequest("/ingredients.php", { method: "POST", body: JSON.stringify(input) });
}

export async function migrateIngredientCategoryProducts(storeId: string) {
  return apiRequest<{ migratedCount: number; movedCount: number }>("/ingredients.php", {
    method: "POST",
    body: JSON.stringify({ action: "migrate-category", storeId }),
  });
}

export async function updateIngredient(code: string, input: Partial<IngredientInput> & { storeId: string }) {
  return apiRequest("/ingredients.php", {
    method: "PATCH",
    body: JSON.stringify({ ...input, ingredientCode: code }),
  });
}

export async function deleteIngredient(storeId: string, code: string) {
  return apiRequest(
    `/ingredients.php?storeId=${encodeURIComponent(storeId)}&ingredientCode=${encodeURIComponent(code)}`,
    { method: "DELETE" }
  );
}
