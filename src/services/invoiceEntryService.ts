import { apiRequest } from "@/lib/api";

export type InvoiceScope = "internal" | "tax";

export type InvoiceEntryItem = {
  id?: number;
  name: string;
  categoryId?: number | null;
  categoryName?: string;
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
    categoryId?: number | null;
    categoryName?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  keptEvidenceIds?: number[];
  evidences?: File[];
};

export type InvoiceEntryPagination = {
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
  from: number;
  to: number;
};

export type InvoiceEntrySummary = {
  count: number;
  totalAmount: number;
  totalEvidence: number;
};

export type InvoiceEntryListResponse = {
  items: InvoiceEntry[];
  pagination: InvoiceEntryPagination;
  summary: {
    overall: InvoiceEntrySummary;
    filtered: InvoiceEntrySummary;
  };
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
        ...(payload.scope === "internal" ? {categoryId:item.categoryId,categoryName:item.categoryName} : {}),
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
  storeId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
}) {
  const query = new URLSearchParams({
    scope: params.scope,
    page: String(Math.max(1, params.page || 1)),
    perPage: String(Math.max(1, params.perPage || 25)),
  });

  if (params.storeId?.trim()) {
    query.set("storeId", params.storeId.trim());
  }
  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }
  if (params.startDate) {
    query.set("startDate", params.startDate);
  }
  if (params.endDate) {
    query.set("endDate", params.endDate);
  }

  return apiRequest<InvoiceEntryListResponse>(
    `/invoice-entries.php?${query.toString()}`,
    {
      method: "GET",
    }
  );
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

export type InternalInvoiceCategory = {id:number;name:string};
export type InternalInvoiceMaterial = {name:string;unit:string;unitPrice:number;categoryId:number|null;categoryName:string|null};
export type InternalInvoiceStock = Omit<InternalInvoiceMaterial,"unitPrice"> & {totalReceived:number};
export type InternalInvoiceWarehouseResponse = {items:InternalInvoiceStock[];categories:InternalInvoiceCategory[];pagination:{page:number;pages:number;total:number;limit:number}};
export function getInternalInvoiceWarehouse(search="", categoryId="", page=1) {
  return apiRequest<InternalInvoiceWarehouseResponse>(`/internal-invoice-warehouse.php?${new URLSearchParams({search,categoryId,page:String(page)})}`);
}
export function searchInternalInvoiceMaterials(search:string) {
  return apiRequest<{items:InternalInvoiceMaterial[];categories:InternalInvoiceCategory[]}>(`/internal-invoice-warehouse.php?view=suggestions&search=${encodeURIComponent(search)}`);
}
export async function createInternalInvoiceCategory(name:string) {
  return (await apiRequest<{item:InternalInvoiceCategory}>("/internal-invoice-warehouse.php",{method:"POST",body:JSON.stringify({name})})).item;
}

export type InternalImportIncoming = {invoiceDate:string;note:string;items:InvoiceEntryPayload["items"];sourceSheetName?:string;sourceRowNumber?:number};
export type InternalImportPreviewRow = {incoming:InternalImportIncoming;status:"new"|"existing"|"category"|"changed"|"ambiguous";candidates:Array<InvoiceEntry & {version:string}>};
export async function previewInternalInvoiceImport(rows:InternalImportIncoming[]) {
  return (await apiRequest<{rows:InternalImportPreviewRow[]}>("/internal-invoice-import.php", {method:"POST",body:JSON.stringify({mode:"preview",rows}),timeoutMs:60000})).rows;
}
export function applyInternalInvoiceImport(payload:{operationId:string;action:"create"|"category"|"update";incoming:InternalImportIncoming;targetId?:string;expectedVersion?:string;forceNew?:boolean}) {
  return apiRequest<{id:string;action:string}>("/internal-invoice-import.php",{method:"POST",body:JSON.stringify({mode:"apply",...payload}),timeoutMs:60000});
}
