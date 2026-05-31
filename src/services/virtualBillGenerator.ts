import type { Product } from "@/services/products.firebase";

export type VirtualBillItem = {
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type VirtualBill = {
  billCode: string;
  createdAt: Date;
  total: number;
  items: VirtualBillItem[];
};

type ProductPriceBucket = {
  price: number;
  products: Product[];
};

export type GenerateVirtualBillsInput = {
  date: string;
  totalRevenue: number;
  billCount: number;
  products: Product[];
};

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pickRandom = <T,>(items: T[]) => items[randomInt(0, items.length - 1)];

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = x % y;
    x = y;
    y = temp;
  }
  return x || 1;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizeToStep = (value: number, step: number, mode: "down" | "up") => {
  if (step <= 1) return value;
  const remainder = value % step;
  if (remainder === 0) return value;
  return mode === "down" ? value - remainder : value + (step - remainder);
};

const buildReachableMap = (maxAmount: number, prices: number[]) => {
  const reachable = new Uint8Array(maxAmount + 1);
  reachable[0] = 1;

  for (let amount = 1; amount <= maxAmount; amount += 1) {
    for (const price of prices) {
      if (price > amount) break;
      if (reachable[amount - price]) {
        reachable[amount] = 1;
        break;
      }
    }
  }

  return reachable;
};

const createPriceBuckets = (products: Product[]) => {
  const map = new Map<number, Product[]>();

  products.forEach((product) => {
    const price = Math.round(product.price || 0);
    if (!product.isSelling || price <= 0 || !product.product_code || !product.product_name) {
      return;
    }

    const bucket = map.get(price) || [];
    bucket.push(product);
    map.set(price, bucket);
  });

  return Array.from(map.entries())
    .map(([price, items]) => ({ price, products: items }))
    .sort((a, b) => a.price - b.price);
};

const pickProductFromBucket = (bucket: ProductPriceBucket) => pickRandom(bucket.products);

const buildBillCode = (billIndex: number, date: string) => {
  const compactDate = date.replace(/[^\d]/g, "") || "virtual";
  return `V${compactDate}-${String(billIndex + 1).padStart(3, "0")}`;
};

const buildBillTime = (date: string, billIndex: number, billCount: number) => {
  const startHour = 7;
  const totalMinutes = 14 * 60;
  const slot = Math.floor((totalMinutes / Math.max(billCount, 1)) * billIndex);
  const jitter = randomInt(0, Math.max(5, Math.floor(totalMinutes / Math.max(billCount * 3, 1))));
  const minutesFromStart = clamp(slot + jitter, 0, totalMinutes);
  const createdAt = new Date(`${date}T00:00:00`);
  createdAt.setHours(startHour, minutesFromStart, randomInt(0, 59), 0);
  return createdAt;
};

