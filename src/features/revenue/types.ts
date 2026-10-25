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
  stores?: Array<{ id: string; name: string }>;
};
