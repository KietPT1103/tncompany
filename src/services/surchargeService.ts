import { ApiTimestamp, posRequest } from "@/services/posApi";
export type SurchargeType = "percent" | "fixed";
export type PosSurcharge = { id: string; storeId: string; name: string; type: SurchargeType; value: number; isEnabled: boolean; createdAt?: ApiTimestamp; updatedAt?: ApiTimestamp };
export const getSurcharges = async (storeId: string) => (await posRequest<{ items: PosSurcharge[] }>("surcharges", {}, { storeId })).items;
export async function createSurcharge(input: { storeId: string; name: string; type: SurchargeType; value: number; isEnabled?: boolean }) { return (await posRequest<{ id: string }>("surcharges", { method: "POST", body: JSON.stringify(input) })).id; }
export async function updateSurcharge(id: string, data: { name?: string; type?: SurchargeType; value?: number; isEnabled?: boolean }) { await posRequest("surcharges", { method: "PATCH", body: JSON.stringify({ id, ...data }) }); }
export async function deleteSurcharge(id: string) { await posRequest("surcharges", { method: "DELETE" }, { id }); }
