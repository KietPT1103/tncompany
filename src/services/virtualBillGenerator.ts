export type VirtualBillProduct = {
  product_code: string;
  product_name: string;
  price: number | null;
  isSelling?: boolean;
  [key: string]: unknown;
};

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

export type VirtualBillProductRule = {
  minQuantity: number;
  maxQuantity: number;
};

type ProductPriceBucket = {
  price: number;
  products: VirtualBillProduct[];
};

export type GenerateVirtualBillsInput = {
  date: string;
  totalRevenue: number;
  maxBillTotal?: number;
  products: VirtualBillProduct[];
  billCount?: number;
  minQuantity?: number;
  maxQuantity?: number;
  productRules?: Record<string, VirtualBillProductRule>;
  fixedQuantities?: Record<string, number>;
  requiredProductCodes?: string[];
};

export type VirtualBillFeasibility = {
  exact: boolean;
  nearestTotal: number | null;
  delta: number;
  estimatedBillCount: number;
  selectedProductCount: number;
  priceStep: number;
  reason: string;
};

type LineOption = {
  product: VirtualBillProduct;
  quantity: number;
  total: number;
  scaledTotal: number;
};
export const DEFAULT_MAX_BILL_TOTAL = 7_000_000;
const MAX_FIXED_TICKET_QUANTITY_PER_BILL = 15;

const DEFAULT_MIN_QUANTITY = 4;
const DEFAULT_MAX_QUANTITY = 10;
const TARGET_LINES_PER_BILL = 16;

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

const normalizeFixedQuantity = (value: number | undefined) =>
  Math.max(0, Math.round(Number(value) || 0));

export function calculateFixedQuantityRevenue(
  products: VirtualBillProduct[],
  fixedQuantities: Record<string, number>,
) {
  return products.reduce((total, product) => {
    if (product.isSelling === false) return total;

    const productCode = product.product_code?.trim();
    const price = Math.round(product.price || 0);
    if (!productCode || price <= 0) return total;

    return total + normalizeFixedQuantity(fixedQuantities[productCode]) * price;
  }, 0);
}

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

