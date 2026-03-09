import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  writeBatch,
  orderBy,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { Employee } from "./employees.firebase";

export type Payroll = {
  id?: string;
  storeId: string;
  name: string; // e.g., "Jan 2025 - Period 1"
  status: "draft" | "locked";
  createdAt?: any;
};

// Shared Shift Interface
export interface Shift {
  id: string;
  date: string;
  inTime: string;
  outTime: string;
  hours: number;
  isWeekend: boolean;
  isValid: boolean;
}

export type PayrollEntry = {
  id?: string;
  payrollId: string;
  employeeId: string;
  employeeName: string;
  role: string;
  hourlyRate: number;
  totalHours: number;
  weekendHours: number;
  salary: number;
  allowances?: { name: string; amount: number }[];
  note: string;
  // Fixed Salary Fields
  salaryType?: "hourly" | "fixed"; // Default 'hourly' if undefined
  fixedSalary?: number; // Lương cứng
  standardHours?: number; // Định mức giờ (ví dụ 300)
  shifts?: Shift[]; // Detailed shifts
};

const PAYROLLS_COLLECTION = "payrolls";
const ENTRIES_COLLECTION = "payroll_entries";

// --- PAYROLLS ---

export async function getPayrolls(storeId: string): Promise<Payroll[]> {
  const q = query(
    collection(db, PAYROLLS_COLLECTION),
    where("storeId", "==", storeId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payroll));
}

export async function createPayroll(
  storeId: string,
  name: string,
  employees: Employee[]
) {
  const batch = writeBatch(db);

  // 1. Create Payroll Record
  const payrollRef = doc(collection(db, PAYROLLS_COLLECTION));
  batch.set(payrollRef, {
    storeId,
    name,
    status: "draft",
    createdAt: serverTimestamp(),
  });

  // 2. Create Entries for each employee
  employees.forEach((emp) => {
    const entryRef = doc(collection(db, ENTRIES_COLLECTION));
    const entryData: PayrollEntry = {
      payrollId: payrollRef.id,
      employeeId: emp.id || "unknown",
      employeeName: emp.name || "Unknown",
      role: emp.role || "Unknown",
      hourlyRate: emp.hourlyRate,
      totalHours: 0,
      weekendHours: 0,
      salary: 0,
      allowances: [],
      note: "",
      salaryType: "hourly",
      fixedSalary: 0,
      standardHours: 0,
    };
    batch.set(entryRef, entryData);
  });

  await batch.commit();
  return payrollRef.id;
}

export async function deletePayroll(payrollId: string) {
  // Note: Ideally, we should also delete all entries, but for simplicity
  // allow them to be orphaned or delete them if needed carefully.
  // For a robust app, use cloud functions or batch delete.
  // Here we just update status to hidden or similar if needed,
  // but let's stick to deleting the payroll doc for now.
  // We'll leave entries for now or implement batch delete if user asks.
  // Actually, let's try to consistency delete entries.

  const entries = await getPayrollEntries(payrollId);
  const batch = writeBatch(db);

  batch.delete(doc(db, PAYROLLS_COLLECTION, payrollId));
  entries.forEach((e) => {
    if (e.id) batch.delete(doc(db, ENTRIES_COLLECTION, e.id));
  });

  await batch.commit();
}

export async function updatePayroll(id: string, data: Partial<Payroll>) {
  await updateDoc(doc(db, PAYROLLS_COLLECTION, id), data);
}

// --- ENTRIES ---

export async function getPayrollEntries(
  payrollId: string
): Promise<PayrollEntry[]> {
  const q = query(
    collection(db, ENTRIES_COLLECTION),
    where("payrollId", "==", payrollId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PayrollEntry));
}

export async function updatePayrollEntry(
  entryId: string,
  data: Partial<PayrollEntry>
) {
  await updateDoc(doc(db, ENTRIES_COLLECTION, entryId), data);
}

export async function addPayrollEntry(payrollId: string) {
  const entryData: PayrollEntry = {
    payrollId,
    employeeId: "manual_" + Date.now(),
    employeeName: "Nhân viên mới",
    role: "Phục vụ",
    hourlyRate: 0,
    totalHours: 0,
    weekendHours: 0,
    salary: 0,
    allowances: [],
    note: "",
    salaryType: "hourly",
    fixedSalary: 0,
    standardHours: 0,
  };
  await addDoc(collection(db, ENTRIES_COLLECTION), entryData);
}

export async function deletePayrollEntry(entryId: string) {
  await deleteDoc(doc(db, ENTRIES_COLLECTION, entryId));
}
