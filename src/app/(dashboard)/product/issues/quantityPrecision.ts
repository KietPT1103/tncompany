const PURCHASE_QUANTITY_DECIMALS = 6;
const BASE_QUANTITY_DECIMALS = 3;

export function formatInventoryQuantity(value: number) {
  return value.toLocaleString("vi-VN", { maximumFractionDigits: PURCHASE_QUANTITY_DECIMALS });
}

export function toInventoryBaseQuantity(quantity: number, factor: number) {
  const scale = 10 ** BASE_QUANTITY_DECIMALS;
  return Math.round(quantity * factor * scale) / scale;
}

export function isInventoryIssueQuantityInsufficient(requested: number, factor: number, stockQuantity: number) {
  return toInventoryBaseQuantity(requested, factor) > stockQuantity + 1e-9;
}
