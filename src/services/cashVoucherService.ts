import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

export type CashVoucherType = "income" | "expense";

export type NewCashVoucher = {
  storeId: string;
  type: CashVoucherType;
  amount: number;
  category: string;
  note?: string;
  personGroup?: string;
  personName?: string;
  includeInCashFlow?: boolean;
  happenedAt?: Date;
  shiftId?: string;
  cashierId?: string;
  cashierName?: string;
};

export type CashVoucher = NewCashVoucher & {
  id: string;
  code: string;
  createdAt?: Timestamp;
  happenedAt?: Timestamp;
};

const VOUCHER_COLLECTION = "cash_vouchers";

const normalizeCodeNumber = (value: number) => String(value).padStart(6, "0");
const toDate = (timestamp?: Timestamp) =>
  timestamp?.seconds ? new Date(timestamp.seconds * 1000) : undefined;

const generateVoucherCode = (type: CashVoucherType) => {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const random = normalizeCodeNumber(Math.floor(Math.random() * 999999));
  const prefix = type === "income" ? "TTHD" : "CTM";
  return `${prefix}${y}${m}${d}${random}`;
};

export async function createCashVoucher(data: NewCashVoucher) {
  const happenedAtDate = data.happenedAt || new Date();
  const payload: Record<string, unknown> = {
    code: generateVoucherCode(data.type),
    storeId: data.storeId,
    type: data.type,
    amount: data.amount,
    category: data.category.trim(),
    note: data.note?.trim() || "",
    personGroup: data.personGroup?.trim() || "Khac",
    personName: data.personName?.trim() || "",
    includeInCashFlow: data.includeInCashFlow !== false,
    happenedAt: Timestamp.fromDate(happenedAtDate),
    shiftId: data.shiftId || "",
    cashierId: data.cashierId || "",
    cashierName: data.cashierName || "",
    createdAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, VOUCHER_COLLECTION), payload);
  return docRef.id;
}

export async function getCashVouchers(options: {
  storeId: string;
  startDate?: Date;
  endDate?: Date;
  limitCount?: number;
  shiftId?: string;
}) {
  const { storeId, startDate, endDate, limitCount = 500, shiftId } = options;

  const q = query(
    collection(db, VOUCHER_COLLECTION),
    where("storeId", "==", storeId),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  const rows = snapshot.docs.map(
    (item) =>
      ({
        id: item.id,
        ...(item.data() as Omit<CashVoucher, "id">),
      } as CashVoucher)
  );

  const filtered = rows.filter((voucher) => {
    if (shiftId && voucher.shiftId !== shiftId) return false;
    const happened = toDate(voucher.happenedAt) || toDate(voucher.createdAt);
    if (startDate && happened && happened < startDate) return false;
    if (endDate && happened && happened > endDate) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const aSec = a.happenedAt?.seconds || a.createdAt?.seconds || 0;
    const bSec = b.happenedAt?.seconds || b.createdAt?.seconds || 0;
    return bSec - aSec;
  });

  return filtered;
}

export async function updateCashVoucherBasic(
  id: string,
  data: { category: string; amount: number }
) {
  const payload: Record<string, unknown> = {};
  if (data.category !== undefined) {
    payload.category = data.category.trim();
  }
  if (data.amount !== undefined) {
    payload.amount = data.amount;
  }
  if (Object.keys(payload).length === 0) return;

  await updateDoc(doc(db, VOUCHER_COLLECTION, id), payload);
}
