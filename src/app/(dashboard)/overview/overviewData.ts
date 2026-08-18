export type OverviewBill = {
  id: string;
  total: number;
  status?: "completed" | "cancelled";
  createdAt?: { seconds: number };
  paymentMethod?: "cash" | "transfer";
  orderSource?: "pos" | "bar";
  cashierName?: string;
  tableNumber?: string;
  items: Array<{
    name: string;
    quantity: number;
    lineTotal: number;
  }>;
};

export type SalesPoint = {
  key: string;
  label: string;
  revenue: number;
  orders: number;
};

export type ProductPerformance = {
  name: string;
  quantity: number;
  revenue: number;
};

export type OverviewRangePreset =
  | "today"
  | "yesterday"
  | "last7Days"
  | "thisMonth"
  | "lastMonth";

export type OverviewDateRanges = {
  startDate: Date;
  endDate: Date;
  previousStartDate: Date;
  previousEndDate: Date;
};

export type OverviewSnapshot = {
  totalRevenue: number;
  orderCount: number;
  customerCount: number;
  cancelledCount: number;
  averageOrder: number;
  itemsSold: number;
  salesSeries: SalesPoint[];
  hourlySeries: SalesPoint[];
  topProducts: ProductPerformance[];
  paymentTotals: { cash: number; transfer: number };
  recentBills: OverviewBill[];
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toBillDate = (bill: OverviewBill) =>
  bill.createdAt?.seconds ? new Date(bill.createdAt.seconds * 1000) : null;

const isWithinRange = (date: Date, startDate: Date, endDate: Date) =>
  date.getTime() >= startDate.getTime() && date.getTime() <= endDate.getTime();

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

export function getOverviewDateRanges(
  preset: OverviewRangePreset,
  now = new Date(),
): OverviewDateRanges {
  if (preset === "today" || preset === "yesterday") {
    const selectedDay = new Date(now);
    if (preset === "yesterday") selectedDay.setDate(selectedDay.getDate() - 1);

    const comparisonDay = new Date(selectedDay);
    comparisonDay.setDate(comparisonDay.getDate() - 1);

    return {
      startDate: startOfDay(selectedDay),
      endDate: endOfDay(selectedDay),
      previousStartDate: startOfDay(comparisonDay),
      previousEndDate: endOfDay(comparisonDay),
    };
  }

  if (preset === "last7Days") {
    const startDate = startOfDay(now);
    startDate.setDate(startDate.getDate() - 6);

    const previousEndDate = new Date(startDate.getTime() - 1);
    const previousStartDate = startOfDay(previousEndDate);
    previousStartDate.setDate(previousStartDate.getDate() - 6);

    return {
      startDate,
      endDate: endOfDay(now),
      previousStartDate,
      previousEndDate,
    };
  }

  const year = now.getFullYear();
  const month = now.getMonth();

  if (preset === "thisMonth") {
    const finalDayOfPreviousMonth = new Date(year, month, 0).getDate();
    const comparisonDay = Math.min(now.getDate(), finalDayOfPreviousMonth);

    return {
      startDate: new Date(year, month, 1, 0, 0, 0, 0),
      endDate: endOfDay(now),
      previousStartDate: new Date(year, month - 1, 1, 0, 0, 0, 0),
      previousEndDate: new Date(
        year,
        month - 1,
        comparisonDay,
        23,
        59,
        59,
        999,
      ),
    };
  }

  return {
    startDate: new Date(year, month - 1, 1, 0, 0, 0, 0),
    endDate: new Date(year, month, 0, 23, 59, 59, 999),
    previousStartDate: new Date(year, month - 2, 1, 0, 0, 0, 0),
    previousEndDate: new Date(year, month - 1, 0, 23, 59, 59, 999),
  };
}

export function calculatePercentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function buildOverviewSnapshot(
  bills: OverviewBill[],
  startDate: Date,
  endDate: Date,
): OverviewSnapshot {
  const points = new Map<string, SalesPoint>();
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const lastDay = new Date(endDate);
  lastDay.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= lastDay.getTime()) {
    const key = toDateKey(cursor);
    points.set(key, {
      key,
      label: cursor.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      }),
      revenue: 0,
      orders: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const hourlyPoints = new Map<string, SalesPoint>();
  for (let hour = 0; hour < 24; hour += 1) {
    const key = String(hour).padStart(2, "0");
    hourlyPoints.set(key, {
      key,
      label: `${key}:00`,
      revenue: 0,
      orders: 0,
    });
  }

  const scopedBills = bills.filter((bill) => {
    const date = toBillDate(bill);
    return date ? isWithinRange(date, startDate, endDate) : false;
  });
  const completedBills = scopedBills.filter((bill) => bill.status !== "cancelled");
  const productTotals = new Map<string, ProductPerformance>();
  const paymentTotals = { cash: 0, transfer: 0 };

  completedBills.forEach((bill) => {
    const date = toBillDate(bill);
    if (date) {
      const point = points.get(toDateKey(date));
      if (point) {
        point.revenue += Number(bill.total || 0);
        point.orders += 1;
      }

      const hourKey = String(date.getHours()).padStart(2, "0");
      const hourlyPoint = hourlyPoints.get(hourKey);
      if (hourlyPoint) {
        hourlyPoint.revenue += Number(bill.total || 0);
        hourlyPoint.orders += 1;
      }
    }

    paymentTotals[bill.paymentMethod === "transfer" ? "transfer" : "cash"] +=
      Number(bill.total || 0);

    bill.items.forEach((item) => {
      const name = item.name.trim() || "Sản phẩm chưa đặt tên";
      const current = productTotals.get(name) || { name, quantity: 0, revenue: 0 };
      current.quantity += Number(item.quantity || 0);
      current.revenue += Number(item.lineTotal || 0);
      productTotals.set(name, current);
    });
  });

  const totalRevenue = completedBills.reduce(
    (total, bill) => total + Number(bill.total || 0),
    0,
  );
  const itemsSold = completedBills.reduce(
    (total, bill) =>
      total + bill.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    0,
  );

  return {
    totalRevenue,
    orderCount: completedBills.length,
    customerCount: completedBills.length,
    cancelledCount: scopedBills.length - completedBills.length,
    averageOrder: completedBills.length ? totalRevenue / completedBills.length : 0,
    itemsSold,
    salesSeries: Array.from(points.values()),
    hourlySeries: Array.from(hourlyPoints.values()),
    topProducts: Array.from(productTotals.values())
      .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue)
      .slice(0, 10),
    paymentTotals,
    recentBills: [...scopedBills]
      .sort(
        (left, right) =>
          (right.createdAt?.seconds || 0) - (left.createdAt?.seconds || 0),
      )
      .slice(0, 6),
  };
}
