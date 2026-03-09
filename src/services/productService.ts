import { PRODUCT_COST } from "@/config/productCost";
import { getAllProducts, updateProductCost } from "@/services/products.firebase";

export type ProductCostValues = Record<string, number>;

export async function fetchProductCosts(
  storeId = "cafe"
): Promise<ProductCostValues> {
  const costMap: ProductCostValues = {};
  const products = await getAllProducts(storeId);

  products.forEach((product) => {
    if (typeof product.cost === "number" && product.product_code) {
      costMap[product.product_code] = product.cost;
    }
  });

  return costMap;
}

export async function seedProductCosts() {
  const entries = Object.entries(PRODUCT_COST);

  if (entries.length === 0) return;

  for (const [code, cost] of entries) {
    await updateProductCost(code, { cost }, "cafe");
  }

  console.log(`Seeded ${entries.length} products to MySQL API.`);
}