const createPriceBuckets = (products: VirtualBillProduct[]) => {
  const map = new Map<number, VirtualBillProduct[]>();

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

type BillDraft = {
  total: number;
  productCodes: Set<string>;
  items: VirtualBillItem[];
};

const normalizeQuantityRange = (minQuantity: number, maxQuantity: number) => {
  const normalizedMin = clamp(Math.round(minQuantity), 1, 99);
  const normalizedMax = clamp(Math.round(maxQuantity), normalizedMin, 99);
  return { minQuantity: normalizedMin, maxQuantity: normalizedMax };
};

const createLineOptions = ({
  products,
  minQuantity = DEFAULT_MIN_QUANTITY,
  maxQuantity = DEFAULT_MAX_QUANTITY,
  productRules = {},
  maxBillTotal = DEFAULT_MAX_BILL_TOTAL,
}: Pick<
  GenerateVirtualBillsInput,
  "products" | "minQuantity" | "maxQuantity" | "productRules" | "maxBillTotal"
>) => {
  const fallbackRange = normalizeQuantityRange(minQuantity, maxQuantity);
  const normalizedMaxBillTotal = Math.max(1, Math.round(maxBillTotal));
  const seen = new Set<string>();
  const options: LineOption[] = [];

  products.forEach((product) => {
    const code = product.product_code?.trim();
    const name = product.product_name?.trim();
    const price = Math.round(product.price || 0);

    if (!code || !name || price <= 0 || product.isSelling === false || seen.has(code)) {
      return;
    }

    seen.add(code);
    const configured = productRules[code] || fallbackRange;
    const range = normalizeQuantityRange(
      configured.minQuantity,
      configured.maxQuantity
    );

    for (let quantity = range.minQuantity; quantity <= range.maxQuantity; quantity += 1) {
      const total = price * quantity;
      if (total > normalizedMaxBillTotal) continue;
      options.push({
        product: {
          ...product,
          product_code: code,
          product_name: name,
          price,
        },
        quantity,
        total,
        scaledTotal: 0,
      });
    }
  });

  if (options.length === 0) {
    return { options, step: 1 };
  }

  const step = options.map((option) => option.total).reduce(gcd);
  options.forEach((option) => {
    option.scaledTotal = Math.round(option.total / step);
  });

  return { options, step };
};

const buildScaledReachableMap = (
  maxAmount: number,
  step: number,
  options: LineOption[]
) => {
  const maxScaled = Math.max(0, Math.floor(maxAmount / step));
  const reachable = new Uint8Array(maxScaled + 1);
  reachable[0] = 1;
  const values = Array.from(
    new Set(options.map((option) => option.scaledTotal))
  ).sort((left, right) => left - right);

  for (let amount = 1; amount <= maxScaled; amount += 1) {
    for (const value of values) {
      if (value > amount) break;
      if (reachable[amount - value]) {
        reachable[amount] = 1;
        break;
      }
    }
  }

  return reachable;
};

const estimateBillCountFromOptions = (
  totalRevenue: number,
  options: LineOption[],
  maxBillTotal = DEFAULT_MAX_BILL_TOTAL
) => {
  if (totalRevenue <= 0 || options.length === 0) return 0;

  const byProduct = new Map<string, LineOption[]>();
  options.forEach((option) => {
    const list = byProduct.get(option.product.product_code) || [];
    list.push(option);
    byProduct.set(option.product.product_code, list);
  });

  const averageLineTotal =
    Array.from(byProduct.values()).reduce((sum, productOptions) => {
      const productAverage =
        productOptions.reduce((subtotal, option) => subtotal + option.total, 0) /
        productOptions.length;
      return sum + productAverage;
    }, 0) / byProduct.size;
  const estimatedLines = Math.max(
    1,
    totalRevenue / Math.max(averageLineTotal, 1)
  );

  return Math.max(
    1,
    Math.ceil(totalRevenue / Math.max(1, maxBillTotal)),
    Math.round(estimatedLines / TARGET_LINES_PER_BILL)
  );
};

const analyzeFixedQuantityFeasibility = (
  input: Omit<GenerateVirtualBillsInput, "date"> & {
    fixedQuantities: Record<string, number>;
  },
): VirtualBillFeasibility => {
  const normalizedRevenue = Math.round(input.totalRevenue);
  const maxBillTotal = Math.max(
    1,
    Math.round(input.maxBillTotal ?? DEFAULT_MAX_BILL_TOTAL),
  );
  const selectedProducts = input.products.filter(
    (product) => normalizeFixedQuantity(input.fixedQuantities[product.product_code]) > 0,
  );
  const pricedProducts = selectedProducts.filter(
    (product) => Math.round(product.price || 0) > 0,
  );
  const expectedRevenue = calculateFixedQuantityRevenue(
    input.products,
    input.fixedQuantities,
  );
  const priceStep = pricedProducts.reduce(
    (step, product) => gcd(step, Math.round(product.price || 0)),
    0,
  ) || 1;
  const quantityLimitedBillCount =
    (input.requiredProductCodes?.length || 0) > 0
      ? selectedProducts.reduce((count, product) => {
          const quantity = normalizeFixedQuantity(
            input.fixedQuantities[product.product_code],
          );
          return Math.max(
            count,
            Math.ceil(quantity / MAX_FIXED_TICKET_QUANTITY_PER_BILL),
          );
        }, 1)
      : 1;
  const estimatedBillCount = expectedRevenue > 0
    ? Math.max(
        1,
        Math.ceil(expectedRevenue / maxBillTotal),
        quantityLimitedBillCount,
      )
    : 0;
  const hasOversizedTicket = pricedProducts.some(
    (product) => Math.round(product.price || 0) > maxBillTotal,
  );

  if (expectedRevenue <= 0) {
    return {
      exact: false,
      nearestTotal: null,
      delta: 0,
      estimatedBillCount: 0,
      selectedProductCount: selectedProducts.length,
      priceStep,
      reason: "Hãy nhập số lượng vé có doanh thu.",
    };
  }

  if (hasOversizedTicket) {
    return {
      exact: false,
      nearestTotal: expectedRevenue,
      delta: expectedRevenue - normalizedRevenue,
      estimatedBillCount,
      selectedProductCount: selectedProducts.length,
      priceStep,
      reason: "Có vé có đơn giá lớn hơn giới hạn tối đa của một bill.",
    };
  }

  if (expectedRevenue !== normalizedRevenue) {
    return {
      exact: false,
      nearestTotal: expectedRevenue,
      delta: expectedRevenue - normalizedRevenue,
      estimatedBillCount,
      selectedProductCount: selectedProducts.length,
      priceStep,
      reason: "Tổng số lượng vé không khớp doanh thu mục tiêu.",
    };
  }

  return {
    exact: true,
    nearestTotal: expectedRevenue,
    delta: 0,
    estimatedBillCount,
    selectedProductCount: selectedProducts.length,
    priceStep,
    reason: "Doanh thu được tính đúng từ số lượng vé đã nhập.",
  };
};

export function analyzeVirtualBillFeasibility(
  input: Omit<GenerateVirtualBillsInput, "date">
): VirtualBillFeasibility {
  if (input.fixedQuantities) {
    return analyzeFixedQuantityFeasibility({
      ...input,
      fixedQuantities: input.fixedQuantities,
    });
  }

  const normalizedRevenue = Math.round(input.totalRevenue);
  const { options, step } = createLineOptions(input);
  const selectedProductCount = new Set(
    options.map((option) => option.product.product_code)
  ).size;
  const estimatedBillCount = estimateBillCountFromOptions(
    normalizedRevenue,
    options,
    input.maxBillTotal
  );

  if (normalizedRevenue <= 0) {
    return {
      exact: false,
      nearestTotal: null,
      delta: 0,
      estimatedBillCount,
      selectedProductCount,
      priceStep: step,
      reason: "Doanh thu mục tiêu phải lớn hơn 0.",
    };
  }

  if (options.length === 0) {
    return {
      exact: false,
      nearestTotal: null,
      delta: 0,
      estimatedBillCount: 0,
      selectedProductCount: 0,
      priceStep: step,
      reason:
        "Chưa có sản phẩm được chọn với đơn giá và giới hạn số lượng hợp lệ.",
    };
  }

  const maxOptionTotal = Math.max(...options.map((option) => option.total));
  const searchWindow = Math.max(
    maxOptionTotal * 2,
    Math.min(normalizedRevenue * 0.05, 5_000_000)
  );
  const reachable = buildScaledReachableMap(
    normalizedRevenue + searchWindow,
    step,
    options
  );
  const exactIndex =
    normalizedRevenue % step === 0 ? normalizedRevenue / step : -1;
  const exact = exactIndex >= 0 && Boolean(reachable[exactIndex]);

  if (exact) {
    return {
      exact: true,
      nearestTotal: normalizedRevenue,
      delta: 0,
      estimatedBillCount,
      selectedProductCount,
      priceStep: step,
      reason:
        "Có thể ghép chính xác doanh thu mục tiêu với danh sách sản phẩm đã chọn.",
    };
  }

  const lowerStart = Math.floor(normalizedRevenue / step);
  const upperStart = Math.ceil(normalizedRevenue / step);
  const maxOffset = Math.ceil(searchWindow / step);
  let nearestTotal: number | null = null;

  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const lowerIndex = lowerStart - offset;
    const upperIndex = upperStart + offset;
    const candidates = [
      lowerIndex > 0 && reachable[lowerIndex] ? lowerIndex * step : null,
      upperIndex < reachable.length && reachable[upperIndex]
        ? upperIndex * step
        : null,
    ].filter((value): value is number => value !== null);

    if (candidates.length > 0) {
      nearestTotal = candidates.sort(
        (left, right) =>
          Math.abs(left - normalizedRevenue) -
            Math.abs(right - normalizedRevenue) || left - right
      )[0];
      break;
    }
  }

  return {
    exact: false,
    nearestTotal,
    delta: nearestTotal === null ? 0 : nearestTotal - normalizedRevenue,
    estimatedBillCount: estimateBillCountFromOptions(
      nearestTotal || normalizedRevenue,
      options,
      input.maxBillTotal
    ),
    selectedProductCount,
    priceStep: step,
    reason:
      nearestTotal === null
        ? "Không tìm được phương án phù hợp trong khoảng doanh thu lân cận."
        : "Không thể khớp tuyệt đối doanh thu mục tiêu với giá và giới hạn số lượng hiện tại.",
  };
}

