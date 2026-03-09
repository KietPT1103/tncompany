import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

export type CafeTable = {
  id: string;
  name: string;
  area?: string;
  active?: boolean;
  order?: number;
  storeId?: string;
};

const TABLES_COLLECTION = "tables";

export async function getTables(storeId = "cafe"): Promise<CafeTable[]> {
  const q = query(
    collection(db, TABLES_COLLECTION),
    where("storeId", "==", storeId),
    orderBy("name", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (doc) =>
      ({
        id: doc.id,
        name: (doc.data() as any).name || doc.id,
        ...doc.data(),
      } as CafeTable)
  );
}

export async function addTable(name: string, area?: string, storeId = "cafe") {
  if (!name.trim()) return null;
  const docRef = await addDoc(collection(db, TABLES_COLLECTION), {
    name: name.trim(),
    area: area?.trim() || "",
    active: true,
    order: Date.now(),
    storeId: storeId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}
