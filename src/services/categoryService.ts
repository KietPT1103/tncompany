import { apiRequest } from "@/lib/api";

export type Category = {
  id: string;
  name: string;
  description?: string;
  order?: number | null;
  isHidden?: boolean;
  isPreparationPrintEnabled?: boolean;
  countsAsCup?: boolean;
  isCupCountConfigured?: boolean;
  isSeparatedInSalesReport?: boolean;
  storeId?: string;
};

export async function getCategories(storeId = "cafe"): Promise<Category[]> {
  const { items } = await apiRequest<{ items: Category[] }>(
    `/categories.php?storeId=${encodeURIComponent(storeId)}`,
    { method: "GET" }
  );
  return items;
}

export async function addCategory(
  name: string,
  description?: string,
  storeId = "cafe",
  isPreparationPrintEnabled = true,
  countsAsCup = false
) {
  if (!name.trim()) return null;
  const { id } = await apiRequest<{ id: string }>("/categories.php", {
    method: "POST",
    body: JSON.stringify({
      name: name.trim(),
      description: description?.trim() || "",
      storeId,
      isPreparationPrintEnabled,
      countsAsCup,
    }),
  });
  return id;
}

export async function updateCategory(
  categoryId: string,
  data: {
    name?: string;
    description?: string;
    isHidden?: boolean;
    isPreparationPrintEnabled?: boolean;
    countsAsCup?: boolean;
    isSeparatedInSalesReport?: boolean;
  }
) {
  const payload: Record<string, unknown> = { id: categoryId };

  if (data.name !== undefined) {
    const normalizedName = data.name.trim();
    if (!normalizedName) {
      throw new Error("Tên danh mục không được để trống.");
    }
    payload.name = normalizedName;
  }

  if (data.description !== undefined) {
    payload.description = data.description.trim();
  }

  if (data.isHidden !== undefined) {
    payload.isHidden = data.isHidden === true;
  }

  if (data.isPreparationPrintEnabled !== undefined) {
    payload.isPreparationPrintEnabled = data.isPreparationPrintEnabled === true;
  }

  if (data.countsAsCup !== undefined) {
    payload.countsAsCup = data.countsAsCup === true;
  }

  if (data.isSeparatedInSalesReport !== undefined) {
    payload.isSeparatedInSalesReport = data.isSeparatedInSalesReport === true;
  }

  await apiRequest<{ updated: boolean }>("/categories.php", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function removeCategory(categoryId: string) {
  await apiRequest<{ deleted: boolean }>(
    `/categories.php?id=${encodeURIComponent(categoryId)}`,
    { method: "DELETE" }
  );
}
