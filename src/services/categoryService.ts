import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";

export type Category = {
  id: string;
  name: string;
  description?: string;
  order?: number;
  isHidden?: boolean;
  storeId?: string;
};

const COLLECTION = "categories";
type CategoryDoc = {
  name?: string;
  description?: string;
  order?: number;
  isHidden?: boolean;
};

export async function getCategories(storeId = "cafe"): Promise<Category[]> {
  const q = query(
    collection(db, COLLECTION),
    where("storeId", "==", storeId),
    orderBy("name", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((categoryDoc) => {
    const data = categoryDoc.data() as CategoryDoc;
    return {
      id: categoryDoc.id,
      name: data.name || categoryDoc.id,
      description: data.description || "",
      order: data.order,
      isHidden: data.isHidden === true,
    };
  });
}

export async function addCategory(
  name: string,
  description?: string,
  storeId = "cafe"
) {
  if (!name.trim()) return null;
  const docRef = await addDoc(collection(db, COLLECTION), {
    name: name.trim(),
    description: description?.trim() || "",
    order: Date.now(),
    isHidden: false,
    storeId: storeId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCategory(
  categoryId: string,
  data: { name?: string; description?: string; isHidden?: boolean }
) {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

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

  await updateDoc(doc(db, COLLECTION, categoryId), payload);
}

export async function removeCategory(categoryId: string) {
  await deleteDoc(doc(db, COLLECTION, categoryId));
}
