export type Metrics = Record<string, number>;
export type RevenueDay = {
  date: string;
  totals: Metrics;
  shifts?: Record<string, Metrics>;
  transactions?: Array<{ type: string; code: string; room: string; amount: number; time: string; payment: string | null }>;
};
export type RevenueReport = {
  version: number;
  source: string;
  from: string;
  to: string;
  updatedAt: string;
  totals: Metrics;
  days: RevenueDay[];
  cashflow?: RevenueCashflow;
  stores?: Array<{ id: string; name: string }>;
};

export type CashflowShift = {
  id: string; storeId: string; label: string; baseHandover: number;
  transferIn: number; transferOut: number; handover: number;
  outsideExpense: number | null; netHandover: number | null; status: string;
};
export type CashflowDay = {
  date: string; grossHandover: number | null; outsideExpense: number | null;
  netHandover: number | null; complete: boolean; provisional: boolean;
  shifts: CashflowShift[]; expenses: Array<{name: string; amount: number; storeId: string}>;
  syncStatus: string; lastSyncedAt: string | null;
};
export type RevenueCashflow = {
  complete: boolean; provisional: boolean; grossHandover: number | null;
  outsideExpense: number | null; netHandover: number | null; days: CashflowDay[];
};
