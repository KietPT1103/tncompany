import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  doc,
  updateDoc,
  deleteDoc,
  QueryConstraint,
} from "firebase/firestore";

export type BillStatus = "completed" | "cancelled";
export type PaymentMethod = "cash" | "transfer";

export type BillItemInput = {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
  note?: string;
  basePrice?: number;
  surchargePerUnit?: number;
  surchargeTotal?: number;
};

export type BillSurcharge = {
  id: string;
  name: string;
  type: "percent" | "fixed";
  value: number;
  amount: number;
};

export type NewBill = {
  tableNumber: string;
  note?: string;
  total: number;
  items: BillItemInput[];
  subtotalBeforeSurcharge?: number;
  surchargeTotal?: number;
  appliedSurcharges?: BillSurcharge[];
  storeId?: string;
  status?: BillStatus;
  paymentMethod?: PaymentMethod;
  cashReceived?: number;
  changeAmount?: number;
  shiftId?: string;
  cashierId?: string;
  cashierName?: string;
};

export type Bill = NewBill & {
  id: string;
  createdAt?: Timestamp;
  cancelledAt?: Timestamp;
  cancelledBy?: string;
};

const BILLS_COLLECTION = "bills";

export async function saveBill(data: NewBill) {
  const payload: Record<string, unknown> = {
    tableNumber: data.tableNumber,
    total: data.total,
    items: data.items,
    storeId: data.storeId || "cafe",
    status: data.status || "completed",
    paymentMethod: data.paymentMethod || "cash",
    createdAt: serverTimestamp(),
  };

  if (data.note && data.note.trim()) {
    payload.note = data.note.trim();
  }
  if (data.subtotalBeforeSurcharge !== undefined) {
    payload.subtotalBeforeSurcharge = data.subtotalBeforeSurcharge;
  }
  if (data.surchargeTotal !== undefined) {
    payload.surchargeTotal = data.surchargeTotal;
  }
  if (data.appliedSurcharges !== undefined) {
    payload.appliedSurcharges = data.appliedSurcharges;
  }
  if (data.cashReceived !== undefined) {
    payload.cashReceived = data.cashReceived;
  }
  if (data.changeAmount !== undefined) {
    payload.changeAmount = data.changeAmount;
  }
  if (data.shiftId) {
    payload.shiftId = data.shiftId;
  }
  if (data.cashierId) {
    payload.cashierId = data.cashierId;
  }
  if (data.cashierName) {
    payload.cashierName = data.cashierName;
  }

  const docRef = await addDoc(collection(db, BILLS_COLLECTION), payload);

  return docRef.id;
}

const filterByStatus = (bills: Bill[], includeCancelled: boolean) => {
  if (includeCancelled) return bills;
  return bills.filter((bill) => bill.status !== "cancelled");
};

export async function getRecentBills(
  storeId = "cafe",
  limitCount = 20,
  includeCancelled = false
) {
  const q = query(
    collection(db, BILLS_COLLECTION),
    where("storeId", "==", storeId),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  const mapped = snapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...(doc.data() as Omit<Bill, "id">),
      } as Bill)
  );
  return filterByStatus(mapped, includeCancelled);
}

export async function getBills(options?: {
  startDate?: Date;
  endDate?: Date;
  limitCount?: number;
  storeId?: string;
  includeCancelled?: boolean;
}) {
  const {
    startDate,
    endDate,
    limitCount = 100,
    storeId = "cafe",
    includeCancelled = false,
  } = options || {};
  const constraints: QueryConstraint[] = [
    where("storeId", "==", storeId),
    orderBy("createdAt", "desc"),
  ];

  if (startDate) {
    constraints.push(where("createdAt", ">=", Timestamp.fromDate(startDate)));
  }
  if (endDate) {
    constraints.push(where("createdAt", "<=", Timestamp.fromDate(endDate)));
  }
  if (limitCount) {
    constraints.push(limit(limitCount));
  }

  const q = query(collection(db, BILLS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);
  const mapped = snapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...(doc.data() as Omit<Bill, "id">),
      } as Bill)
  );
  return filterByStatus(mapped, includeCancelled);
}

export async function updateBill(
  id: string,
  data: Partial<NewBill> & { createdAt?: Date; cancelledAt?: Date }
) {
  const payload: Record<string, unknown> = {};

  if (data.tableNumber !== undefined) payload.tableNumber = data.tableNumber;
  if (data.total !== undefined) payload.total = data.total;
  if (data.items !== undefined) payload.items = data.items;
  if (data.subtotalBeforeSurcharge !== undefined) {
    payload.subtotalBeforeSurcharge = data.subtotalBeforeSurcharge;
  }
  if (data.surchargeTotal !== undefined) payload.surchargeTotal = data.surchargeTotal;
  if (data.appliedSurcharges !== undefined) {
    payload.appliedSurcharges = data.appliedSurcharges;
  }
  if (data.storeId !== undefined) payload.storeId = data.storeId;
  if (data.status !== undefined) payload.status = data.status;
  if (data.paymentMethod !== undefined) payload.paymentMethod = data.paymentMethod;
  if (data.cashReceived !== undefined) payload.cashReceived = data.cashReceived;
  if (data.changeAmount !== undefined) payload.changeAmount = data.changeAmount;
  if (data.shiftId !== undefined) payload.shiftId = data.shiftId;
  if (data.cashierId !== undefined) payload.cashierId = data.cashierId;
  if (data.cashierName !== undefined) payload.cashierName = data.cashierName;

  if (data.note !== undefined) {
    payload.note = data.note?.trim() || "";
  }

  if (data.createdAt) {
    payload.createdAt = Timestamp.fromDate(data.createdAt);
  }
  if (data.cancelledAt) {
    payload.cancelledAt = Timestamp.fromDate(data.cancelledAt);
  }

  if (Object.keys(payload).length === 0) return;

  await updateDoc(doc(db, BILLS_COLLECTION, id), payload);
}

export async function cancelBill(
  id: string,
  cancelledBy?: string,
  cancelNote?: string
) {
  const payload: Record<string, unknown> = {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
  };
  if (cancelledBy) payload.cancelledBy = cancelledBy;
  if (cancelNote !== undefined) payload.note = cancelNote.trim();
  await updateDoc(doc(db, BILLS_COLLECTION, id), payload);
}

export async function getBillsByShift(shiftId: string) {
  const q = query(collection(db, BILLS_COLLECTION), where("shiftId", "==", shiftId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...(doc.data() as Omit<Bill, "id">),
      } as Bill)
  );
}

export async function deleteBill(id: string) {
  await deleteDoc(doc(db, BILLS_COLLECTION, id));
}
