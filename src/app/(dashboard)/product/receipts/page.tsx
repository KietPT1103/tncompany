"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  deleteInventoryReceipt,
  getInventoryReceipts,
  InventoryReceipt,
  saveInventoryReceipt,
} from "@/services/inventoryReceiptService";
import { getAllProducts, Product } from "@/services/products.firebase";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  PackagePlus,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";

type ReceiptLineDraft = {
  localId: string;
  productCode: string;
  productName: string;
  quantity: string;
  unitCost: string;
  note: string;
};

type ReceiptFormState = {
  id?: string;
  receiptCode?: string;
  receiptDate: string;
  note: string;
  items: ReceiptLineDraft[];
};

const formatCurrency = (value: number | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 });

const formatQuantity = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 3 });

const parseNumberInput = (value: string) => {
  const normalized = value.replace(/,/g, ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const createLocalId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const todayValue = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const createEmptyForm = (): ReceiptFormState => ({
  receiptDate: todayValue(),
  note: "",
  items: [],
});

export default function InventoryReceiptsPage() {
  const { storeId } = useStore();
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [receipts, setReceipts] = useState<InventoryReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState<ReceiptFormState>(createEmptyForm());

  async function loadPageData() {
    const [productItems, receiptItems] = await Promise.all([
      getAllProducts(storeId),
      getInventoryReceipts({ storeId, limit: 40 }),
    ]);

    setProducts(productItems);
    setReceipts(receiptItems);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        await loadPageData();
      } finally {
        setLoading(false);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (
        pickerRef.current &&
        target instanceof Node &&
        !pickerRef.current.contains(target)
      ) {
        setSearchTerm("");
      }
    };

    window.addEventListener("mousedown", handleMouseDown);
    return () => window.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const lineItems = useMemo(
    () =>
      form.items.map((item) => {
        const quantity = parseNumberInput(item.quantity);
        const unitCost = parseNumberInput(item.unitCost);

        return {
          ...item,
          quantityNumber: quantity,
          unitCostNumber: unitCost,
          lineTotal: quantity * unitCost,
        };
      }),
    [form.items]
  );

  const summary = useMemo(() => {
    return lineItems.reduce(
      (acc, item) => {
        acc.totalQuantity += item.quantityNumber;
        acc.totalAmount += item.lineTotal;
        return acc;
      },
      { totalQuantity: 0, totalAmount: 0 }
    );
  }, [lineItems]);

  const selectedCodes = new Set(form.items.map((item) => item.productCode));
  const suggestions = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return [];

    return products
      .filter((product) => {
        if (selectedCodes.has(product.product_code)) return false;
        return (
          product.product_code.toLowerCase().includes(keyword) ||
          product.product_name.toLowerCase().includes(keyword)
        );
      })
      .slice(0, 8);
  }, [products, searchTerm, selectedCodes]);

  const draftReceipts = receipts.filter((receipt) => receipt.status === "draft");
  const completedReceipts = receipts.filter((receipt) => receipt.status === "completed");

  const resetForm = () => {
    setForm(createEmptyForm());
    setSearchTerm("");
  };

  const addItem = (product: Product) => {
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          localId: createLocalId(),
          productCode: product.product_code,
          productName: product.product_name,
          quantity: "1",
          unitCost: product.cost ? String(product.cost) : "",
          note: "",
        },
      ],
    }));
    setSearchTerm("");
  };

  const loadDraftIntoForm = (receipt: InventoryReceipt) => {
    setForm({
      id: receipt.id,
      receiptCode: receipt.receiptCode,
      receiptDate: receipt.receiptDate,
      note: receipt.note || "",
      items: (receipt.items || []).map((item) => ({
        localId: createLocalId(),
        productCode: item.productCode,
        productName: item.productName,
        quantity: String(item.quantity),
        unitCost: String(item.unitCost),
        note: item.note || "",
      })),
    });
  };

  async function handleSave(status: "draft" | "completed") {
    if (form.items.length === 0) {
      alert("Vui lòng thêm ít nhất 1 hàng hoá.");
      return;
    }

    setSaving(true);

    try {
      const saved = await saveInventoryReceipt({
        id: form.id,
        storeId,
        receiptDate: form.receiptDate,
        status,
        note: form.note,
        items: form.items.map((item) => ({
          productCode: item.productCode,
          quantity: parseNumberInput(item.quantity),
          unitCost: parseNumberInput(item.unitCost),
          note: item.note,
        })),
      });

      await loadPageData();

      if (status === "draft") {
        loadDraftIntoForm(saved);
        alert("Đã lưu tạm phiếu nhập.");
      } else {
        resetForm();
        alert("Đã hoàn thành phiếu nhập và cập nhật tồn kho.");
      }
    } catch (error) {
      console.error(error);
      alert("Không thể lưu phiếu nhập.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDraft(id: string) {
    if (!window.confirm("Bạn chắc chắn muốn xoá phiếu tạm này?")) {
      return;
    }

    try {
      await deleteInventoryReceipt(id);
      await loadPageData();
      if (form.id === id) {
        resetForm();
      }
    } catch (error) {
      console.error(error);
      alert("Không thể xoá phiếu tạm.");
    }
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <main className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/product"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Trở về hàng hoá"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Nhập hàng</h1>
              <p className="mt-1 text-sm text-slate-500">
                Cộng tồn kho và cập nhật giá vốn bình quân theo từng lần nhập hàng.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            onClick={resetForm}
          >
            <Plus className="mr-2 h-4 w-4" />
            Phiếu mới
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card className="rounded-[28px] border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <div ref={pickerRef} className="relative max-w-xl">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Tìm hàng hoá để nhập"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />

                  {suggestions.length > 0 ? (
                    <div className="absolute left-0 top-[calc(100%+10px)] z-20 max-h-80 w-full overflow-y-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-xl">
                      {suggestions.map((product) => (
                        <button
                          key={product.product_code}
                          type="button"
                          onClick={() => addItem(product)}
                          className="flex w-full items-start gap-4 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
                        >
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                            <PackagePlus className="h-6 w-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900">
                              {product.product_name}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              {product.product_code}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              Tồn: {formatQuantity(product.stockQuantity)} | Giá vốn:{" "}
                              {formatCurrency(product.cost)}đ
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-[28px] border-slate-200 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-sky-50 text-slate-700">
                    <tr>
                      <th className="px-5 py-4 text-left font-semibold">STT</th>
                      <th className="px-5 py-4 text-left font-semibold">Mã hàng hoá</th>
                      <th className="px-5 py-4 text-left font-semibold">Tên hàng</th>
                      <th className="px-5 py-4 text-right font-semibold">Số lượng</th>
                      <th className="px-5 py-4 text-right font-semibold">Đơn giá</th>
                      <th className="px-5 py-4 text-right font-semibold">Thành tiền</th>
                      <th className="px-5 py-4 text-right font-semibold">Xoá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                          Chưa có mặt hàng nào trong phiếu nhập.
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((item, index) => (
                        <tr key={item.localId}>
                          <td className="px-5 py-4 text-slate-500">{index + 1}</td>
                          <td className="px-5 py-4 font-mono text-slate-700">
                            {item.productCode}
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-900">{item.productName}</div>
                            <input
                              value={item.note}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  items: current.items.map((line) =>
                                    line.localId === item.localId
                                      ? { ...line, note: event.target.value }
                                      : line
                                  ),
                                }))
                              }
                              placeholder="Ghi chú"
                              className="mt-2 h-9 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                            />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  items: current.items.map((line) =>
                                    line.localId === item.localId
                                      ? { ...line, quantity: event.target.value }
                                      : line
                                  ),
                                }))
                              }
                              className="ml-auto h-10 w-28 rounded-2xl border border-slate-300 px-3 text-right outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                            />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <input
                              type="number"
                              value={item.unitCost}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  items: current.items.map((line) =>
                                    line.localId === item.localId
                                      ? { ...line, unitCost: event.target.value }
                                      : line
                                  ),
                                }))
                              }
                              className="ml-auto h-10 w-32 rounded-2xl border border-slate-300 px-3 text-right outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                            />
                          </td>
                          <td className="px-5 py-4 text-right font-semibold text-slate-900">
                            {formatCurrency(item.lineTotal)}đ
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-2xl text-rose-600 hover:bg-rose-50"
                              onClick={() =>
                                setForm((current) => ({
                                  ...current,
                                  items: current.items.filter((line) => line.localId !== item.localId),
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-[28px] border-slate-200 shadow-sm">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Phiếu nhập
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {form.receiptCode || "Mã phiếu tự động"}
                    </div>
                  </div>
                  {form.id ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      Đang sửa phiếu tạm
                    </span>
                  ) : null}
                </div>

                <Input
                  label="Ngày nhập"
                  type="date"
                  value={form.receiptDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, receiptDate: event.target.value }))
                  }
                />

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-900">Ghi chú</label>
                  <textarea
                    value={form.note}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, note: event.target.value }))
                    }
                    rows={4}
                    placeholder="Ghi chú thêm cho phiếu nhập"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Số dòng hàng</span>
                    <span className="font-semibold text-slate-900">{lineItems.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Tổng số lượng</span>
                    <span className="font-semibold text-slate-900">
                      {formatQuantity(summary.totalQuantity)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-base">
                    <span className="font-semibold text-slate-700">Tổng tiền hàng</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(summary.totalAmount)}đ
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    className="h-12 rounded-2xl bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleSave("draft")}
                    isLoading={saving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Lưu tạm
                  </Button>
                  <Button
                    type="button"
                    className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleSave("completed")}
                    isLoading={saving}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Hoàn thành
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-slate-500" />
                  <h2 className="text-lg font-semibold text-slate-900">Phiếu tạm gần đây</h2>
                </div>

                {loading ? (
                  <p className="text-sm text-slate-400">Đang tải phiếu nhập...</p>
                ) : draftReceipts.length === 0 ? (
                  <p className="text-sm text-slate-400">Không có phiếu tạm nào.</p>
                ) : (
                  <div className="space-y-3">
                    {draftReceipts.map((receipt) => (
                      <div
                        key={receipt.id}
                        className="rounded-3xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">
                              {receipt.receiptCode}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              {receipt.receiptDate} • {receipt.items.length} dòng
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-slate-900">
                            {formatCurrency(receipt.totalAmount)}đ
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-2xl text-slate-500 hover:bg-slate-100"
                            onClick={() => loadDraftIntoForm(receipt)}
                            title="Sửa phiếu"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-2xl text-rose-600 hover:bg-rose-50"
                            onClick={() => handleDeleteDraft(receipt.id)}
                            title="Xoá phiếu"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <h2 className="text-lg font-semibold text-slate-900">Phiếu đã hoàn thành</h2>
                {loading ? (
                  <p className="text-sm text-slate-400">Đang tải lịch sử...</p>
                ) : completedReceipts.length === 0 ? (
                  <p className="text-sm text-slate-400">Chưa có phiếu hoàn thành.</p>
                ) : (
                  <div className="space-y-3">
                    {completedReceipts.slice(0, 8).map((receipt) => (
                      <div
                        key={receipt.id}
                        className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">
                              {receipt.receiptCode}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              {receipt.receiptDate} • {receipt.items.length} dòng
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-slate-900">
                              {formatCurrency(receipt.totalAmount)}đ
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {receipt.completedBy || "admin"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </RoleGuard>
  );
}