const reconstructLineOptions = ({
  totalRevenue,
  step,
  options,
  reachable,
  estimatedBillCount,
  maxUsagePerProduct,
}: {
  totalRevenue: number;
  step: number;
  options: LineOption[];
  reachable: Uint8Array;
  estimatedBillCount: number;
  maxUsagePerProduct: number;
}) => {
  const lines: LineOption[] = [];
  const usage = new Map<string, number>();
  const preferredLineTotal =
    totalRevenue /
    Math.max(estimatedBillCount * TARGET_LINES_PER_BILL, 1);
  let remaining = totalRevenue / step;

  while (remaining > 0) {
    const candidates = options
      .filter((option) => {
        const next = remaining - option.scaledTotal;
        if (next < 0 || !reachable[next]) return false;
        return (
          (usage.get(option.product.product_code) || 0) <
          maxUsagePerProduct
        );
      })
      .map((option) => ({
        option,
        score:
          (usage.get(option.product.product_code) || 0) *
            preferredLineTotal *
            0.7 +
          Math.abs(option.total - preferredLineTotal) +
          Math.random() * preferredLineTotal * 0.35,
      }))
      .sort((left, right) => left.score - right.score);

    if (candidates.length === 0) return null;

    const shortlist = candidates.slice(0, Math.min(8, candidates.length));
    const selected =
      shortlist[randomInt(0, shortlist.length - 1)].option;
    lines.push(selected);
    usage.set(
      selected.product.product_code,
      (usage.get(selected.product.product_code) || 0) + 1
    );
    remaining -= selected.scaledTotal;
  }

  return { lines, usage };
};

