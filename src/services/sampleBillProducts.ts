import { apiDownload, apiRequest } from "@/lib/api";
import { resolveSampleBillExportFileName } from "./sampleBillExport";

export type SampleBillType = "coffee" | "hotpot" | "farm";
export type FarmPriceSchedule =
  | "none"
  | "weekday"
  | "weekend_holiday"
  | "both";

export type SampleBillProduct = {
  id: string;
  productCode: string;
  productName: string;
  unit: string;
  price: number;
  billType: SampleBillType;
  farmSchedule: FarmPriceSchedule;
  minQuantity: number;
  maxQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SampleBillProductInput = Omit<
  SampleBillProduct,
  "id" | "createdAt" | "updatedAt"
>;

export type SampleBillExportRow = {
  billCode: string;
  customerName: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export async function getSampleBillProducts(
  billType?: SampleBillType
): Promise<SampleBillProduct[]> {
  const query = billType
    ? `?billType=${encodeURIComponent(billType)}`
    : "";
  const response = await apiRequest<{ items: SampleBillProduct[] }>(
    `/sample-bill-products.php${query}`
  );
  return response.items;
}

export async function createSampleBillProduct(
  product: SampleBillProductInput
) {
  return apiRequest<{ created: boolean }>("/sample-bill-products.php", {
    method: "POST",
    body: JSON.stringify(product),
  });
}

export async function updateSampleBillProduct(
  id: string,
  product: SampleBillProductInput
) {
  return apiRequest<{ updated: boolean }>("/sample-bill-products.php", {
    method: "PATCH",
    body: JSON.stringify({ id, ...product }),
  });
}

export async function deleteSampleBillProduct(id: string) {
  return apiRequest<{ deleted: boolean }>(
    `/sample-bill-products.php?id=${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function importSampleBillProducts(
  products: SampleBillProductInput[]
) {
  return apiRequest<{
    imported: boolean;
    created: number;
    updated: number;
  }>("/sample-bill-products.php", {
    method: "POST",
    body: JSON.stringify({
      action: "import",
      items: products,
    }),
    timeoutMs: 120000,
  });
}

export async function exportSampleBills(input: {
  billType: SampleBillType;
  date: string;
  targetRevenue: number;
  rows: SampleBillExportRow[];
}) {
  const { blob, fileName } = await apiDownload(
    "/sample-bills-export.php",
    {
      method: "POST",
      body: JSON.stringify(input),
      timeoutMs: 30000,
    }
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = resolveSampleBillExportFileName(
    fileName,
    input.billType,
    input.date,
  );
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
