import { apiRequest } from "@/lib/api";

export type Product = {
  product_code: string;
  product_name: string;
  cost: number | null;
  price: number | null;
  category?: string;
  categoryName?: string;
  has_cost: boolean;
  isSelling?: boolean;
  stockQuantity?: number;
  componentCount?: number;
  componentCostTotal?: number;
  components?: ProductComponent[];
  storeId?: string;
};

export type ProductComponent = {
  productCode: string;
  productName: string;
  quantity: number;
  cost: number;
  stockQuantity: number;
  lineTotal: number;
};

export type ProductPayload = {
  product_code: string;
  product_name: string;
  cost: number | null;
  price: number | null;
  category?: string;
  has_cost?: boolean;
  isSelling?: boolean;
  storeId?: string;
  stockQuantity?: number;
  components?: Array<{
    productCode: string;
    quantity: number;
  }>;
};

export async function getAllProducts(storeId = "cafe"): Promise<Product[]> {
  const { items } = await apiRequest<{ items: Product[] }>(
    `/products.php?storeId=${encodeURIComponent(storeId)}`,
    { method: "GET" }
  );
  return items.map((item) => ({
    ...item,
    isSelling: item.isSelling !== false,
    stockQuantity: item.stockQuantity ?? 0,
    componentCount: item.componentCount ?? 0,
    componentCostTotal: item.componentCostTotal ?? 0,
    components: item.components || [],
  }));
}

export async function upsertProductsFromExcel(
  products: {
    product_code: string;
    product_name: string;
    cost?: number | null;
    price?: number | null;
    stockQuantity?: number | null;
    category?: string;
    isSelling?: boolean;
    components?: Array<{
      productCode: string;
      quantity: number;
    }>;
  }[],
  storeId: string
) {
  await apiRequest<{ imported: boolean }>("/products.php", {
    method: "POST",
    body: JSON.stringify({
      action: "import",
      items: products,
      storeId,
    }),
  });
}

export async function updateProductCost(
  productCode: string,
  data: {
    productName?: string;
    cost?: number | null;
    price?: number | null;
    category?: string;
    isSelling?: boolean;
    stockQuantity?: number;
    components?: Array<{
      productCode: string;
      quantity: number;
    }>;
  },
  storeId = "cafe"
) {
  await apiRequest<{ updated: boolean }>("/products.php", {
    method: "PATCH",
    body: JSON.stringify({
      productCode,
      storeId,
      ...data,
    }),
  });
}

export async function deleteProduct(productCode: string, storeId: string) {
  await apiRequest<{ deleted: boolean }>(
    `/products.php?storeId=${encodeURIComponent(storeId)}&productCode=${encodeURIComponent(productCode)}`,
    { method: "DELETE" }
  );
}

export async function addProduct(product: ProductPayload) {
  await apiRequest<{ created: boolean }>("/products.php", {
    method: "POST",
    body: JSON.stringify({
      ...product,
      cost: product.cost ?? null,
      price: product.price ?? null,
      category: product.category ?? "",
      has_cost: product.has_cost ?? Boolean(product.cost),
      isSelling: product.isSelling !== false,
      storeId: product.storeId || "cafe",
      stockQuantity: product.stockQuantity ?? 0,
      components: product.components || [],
    }),
  });
}

export async function setProductSellingStatus(
  productCode: string,
  isSelling: boolean,
  storeId: string
) {
  await updateProductCost(productCode, { isSelling }, storeId);
}

export async function replaceProductCategoryName(
  oldCategoryName: string,
  newCategoryName: string,
  _storeId: string
) {
  const fromName = oldCategoryName.trim();
  const toName = newCategoryName.trim();
  if (!fromName || !toName || fromName === toName) return 0;
  return 0;
}

export async function normalizeProductCategoryReferences(storeId: string): Promise<{
  updatedProductCount: number;
  createdCategoryCount: number;
}> {
  return apiRequest<{
    updatedProductCount: number;
    createdCategoryCount: number;
  }>("/products.php", {
    method: "POST",
    body: JSON.stringify({
      action: "normalize-categories",
      storeId,
    }),
  });
}

export async function migrateOldProducts(targetStoreId = "cafe") {
  return targetStoreId ? 0 : 0;
}