export class VirtualBillGenerationError extends Error {
  nearestTotal: number | null;

  constructor(message: string, nearestTotal: number | null = null) {
    super(message);
    this.name = "VirtualBillGenerationError";
    this.nearestTotal = nearestTotal;
  }
}


export function generateVirtualBills({
  date,
  totalRevenue,
  billCount = 1,
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

const distributeLineOptions = (
  lines: LineOption[],
  initialBillCount: number,
  maxBillTotal: number
): BillDraft[] | null => {
  const sortedLines = [...lines].sort((left, right) => right.total - left.total);

  for (
    let billCount = Math.max(1, initialBillCount);
    billCount <= sortedLines.length;
    billCount += 1
  ) {
    const drafts: BillDraft[] = Array.from({ length: billCount }, () => ({
      total: 0,
      productCodes: new Set<string>(),
      items: [],
    }));
    let failed = false;

    for (const line of sortedLines) {
      const draft = drafts
        .filter(
          (candidate) =>
            !candidate.productCodes.has(line.product.product_code) &&
            candidate.total + line.total <= maxBillTotal
        )
        .sort(
          (left, right) =>
            left.total - right.total ||
            left.items.length - right.items.length
        )[0];

      if (!draft) {
        failed = true;
        break;
      }

      draft.productCodes.add(line.product.product_code);
      draft.total += line.total;
      draft.items.push({
        productCode: line.product.product_code,
        productName: line.product.product_name,
        quantity: line.quantity,
        unitPrice: Math.round(line.product.price || 0),
        lineTotal: line.total,
      });
    }

    if (!failed && drafts.every((draft) => draft.items.length > 0)) {
      return drafts;
    }
  }

  return null;
};

const attachZeroPriceItems = (
  bills: VirtualBill[],
  input: GenerateVirtualBillsInput
) => {
  const fallbackRange = normalizeQuantityRange(
    input.minQuantity ?? DEFAULT_MIN_QUANTITY,
    input.maxQuantity ?? DEFAULT_MAX_QUANTITY
  );
  const freeProducts = input.products.filter(
    (product) =>
      product.isSelling !== false &&
      product.product_code?.trim() &&
      product.product_name?.trim() &&
      Math.round(product.price || 0) === 0
  );

  freeProducts.forEach((product, productIndex) => {
    const code = product.product_code.trim();
    const rule = input.productRules?.[code] || fallbackRange;
    const range = normalizeQuantityRange(rule.minQuantity, rule.maxQuantity);
    const occurrenceCount = Math.min(
      bills.length,
      Math.max(1, Math.ceil(bills.length / 4))
    );

    for (let occurrence = 0; occurrence < occurrenceCount; occurrence += 1) {
      const bill = bills[
        (productIndex + occurrence * Math.max(1, Math.floor(bills.length / occurrenceCount))) %
          bills.length
      ];
      if (bill.items.some((item) => item.productCode === code)) continue;

      bill.items.push({
        productCode: code,
        productName: product.product_name.trim(),
        quantity: range.minQuantity,
        unitPrice: 0,
        lineTotal: 0,
      });
    }
  });
};

type FixedQuantityLine = {
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type FixedQuantityDraft = {
  total: number;
  items: VirtualBillItem[];
};

const appendFixedQuantity = (
  draft: FixedQuantityDraft,
  product: VirtualBillProduct,
  quantity: number,
) => {
  if (quantity <= 0) return;

  const productCode = product.product_code.trim();
  const unitPrice = Math.round(product.price || 0);
  const item = draft.items.find((entry) => entry.productCode === productCode);
  if (item) {
    item.quantity += quantity;
    item.lineTotal += quantity * unitPrice;
  } else {
    draft.items.push({
      productCode,
      productName: product.product_name.trim(),
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
    });
  }
  draft.total += quantity * unitPrice;
};

const buildRequiredProductDrafts = (
  products: VirtualBillProduct[],
  fixedQuantities: Record<string, number>,
  requiredProductCodes: string[],
  draftCount: number,
  maxBillTotal: number,
) => {
  const requiredSet = new Set(requiredProductCodes);
  const productByCode = new Map(
    products
      .map((product) => [product.product_code.trim(), product] as const)
      .filter(([code, product]) => code && product.isSelling !== false),
  );
  const requiredProducts = requiredProductCodes.map((code) => {
    const product = productByCode.get(code);
    const quantity = normalizeFixedQuantity(fixedQuantities[code]);
    if (!product || quantity < draftCount) {
      throw new VirtualBillGenerationError(
        "Số lượng vé bắt buộc không đủ để có mặt trong mỗi bill.",
      );
    }
    return { product, quantity };
  });
  const requiredTotal = requiredProducts.reduce(
    (total, { product }) => total + Math.round(product.price || 0),
    0,
  );
  if (requiredTotal > maxBillTotal) {
    throw new VirtualBillGenerationError(
      "Không thể giữ đủ vé Farm bắt buộc trong mọi bill dưới giới hạn doanh thu.",
    );
  }

  const drafts = Array.from({ length: draftCount }, () => ({
    total: 0,
    items: [],
  } as FixedQuantityDraft));
  requiredProducts.forEach(({ product }) => {
    drafts.forEach((draft) => appendFixedQuantity(draft, product, 1));
  });

  const remainingProducts = products
    .filter((product) => product.isSelling !== false)
    .map((product) => ({
      product,
      quantity:
        normalizeFixedQuantity(fixedQuantities[product.product_code.trim()]) -
        (requiredSet.has(product.product_code.trim()) ? draftCount : 0),
      unitPrice: Math.round(product.price || 0),
    }))
    .filter(({ quantity, unitPrice }) => quantity > 0 && unitPrice > 0)
    .sort((left, right) => right.unitPrice - left.unitPrice);

  remainingProducts.forEach(({ product, quantity, unitPrice }) => {
    let remaining = quantity;
    while (remaining > 0) {
      const draft = drafts
        .filter((candidate) => {
          const existing = candidate.items.find(
            (item) => item.productCode === product.product_code.trim(),
          );
          return (
            candidate.total + unitPrice <= maxBillTotal &&
            (existing?.quantity || 0) < MAX_FIXED_TICKET_QUANTITY_PER_BILL
          );
        })
        .sort((left, right) => right.total - left.total)[0];
      if (!draft) {
        throw new VirtualBillGenerationError(
          "Không thể giữ đủ vé Farm bắt buộc trong mọi bill dưới giới hạn doanh thu.",
        );
      }
      appendFixedQuantity(draft, product, 1);
      remaining -= 1;
    }
  });

  return drafts;
};

const generateFixedQuantityBills = (
  input: GenerateVirtualBillsInput,
  maxBillTotal: number,
): VirtualBill[] => {
  const fixedQuantities = input.fixedQuantities || {};
  const normalizedRevenue = Math.round(input.totalRevenue);

  if (!input.date) {
    throw new VirtualBillGenerationError("Vui lòng chọn ngày tạo bill mẫu.");
  }

  const expectedRevenue = calculateFixedQuantityRevenue(
    input.products,
    fixedQuantities,
  );
  if (expectedRevenue <= 0) {
    throw new VirtualBillGenerationError("Hãy nhập số lượng vé có doanh thu.");
  }
  if (expectedRevenue !== normalizedRevenue) {
    throw new VirtualBillGenerationError(
      "Tổng số lượng vé không khớp doanh thu mục tiêu.",
      expectedRevenue,
    );
  }

  const lines: FixedQuantityLine[] = [];
  const freeLines: FixedQuantityLine[] = [];

  input.products.forEach((product) => {
    if (product.isSelling === false) return;

    const productCode = product.product_code?.trim();
    const productName = product.product_name?.trim();
    const unitPrice = Math.round(product.price || 0);
    const quantity = normalizeFixedQuantity(fixedQuantities[productCode]);
    if (!productCode || !productName || quantity <= 0) return;

    if (unitPrice === 0) {
      freeLines.push({
        productCode,
        productName,
        quantity,
        unitPrice,
        lineTotal: 0,
      });
      return;
    }

    const maxQuantityPerBill = Math.floor(maxBillTotal / unitPrice);
    if (maxQuantityPerBill < 1) {
      throw new VirtualBillGenerationError(
        `Vé ${productName} có đơn giá vượt giới hạn một bill.`,
      );
    }

    let remainingQuantity = quantity;
    while (remainingQuantity > 0) {
      const lineQuantity = Math.min(remainingQuantity, maxQuantityPerBill);
      lines.push({
        productCode,
        productName,
        quantity: lineQuantity,
        unitPrice,
        lineTotal: lineQuantity * unitPrice,
      });
      remainingQuantity -= lineQuantity;
    }
  });

  let drafts: FixedQuantityDraft[] = [];
  [...lines]
    .sort((left, right) => right.lineTotal - left.lineTotal)
    .forEach((line) => {
      const draft = drafts
        .filter((candidate) => candidate.total + line.lineTotal <= maxBillTotal)
        .sort((left, right) => right.total - left.total)[0];

      if (draft) {
        draft.total += line.lineTotal;
        draft.items.push(line);
        return;
      }

      drafts.push({
        total: line.lineTotal,
        items: [line],
      });
    });

  if (drafts.length === 0) {
    throw new VirtualBillGenerationError("Không có vé có doanh thu để tạo bill.");
  }

  const minimumDraftCount = input.products.reduce((count, product) => {
    if (product.isSelling === false) return count;
    const productCode = product.product_code?.trim();
    const quantity = normalizeFixedQuantity(fixedQuantities[productCode]);
    return Math.max(
      count,
      Math.ceil(quantity / MAX_FIXED_TICKET_QUANTITY_PER_BILL),
    );
  }, 1);

  const requiredProductCodes = (input.requiredProductCodes || [])
    .map((code) => code?.trim())
    .filter((code, index, codes): code is string =>
      Boolean(code) && codes.indexOf(code) === index,
    );
  const requiredProductCodeSet = new Set(requiredProductCodes);
  if (requiredProductCodes.length > 0) {
    drafts = buildRequiredProductDrafts(
      input.products,
      fixedQuantities,
      requiredProductCodes,
      Math.max(drafts.length, minimumDraftCount),
      maxBillTotal,
    );
  }

  freeLines.forEach((line) => {
    const remainingQuantity = requiredProductCodeSet.has(line.productCode)
      ? Math.max(0, line.quantity - drafts.length)
      : line.quantity;
    if (remainingQuantity === 0) return;
    let remaining = remainingQuantity;
    while (remaining > 0) {
      const draft = drafts
        .filter((candidate) => {
          const existing = candidate.items.find(
            (item) => item.productCode === line.productCode,
          );
          return (existing?.quantity || 0) < MAX_FIXED_TICKET_QUANTITY_PER_BILL;
        })
        .sort((left, right) => left.total - right.total)[0];
      if (!draft) {
        throw new VirtualBillGenerationError(
          "Không thể chia số lượng vé thành các bill tối đa 15 vé mỗi mã.",
        );
      }
      appendFixedQuantity(
        draft,
        {
          product_code: line.productCode,
          product_name: line.productName,
          price: line.unitPrice,
        },
        1,
      );
      remaining -= 1;
    }
  });

  const bills = drafts.map((draft, billIndex) => ({
    billCode: String(billIndex + 1),
    createdAt: buildBillTime(input.date, billIndex, drafts.length),
    total: draft.total,
    items: draft.items.sort((left, right) =>
      left.productName.localeCompare(right.productName, "vi"),
    ),
  }));

  const generatedTotal = bills.reduce((sum, bill) => sum + bill.total, 0);
  if (generatedTotal !== normalizedRevenue) {
    throw new VirtualBillGenerationError(
      "Tổng bill tạo ra không khớp doanh thu đã chọn.",
    );
  }

  return bills;
};

export function generateSampleBills(
  input: GenerateVirtualBillsInput
): VirtualBill[] {
  const normalizedRevenue = Math.round(input.totalRevenue);
  const maxBillTotal = Math.max(
    1,
    Math.round(input.maxBillTotal ?? DEFAULT_MAX_BILL_TOTAL)
  );

  if (input.fixedQuantities) {
    return generateFixedQuantityBills(input, maxBillTotal);
  }

  if (!input.date) {
    throw new VirtualBillGenerationError("Vui lòng chọn ngày tạo bill mẫu.");
  }

  const feasibility = analyzeVirtualBillFeasibility({
    ...input,
    maxBillTotal,
  });
  if (!feasibility.exact) {
    throw new VirtualBillGenerationError(
      feasibility.reason,
      feasibility.nearestTotal
    );
  }

  const { options, step } = createLineOptions({
    ...input,
    maxBillTotal,
  });
  const reachable = buildScaledReachableMap(
    normalizedRevenue,
    step,
    options
  );
  let reconstructed: {
    lines: LineOption[];
    usage: Map<string, number>;
  } | null = null;
  const reconstructionHint = Math.max(1, feasibility.estimatedBillCount);

  for (
    let cap = reconstructionHint;
    cap <= reconstructionHint + 6 && !reconstructed;
    cap += 1
  ) {
    for (let attempt = 0; attempt < 36 && !reconstructed; attempt += 1) {
      reconstructed = reconstructLineOptions({
        totalRevenue: normalizedRevenue,
        step,
        options,
        reachable,
        estimatedBillCount: reconstructionHint,
        maxUsagePerProduct: cap,
      });
    }
  }

  if (!reconstructed) {
    reconstructed = reconstructLineOptions({
      totalRevenue: normalizedRevenue,
      step,
      options,
      reachable,
      estimatedBillCount: reconstructionHint,
      maxUsagePerProduct: Number.MAX_SAFE_INTEGER,
    });
  }

  if (!reconstructed) {
    throw new VirtualBillGenerationError(
      "Không thể dựng danh sách món dù tổng doanh thu có thể đối soát. Hãy chọn thêm sản phẩm."
    );
  }

  const maxProductUsage = Math.max(
    ...Array.from(reconstructed.usage.values())
  );
  const minimumBillCount = Math.max(
    reconstructionHint,
    maxProductUsage,
    Math.ceil(normalizedRevenue / maxBillTotal)
  );
  const drafts = distributeLineOptions(
    reconstructed.lines,
    minimumBillCount,
    maxBillTotal
  );

  if (!drafts) {
    throw new VirtualBillGenerationError(
      "Không thể phân bổ sản phẩm mà vẫn giữ mỗi bill dưới 7.000.000 VND."
    );
  }

  const bills = drafts.map((draft, billIndex) => ({
    billCode: String(billIndex + 1),
    createdAt: buildBillTime(input.date, billIndex, drafts.length),
    total: draft.total,
    items: draft.items,
  }));
  attachZeroPriceItems(bills, input);

  bills.forEach((bill) => {
    bill.items.sort((left, right) =>
      left.productName.localeCompare(right.productName, "vi")
    );
  });

  const generatedTotal = bills.reduce(
    (sum, bill) => sum + bill.total,
    0
  );

  if (generatedTotal !== normalizedRevenue) {
    throw new VirtualBillGenerationError(
      "Tổng bill tạo ra không khớp doanh thu đã chọn."
    );
  }
  if (bills.some((bill) => bill.total > maxBillTotal)) {
    throw new VirtualBillGenerationError(
      "Có bill vượt giới hạn 7.000.000 VND."
    );
  }

  return bills.sort(
    (left, right) =>
      left.createdAt.getTime() - right.createdAt.getTime()
  );
}

export const generateWaterBills = generateSampleBills;
