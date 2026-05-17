"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  createInvoiceEntry,
  deleteInvoiceEntry,
  getInvoiceEntries,
  InvoiceEntry,
  InvoiceEntryPagination,
  InvoiceScope,
  InvoiceEntrySummary,
  updateInvoiceEntry,
} from "@/services/invoiceEntryService";
import { parseInvoiceImportWorkbook } from "@/services/excel";
import { type StoreType, useStore } from "@/context/StoreContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  ArrowLeft,
  Download,
  FileImage,
  FilePlus2,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type InvoiceAdminPageProps = {
  scope: InvoiceScope;
  title: string;
  description: string;
  accentClassName: string;
};

type EditableItem = {
  localId: string;
  name: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

type FilterMode = "day" | "range" | "month" | "quarter" | "year";

type InvoiceDateQuery = {
  startDate?: string;
  endDate?: string;
};

type InvoiceStoreFilter = "all" | StoreType;

const STORE_FILTER_OPTIONS: Array<{ value: InvoiceStoreFilter; label: string }> = [
  { value: "all", label: "Tất cả store" },
  { value: "cafe", label: "Cafe" },
  { value: "restaurant", label: "Lẩu / Bếp" },
  { value: "bakery", label: "Tiệm bánh" },
  { value: "farm", label: "Farm" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const EMPTY_PAGINATION: InvoiceEntryPagination = {
  page: 1,
  perPage: 25,
  total: 0,
  lastPage: 1,
  from: 0,
  to: 0,
};

const EMPTY_SUMMARY: InvoiceEntrySummary = {
  count: 0,
  totalAmount: 0,
  totalEvidence: 0,
};

function buildVisiblePages(currentPage: number, lastPage: number) {
  if (lastPage <= 7) {
    return Array.from({ length: lastPage }, (_, index) => index + 1);
  }

  const pages: Array<number | string> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(lastPage - 1, currentPage + 1);

  if (start > 2) {
    pages.push("start-ellipsis");
  }

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    pages.push(pageNumber);
  }

  if (end < lastPage - 1) {
    pages.push("end-ellipsis");
  }

  pages.push(lastPage);
  return pages;
}

const formatCurrency = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

const createLocalId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createEmptyItem = (): EditableItem => ({
  localId: createLocalId(),
  name: "",
  quantity: "1",
  unit: "",
  unitPrice: "",
});

const padDatePart = (value: number) => String(value).padStart(2, "0");

const formatDateInputValue = (value: Date) =>
  `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(
    value.getDate()
  )}`;

const formatMonthInputValue = (value: Date) =>
  `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}`;

const todayValue = () => formatDateInputValue(new Date());

const currentYearValue = () => String(new Date().getFullYear());

const currentMonthValue = () => formatMonthInputValue(new Date());

const currentQuarterValue = () => String(Math.floor(new Date().getMonth() / 3) + 1);

const createDefaultFilterState = () => ({
  mode: "range" as FilterMode,
  day: todayValue(),
  startDate: "",
  endDate: "",
  month: currentMonthValue(),
  quarter: currentQuarterValue(),
  quarterYear: currentYearValue(),
  year: currentYearValue(),
});

function buildDateQuery(params: {
  mode: FilterMode;
  day: string;
  startDate: string;
  endDate: string;
  month: string;
  quarter: string;
  quarterYear: string;
  year: string;
}): InvoiceDateQuery & { error?: string } {
  if (params.mode === "day") {
    if (!params.day) {
      return { error: "Vui lòng chọn ngày cần lọc." };
    }

    return {
      startDate: params.day,
      endDate: params.day,
    };
  }

  if (params.mode === "range") {
    if (params.startDate && params.endDate && params.startDate > params.endDate) {
      return { error: "Ngày bắt đầu không được lớn hơn ngày kết thúc." };
    }

    return {
      startDate: params.startDate || undefined,
      endDate: params.endDate || undefined,
    };
  }

  if (params.mode === "month") {
    if (!params.month || !/^\d{4}-\d{2}$/.test(params.month)) {
      return { error: "Vui lòng chọn tháng hợp lệ." };
    }

    const [yearValue, monthValue] = params.month.split("-").map(Number);

    return {
      startDate: formatDateInputValue(new Date(yearValue, monthValue - 1, 1)),
      endDate: formatDateInputValue(new Date(yearValue, monthValue, 0)),
    };
  }

  if (params.mode === "quarter") {
    const quarter = Number(params.quarter);
    const yearValue = Number(params.quarterYear);

    if (!Number.isInteger(yearValue) || yearValue < 2000) {
      return { error: "Vui lòng nhập năm hợp lệ cho bộ lọc quý." };
    }

    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      return { error: "Vui lòng chọn quý hợp lệ." };
    }

    const startMonth = (quarter - 1) * 3;

    return {
      startDate: formatDateInputValue(new Date(yearValue, startMonth, 1)),
      endDate: formatDateInputValue(new Date(yearValue, startMonth + 3, 0)),
    };
  }

  const yearValue = Number(params.year);
  if (!Number.isInteger(yearValue) || yearValue < 2000) {
    return { error: "Vui lòng nhập năm hợp lệ." };
  }

  return {
    startDate: formatDateInputValue(new Date(yearValue, 0, 1)),
    endDate: formatDateInputValue(new Date(yearValue, 11, 31)),
  };
}

const parseDecimal = (value: string) => {
  const normalized = value.replace(/,/g, ".").replace(/[^\d.-]/g, "");
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const buildItemPayload = (items: EditableItem[]) =>
  items
    .map((item) => ({
      name: item.name.trim(),
      quantity: parseDecimal(item.quantity),
      unit: item.unit.trim(),
      unitPrice: parseDecimal(item.unitPrice),
    }))
    .filter((item) => item.name && item.quantity > 0 && item.unitPrice > 0);

const FALLBACK_SITE_URL = "https://tnservice.vn";
const CONFIGURED_SITE_URL = (import.meta.env.VITE_SITE_URL || "").trim();

type ExportRowValue = string | number;
type ExportRow = Record<string, ExportRowValue>;
type ExportHyperlinkCell = {
  column: string;
  rowIndex: number;
  url: string;
};

function buildExportRows(entries: InvoiceEntry[], scopeLabel: string) {
  return entries.flatMap((entry) => {
    const evidenceUrls =
      entry.evidences.length > 0
        ? entry.evidences.map((evidence) => evidence.fileUrl).join("\n")
        : "";

    return entry.items.map((item, index) => ({
      "Loại màn": scopeLabel,
      "Ngày hóa đơn": entry.invoiceDate,
      "Mã phiếu": entry.id,
      "Số hóa đơn": entry.invoiceNumber || "",
      "Đơn vị / người bán": entry.partnerName || "",
      "Tổng hóa đơn": entry.totalAmount,
      "Mặt hàng": item.name,
      "Số lượng": item.quantity,
      "Đơn vị": item.unit,
      "Đơn giá": item.unitPrice,
      "Thành tiền": item.lineTotal,
      "Ghi chú": index === 0 ? entry.note || "" : "",
      "Minh chứng": index === 0 ? evidenceUrls : "",
      "Người tạo": index === 0 ? entry.createdBy || "" : "",
      "Tạo lúc": index === 0 ? entry.createdAt : "",
      "Cập nhật lúc": index === 0 ? entry.updatedAt : "",
    }));
  });
}

const buildExportBaseUrl = () => {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  return (CONFIGURED_SITE_URL || FALLBACK_SITE_URL).replace(/\/+$/, "");
};

const resolveEvidenceExportUrl = (fileUrl: string) => {
  const normalizedUrl = fileUrl.trim();
  if (!normalizedUrl) {
    return "";
  }

  try {
    return new URL(normalizedUrl).toString();
  } catch {
    try {
      return new URL(normalizedUrl, `${buildExportBaseUrl()}/`).toString();
    } catch {
      return normalizedUrl;
    }
  }
};

function buildExportWorkbookData(entries: InvoiceEntry[], scopeLabel: string) {
  const evidenceLinkHeaders = Array.from(
    {
      length: entries.reduce(
        (maxCount, entry) => Math.max(maxCount, entry.evidences.length),
        0
      ),
    },
    (_, index) => `Link minh chung ${index + 1}`
  );

  const headers = [
    "Loai man",
    "Ngay hoa don",
    "Ma phieu",
    "So hoa don",
    "Don vi / nguoi ban",
    "Tong hoa don",
    "Mat hang",
    "So luong",
    "Don vi",
    "Don gia",
    "Thanh tien",
    "Ghi chu",
    "Minh chung",
    ...evidenceLinkHeaders,
    "Nguoi tao",
    "Tao luc",
    "Cap nhat luc",
  ];

  const rows: ExportRow[] = [];
  const hyperlinkCells: ExportHyperlinkCell[] = [];

  entries.forEach((entry) => {
    const evidenceUrls = entry.evidences.map((evidence) =>
      resolveEvidenceExportUrl(evidence.fileUrl)
    );

    entry.items.forEach((item, index) => {
      const row = headers.reduce<ExportRow>((accumulator, header) => {
        accumulator[header] = "";
        return accumulator;
      }, {});

      row["Loai man"] = scopeLabel;
      row["Ngay hoa don"] = entry.invoiceDate;
      row["Ma phieu"] = entry.id;
      row["So hoa don"] = entry.invoiceNumber || "";
      row["Don vi / nguoi ban"] = entry.partnerName || "";
      row["Tong hoa don"] = entry.totalAmount;
      row["Mat hang"] = item.name;
      row["So luong"] = item.quantity;
      row["Don vi"] = item.unit;
      row["Don gia"] = item.unitPrice;
      row["Thanh tien"] = item.lineTotal;
      row["Ghi chu"] = index === 0 ? entry.note || "" : "";
      row["Minh chung"] = index === 0 ? evidenceUrls.join("\n") : "";
      row["Nguoi tao"] = index === 0 ? entry.createdBy || "" : "";
      row["Tao luc"] = index === 0 ? entry.createdAt : "";
      row["Cap nhat luc"] = index === 0 ? entry.updatedAt : "";

      if (index === 0) {
        evidenceLinkHeaders.forEach((header, evidenceIndex) => {
          const url = evidenceUrls[evidenceIndex] || "";
          row[header] = url;

          if (url) {
            hyperlinkCells.push({
              column: header,
              rowIndex: rows.length,
              url,
            });
          }
        });
      }

      rows.push(row);
    });
  });

  return {
    headers,
    rows,
    hyperlinkCells,
  };
}

function attachExportHyperlinks(
  worksheet: XLSX.WorkSheet,
  headers: string[],
  hyperlinkCells: ExportHyperlinkCell[]
) {
  const headerColumnIndex = new Map(
    headers.map((header, index) => [header, index] as const)
  );

  hyperlinkCells.forEach(({ column, rowIndex, url }) => {
    const columnIndex = headerColumnIndex.get(column);
    if (columnIndex === undefined) {
      return;
    }

    const cellAddress = XLSX.utils.encode_cell({
      r: rowIndex + 1,
      c: columnIndex,
    });
    const cell = worksheet[cellAddress] as
      | (XLSX.CellObject & { l?: { Target: string; Tooltip?: string } })
      | undefined;

    if (!cell) {
      return;
    }

    cell.l = {
      Target: url,
      Tooltip: "Mo minh chung tren web",
    };
  });
}

export default function InvoiceAdminPage({
  scope,
  title,
  description,
  accentClassName,
}: InvoiceAdminPageProps) {
  const { storeId, storeName } = useStore();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const autoApplyInitializedRef = useRef(false);
  const skipNextAutoApplyRef = useRef(false);

  const [entries, setEntries] = useState<InvoiceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [pageJump, setPageJump] = useState("1");
  const [pagination, setPagination] = useState<InvoiceEntryPagination>(EMPTY_PAGINATION);
  const [overallSummary, setOverallSummary] = useState<InvoiceEntrySummary>(EMPTY_SUMMARY);
  const [filteredSummary, setFilteredSummary] = useState<InvoiceEntrySummary>(EMPTY_SUMMARY);
  const [filterMode, setFilterMode] = useState<FilterMode>(createDefaultFilterState().mode);
  const [search, setSearch] = useState("");
  const [filterDay, setFilterDay] = useState(createDefaultFilterState().day);
  const [startDate, setStartDate] = useState(createDefaultFilterState().startDate);
  const [endDate, setEndDate] = useState(createDefaultFilterState().endDate);
  const [filterMonth, setFilterMonth] = useState(createDefaultFilterState().month);
  const [filterQuarter, setFilterQuarter] = useState(createDefaultFilterState().quarter);
  const [filterQuarterYear, setFilterQuarterYear] = useState(
    createDefaultFilterState().quarterYear
  );
  const [filterYear, setFilterYear] = useState(createDefaultFilterState().year);
  const [storeFilterId, setStoreFilterId] = useState<InvoiceStoreFilter>("all");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [appliedDateQuery, setAppliedDateQuery] = useState<InvoiceDateQuery>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<InvoiceEntry | null>(null);
  const [invoiceStoreId, setInvoiceStoreId] = useState<StoreType>(storeId);
  const [invoiceDate, setInvoiceDate] = useState(todayValue());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<EditableItem[]>([createEmptyItem()]);
  const [keptEvidenceIds, setKeptEvidenceIds] = useState<number[]>([]);
  const [newEvidenceFiles, setNewEvidenceFiles] = useState<File[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [movingStore, setMovingStore] = useState(false);
  const [batchStoreId, setBatchStoreId] = useState<StoreType>(storeId);

  const scopeLabel = scope === "internal" ? "Nội bộ" : "Thuế";

  const loadEntries = async (
    dateQuery: InvoiceDateQuery = appliedDateQuery,
    keyword: string = appliedSearch,
    targetStoreFilter: InvoiceStoreFilter = storeFilterId,
    targetPage: number = page,
    targetPageSize: number = pageSize
  ) => {
    setLoading(true);
    try {
      const data = await getInvoiceEntries({
        scope,
        storeId: targetStoreFilter === "all" ? undefined : targetStoreFilter,
        search: keyword,
        startDate: dateQuery.startDate,
        endDate: dateQuery.endDate,
        page: targetPage,
        perPage: targetPageSize,
      });
      setEntries(data.items);
      setPagination(data.pagination);
      setPage(data.pagination.page);
      setPageJump(String(data.pagination.page));
      setOverallSummary(data.summary.overall);
      setFilteredSummary(data.summary.filtered);
      setSelectedEntryIds((current) =>
        current.filter((entryId) => data.items.some((entry) => entry.id === entryId))
      );
    } catch (error) {
      console.error(error);
      alert("Không thể tải danh sách hóa đơn.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    setPageJump("1");
    void loadEntries(appliedDateQuery, appliedSearch, storeFilterId, 1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  useEffect(() => {
    if (!editingEntry) {
      setInvoiceStoreId(storeId);
    }
    setBatchStoreId(storeId);
  }, [editingEntry, storeId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [search]);

  useEffect(() => {
    if (!autoApplyInitializedRef.current) {
      autoApplyInitializedRef.current = true;
      return;
    }

    if (skipNextAutoApplyRef.current) {
      skipNextAutoApplyRef.current = false;
      return;
    }

    const dateQuery = buildDateQuery({
      mode: filterMode,
      day: filterDay,
      startDate,
      endDate,
      month: filterMonth,
      quarter: filterQuarter,
      quarterYear: filterQuarterYear,
      year: filterYear,
    });

    if (dateQuery.error) {
      return;
    }

    const keyword = debouncedSearch.trim();
    const nextDateQuery = {
      startDate: dateQuery.startDate,
      endDate: dateQuery.endDate,
    };

    setAppliedSearch(keyword);
    setAppliedDateQuery(nextDateQuery);
    if (page !== 1) {
      setPage(1);
      setPageJump("1");
      void loadEntries(nextDateQuery, keyword, storeFilterId, 1, pageSize);
      return;
    }

    void loadEntries(nextDateQuery, keyword, storeFilterId, 1, pageSize);
  }, [
    debouncedSearch,
    endDate,
    filterDay,
    filterMode,
    filterMonth,
    filterQuarter,
    filterQuarterYear,
    filterYear,
    storeFilterId,
    startDate,
  ]);

  const currentPageTotalAmount = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.totalAmount, 0),
    [entries]
  );

  const currentPageTotalEvidence = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.evidences.length, 0),
    [entries]
  );

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedEntryIds.includes(entry.id)),
    [entries, selectedEntryIds]
  );

  const selectedTotalAmount = useMemo(
    () => selectedEntries.reduce((sum, entry) => sum + entry.totalAmount, 0),
    [selectedEntries]
  );

  const isAllEntriesSelected =
    entries.length > 0 && selectedEntryIds.length === entries.length;

  const formTotal = useMemo(
    () =>
      buildItemPayload(items).reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      ),
    [items]
  );

  const resetForm = () => {
    setEditingEntry(null);
    setInvoiceStoreId(storeId);
    setInvoiceDate(todayValue());
    setInvoiceNumber("");
    setPartnerName("");
    setNote("");
    setItems([createEmptyItem()]);
    setKeptEvidenceIds([]);
    setNewEvidenceFiles([]);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (entry: InvoiceEntry) => {
    setEditingEntry(entry);
    setInvoiceStoreId(entry.storeId as StoreType);
    setInvoiceDate(entry.invoiceDate);
    setInvoiceNumber(entry.invoiceNumber || "");
    setPartnerName(entry.partnerName || "");
    setNote(entry.note || "");
    setItems(
      entry.items.map((item) => ({
        localId: createLocalId(),
        name: item.name,
        quantity: String(item.quantity),
        unit: item.unit || "",
        unitPrice: String(item.unitPrice),
      }))
    );
    setKeptEvidenceIds(entry.evidences.map((evidence) => evidence.id));
    setNewEvidenceFiles([]);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const updateItem = (localId: string, key: keyof EditableItem, value: string) => {
    setItems((current) =>
      current.map((item) =>
        item.localId === localId ? { ...item, [key]: value } : item
      )
    );
  };

  const addItem = () => {
    setItems((current) => [...current, createEmptyItem()]);
  };

  const removeItem = (localId: string) => {
    setItems((current) =>
      current.length === 1
        ? [createEmptyItem()]
        : current.filter((item) => item.localId !== localId)
    );
  };

  const handleSubmit = async () => {
    const payloadItems = buildItemPayload(items);

    if (!invoiceDate) {
      alert("Vui lòng chọn ngày hóa đơn.");
      return;
    }

    if (payloadItems.length === 0) {
      alert("Cần ít nhất 1 dòng hàng hợp lệ.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        scope,
        storeId: invoiceStoreId,
        invoiceDate,
        invoiceNumber,
        partnerName,
        note,
        items: payloadItems,
        keptEvidenceIds,
        evidences: newEvidenceFiles,
      };

      if (editingEntry) {
        await updateInvoiceEntry(editingEntry.id, payload);
      } else {
        await createInvoiceEntry(payload);
      }

      closeModal();
      await loadEntries();
      alert(editingEntry ? "Đã cập nhật hóa đơn." : "Đã lưu hóa đơn.");
    } catch (error) {
      console.error(error);
      alert("Không thể lưu hóa đơn.");
    } finally {
      setSaving(false);
    }
  };

  const toggleEntrySelection = (entryId: string) => {
    setSelectedEntryIds((current) =>
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId]
    );
  };

  const toggleSelectAllEntries = () => {
    setSelectedEntryIds((current) =>
      current.length === entries.length ? [] : entries.map((entry) => entry.id)
    );
  };

  const clearSelection = () => {
    setSelectedEntryIds([]);
  };

  const handleDelete = async (entry: InvoiceEntry) => {
    if (!confirm(`Xóa hóa đơn ${entry.invoiceNumber || entry.id}?`)) {
      return;
    }

    setDeletingId(entry.id);
    try {
      await deleteInvoiceEntry(entry.id);
      await loadEntries();
    } catch (error) {
      console.error(error);
      alert("Không thể xóa hóa đơn.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedEntries.length === 0) {
      alert("Vui lòng chọn ít nhất 1 hóa đơn.");
      return;
    }

    if (
      !confirm(
        `Xóa ${selectedEntries.length} hóa đơn đã chọn? Hành động này không thể hoàn tác.`
      )
    ) {
      return;
    }

    setDeletingId("batch");
    try {
      for (const entry of selectedEntries) {
        await deleteInvoiceEntry(entry.id);
      }
      clearSelection();
      await loadEntries();
    } catch (error) {
      console.error(error);
      alert("Không thể xóa các hóa đơn đã chọn.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = (targetEntries: InvoiceEntry[] = entries) => {
    if (targetEntries.length === 0) {
      alert("Chưa có dữ liệu để xuất.");
      return;
    }

    const { headers, rows, hyperlinkCells } = buildExportWorkbookData(
      targetEntries,
      scopeLabel
    );
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: headers,
    });
    attachExportHyperlinks(worksheet, headers, hyperlinkCells);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "HoaDon");
    XLSX.writeFile(
      workbook,
      `hoa-don-${scope}-${storeId}-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const updateEntryStore = async (entry: InvoiceEntry, nextStoreId: StoreType) => {
    if (entry.storeId === nextStoreId) {
      return;
    }

    await updateInvoiceEntry(entry.id, {
      scope,
      storeId: nextStoreId,
      invoiceDate: entry.invoiceDate,
      invoiceNumber: entry.invoiceNumber || "",
      partnerName: entry.partnerName || "",
      note: entry.note || "",
      items: entry.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit || "",
        unitPrice: item.unitPrice,
      })),
      keptEvidenceIds: entry.evidences.map((evidence) => evidence.id),
      evidences: [],
    });
  };

  const handleMoveSelectedToStore = async () => {
    if (selectedEntries.length === 0) {
      alert("Vui lòng chọn ít nhất 1 hóa đơn.");
      return;
    }

    setMovingStore(true);
    try {
      for (const entry of selectedEntries) {
        await updateEntryStore(entry, batchStoreId);
      }
      await loadEntries();
    } catch (error) {
      console.error(error);
      alert("Không thể chuyển store cho các hóa đơn đã chọn.");
    } finally {
      setMovingStore(false);
    }
  };

  const handleDeleteSelectedAction = async () => {
    if (selectedEntries.length === 0) {
      alert("Vui lòng chọn ít nhất 1 hóa đơn.");
      return;
    }

    if (
      !confirm(
        `Xóa ${selectedEntries.length} hóa đơn đã chọn? Hành động này không thể hoàn tác.`
      )
    ) {
      return;
    }

    setDeletingId("batch");
    try {
      for (const entry of selectedEntries) {
        await deleteInvoiceEntry(entry.id);
      }
      clearSelection();
      await loadEntries();
    } catch (error) {
      console.error(error);
      alert("Không thể xóa các hóa đơn đã chọn.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportSelected = () => {
    if (selectedEntries.length === 0) {
      alert("Vui lòng chọn ít nhất 1 hóa đơn.");
      return;
    }

    handleExport(selectedEntries);
  };

  const openImportPicker = () => {
    if (importing) {
      return;
    }

    importInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!storeId) {
      alert("Vui lòng chọn cửa hàng trước khi import hóa đơn.");
      input.value = "";
      return;
    }

    setImporting(true);
    try {
      const parsed = await parseInvoiceImportWorkbook(file);

      if (parsed.entries.length === 0) {
        alert("Không tìm thấy dòng dữ liệu hợp lệ theo mẫu Excel.");
        return;
      }

      const sheetSummary = parsed.sheets
        .map((sheet) => `${sheet.sheetName} (${sheet.rowCount} dòng)`)
        .join(", ");

      const confirmed = confirm(
        [
          `Sẽ import ${parsed.entries.length} hóa đơn từ ${parsed.sheets.length} sheet.`,
          `File: ${file.name}`,
          sheetSummary ? `Chi tiết: ${sheetSummary}` : "",
          parsed.skippedRows > 0 ? `Bỏ qua ${parsed.skippedRows} dòng không hợp lệ.` : "",
          "",
          "Tiếp tục import?",
        ]
          .filter(Boolean)
          .join("\n")
      );

      if (!confirmed) {
        return;
      }

      for (const entry of parsed.entries) {
        await createInvoiceEntry({
          scope,
          storeId,
          invoiceDate: entry.invoiceDate,
          invoiceNumber: "",
          partnerName: "",
          note: entry.note,
          items: entry.items,
        });
      }

      await loadEntries();

      alert(
        [
          `Đã import ${parsed.entries.length} hóa đơn.`,
          `Từ ${parsed.sheets.length} sheet trong file ${file.name}.`,
          parsed.skippedRows > 0 ? `Đã bỏ qua ${parsed.skippedRows} dòng không hợp lệ.` : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
    } catch (error) {
      console.error(error);
      alert("Không thể import file Excel.");
    } finally {
      setImporting(false);
      input.value = "";
    }
  };

  const resetFilters = async () => {
    const defaults = createDefaultFilterState();
    skipNextAutoApplyRef.current = true;

    setStoreFilterId("all");
    setFilterMode(defaults.mode);
    setSearch("");
    setDebouncedSearch("");
    setFilterDay(defaults.day);
    setStartDate(defaults.startDate);
    setEndDate(defaults.endDate);
    setFilterMonth(defaults.month);
    setFilterQuarter(defaults.quarter);
    setFilterQuarterYear(defaults.quarterYear);
    setFilterYear(defaults.year);
    setAppliedSearch("");
    setAppliedDateQuery({});

    await loadEntries({}, "", "all");
  };

  const handlePageChange = async (nextPage: number) => {
    const safePage = Math.max(1, Math.min(nextPage, pagination.lastPage || 1));
    setPage(safePage);
    setPageJump(String(safePage));
    await loadEntries(appliedDateQuery, appliedSearch, storeFilterId, safePage, pageSize);
  };

  const handlePageSizeChange = async (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
    setPageJump("1");
    await loadEntries(appliedDateQuery, appliedSearch, storeFilterId, 1, nextPageSize);
  };

  const handleJumpPage = async () => {
    const targetPage = Number(pageJump);
    if (!Number.isFinite(targetPage)) {
      setPageJump(String(page));
      return;
    }

    await handlePageChange(targetPage);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="w-full space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-100"
              title="Trang chủ"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${accentClassName}`}>
                <ReceiptText className="mr-2 inline h-4 w-4" />
                Hóa đơn {scopeLabel.toLowerCase()}
              </p>
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
              <p className="text-sm text-slate-500">
                {description} tại {storeName}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => void loadEntries()}
              disabled={importing}
            >
              <RefreshCcw className="h-4 w-4" />
              Tải lại
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={openImportPicker}
              isLoading={importing}
            >
              <Upload className="h-4 w-4" />
              Import Excel
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleExport()}
              disabled={importing}
            >
              <Download className="h-4 w-4" />
              Xuất Excel
            </Button>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={openCreateModal}
              disabled={importing}
            >
              <Plus className="h-4 w-4" />
              Thêm hóa đơn
            </Button>
          </div>
        </div>

        {selectedEntryIds.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="text-sm text-emerald-900">
              <span className="font-semibold">{selectedEntryIds.length}</span> hóa đơn được chọn
              {selectedTotalAmount > 0 ? ` • ${formatCurrency(selectedTotalAmount)} VND` : ""}
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={batchStoreId}
                onChange={(event) => setBatchStoreId(event.target.value as StoreType)}
                className="h-10 rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700"
                disabled={movingStore}
              >
                {STORE_FILTER_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => void handleMoveSelectedToStore()}
                isLoading={movingStore}
                disabled={importing}
              >
                Chuyển store
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleExportSelected}>
                <Download className="h-4 w-4" />
                Xuất đã chọn
              </Button>
              <Button
                variant="outline"
                className="gap-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                onClick={() => void handleDeleteSelectedAction()}
                isLoading={deletingId === "batch"}
                disabled={importing}
              >
                <Trash2 className="h-4 w-4" />
                Xóa đã chọn
              </Button>
              <Button variant="ghost" className="gap-2" onClick={clearSelection}>
                <X className="h-4 w-4" />
                Bỏ chọn
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Bộ lọc</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_220px_220px_minmax(0,1fr)_72px]">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tìm kiếm
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="pl-9"
                      placeholder="Số HĐ, đơn vị, chi tiết, ghi chú"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium leading-none text-slate-700">
                    Store
                  </label>
                  <select
                    value={storeFilterId}
                    onChange={(event) => setStoreFilterId(event.target.value as InvoiceStoreFilter)}
                    className="mb-4 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {STORE_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <label className="text-sm font-medium leading-none text-slate-700">
                    Kiểu lọc
                  </label>
                  <select
                    value={filterMode}
                    onChange={(event) => setFilterMode(event.target.value as FilterMode)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="day">Theo ngày</option>
                    <option value="range">Khoảng ngày</option>
                    <option value="month">Theo tháng</option>
                    <option value="quarter">Theo quý</option>
                    <option value="year">Theo năm</option>
                  </select>
                </div>
                <div className="xl:col-span-2">
                  {filterMode === "day" ? (
                    <Input
                      type="date"
                      label="Ngày hóa đơn"
                      value={filterDay}
                      onChange={(event) => setFilterDay(event.target.value)}
                    />
                  ) : null}

                  {filterMode === "range" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Input
                        type="date"
                        label="Từ ngày"
                        value={startDate}
                        onChange={(event) => setStartDate(event.target.value)}
                      />
                      <Input
                        type="date"
                        label="Đến ngày"
                        value={endDate}
                        onChange={(event) => setEndDate(event.target.value)}
                      />
                    </div>
                  ) : null}

                  {filterMode === "month" ? (
                    <Input
                      type="month"
                      label="Tháng"
                      value={filterMonth}
                      onChange={(event) => setFilterMonth(event.target.value)}
                    />
                  ) : null}

                  {filterMode === "quarter" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-sm font-medium leading-none text-slate-700">
                          Quý
                        </label>
                        <select
                          value={filterQuarter}
                          onChange={(event) => setFilterQuarter(event.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="1">Quý 1</option>
                          <option value="2">Quý 2</option>
                          <option value="3">Quý 3</option>
                          <option value="4">Quý 4</option>
                        </select>
                      </div>
                      <Input
                        type="number"
                        label="Năm"
                        value={filterQuarterYear}
                        onChange={(event) => setFilterQuarterYear(event.target.value)}
                        min="2000"
                        step="1"
                      />
                    </div>
                  ) : null}

                  {filterMode === "year" ? (
                    <Input
                      type="number"
                      label="Năm"
                      value={filterYear}
                      onChange={(event) => setFilterYear(event.target.value)}
                      min="2000"
                      step="1"
                    />
                  ) : null}
                </div>
                <div className="flex items-end">
                  <div className="flex w-full justify-end">
                    <Button
                      variant="ghost"
                      className="h-10 w-10 rounded-full p-0"
                      onClick={() => void resetFilters()}
                      title="Xóa lọc"
                      aria-label="Xóa lọc"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Tất cả hóa đơn
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{overallSummary.count}</p>
                <p className="mt-2 text-sm text-slate-500">Theo toàn bộ hóa đơn đã nhập</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Tổng toàn bộ
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-700">
                  {formatCurrency(overallSummary.totalAmount)} VND
                </p>
                <p className="mt-2 text-sm text-slate-500">Không phụ thuộc bộ lọc hiện tại</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Theo bộ lọc
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{filteredSummary.count}</p>
                <p className="mt-2 text-sm text-slate-500">
                  Đang xem {pagination.from}-{pagination.to} trên trang này
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Tổng theo bộ lọc
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-700">
                  {formatCurrency(filteredSummary.totalAmount)} VND
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Trang này: {formatCurrency(currentPageTotalAmount)} VND • {currentPageTotalEvidence} minh chứng
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>
                Danh sách hóa đơn {scopeLabel.toLowerCase()} ({filteredSummary.count})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-slate-500">
                  Hiển thị {pagination.from}-{pagination.to} / {filteredSummary.count} hóa đơn theo bộ lọc
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-500">Mỗi trang</span>
                  <select
                    value={pageSize}
                    onChange={(event) => void handlePageSizeChange(Number(event.target.value))}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700"
                    disabled={loading}
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-center font-medium">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả hóa đơn"
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          checked={isAllEntriesSelected}
                          onChange={toggleSelectAllEntries}
                          disabled={loading || entries.length === 0 || importing}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-medium">Ngày</th>
                      <th className="px-4 py-3 text-left font-medium">Số HĐ / Mã</th>
                      <th className="px-4 py-3 text-left font-medium">Đơn vị</th>
                      <th className="px-4 py-3 text-left font-medium">Chi tiết</th>
                      <th className="px-4 py-3 text-left font-medium">Minh chứng</th>
                      <th className="px-4 py-3 text-right font-medium">Tổng</th>
                      <th className="px-4 py-3 text-center font-medium">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : entries.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          Chưa có hóa đơn trong khoảng lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className={`align-top hover:bg-slate-50 ${
                            selectedEntryIds.includes(entry.id) ? "bg-emerald-50/60" : ""
                          }`}
                        >
                          <td className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              aria-label={`Chọn hóa đơn ${entry.invoiceNumber || entry.id}`}
                              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              checked={selectedEntryIds.includes(entry.id)}
                              onChange={() => toggleEntrySelection(entry.id)}
                              disabled={importing}
                            />
                          </td>
                          <td className="px-4 py-4 text-slate-700">{entry.invoiceDate}</td>
                          <td className="px-4 py-4">
                            <p className="font-semibold text-slate-900">
                              {entry.invoiceNumber || "Chưa nhập số hóa đơn"}
                            </p>
                            <p className="font-mono text-xs text-slate-500">{entry.id}</p>
                          </td>
                          <td className="px-4 py-4 text-slate-700">
                            <p>{entry.partnerName || "Chưa khai báo"}</p>
                            {entry.note ? (
                              <p className="mt-1 text-xs text-slate-500">{entry.note}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-4">
                            <div className="space-y-2">
                              {entry.items.map((item) => (
                                <div
                                  key={item.id || `${entry.id}-${item.name}`}
                                  className="rounded-lg bg-slate-50 px-3 py-2"
                                >
                                  <p className="font-medium text-slate-900">{item.name}</p>
                                  <p className="text-xs text-slate-500">
                                    {item.quantity} {item.unit || ""} x{" "}
                                    {formatCurrency(item.unitPrice)} ={" "}
                                    {formatCurrency(item.lineTotal)} VND
                                  </p>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {entry.evidences.length === 0 ? (
                              <span className="text-slate-400">Chưa có</span>
                            ) : (
                              <div className="space-y-2">
                                {entry.evidences.map((evidence) => (
                                  <a
                                    key={evidence.id}
                                    href={evidence.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 text-sm text-sky-700 hover:text-sky-900"
                                  >
                                    <FileImage className="h-4 w-4" />
                                    <span>{evidence.originalName}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right font-semibold text-emerald-700">
                            {formatCurrency(entry.totalAmount)} VND
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => openEditModal(entry)}
                                disabled={importing}
                              >
                                <Pencil className="h-4 w-4" />
                                Sửa
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                isLoading={deletingId === entry.id}
                                onClick={() => handleDelete(entry)}
                                disabled={importing}
                              >
                                <Trash2 className="h-4 w-4" />
                                Xóa
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-slate-500">
                  Trang {pagination.page}/{pagination.lastPage} • Tổng {filteredSummary.count} hóa đơn sau lọc
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handlePageChange(1)}
                    disabled={loading || pagination.page <= 1}
                  >
                    Đầu
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handlePageChange(pagination.page - 1)}
                    disabled={loading || pagination.page <= 1}
                  >
                    Trước
                  </Button>
                  {buildVisiblePages(pagination.page, pagination.lastPage).map((pageItem) =>
                    typeof pageItem === "number" ? (
                      <Button
                        key={pageItem}
                        variant={pageItem === pagination.page ? "default" : "outline"}
                        size="sm"
                        onClick={() => void handlePageChange(pageItem)}
                        disabled={loading}
                        className="min-w-10"
                      >
                        {pageItem}
                      </Button>
                    ) : (
                      <span key={pageItem} className="px-1 text-sm text-slate-400">
                        ...
                      </span>
                    )
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handlePageChange(pagination.page + 1)}
                    disabled={loading || pagination.page >= pagination.lastPage}
                  >
                    Sau
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handlePageChange(pagination.lastPage)}
                    disabled={loading || pagination.page >= pagination.lastPage}
                  >
                    Cuối
                  </Button>
                  <input
                    type="number"
                    min={1}
                    max={pagination.lastPage}
                    value={pageJump}
                    onChange={(event) => setPageJump(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleJumpPage();
                      }
                    }}
                    className="h-9 w-20 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-500"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleJumpPage()}
                    disabled={loading}
                  >
                    Đến trang
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <p className="text-sm text-slate-500">
                  {editingEntry ? "Cập nhật hóa đơn" : "Nhập hóa đơn mới"}
                </p>
                <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
              </div>
              <Button variant="ghost" onClick={closeModal}>
                Đóng
              </Button>
            </div>

            <div className="max-h-[calc(90vh-144px)] overflow-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="space-y-1">
                  <label className="text-sm font-medium leading-none text-slate-700">
                    Store
                  </label>
                  <select
                    value={invoiceStoreId}
                    onChange={(event) => setInvoiceStoreId(event.target.value as StoreType)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {STORE_FILTER_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  type="date"
                  label="Ngày hóa đơn *"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                />
                <Input
                  label="Số hóa đơn"
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                  placeholder="Ví dụ: 000123"
                />
                <Input
                  label="Đơn vị / người bán"
                  value={partnerName}
                  onChange={(event) => setPartnerName(event.target.value)}
                  placeholder="Ví dụ: Nhà cung cấp A"
                />
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Tổng hóa đơn
                  </p>
                  <p className="mt-2 text-xl font-bold text-emerald-700">
                    {formatCurrency(formTotal)} VND
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Ghi chú
                </label>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Ghi chú thêm về hóa đơn, nội dung chi, mục đích..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">Dòng hàng</h4>
                    <p className="text-sm text-slate-500">
                      Nhập tên, số lượng, đơn vị và đơn giá cho từng mục.
                    </p>
                  </div>
                  <Button variant="outline" className="gap-2" onClick={addItem}>
                    <FilePlus2 className="h-4 w-4" />
                    Thêm dòng
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-3 text-left font-medium">Tên mục *</th>
                        <th className="px-3 py-3 text-right font-medium">Số lượng *</th>
                        <th className="px-3 py-3 text-left font-medium">Đơn vị</th>
                        <th className="px-3 py-3 text-right font-medium">Đơn giá *</th>
                        <th className="px-3 py-3 text-right font-medium">Thành tiền</th>
                        <th className="px-3 py-3 text-center font-medium">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item) => {
                        const quantity = parseDecimal(item.quantity);
                        const unitPrice = parseDecimal(item.unitPrice);
                        const lineTotal = quantity * unitPrice;

                        return (
                          <tr key={item.localId}>
                            <td className="px-3 py-3">
                              <Input
                                value={item.name}
                                onChange={(event) =>
                                  updateItem(item.localId, "name", event.target.value)
                                }
                                placeholder="Ví dụ: Vật tư, thầy thợ..."
                              />
                            </td>
                            <td className="px-3 py-3">
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(event) =>
                                  updateItem(item.localId, "quantity", event.target.value)
                                }
                                min="0"
                                step="0.001"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <Input
                                value={item.unit}
                                onChange={(event) =>
                                  updateItem(item.localId, "unit", event.target.value)
                                }
                                placeholder="kg, công, bộ..."
                              />
                            </td>
                            <td className="px-3 py-3">
                              <Input
                                type="number"
                                value={item.unitPrice}
                                onChange={(event) =>
                                  updateItem(item.localId, "unitPrice", event.target.value)
                                }
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="px-3 py-3 text-right font-semibold text-slate-900">
                              {lineTotal > 0 ? `${formatCurrency(lineTotal)} VND` : "-"}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                onClick={() => removeItem(item.localId)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <h4 className="text-base font-semibold text-slate-900">Minh chứng mới</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Có thể chọn nhiều ảnh hoặc PDF cho cùng một hóa đơn.
                  </p>
                  <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600 hover:border-sky-300 hover:bg-sky-50">
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(event) =>
                        setNewEvidenceFiles(Array.from(event.target.files || []))
                      }
                    />
                    Chọn minh chứng
                  </label>

                  {newEvidenceFiles.length > 0 ? (
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      {newEvidenceFiles.map((file) => (
                        <div
                          key={`${file.name}-${file.size}`}
                          className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                        >
                          <span className="truncate">{file.name}</span>
                          <span className="text-xs text-slate-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <h4 className="text-base font-semibold text-slate-900">Minh chứng đang giữ</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Bỏ chọn file nào thì khi lưu sẽ xóa khỏi hóa đơn.
                  </p>
                  <div className="mt-4 space-y-2">
                    {editingEntry?.evidences?.length ? (
                      editingEntry.evidences.map((evidence) => (
                        <label
                          key={evidence.id}
                          className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={keptEvidenceIds.includes(evidence.id)}
                            onChange={(event) =>
                              setKeptEvidenceIds((current) =>
                                event.target.checked
                                  ? [...current, evidence.id]
                                  : current.filter((id) => id !== evidence.id)
                              )
                            }
                          />
                          <a
                            href={evidence.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-sky-700 hover:text-sky-900"
                          >
                            {evidence.originalName}
                          </a>
                        </label>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400">Chưa có minh chứng cũ.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
              <Button variant="outline" onClick={closeModal}>
                Hủy
              </Button>
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSubmit}
                isLoading={saving}
              >
                <ReceiptText className="h-4 w-4" />
                {editingEntry ? "Lưu thay đổi" : "Lưu hóa đơn"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
