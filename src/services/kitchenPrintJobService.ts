import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

export type KitchenPrintJobStatus = "pending" | "printed";

export type KitchenPrintJobItem = {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
};

export type KitchenPrintJob = {
  id: string;
  storeId: string;
  orderKey: string;
  tableNumber: string;
  items: KitchenPrintJobItem[];
  createdById?: string;
  createdByName?: string;
  status: KitchenPrintJobStatus;
  createdAt?: Timestamp;
  printedAt?: Timestamp;
  printedByTerminal?: string;
};

export type NewKitchenPrintJob = {
  storeId: string;
  orderKey: string;
  tableNumber: string;
  items: KitchenPrintJobItem[];
  createdById?: string;
  createdByName?: string;
};

const KITCHEN_PRINT_JOB_COLLECTION = "kitchen_print_jobs";

export async function createKitchenPrintJob(data: NewKitchenPrintJob) {
  const payload: Record<string, unknown> = {
    storeId: data.storeId,
    orderKey: data.orderKey.trim(),
    tableNumber: data.tableNumber.trim(),
    items: data.items,
    createdById: data.createdById || "",
    createdByName: data.createdByName || "",
    status: "pending",
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, KITCHEN_PRINT_JOB_COLLECTION), payload);
  return docRef.id;
}

export function subscribePendingKitchenPrintJobs(
  storeId: string,
  onChange: (jobs: KitchenPrintJob[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, KITCHEN_PRINT_JOB_COLLECTION),
    where("storeId", "==", storeId),
    where("status", "==", "pending")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const jobs = snapshot.docs
        .map(
        (item) =>
          ({
            id: item.id,
            ...(item.data() as Omit<KitchenPrintJob, "id">),
          } as KitchenPrintJob)
        )
        .sort((a, b) => {
          const aSec = a.createdAt?.seconds || 0;
          const bSec = b.createdAt?.seconds || 0;
          return aSec - bSec;
        });
      onChange(jobs);
    },
    (error) => {
      if (onError) {
        onError(error as Error);
      } else {
        console.error("Failed to subscribe kitchen print jobs", error);
      }
    }
  );
}

export async function markKitchenPrintJobPrinted(
  jobId: string,
  terminalName?: string
) {
  await updateDoc(doc(db, KITCHEN_PRINT_JOB_COLLECTION, jobId), {
    status: "printed",
    printedAt: serverTimestamp(),
    printedByTerminal: terminalName?.trim() || "",
  });
}
