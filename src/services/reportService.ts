import { db } from "@/lib/firebase";
import { CostRow } from "./cost";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  where,
  Timestamp,
  limit,
} from "firebase/firestore";

export type Report = {
  id?: string;
  createdAt: Timestamp; // Firestore Timestamp
  startDate?: Timestamp;
  endDate?: Timestamp;
  includeInCashFlow?: boolean;
  fileName: string;
  revenue: number;
  salary: number;
  electric: number;
  other: number;
  totalMaterialCost: number;
  totalCost: number;
  profit: number;
  details: CostRow[];
  storeId?: string;
};

export type NewReport = Omit<Report, "id" | "createdAt" | "startDate" | "endDate"> & {
  createdAt?: Timestamp | Date;
  startDate?: Timestamp | Date;
  endDate?: Timestamp | Date;
};

const REPORTS_COLLECTION = "reports";

export async function saveReport(data: NewReport) {
  let createdAt = Timestamp.now();
  if (data.createdAt) {
    if (data.createdAt instanceof Date) {
      createdAt = Timestamp.fromDate(data.createdAt);
    } else {
      createdAt = data.createdAt;
    }
  }

  let startDate = null;
  if (data.startDate) {
    if (data.startDate instanceof Date) {
      startDate = Timestamp.fromDate(data.startDate);
    } else {
      startDate = data.startDate;
    }
  }

  let endDate = null;
  if (data.endDate) {
    if (data.endDate instanceof Date) {
      endDate = Timestamp.fromDate(data.endDate);
    } else {
      endDate = data.endDate;
    }
  }

  const docRef = await addDoc(collection(db, REPORTS_COLLECTION), {
    ...data,
    storeId: data.storeId || "cafe",
    createdAt,
    startDate,
    endDate,
    includeInCashFlow: data.includeInCashFlow ?? true,
  });
  return docRef.id;
}

export async function getReports(
  limitCount = 20,
  startDate?: Date,
  endDate?: Date,
  storeId = "cafe"
) {
  let q = query(
    collection(db, REPORTS_COLLECTION),
    where("storeId", "==", storeId),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

  if (startDate && endDate) {
    q = query(
      collection(db, REPORTS_COLLECTION),
      where("storeId", "==", storeId),
      where("createdAt", ">=", Timestamp.fromDate(startDate)),
      where("createdAt", "<=", Timestamp.fromDate(endDate)),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Report[];
}

export async function getReportById(id: string) {
  const docRef = doc(db, REPORTS_COLLECTION, id);
  const snap = await getDoc(docRef);

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data(),
  } as Report;
}

export async function updateReport(id: string, data: Partial<Report>) {
  const docRef = doc(db, REPORTS_COLLECTION, id);
  await import("firebase/firestore").then(({ updateDoc }) =>
    updateDoc(docRef, data)
  );
}

export async function deleteReport(id: string) {
  const docRef = doc(db, REPORTS_COLLECTION, id);
  await import("firebase/firestore").then(({ deleteDoc }) => deleteDoc(docRef));
}
