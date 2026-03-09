import { ExcelSaleRow } from "@/types/excelType";

export type SaleRow = {
  product_code: string;
  product_name: string;
  quantity: number;
  costUnit: number;
  cost: number;
};

export type CostRow = {
  product_code: string;
  product_name: string;
  quantity: number;
  costUnit: number;
  cost: number;
};

export type CostResult = {
  detail: CostRow[];
  totalMaterialCost: number;
};

export function calculateCost(
  rows: ExcelSaleRow[],
  costMap: Record<string, number>
): CostResult {
  let totalMaterialCost = 0;

  const detail: CostRow[] = rows.map((row) => {
    const quantity = Number(row.quantity ?? 0);
    const costUnit = costMap[row.product_code] ?? 0;
    const cost = quantity * costUnit;

    totalMaterialCost += cost;

    return {
      product_code: row.product_code,
      product_name: row.product_name,
      quantity,
      costUnit,
      cost,
    };
  });

  return { detail, totalMaterialCost };
}
