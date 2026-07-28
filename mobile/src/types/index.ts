export type Area = { id: string; code: string; name: string };
export type AppUser = {
  id: string;
  email: string;
  username?: string | null;
  displayName: string;
  role: string;
  permissions: string[];
};
export type LocationMetadata = {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  address: string;
};
export type ReceiptStatus = "pending_explanation" | "draft" | "completed" | "cancelled";
export type ReceiptImage = {
  id: string;
  url: string;
  thumbnailUrl: string;
  capturedAt: string;
  locationAddress?: string | null;
};
export type ReceiptItem = {
  id: number;
  productId: string;
  productCode: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  note?: string;
};
export type Receipt = {
  id: string;
  receiptCode: string;
  areaId: string;
  area: Area;
  status: ReceiptStatus;
  capturedAt: string | null;
  createdAt: string;
  createdByName: string;
  totalQuantity: number;
  totalAmount: number;
  itemCount: number;
  imageCount: number;
  thumbnailUrl?: string | null;
  items: ReceiptItem[];
  images: ReceiptImage[];
};