const chooseBillTarget = ({
  averageTarget,
  billMin,
  billMax,
  remainingAfterThis,
  remainingBillsAfterThis,
  minPrice,
  step,
  reachable,
}: {
  averageTarget: number;
  billMin: number;
  billMax: number;
  remainingAfterThis: number;
  remainingBillsAfterThis: number;
  minPrice: number;
  step: number;
  reachable: Uint8Array;
}) => {
  const roughTarget = clamp(
    normalizeToStep(
      Math.round(averageTarget * (0.72 + Math.random() * 0.56)),
      step,
      "down"
    ),
    billMin,
    billMax
  );

  const candidates: number[] = [];
  const maxOffset = Math.max(roughTarget - billMin, billMax - roughTarget);

  for (let offset = 0; offset <= maxOffset; offset += step) {
    const attempts =
      offset === 0 ? [roughTarget] : [roughTarget - offset, roughTarget + offset];

    for (const target of attempts) {
      if (target < billMin || target > billMax) continue;
      if (!reachable[target]) continue;

      if (remainingBillsAfterThis <= 0) {
        candidates.push(target);
        continue;
      }

      const remainder = remainingAfterThis - target;
      const reservedMinimum = remainingBillsAfterThis * minPrice;
      if (remainder < reservedMinimum) continue;

      const extraAmount = remainder - reservedMinimum;
      if (!reachable[extraAmount]) continue;
      candidates.push(target);
    }

    if (candidates.length >= 10) {
      break;
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const preferred = candidates.sort(
    (a, b) => Math.abs(a - averageTarget) - Math.abs(b - averageTarget)
  );
  return pickRandom(preferred.slice(0, Math.min(5, preferred.length)));
};

const composeBillItems = (
  amount: number,
  buckets: ProductPriceBucket[],
  reachable: Uint8Array,
  minPrice: number
) => {
  const draftLines: Array<{ bucket: ProductPriceBucket; quantity: number }> = [];
  let remaining = amount;
  const lineTarget = randomInt(1, Math.min(5, Math.max(1, Math.floor(amount / minPrice))));

  while (remaining > 0) {
    const linesLeft = lineTarget - draftLines.length;
    const activeBuckets = buckets.filter((bucket) => {
      if (bucket.price > remaining) return false;
      const remainder = remaining - bucket.price;
      if (remainder === 0) return true;
      if (!reachable[remainder]) return false;
      if (linesLeft > 1 && remainder < minPrice) return false;
      return true;
    });

    if (activeBuckets.length === 0) {
      throw new Error("Không thể tách món cho bill ảo.");
    }

    const targetPerLine = Math.max(minPrice, Math.round(remaining / Math.max(linesLeft, 1)));
    const prioritized = [...activeBuckets].sort(
      (a, b) => Math.abs(a.price - targetPerLine) - Math.abs(b.price - targetPerLine)
    );
    const chosenBucket = pickRandom(prioritized.slice(0, Math.min(6, prioritized.length)));

    let maxQuantity = Math.max(1, Math.floor(remaining / chosenBucket.price));
    if (linesLeft > 1) {
      maxQuantity = Math.min(
        maxQuantity,
        Math.max(1, Math.floor((remaining - minPrice * (linesLeft - 1)) / chosenBucket.price))
      );
    }

    const quantityOptions: number[] = [];
    for (let quantity = 1; quantity <= maxQuantity; quantity += 1) {
      const remainder = remaining - chosenBucket.price * quantity;
      if (remainder < 0) break;
      if (remainder === 0 || reachable[remainder]) {
        quantityOptions.push(quantity);
      }
    }

    const quantity =
      quantityOptions.length > 0
        ? pickRandom(quantityOptions.slice(0, Math.min(4, quantityOptions.length)))
        : 1;

    draftLines.push({
      bucket: chosenBucket,
      quantity,
    });
    remaining -= chosenBucket.price * quantity;
  }

  const merged = new Map<string, VirtualBillItem>();

  draftLines.forEach(({ bucket, quantity }) => {
    const product = pickProductFromBucket(bucket);
    const existing = merged.get(product.product_code);
    if (existing) {
      existing.quantity += quantity;
      existing.lineTotal += bucket.price * quantity;
      return;
    }

    merged.set(product.product_code, {
      productCode: product.product_code,
      productName: product.product_name,
      quantity,
      unitPrice: bucket.price,
      lineTotal: bucket.price * quantity,
    });
  });

  return Array.from(merged.values());
};

export function generateVirtualBills({
  date,
  totalRevenue,
  billCount,
  products,
}: GenerateVirtualBillsInput): VirtualBill[] {
  const normalizedRevenue = Math.round(totalRevenue);
  const normalizedBillCount = Math.round(billCount);
  const buckets = createPriceBuckets(products);

  if (!date) {
    throw new Error("Vui lòng chọn ngày tạo bill ảo.");
  }
  if (normalizedRevenue <= 0) {
    throw new Error("Doanh thu phải lớn hơn 0.");
  }
  if (normalizedBillCount <= 0) {
    throw new Error("Số lượng bill phải lớn hơn 0.");
  }
  if (buckets.length === 0) {
    throw new Error("Không tìm thấy sản phẩm đang bán có đơn giá hợp lệ.");
  }

  const prices = buckets.map((bucket) => bucket.price);
  const minPrice = prices[0];
  const priceGcd = prices.reduce((current, price) => gcd(current, price));
  const minimumPossibleRevenue = minPrice * normalizedBillCount;

  if (normalizedRevenue < minimumPossibleRevenue) {
    throw new Error(
      `Doanh thu quá nhỏ. Tối thiểu cần ${minimumPossibleRevenue.toLocaleString("vi-VN")} VND để tạo ${normalizedBillCount} bill.`
    );
  }

  if (normalizedRevenue % priceGcd !== 0) {
    throw new Error(
      `Doanh thu phải chia hết cho bước giá ${priceGcd.toLocaleString("vi-VN")} VND của menu hiện tại.`
    );
  }

  const extraRevenue = normalizedRevenue - minimumPossibleRevenue;
  const reachable = buildReachableMap(normalizedRevenue, prices);

  if (!reachable[extraRevenue]) {
    throw new Error("Không thể ghép doanh thu đúng với bảng giá sản phẩm hiện tại.");
  }

  const billTotals: number[] = [];
  let remaining = normalizedRevenue;

  for (let billIndex = 0; billIndex < normalizedBillCount; billIndex += 1) {
    const remainingBills = normalizedBillCount - billIndex;
    if (remainingBills === 1) {
      billTotals.push(remaining);
      break;
    }

    const minTarget = minPrice;
    const maxTarget = remaining - minPrice * (remainingBills - 1);
    const chosenTarget = chooseBillTarget({
      averageTarget: remaining / remainingBills,
      billMin: minTarget,
      billMax: maxTarget,
      remainingAfterThis: remaining,
      remainingBillsAfterThis: remainingBills - 1,
      minPrice,
      step: priceGcd,
      reachable,
    });

    if (!chosenTarget) {
      throw new Error("Không tìm được cách chia tổng doanh thu thành đúng số bill yêu cầu.");
    }

    billTotals.push(chosenTarget);
    remaining -= chosenTarget;
  }

  const bills = billTotals.map((billTotal, billIndex) => {
    const items = composeBillItems(billTotal, buckets, reachable, minPrice);
    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);

    if (total !== billTotal) {
      throw new Error("Bill ảo tạo ra không khớp tổng tiền.");
    }

    return {
      billCode: buildBillCode(billIndex, date),
      createdAt: buildBillTime(date, billIndex, normalizedBillCount),
      total,
      items,
    };
  });

  const totalGenerated = bills.reduce((sum, bill) => sum + bill.total, 0);
  if (totalGenerated !== normalizedRevenue) {
    throw new Error("Tổng bill ảo tạo ra không khớp doanh thu đã nhập.");
  }

  return bills.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}
