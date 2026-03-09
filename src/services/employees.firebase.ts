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

export type Employee = {
  id?: string;
  storeId: string;
  name: string;
  role: string;
  hourlyRate: number;
  createdAt?: any;
};

const COLLECTION_NAME = "employees";

export async function getEmployees(storeId: string): Promise<Employee[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("storeId", "==", storeId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Employee));
}

export async function addEmployee(employee: Omit<Employee, "id">) {
  await addDoc(collection(db, COLLECTION_NAME), {
    ...employee,
    createdAt: serverTimestamp(),
  });
}

export async function updateEmployee(
  id: string,
  data: Partial<Omit<Employee, "id" | "storeId" | "createdAt">>
) {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEmployee(id: string) {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}
