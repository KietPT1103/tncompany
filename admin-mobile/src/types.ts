export type AdminUser = {
  id: string;
  email: string;
  username?: string | null;
  displayName: string;
  role: string;
  permissions: string[];
};

export type ApiTimestamp = { seconds: number; nanoseconds?: number };

export type BillItem = {
  menuId: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
};

export type Bill = {
  id: string;
  storeId?: string;
  tableNumber: string;
  total: number;
  status: "completed" | "cancelled";
  paymentMethod?: "cash" | "transfer";
  cashierName?: string;
  orderSource?: "pos" | "bar";
  createdAt?: ApiTimestamp;
  items: BillItem[];
};
