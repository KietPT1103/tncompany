export type InternalInvoiceDraftRow = { localId: string; name: string; quantity: string; unit: string; unitPrice: string; categoryName?: string; categoryId?: number | null };
export const createInternalInvoiceRows = (): InternalInvoiceDraftRow[] => Array.from({length:12}, () => ({localId:crypto.randomUUID(),name:"",quantity:"1",unit:"",unitPrice:"",categoryName:""}));
export function internalInvoicePayload(rows: InternalInvoiceDraftRow[]) {
  return rows.flatMap((row,index) => {
    if (!row.name.trim() && !row.unit.trim() && !row.categoryName?.trim() && !row.categoryId && !row.unitPrice.trim() && (!row.quantity.trim() || row.quantity === "1")) return [];
    const quantity = Number(row.quantity.replace(",", "."));
    const unitPrice = Number(row.unitPrice.replace(",", "."));
    if (!row.name.trim() || !Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity <= 0 || unitPrice <= 0) throw new Error(`Dòng ${index+1}: nhập tên, số lượng và đơn giá lớn hơn 0.`);
    return [{name:row.name.trim(),quantity,unit:row.unit.trim(),unitPrice,categoryId:row.categoryId,categoryName:row.categoryName?.trim() || ""}];
  });
}
