import { ApiTimestamp, posRequest, subscribeByPolling } from "@/services/posApi";
export type SurchargeType = "percent" | "fixed";
export type PosSurcharge = { id: string; storeId: string; name: string; type: SurchargeType; value: number; isEnabled: boolean; createdAt?: ApiTimestamp; updatedAt?: ApiTimestamp };
const loadSurcharges = async (storeId: string) => (await posRequest<{ items: PosSurcharge[] }>("surcharges", {}, { storeId })).items;
export const subscribeSurcharges = (storeId: string, onChange: (items: PosSurcharge[]) => void, onError?: (error: Error) => void) => subscribeByPolling(() => loadSurcharges(storeId), onChange, onError);
export async function createSurcharge(input: { storeId: string; name: string; type: SurchargeType; value: number; isEnabled?: boolean }) { return (await posRequest<{ id: string }>("surcharges", { method: "POST", body: JSON.stringify(input) })).id; }
export async function updateSurcharge(id: string, data: { name?: string; type?: SurchargeType; value?: number; isEnabled?: boolean }) { await posRequest("surcharges", { method: "PATCH", body: JSON.stringify({ id, ...data }) }); }
export async function deleteSurcharge(id: string) { await posRequest("surcharges", { method: "DELETE" }, { id }); }
