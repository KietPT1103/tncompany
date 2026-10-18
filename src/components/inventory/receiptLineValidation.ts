export function receiptEntryProduct<T extends { unit?: string }>(product: T, warehouseType: "ingredient" | "equipment"): T & { unit: string } {
  return { ...product, unit: product.unit?.trim() || (warehouseType === "equipment" ? "cái" : "") };
}

export function validReceiptLine(line: { product: { id: string; productName: string; unit: string } | null; quantity: string; unitPrice: string }) {
  return !!line.product?.id && !!line.product.productName?.trim() && !!line.product.unit?.trim()
    && line.quantity.trim() !== "" && Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0
    && line.unitPrice.trim() !== "" && Number.isFinite(Number(line.unitPrice)) && Number(line.unitPrice) >= 0;
}
