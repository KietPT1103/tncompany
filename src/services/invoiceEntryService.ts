import { apiRequest } from "@/lib/api";

export type InvoiceScope = "internal" | "tax";

export type InvoiceEntryItem = {
  id?: number;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
};

export type InvoiceEntryEvidence = {
  id: number;
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  fileUrl: string;
};

export type InvoiceEntry = {
  id: string;
  storeId: string;
  scope: InvoiceScope;
  invoiceNumber?: string | null;
  partnerName?: string | null;
  invoiceDate: string;
  note?: string | null;
  totalAmount: number;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceEntryItem[];
  evidences: InvoiceEntryEvidence[];
};

export type InvoiceEntryPayload = {
  scope: InvoiceScope;
  storeId: string;
  invoiceDate: string;
  invoiceNumber?: string;
  partnerName?: string;
  note?: string;
  items: Array<{
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  keptEvidenceIds?: number[];
  evidences?: File[];
};

function buildInvoiceFormData(
  payload: InvoiceEntryPayload,
  mode: "create" | "update",
  id?: string
) {
  const formData = new FormData();
  formData.append("action", mode);
  if (id) {
    formData.append("id", id);
  }

  formData.append("scope", payload.scope);
  formData.append("storeId", payload.storeId);
  formData.append("invoiceDate", payload.invoiceDate);
  formData.append("invoiceNumber", payload.invoiceNumber?.trim() || "");
  formData.append("partnerName", payload.partnerName?.trim() || "");
  formData.append("note", payload.note?.trim() || "");
  formData.append(
    "items",
    JSON.stringify(
      payload.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
      }))
    )
  );
  formData.append(
    "keptEvidenceIds",
    JSON.stringify(payload.keptEvidenceIds || [])
  );

  (payload.evidences || []).forEach((file) => {
    formData.append("evidences[]", file);
  });

  return formData;
}

export async function getInvoiceEntries(params: {
  scope: InvoiceScope;
  storeId: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const query = new URLSearchParams({
    scope: params.scope,
    storeId: params.storeId,
    limit: String(params.limit || 200),
  });

  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }
  if (params.startDate) {
    query.set("startDate", params.startDate);
  }
  if (params.endDate) {
    query.set("endDate", params.endDate);
  }

  const { items } = await apiRequest<{ items: InvoiceEntry[] }>(
    `/invoice-entries.php?${query.toString()}`,
    {
      method: "GET",
    }
  );

  return items;
}

export async function createInvoiceEntry(payload: InvoiceEntryPayload) {
  const { item } = await apiRequest<{ item: InvoiceEntry }>(
    "/invoice-entries.php",
    {
      method: "POST",
      body: buildInvoiceFormData(payload, "create"),
    }
  );

  return item;
}

export async function updateInvoiceEntry(
  id: string,
  payload: InvoiceEntryPayload
) {
  const { item } = await apiRequest<{ item: InvoiceEntry }>(
    "/invoice-entries.php",
    {
      method: "POST",
      body: buildInvoiceFormData(payload, "update", id),
    }
  );

  return item;
}

export async function deleteInvoiceEntry(id: string) {
  const { deleted } = await apiRequest<{ deleted: boolean }>(
    "/invoice-entries.php",
    {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }
  );

  return deleted;
}
