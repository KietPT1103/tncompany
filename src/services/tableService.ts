import { posRequest } from "@/services/posApi";
export type CafeTable = { id: string; name: string; area?: string; active?: boolean; order?: number; storeId?: string };
export async function getTables(storeId = "cafe"): Promise<CafeTable[]> { return (await posRequest<{ items: CafeTable[] }>("tables", {}, { storeId })).items; }
export async function addTable(name: string, area?: string, storeId = "cafe") { if (!name.trim()) return null; return (await posRequest<{ id: string }>("tables", { method: "POST", body: JSON.stringify({ name: name.trim(), area: area?.trim() || "", storeId }) })).id; }
