"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  createInvoiceEntry,
  deleteInvoiceEntry,
  getInvoiceEntries,
  InvoiceEntry,
  InvoiceScope,
  updateInvoiceEntry,
} from "@/services/invoiceEntryService";
import { parseInvoiceImportWorkbook } from "@/services/excel";
import { useStore } from "@/context/StoreContext";
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

const todayValue = () => new Date().toISOString().split("T")[0];

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

export default function InvoiceAdminPage({
  scope,
  title,
  description,
  accentClassName,
}: InvoiceAdminPageProps) {
  const { storeId, storeName } = useStore();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [entries, setEntries] = useState<InvoiceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<InvoiceEntry | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(todayValue());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<EditableItem[]>([createEmptyItem()]);
  const [keptEvidenceIds, setKeptEvidenceIds] = useState<number[]>([]);
  const [newEvidenceFiles, setNewEvidenceFiles] = useState<File[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const scopeLabel = scope === "internal" ? "Nội bộ" : "Thuế";

  const loadEntries = async () => {
    setLoading(true);
    try {
      const data = await getInvoiceEntries({
        scope,
        storeId,
        search,
        startDate,
        endDate,
        limit: 300,
      });
      setEntries(data);
    } catch (error) {
      console.error(error);
      alert("Không thể tải danh sách hóa đơn.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, storeId, startDate, endDate]);

  const totalAmount = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.totalAmount, 0),
    [entries]
  );

  const totalEvidence = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.evidences.length, 0),
    [entries]
  );

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
        storeId,
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

  const handleExport = () => {
    if (entries.length === 0) {
      alert("Chưa có dữ liệu để xuất.");
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(buildExportRows(entries, scopeLabel));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "HoaDon");
    XLSX.writeFile(
      workbook,
      `hoa-don-${scope}-${storeId}-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
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
            <Button variant="outline" className="gap-2" onClick={loadEntries} disabled={importing}>
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
            <Button variant="outline" className="gap-2" onClick={handleExport} disabled={importing}>
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

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Bộ lọc</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_220px_220px_180px]">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Tìm kiếm
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void loadEntries();
                        }
                      }}
                      className="pl-9"
                      placeholder="Số HĐ, đơn vị, ghi chú"
                    />
                  </div>
                </div>
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
                <div className="flex items-end">
                  <Button variant="outline" className="w-full" onClick={loadEntries}>
                    Áp dụng lọc
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Số hóa đơn
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{entries.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Tổng giá trị
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-700">
                  {formatCurrency(totalAmount)} VND
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Minh chứng đã tải
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{totalEvidence}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>
                Danh sách hóa đơn {scopeLabel.toLowerCase()} ({entries.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
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
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : entries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          Chưa có hóa đơn trong khoảng lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      entries.map((entry) => (
                        <tr key={entry.id} className="align-top hover:bg-slate-50">
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
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
