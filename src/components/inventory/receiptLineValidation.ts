export function validReceiptLine(line: { product: { id: string } | null; quantity: string; unitPrice: string }) {
  return !!line.product && line.quantity.trim() !== "" && Number.isFinite(Number(line.quantity)) && Number(line.quantity) > 0
    && line.unitPrice.trim() !== "" && Number.isFinite(Number(line.unitPrice)) && Number(line.unitPrice) >= 0;
}
