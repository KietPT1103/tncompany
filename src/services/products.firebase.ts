import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  addDoc,
} from "firebase/firestore";

export type Product = {
  product_code: string;
  product_name: string;
  cost: number | null;
  price: number | null;
  category?: string;
  has_cost: boolean;
  isSelling?: boolean;
  storeId?: string;
};

// GET ALL
export async function getAllProducts(storeId = "cafe"): Promise<Product[]> {
  const q = query(collection(db, "products"), where("storeId", "==", storeId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Product;
    return {
      ...data,
      isSelling: data.isSelling !== false,
    };
  });
}

// UPSERT FROM EXCEL (KHÔNG GHI ĐÈ COST)
export async function upsertProductsFromExcel(
  products: {
    product_code: string;
    product_name: string;
    price?: number | null;
    category?: string;
  }[],
  storeId: string
) {
  // 1. Get all existing products for this store to find matches
  const q = query(collection(db, "products"), where("storeId", "==", storeId));
  const snap = await getDocs(q);
  const existingMap = new Map<string, string>(); // code -> docId

  snap.forEach((d) => {
    const data = d.data();
    if (data.product_code) {
      existingMap.set(data.product_code, d.id);
    }
  });

  for (const p of products) {
    const existingDocId = existingMap.get(p.product_code);
    const dataToSave = {
      product_code: p.product_code,
      product_name: p.product_name,
      // cost: null, // Don't reset cost if it exists, logic below handles merge
      price: typeof p.price === "number" ? p.price : null,
      category: p.category || "",
      // has_cost: false, // Don't reset has_cost
      storeId,
      updatedAt: serverTimestamp(),
    };

    if (existingDocId) {
      // Update existing
      await setDoc(doc(db, "products", existingDocId), dataToSave, {
        merge: true,
      });
    } else {
      // Create new (Auto ID)
      await addDoc(collection(db, "products"), {
        ...dataToSave,
        cost: null,
        has_cost: false,
        isSelling: true,
      });
    }
  }
}

// UPDATE COST / PRICE / CATEGORY
export async function updateProductCost(
  productCode: string,
  data: {
    cost?: number | null;
    price?: number | null;
    category?: string;
    isSelling?: boolean;
  },
  storeId: string = "cafe" // Added storeId param
) {
  // Find doc by code + storeId
  const q = query(
    collection(db, "products"),
    where("product_code", "==", productCode),
    where("storeId", "==", storeId)
  );
  const snap = await getDocs(q);

  if (!snap.empty) {
    // Should be unique, but if multiple, update all
    for (const d of snap.docs) {
      await updateDoc(doc(db, "products", d.id), {
        ...("cost" in data ? { cost: data.cost, has_cost: true } : {}),
        ...("price" in data ? { price: data.price ?? null } : {}),
        ...("category" in data ? { category: data.category ?? "" } : {}),
        ...("isSelling" in data ? { isSelling: data.isSelling !== false } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } else {
    console.warn(
      `Product ${productCode} not found in store ${storeId} to update.`
    );
  }
}

// DELETE PRODUCT
export async function deleteProduct(productCode: string, storeId: string) {
  const q = query(
    collection(db, "products"),
    where("product_code", "==", productCode),
    where("storeId", "==", storeId)
  );
  const snap = await getDocs(q);

  for (const d of snap.docs) {
    await deleteDoc(doc(db, "products", d.id));
  }
}

// ADD NEW PRODUCT
export async function addProduct(product: Product) {
  // Use addDoc for Auto ID logic
  await addDoc(collection(db, "products"), {
    ...product,
    cost: product.cost ?? null,
    price: product.price ?? null,
    category: product.category ?? "",
    has_cost: product.has_cost ?? Boolean(product.cost),
    isSelling: product.isSelling !== false,
    storeId: product.storeId || "cafe",
    updatedAt: serverTimestamp(),
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
  storeId: string
) {
  const fromName = oldCategoryName.trim();
  const toName = newCategoryName.trim();
  if (!fromName || !toName || fromName === toName) return 0;

  const q = query(collection(db, "products"), where("storeId", "==", storeId));
  const snap = await getDocs(q);

  let updatedCount = 0;
  for (const productDoc of snap.docs) {
    const data = productDoc.data() as { category?: string };
    if ((data.category || "").trim() !== fromName) continue;

    await updateDoc(doc(db, "products", productDoc.id), {
      category: toName,
      updatedAt: serverTimestamp(),
    });
    updatedCount++;
  }

  return updatedCount;
}

export async function normalizeProductCategoryReferences(storeId: string): Promise<{
  updatedProductCount: number;
  createdCategoryCount: number;
}> {
  const categoryQuery = query(
    collection(db, "categories"),
    where("storeId", "==", storeId)
  );
  const categorySnap = await getDocs(categoryQuery);

  const categoryIdSet = new Set<string>();
  const categoryNameToId = new Map<string, string>();
  categorySnap.forEach((categoryDoc) => {
    const data = categoryDoc.data() as { name?: string };
    categoryIdSet.add(categoryDoc.id);
    const normalizedName = (data.name || "").trim().toLowerCase();
    if (normalizedName) {
      categoryNameToId.set(normalizedName, categoryDoc.id);
    }
  });

  const productQuery = query(
    collection(db, "products"),
    where("storeId", "==", storeId)
  );
  const productSnap = await getDocs(productQuery);

  let updatedProductCount = 0;
  let createdCategoryCount = 0;

  for (const productDoc of productSnap.docs) {
    const data = productDoc.data() as { category?: string };
    const rawCategory = (data.category || "").trim();
    if (!rawCategory) continue;
    if (categoryIdSet.has(rawCategory)) continue;

    const normalizedCategoryName = rawCategory.toLowerCase();
    let nextCategoryId = categoryNameToId.get(normalizedCategoryName);

    if (!nextCategoryId) {
      const createdCategoryRef = await addDoc(collection(db, "categories"), {
        name: rawCategory,
        description: "",
        order: Date.now() + createdCategoryCount,
        isHidden: false,
        storeId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      nextCategoryId = createdCategoryRef.id;
      categoryIdSet.add(nextCategoryId);
      categoryNameToId.set(normalizedCategoryName, nextCategoryId);
      createdCategoryCount++;
    }

    await updateDoc(doc(db, "products", productDoc.id), {
      category: nextCategoryId,
      updatedAt: serverTimestamp(),
    });
    updatedProductCount++;
  }

  return { updatedProductCount, createdCategoryCount };
}
// MIGRATE OLD DATA (Products, Categories, Tables)
export async function migrateOldProducts(targetStoreId = "cafe") {
  const collections = ["products", "categories", "tables"];
  let totalCount = 0;

  for (const colName of collections) {
    const q = query(collection(db, colName));
    const snap = await getDocs(q);

    for (const d of snap.docs) {
      const data = d.data();
      // If storeId is missing, update it
      if (!data.storeId) {
        await updateDoc(doc(db, colName, d.id), {
          storeId: targetStoreId,
        });
        totalCount++;
      }
    }
  }
  return totalCount;
}
