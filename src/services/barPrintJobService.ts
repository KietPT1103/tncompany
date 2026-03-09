import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

export type BarPrintJobStatus = "pending" | "printed";

export type BarPrintJobItem = {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
};

export type BarPrintJob = {
  id: string;
  storeId: string;
  tableNumber: string;
  sourceBillId?: string;
  items: BarPrintJobItem[];
  createdById?: string;
  createdByName?: string;
  status: BarPrintJobStatus;
  createdAt?: Timestamp;
  printedAt?: Timestamp;
  printedByTerminal?: string;
};

export type NewBarPrintJob = {
  storeId: string;
  tableNumber: string;
  sourceBillId?: string;
  items: BarPrintJobItem[];
  createdById?: string;
  createdByName?: string;
};

const BAR_PRINT_JOB_COLLECTION = "bar_print_jobs";

export async function createBarPrintJob(data: NewBarPrintJob) {
  const payload: Record<string, unknown> = {
    storeId: data.storeId,
    tableNumber: data.tableNumber.trim(),
    sourceBillId: data.sourceBillId || "",
    items: data.items,
    createdById: data.createdById || "",
    createdByName: data.createdByName || "",
    status: "pending",
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, BAR_PRINT_JOB_COLLECTION), payload);
  return docRef.id;
}

export function subscribePendingBarPrintJobs(
  storeId: string,
  onChange: (jobs: BarPrintJob[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, BAR_PRINT_JOB_COLLECTION),
    where("storeId", "==", storeId),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const jobs = snapshot.docs.map(
        (item) =>
          ({
            id: item.id,
            ...(item.data() as Omit<BarPrintJob, "id">),
          } as BarPrintJob)
      );
      onChange(jobs);
    },
    (error) => {
      if (onError) {
        onError(error as Error);
      } else {
        console.error("Failed to subscribe bar print jobs", error);
      }
    }
  );
}

export async function markBarPrintJobPrinted(
  jobId: string,
  terminalName?: string
) {
  await updateDoc(doc(db, BAR_PRINT_JOB_COLLECTION, jobId), {
    status: "printed",
    printedAt: serverTimestamp(),
    printedByTerminal: terminalName?.trim() || "",
  });
}
