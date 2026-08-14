"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  deleteInventoryCheck,
  getInventoryChecks,
  InventoryCheck,
  saveInventoryCheck,
} from "@/services/inventoryCheckService";
import { Product } from "@/services/products";
import { getIngredients } from "@/services/ingredients";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";

type CheckLineDraft = {
  localId: string;
  productCode: string;
  productName: string;
  systemQuantity: number;
  unitCost: number;
  actualQuantity: string;
  note: string;
};

type CheckFormState = {
  id?: string;
  checkCode?: string;
  checkDate: string;
  note: string;
  items: CheckLineDraft[];
};

type ItemFilter = "all" | "matched" | "variance" | "unchecked";

const formatCurrency = (value: number | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 });

const formatQuantity = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 3 });

const parseNumberInput = (value: string) => {
  const normalized = value.replace(/,/g, ".").replace(/[^\d.-]/g, "");
  if (!normalized) return 0;
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

const createEmptyForm = (): CheckFormState => ({
  checkDate: todayValue(),
  note: "",
  items: [],
});

const statusLabel: Record<InventoryCheck["status"], string> = {
  draft: "Phiếu tạm",
  completed: "Đã cân bằng kho",
  cancelled: "Đã hủy",
};

const statusClassName: Record<InventoryCheck["status"], string> = {
  draft: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-600",
};

export default function InventoryChecksPage() {
  const { storeId } = useStore();
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [checks, setChecks] = useState<InventoryCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ItemFilter>("all");
  const [form, setForm] = useState<CheckFormState>(createEmptyForm());

  async function loadPageData() {
    const [ingredientResult, checkItems] = await Promise.all([
      getIngredients(storeId),
      getInventoryChecks({ storeId, limit: 40 }),
    ]);

    setProducts(ingredientResult.items.map((item) => ({
      product_code: item.ingredientCode, product_name: item.ingredientName,
      cost: item.cost, price: null, has_cost: item.cost !== null,
      stockQuantity: item.stockQuantity, unit: item.unit, storeId: item.storeId,
    })));
    setChecks(checkItems);
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
        const isCounted = item.actualQuantity.trim() !== "";
        const actualQuantity = isCounted ? parseNumberInput(item.actualQuantity) : null;
        const varianceQuantity =
          actualQuantity === null ? null : actualQuantity - Number(item.systemQuantity || 0);
        const varianceValue =
          varianceQuantity === null ? null : varianceQuantity * Number(item.unitCost || 0);

        return {
          ...item,
          isCounted,
          actualQuantityNumber: actualQuantity,
          varianceQuantity,
          varianceValue,
        };
      }),
    [form.items]
  );

  const summary = useMemo(() => {
    return lineItems.reduce(
      (acc, item) => {
        if (!item.isCounted || item.actualQuantityNumber === null || item.varianceQuantity === null) {
          return acc;
        }

        acc.countedItemCount += 1;
        acc.totalActualQuantity += item.actualQuantityNumber;
        acc.totalVarianceQuantity += item.varianceQuantity;
        acc.varianceValueTotal += item.varianceValue || 0;
        acc.increaseQuantityTotal += item.varianceQuantity > 0 ? item.varianceQuantity : 0;
        acc.decreaseQuantityTotal += item.varianceQuantity < 0 ? Math.abs(item.varianceQuantity) : 0;
        return acc;
      },
      {
        countedItemCount: 0,
        totalActualQuantity: 0,
        totalVarianceQuantity: 0,
        varianceValueTotal: 0,
        increaseQuantityTotal: 0,
        decreaseQuantityTotal: 0,
      }
    );
  }, [lineItems]);

  const filterCounts = useMemo(
    () => ({
      all: lineItems.length,
      matched: lineItems.filter(
        (item) => item.isCounted && Math.abs(item.varianceQuantity || 0) < 0.0005
      ).length,
      variance: lineItems.filter(
        (item) => item.isCounted && Math.abs(item.varianceQuantity || 0) >= 0.0005
      ).length,
      unchecked: lineItems.filter((item) => !item.isCounted).length,
    }),
    [lineItems]
  );

  const filteredItems = useMemo(() => {
    if (activeFilter === "matched") {
      return lineItems.filter(
        (item) => item.isCounted && Math.abs(item.varianceQuantity || 0) < 0.0005
      );
    }

    if (activeFilter === "variance") {
      return lineItems.filter(
        (item) => item.isCounted && Math.abs(item.varianceQuantity || 0) >= 0.0005
      );
    }

    if (activeFilter === "unchecked") {
      return lineItems.filter((item) => !item.isCounted);
    }

    return lineItems;
  }, [activeFilter, lineItems]);

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

  const recentProductChecks = useMemo(() => {
    const seen = new Set<string>();
    const rows: Array<{
      productCode: string;
      productName: string;
      varianceQuantity: number | null;
      checkedAt: string;
    }> = [];

    for (const check of checks) {
      for (const item of check.items || []) {
        if (!item.isCounted || seen.has(item.productCode)) continue;
        seen.add(item.productCode);
        rows.push({
          productCode: item.productCode,
          productName: item.productName,
          varianceQuantity: item.varianceQuantity,
          checkedAt: check.checkDate,
        });
        if (rows.length >= 8) {
          return rows;
        }
      }
    }

    return rows;
  }, [checks]);

  const historyItems = useMemo(() => {
    const keyword = historySearch.trim().toLowerCase();
    if (!keyword) return checks;

    return checks.filter((check) => {
      const inHeader =
        check.checkCode.toLowerCase().includes(keyword) || check.note.toLowerCase().includes(keyword);
      if (inHeader) return true;

      return (check.items || []).some(
        (item) =>
          item.productCode.toLowerCase().includes(keyword) ||
          item.productName.toLowerCase().includes(keyword)
      );
    });
  }, [checks, historySearch]);

  const resetForm = () => {
    setForm(createEmptyForm());
    setSearchTerm("");
    setActiveFilter("all");
  };

  const loadDraftIntoForm = (check: InventoryCheck) => {
    setForm({
      id: check.id,
      checkCode: check.checkCode,
      checkDate: check.checkDate,
      note: check.note || "",
      items: (check.items || []).map((item) => ({
        localId: createLocalId(),
        productCode: item.productCode,
        productName: item.productName,
        systemQuantity: item.systemQuantity,
        unitCost: item.unitCost,
        actualQuantity:
          item.actualQuantity === null || item.actualQuantity === undefined
            ? ""
            : String(item.actualQuantity),
        note: item.note || "",
      })),
    });
    setActiveFilter("all");
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
          systemQuantity: product.stockQuantity ?? 0,
          unitCost: product.cost ?? 0,
          actualQuantity: "",
          note: "",
        },
      ],
    }));
    setSearchTerm("");
  };

  const updateItem = (localId: string, patch: Partial<CheckLineDraft>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    }));
  };

  const removeItem = (localId: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.filter((item) => item.localId !== localId),
    }));
  };

  async function handleSave(status: "draft" | "completed") {
    if (form.items.length === 0) {
      alert("Vui lòng thêm ít nhất 1 nguyên liệu cần kiểm.");
      return;
    }

    setSaving(true);

    try {
      const saved = await saveInventoryCheck({
        id: form.id,
        storeId,
        checkDate: form.checkDate,
        status,
        note: form.note,
        items: form.items.map((item) => ({
          productCode: item.productCode,
          actualQuantity: item.actualQuantity.trim() === "" ? null : parseNumberInput(item.actualQuantity),
          note: item.note,
        })),
      });

      await loadPageData();

      if (status === "draft") {
        loadDraftIntoForm(saved);
        alert("Đã lưu tạm phiếu kiểm kho.");
      } else {
        resetForm();
        alert("Đã hoàn thành phiếu kiểm kho và cập nhật lại tồn kho trên máy.");
      }
    } catch (error) {
      console.error(error);
      alert("Không thể lưu phiếu kiểm kho.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDraft(id: string) {
    if (!window.confirm("Bạn chắc chắn muốn xóa phiếu kiểm tạm này?")) {
      return;
    }

    try {
      await deleteInventoryCheck(id);
      if (form.id === id) {
        resetForm();
      }
      await loadPageData();
    } catch (error) {
      console.error(error);
      alert("Không thể xóa phiếu kiểm kho.");
    }
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <main className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/product/ingredients"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Trở về nguyên liệu"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Kiểm kho</h1>
              <p className="mt-1 text-sm text-slate-500">
                So sánh tồn trên máy với số thực tế và cân bằng lại kho sau khi chốt phiếu.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-2xl border-slate-200 px-4"
              onClick={resetForm}
            >
              <Plus className="mr-2 h-4 w-4" />
              Phiếu mới
            </Button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Card className="rounded-[28px] border-slate-200 shadow-sm">
              <CardContent className="space-y-5 p-5">
                <div ref={pickerRef} className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Tìm theo mã hoặc tên nguyên liệu"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />

                  {suggestions.length > 0 ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                      {suggestions.map((product) => (
                        <button
                          key={product.product_code}
                          type="button"
                          onClick={() => addItem(product)}
                          className="flex w-full items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {product.product_name}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">{product.product_code}</div>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <div>Tồn: {formatQuantity(product.stockQuantity)}</div>
                            <div>Giá vốn: {formatCurrency(product.cost)}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-3">
                  {[
                    { key: "all", label: "Tất cả", count: filterCounts.all },
                    { key: "matched", label: "Khớp", count: filterCounts.matched },
                    { key: "variance", label: "Lệch", count: filterCounts.variance },
                    { key: "unchecked", label: "Chưa kiểm", count: filterCounts.unchecked },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveFilter(tab.key as ItemFilter)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        activeFilter === tab.key
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-3xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-sky-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">STT</th>
                        <th className="px-4 py-3 text-left font-semibold">Mã nguyên liệu</th>
                        <th className="px-4 py-3 text-left font-semibold">Tên hàng</th>
                        <th className="px-4 py-3 text-right font-semibold">Tồn kho</th>
                        <th className="px-4 py-3 text-right font-semibold">Thực tế</th>
                        <th className="px-4 py-3 text-right font-semibold">SL lệch</th>
                        <th className="px-4 py-3 text-right font-semibold">Giá trị lệch</th>
                        <th className="px-4 py-3 text-right font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                            {form.items.length === 0
                              ? "Chưa có nguyên liệu nào trong phiếu kiểm."
                              : "Không có dòng nào phù hợp bộ lọc hiện tại."}
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item, index) => (
                          <tr key={item.localId}>
                            <td className="px-4 py-3 text-slate-600">{index + 1}</td>
                            <td className="px-4 py-3 font-medium text-slate-700">{item.productCode}</td>
                            <td className="px-4 py-3 text-slate-900">{item.productName}</td>
                            <td className="px-4 py-3 text-right text-slate-600">
                              {formatQuantity(item.systemQuantity)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                value={item.actualQuantity}
                                onChange={(event) =>
                                  updateItem(item.localId, { actualQuantity: event.target.value })
                                }
                                placeholder="Chưa kiểm"
                                className="h-10 w-28 rounded-2xl border border-slate-200 px-3 text-right outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                              />
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-medium ${
                                item.varianceQuantity === null
                                  ? "text-slate-400"
                                  : item.varianceQuantity > 0
                                    ? "text-emerald-600"
                                    : item.varianceQuantity < 0
                                      ? "text-rose-600"
                                      : "text-slate-700"
                              }`}
                            >
                              {item.varianceQuantity === null
                                ? "Chưa kiểm"
                                : formatQuantity(item.varianceQuantity)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-medium ${
                                item.varianceValue === null
                                  ? "text-slate-400"
                                  : item.varianceValue > 0
                                    ? "text-emerald-600"
                                    : item.varianceValue < 0
                                      ? "text-rose-600"
                                      : "text-slate-700"
                              }`}
                            >
                              {item.varianceValue === null
                                ? "Chưa kiểm"
                                : formatCurrency(item.varianceValue)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeItem(item.localId)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-rose-600"
                                title="Xóa dòng"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-slate-500" />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Lịch sử phiếu kiểm kho</h2>
                    <p className="text-sm text-slate-500">
                      Phiếu hoàn thành sẽ đóng vai trò cân bằng kho và giữ lại lịch sử chênh lệch.
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={historySearch}
                    onChange={(event) => setHistorySearch(event.target.value)}
                    placeholder="Tìm mã phiếu, mã hàng hoặc tên hàng"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                <div className="overflow-x-auto rounded-3xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-sky-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Mã kiểm kho</th>
                        <th className="px-4 py-3 text-left font-semibold">Ngày cân bằng</th>
                        <th className="px-4 py-3 text-right font-semibold">Tổng lệch</th>
                        <th className="px-4 py-3 text-right font-semibold">SL lệch tăng</th>
                        <th className="px-4 py-3 text-right font-semibold">SL lệch giảm</th>
                        <th className="px-4 py-3 text-left font-semibold">Trạng thái</th>
                        <th className="px-4 py-3 text-right font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                            Đang tải lịch sử kiểm kho...
                          </td>
                        </tr>
                      ) : historyItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                            Chưa có phiếu kiểm kho nào.
                          </td>
                        </tr>
                      ) : (
                        historyItems.map((check) => (
                          <tr key={check.id}>
                            <td className="px-4 py-3 font-medium text-slate-900">{check.checkCode}</td>
                            <td className="px-4 py-3 text-slate-600">{check.checkDate}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700">
                              {formatQuantity(check.totalVarianceQuantity)}
                            </td>
                            <td className="px-4 py-3 text-right text-emerald-600">
                              {formatQuantity(check.increaseQuantityTotal)}
                            </td>
                            <td className="px-4 py-3 text-right text-rose-600">
                              {formatQuantity(check.decreaseQuantityTotal)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClassName[check.status]}`}
                              >
                                {statusLabel[check.status]}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                {check.status === "draft" ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-9 rounded-2xl border-slate-200 px-3 text-xs"
                                      onClick={() => loadDraftIntoForm(check)}
                                    >
                                      Mở phiếu
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-9 rounded-2xl border-rose-200 px-3 text-xs text-rose-600 hover:bg-rose-50"
                                      onClick={() => handleDeleteDraft(check.id)}
                                    >
                                      Xóa
                                    </Button>
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-400">Đã cân bằng</span>
                                )}
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

          <div className="space-y-6">
            <Card className="rounded-[28px] border-slate-200 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-slate-500">Mã kiểm kho</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900">
                      {form.checkCode || "Mã phiếu tự động"}
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    {form.id ? "Đang chỉnh phiếu tạm" : "Phiếu mới"}
                  </span>
                </div>

                <div className="grid gap-4">
                  <label className="grid gap-2 text-sm text-slate-600">
                    Ngày kiểm kho
                    <input
                      type="date"
                      value={form.checkDate}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, checkDate: event.target.value }))
                      }
                      className="h-11 rounded-2xl border border-slate-200 px-4 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>

                  <label className="grid gap-2 text-sm text-slate-600">
                    Ghi chú
                    <textarea
                      value={form.note}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, note: event.target.value }))
                      }
                      rows={3}
                      placeholder="Ví dụ: kiểm cuối ngày, kiểm lại nhóm thịt, phát sinh hao hụt..."
                      className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                    />
                  </label>
                </div>

                <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Đã kiểm</span>
                    <span className="font-semibold text-slate-900">
                      {summary.countedItemCount}/{form.items.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Tổng SL thực tế</span>
                    <span className="font-semibold text-slate-900">
                      {formatQuantity(summary.totalActualQuantity)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">SL lệch tăng</span>
                    <span className="font-semibold text-emerald-600">
                      {formatQuantity(summary.increaseQuantityTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">SL lệch giảm</span>
                    <span className="font-semibold text-rose-600">
                      {formatQuantity(summary.decreaseQuantityTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Giá trị lệch</span>
                    <span
                      className={`font-semibold ${
                        summary.varianceValueTotal > 0
                          ? "text-emerald-600"
                          : summary.varianceValueTotal < 0
                            ? "text-rose-600"
                            : "text-slate-900"
                      }`}
                    >
                      {formatCurrency(summary.varianceValueTotal)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    type="button"
                    className="h-12 w-full rounded-2xl bg-blue-600 hover:bg-blue-700"
                    onClick={() => handleSave("draft")}
                    disabled={saving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Lưu tạm
                  </Button>
                  <Button
                    type="button"
                    className="h-12 w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleSave("completed")}
                    disabled={saving}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Hoàn thành
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <h2 className="text-lg font-semibold text-slate-900">Nguyên tắc kiểm kho</h2>
                <div className="space-y-3 text-sm leading-6 text-slate-600">
                  <p>
                    Khi kiểm kho, hệ thống so sánh <strong>tồn trên máy</strong> với{" "}
                    <strong>số thực tế trong kho</strong>. Chênh lệch được tính theo công thức:
                    <strong> số thực tế - số trên máy</strong>.
                  </p>
                  <p>
                    Nếu chênh lệch dương, kho thực tế đang nhiều hơn hệ thống. Nếu chênh lệch âm,
                    hệ thống đang ghi nhận nhiều hơn kho thực. Giá trị lệch được tính bằng:
                    <strong> chênh lệch x giá vốn hiện tại</strong>.
                  </p>
                  <p>
                    Sau khi bấm <strong>Hoàn thành</strong>, hệ thống sẽ cập nhật lại tồn kho của từng
                    nguyên liệu bằng đúng số thực tế bạn đã kiểm. Giá vốn không bị đổi ở bước này,
                    chỉ cân bằng lại số lượng.
                  </p>
                  <p>
                    Thực tế vận hành nên kiểm theo mốc giờ rõ ràng, hạn chế nhập hàng hoặc bán hàng
                    trong lúc kiểm, và ưu tiên kiểm các nguyên liệu chính hoặc nhóm đang lệch nhiều.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 shadow-sm">
              <CardContent className="space-y-3 p-5">
                <h2 className="text-lg font-semibold text-slate-900">Kiểm gần đây</h2>
                {recentProductChecks.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có lịch sử kiểm gần đây.</p>
                ) : (
                  <div className="space-y-2">
                    {recentProductChecks.map((item) => (
                      <div
                        key={`${item.productCode}-${item.checkedAt}`}
                        className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      >
                        <div className="font-medium text-slate-900">{item.productName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.productCode} • {item.checkedAt}
                        </div>
                        <div
                          className={`mt-2 text-xs font-semibold ${
                            (item.varianceQuantity || 0) > 0
                              ? "text-emerald-600"
                              : (item.varianceQuantity || 0) < 0
                                ? "text-rose-600"
                                : "text-slate-600"
                          }`}
                        >
                          Lệch: {item.varianceQuantity === null ? "Chưa kiểm" : formatQuantity(item.varianceQuantity)}
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
