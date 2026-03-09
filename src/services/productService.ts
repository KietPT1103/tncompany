import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  writeBatch,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { PRODUCT_COST } from "@/config/productCost";

export type ProductCostValues = Record<string, number>;

// ...

/**
 * Fetches product costs from Firebase for a specific store and returns a map of product_code -> cost
 */
export async function fetchProductCosts(
  storeId = "cafe"
): Promise<ProductCostValues> {
  const q = query(collection(db, "products"), where("storeId", "==", storeId));
  const snapshot = await getDocs(q);
  const costMap: ProductCostValues = {};

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (typeof data.cost === "number" && data.product_code) {
      costMap[data.product_code] = data.cost;
    }
  });

  return costMap;
}

/**
 * Seeds the initial data from the local config file to Firebase.
 * This is a one-time migration helper.
 */
export async function seedProductCosts() {
  const batch = writeBatch(db);
  const entries = Object.entries(PRODUCT_COST);

  if (entries.length === 0) return;

  for (const [code, cost] of entries) {
    const docRef = doc(db, "products", code);
    batch.set(
      docRef,
      {
        product_code: code,
        cost: cost,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
  console.log(`Seeded ${entries.length} products to Firebase.`);
}
