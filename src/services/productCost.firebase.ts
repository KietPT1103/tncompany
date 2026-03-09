import { db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  serverTimestamp,
} from "firebase/firestore";

export type ProductCost = {
  product_code: string;
  product_name: string;
  cost: number;
  unit?: string;
  price?: number | null;
  category?: string;
};

// Lưu / cập nhật cost
export async function saveProductCost(data: ProductCost) {
  await setDoc(
    doc(db, "products", data.product_code),
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// Lấy cost theo mã
export async function getProductCost(productCode: string) {
  const snap = await getDoc(doc(db, "products", productCode));
  return snap.exists() ? snap.data() : null;
}

// Lấy toàn bộ cost
export async function getAllProductCosts() {
  const snapshot = await getDocs(collection(db, "products"));
  return snapshot.docs.map((d) => d.data());
}
