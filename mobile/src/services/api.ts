import Constants from "expo-constants";
import { fetch } from "expo/fetch";
import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import type { AppUser, Area, Receipt } from "@/types";

const TOKEN_KEY = "tn_company_api_token";
const configuredBase = process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) || "";
export const API_BASE_URL = configuredBase.replace(/\/$/, "");

export function apiAssetUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  if (API_BASE_URL.endsWith("/api") && path.startsWith("/api/")) {
    return `${API_BASE_URL.slice(0, -4)}${path}`;
  }
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function cacheApiAsset(path: string, cacheKey: string) {
  const token = await getToken();
  if (!token) throw new Error("Phiên đăng nhập chưa sẵn sàng để tải ảnh.");
  const safeKey = cacheKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  const target = new File(Paths.cache, `tn-receipt-${safeKey}.jpg`);
  const downloaded = await File.downloadFileAsync(apiAssetUrl(path), target, {
    headers: { Authorization: `Bearer ${token}`, Accept: "image/*" },
    idempotent: true,
  });
  return downloaded.uri;
}

type Envelope<T> = { ok: boolean; data: T; error?: string };

export async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}
export async function setToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
}
export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error("Chưa cấu hình EXPO_PUBLIC_API_BASE_URL.");
  const token = await getToken();
  const headers = new Headers(init.headers);
  const originalMethod = (init.method || "GET").toUpperCase();
  const useMethodOverride = ["PUT", "PATCH", "DELETE"].includes(originalMethod) &&
    /(?:^|\/)[^/?]+\.php(?:[?#]|$)/i.test(path);
  headers.set("Accept", "application/json");
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const requestPath = useMethodOverride
    ? `${path}${path.includes("?") ? "&" : "?"}_method=${encodeURIComponent(originalMethod)}`
    : path;
  const response = await fetch(`${API_BASE_URL}${requestPath}`, {
    ...init,
    method: useMethodOverride ? "POST" : originalMethod,
    headers,
  });
  const raw = await response.text();
  let payload: Envelope<T>;
  try {
    payload = JSON.parse(raw) as Envelope<T>;
  } catch {
    const returnedHtml = raw.trimStart().startsWith("<");
    throw new Error(returnedHtml
      ? `Không tìm thấy API ${path} trên máy chủ (HTTP ${response.status}).`
      : `Máy chủ trả về dữ liệu không hợp lệ (HTTP ${response.status}).`);
  }
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Yêu cầu thất bại.");
  return payload.data;
}

export async function login(loginName: string, password: string) {
  const data = await api<{ token: string; user: AppUser }>("/auth.php?action=login", {
    method: "POST", body: JSON.stringify({ login: loginName, password })
  });
  await setToken(data.token);
  return data.user;
}
export const getMe = () => api<{ user: AppUser }>("/auth.php?action=me");
export const getAreas = () => api<{ items: Area[] }>("/areas.php");
export const getReceipts = (query: string) =>
  api<{ items: Receipt[]; counts: Record<string, number> }>(`/inventory-receipts.php?${query}`);
export const getReceipt = (id: string) =>
  api<{ item: Receipt }>(`/inventory-receipts.php?id=${encodeURIComponent(id)}`);
export const createReceipt = (payload: object) =>
  api<{ item: Receipt }>("/inventory-receipts.php", { method: "POST", body: JSON.stringify(payload) });
export const updateReceipt = (id: string, payload: object) =>
  api<{ item: Receipt }>(`/inventory-receipts.php?id=${encodeURIComponent(id)}`, {
    method: "PUT", body: JSON.stringify(payload)
  });
export const completeReceipt = (id: string) =>
  api<{ item: Receipt }>("/inventory-receipts.php?action=complete", {
    method: "POST", body: JSON.stringify({ id })
  });
export const unlockReceipt = (id: string) =>
  api<{ item: Receipt }>("/inventory-receipts.php?action=unlock", {
    method: "POST", body: JSON.stringify({ id })
  });
export type ProductSearchResult = {
  id: string; productCode: string; productName: string; unit: string;
  areaId: string; areaName: string; attachedToCurrentArea: boolean;
};
export async function searchProducts(search: string, areaId: string) {
  const result = await api<{ items: {
    id: string; ingredientCode: string; ingredientName: string; unit: string; storeId: string;
  }[]; canCreate: boolean; suggestedCode: string }>(
    `/ingredients.php?search=${encodeURIComponent(search)}&areaId=${encodeURIComponent(areaId)}`
  );
  return {
    ...result,
    items: result.items.map((item): ProductSearchResult => ({
      id: item.id, productCode: item.ingredientCode, productName: item.ingredientName,
      unit: item.unit, areaId: item.storeId, areaName: "", attachedToCurrentArea: true,
    })),
  };
}
export const getNextProductCode = (areaId: string) =>
  api<{ suggestedCode: string }>(
    `/ingredients.php?action=next-code&areaId=${encodeURIComponent(areaId)}`
  );
export const attachProduct = (productId: string, areaId: string) =>
  api<{ item: { id: string } }>("/area-products.php", {
    method: "POST", body: JSON.stringify({ productId, areaId })
  });
export const createProduct = (payload: object) =>
  api<{ item: {
    id: string; ingredientCode: string; ingredientName: string; unit: string; storeId: string;
  } }>("/ingredients.php", { method: "POST", body: JSON.stringify(payload) }).then(({ item }) => ({
    item: {
      id: item.id, productCode: item.ingredientCode, productName: item.ingredientName,
      unit: item.unit, areaId: item.storeId, areaName: "", attachedToCurrentArea: true,
    } satisfies ProductSearchResult,
  }));
export type SupplierSearchResult = {
  id: string; supplierCode: string; supplierName: string; phone: string; address: string;
};
export const searchSuppliers = (search: string, areaId: string) =>
  api<{ items: SupplierSearchResult[] }>(
    `/suppliers.php?search=${encodeURIComponent(search)}&areaId=${encodeURIComponent(areaId)}`
  );
export const addReceiptItem = (payload: object) =>
  api("/inventory-receipt-items.php", { method: "POST", body: JSON.stringify(payload) });
export async function uploadReceiptImage(receiptId: string, photoUri: string, metadata: {
  clientFileId: string; capturedAt: string; location: { latitude: number | null; longitude: number | null; accuracy: number | null; address: string };
  finalizeQuick?: boolean;
}) {
  const photo = new File(photoUri);
  if (!photo.exists) throw new Error("Ảnh chờ đồng bộ không còn tồn tại trên thiết bị.");
  const form = new FormData();
  form.append("receiptId", receiptId);
  form.append("clientFileId", metadata.clientFileId);
  form.append("capturedAt", metadata.capturedAt);
  form.append("latitude", String(metadata.location.latitude ?? ""));
  form.append("longitude", String(metadata.location.longitude ?? ""));
  form.append("locationAccuracy", String(metadata.location.accuracy ?? ""));
  form.append("locationAddress", metadata.location.address);
  form.append("finalizeQuick", metadata.finalizeQuick ? "1" : "0");
  form.append("photo", photo);
  return api("/inventory-receipt-images.php", { method: "POST", body: form });
}
