"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  addProduct,
  deleteProduct,
  getAllProducts,
  normalizeProductCategoryReferences,
  Product,
  setProductSellingStatus,
  updateProductCost,
  upsertProductsFromExcel,
} from "@/services/products.firebase";
import {
  addCategory,
  Category,
  getCategories,
} from "@/services/categoryService";
import { useStore } from "@/context/StoreContext";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRouter } from "next/navigation";
import { getIngredients } from "@/services/ingredients";

import { SelectBox, type SelectBoxOption } from "@/components/ui/SelectBox";
import { Pagination } from "@/components/ui/Pagination";
import { paginateItems } from "@/lib/listPagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast, type ToastVariant } from "@/components/ui/Toast";

import {
  Check,
  ClipboardList,
  CircleAlert,
  FolderTree,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type ProductComponentDraft = {
  localId: string;
  productCode: string;
  productName: string;
  quantity: string;
};

type ProductFormState = {
  code: string;
  name: string;
  cost: string;
  price: string;
  category: string;
  components: ProductComponentDraft[];
};

type ModalMode = "create" | "edit";
type ModalTab = "info" | "components";

type ProductAction =
  | ""
  | "check"
  | "receipt"
  | "import"
  | "categories"
  | "normalize";

type CategoryFilterValue = `category:${string}` | "all";

type ToastState = {
  open: boolean;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type ProductCategorySelectValue = "uncategorized" | `category:${string}`;

const productActionOptions: readonly SelectBoxOption<
  Exclude<ProductAction, "">
>[] = [
  {
    value: "check",
    label: "Kiểm kho",
    icon: ClipboardList,
  },
  {
    value: "receipt",
    label: "Nhập hàng",
    icon: PackagePlus,
  },
  {
    value: "import",
    label: "Import Excel",
    icon: Upload,
  },
  {
    value: "categories",
    label: "Danh mục",
    icon: FolderTree,
  },
  {
    value: "normalize",
    label: "Chuẩn hóa category",
    icon: RefreshCcw,
  },
];

const buildCategoryFilterOptions = (
  categories: Category[],
): readonly SelectBoxOption<CategoryFilterValue>[] => [
  {
    value: "all",
    label: "Tất cả danh mục",
    icon: FolderTree,
  },
  ...categories.map((category) => ({
    value: `category:${category.id}` as CategoryFilterValue,
    label: category.name,
    icon: FolderTree,
  })),
];

const formatCurrency = (value: number | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 });

const formatQuantity = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 3 });

const createLocalId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const createEmptyForm = (): ProductFormState => ({
  code: "",
  name: "",
  cost: "",
  price: "",
  category: "",
  components: [],
});

const parseNumberInput = (value: string) => {
  const normalized = value.replace(/,/g, ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeExcelHeader = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();

const parseExcelNumber = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseExcelBoolean = (value: unknown, fallback = true) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!normalized) {
    return fallback;
  }

  if (["1", "true", "co", "yes", "dang kinh doanh"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "khong", "no", "ngung kinh doanh"].includes(normalized)) {
    return false;
  }

  return fallback;
};

const parseComponentCell = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return [];
  }

  return raw
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [productCodeRaw, quantityRaw] = entry.split(":");
      const productCode = String(productCodeRaw ?? "").trim();
      const quantity = parseExcelNumber(quantityRaw);

      if (!productCode || !quantity || quantity <= 0) {
        return null;
      }

      return {
        productCode,
        quantity,
      };
    })
    .filter((item): item is { productCode: string; quantity: number } =>
      Boolean(item),
    );
};

function ProductModal({
  open,
  mode,
  form,
  categories,
  products,
  saving,
  newCategoryName,
  componentQuery,
  tab,
  onClose,
  onSubmit,
  onChange,
  onTabChange,
  onNewCategoryNameChange,
  onCreateCategory,
  onComponentQueryChange,
  onAddComponent,
  onRemoveComponent,
  onUpdateComponentQuantity,
}: {
  open: boolean;
  mode: ModalMode;
  form: ProductFormState;
  categories: Category[];
  products: Product[];
  saving: boolean;
  newCategoryName: string;
  componentQuery: string;
  tab: ModalTab;
  onClose: () => void;
  onSubmit: () => void;
  onChange: (patch: Partial<ProductFormState>) => void;
  onTabChange: (tab: ModalTab) => void;
  onNewCategoryNameChange: (value: string) => void;
  onCreateCategory: () => void;
  onComponentQueryChange: (value: string) => void;
  onAddComponent: (product: Product) => void;
  onRemoveComponent: (localId: string) => void;
  onUpdateComponentQuantity: (localId: string, quantity: string) => void;
}) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const selectedCodes = useMemo(
    () => new Set(form.components.map((item) => item.productCode)),
    [form.components],
  );

  const categoryOptions = useMemo<
    readonly SelectBoxOption<ProductCategorySelectValue>[]
  >(
    () => [
      {
        value: "uncategorized",
        label: "Chưa phân loại",
        icon: FolderTree,
      },
      ...categories.map((category) => ({
        value: `category:${category.id}` as ProductCategorySelectValue,
        label: category.name,
        icon: FolderTree,
      })),
    ],
    [categories],
  );

  const selectedCategoryValue: ProductCategorySelectValue = form.category
    ? `category:${form.category}`
    : "uncategorized";

  const componentSuggestions = useMemo(() => {
    const keyword = componentQuery.trim().toLocaleLowerCase("vi");

    if (!keyword) return [];

    return products
      .filter((product) => {
        if (product.product_code === form.code) return false;
        if (selectedCodes.has(product.product_code)) return false;

        return (
          product.product_code.toLocaleLowerCase("vi").includes(keyword) ||
          product.product_name.toLocaleLowerCase("vi").includes(keyword)
        );
      })
      .slice(0, 8);
  }, [componentQuery, form.code, products, selectedCodes]);

  const componentRows = useMemo(
    () =>
      form.components.map((component) => {
        const matched = products.find(
          (product) => product.product_code === component.productCode,
        );

        const unitCost = matched?.cost ?? 0;
        const quantity = parseNumberInput(component.quantity);

        return {
          ...component,
          unitCost,
          stockQuantity: matched?.stockQuantity ?? 0,
          lineTotal: quantity * unitCost,
        };
      }),
    [form.components, products],
  );

  const componentCostTotal = useMemo(
    () => componentRows.reduce((sum, item) => sum + item.lineTotal, 0),
    [componentRows],
  );

  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;

      if (
        dropdownRef.current &&
        target instanceof Node &&
        !dropdownRef.current.contains(target)
      ) {
        onComponentQueryChange("");
      }
    };

    window.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [onComponentQueryChange, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 backdrop-blur-[2px] sm:items-center sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Thêm hàng hóa" : "Sửa hàng hóa"}
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)] sm:rounded-xl"
      >
        <header className="flex items-start justify-between bg-[linear-gradient(135deg,#064E3B,#033C2F)] px-5 py-5 text-white sm:px-6">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#F6C85F] ring-1 ring-white/15">
              {mode === "create" ? (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Tạo mới
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  Chỉnh sửa
                </>
              )}
            </div>

            <h2 className="truncate text-xl font-bold sm:text-2xl">
              {mode === "create"
                ? "Thêm hàng hóa"
                : form.name || "Sửa hàng hóa"}
            </h2>

            <p className="mt-1 text-sm leading-5 text-emerald-100">
              {mode === "create"
                ? "Khai báo thông tin, giá bán và thành phần cấu thành."
                : `Mã hàng hóa: ${form.code}`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Đóng popup"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-emerald-100 transition-[background-color,color,transform] duration-200 hover:bg-white/15 hover:text-[#F6C85F] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="border-b border-slate-200 bg-white px-5 sm:px-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onTabChange("info")}
              className={`relative inline-flex min-h-12 items-center gap-2 px-3 text-sm font-semibold transition-colors ${tab === "info" ? "text-emerald-800" : "text-slate-500 hover:text-slate-900"}`}
            >
              <ClipboardList className="h-4 w-4" />
              Thông tin
              {tab === "info" ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-700" />
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => onTabChange("components")}
              className={`relative inline-flex min-h-12 items-center gap-2 px-3 text-sm font-semibold transition-colors ${tab === "components" ? "text-emerald-800" : "text-slate-500 hover:text-slate-900"}`}
            >
              <PackagePlus className="h-4 w-4" />
              Thành phần
              <span
                className={`inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold ${tab === "components" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
              >
                {form.components.length}
              </span>
              {tab === "components" ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-700" />
              ) : null}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
          {tab === "info" ? (
            <div className="space-y-5">
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[6px_8px_14px_rgba(15,23,42,0.14)] sm:p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Thông tin cơ bản
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Mã và tên dùng để nhận diện hàng hóa trong hệ thống.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Mã hàng hóa"
                    value={form.code}
                    onChange={(event) => onChange({ code: event.target.value })}
                    disabled={mode === "edit"}
                    placeholder="VD: SP000001"
                  />

                  <Input
                    label="Tên hàng hóa"
                    value={form.name}
                    onChange={(event) => onChange({ name: event.target.value })}
                    placeholder="VD: Tôm nguyên liệu (kg)"
                  />
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[6px_8px_14px_rgba(15,23,42,0.14)] sm:p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Giá và phân loại
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Thiết lập giá vốn, giá bán và danh mục hiển thị.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Giá vốn hiện tại"
                    type="number"
                    min={0}
                    value={form.cost}
                    onChange={(event) => onChange({ cost: event.target.value })}
                    placeholder="0"
                    className="tabular-nums"
                  />

                  <Input
                    label="Giá bán"
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(event) =>
                      onChange({ price: event.target.value })
                    }
                    placeholder="0"
                    className="tabular-nums"
                  />

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-medium text-slate-900">
                      Danh mục
                    </label>

                    <SelectBox<ProductCategorySelectValue>
                      ariaLabel="Chọn danh mục hàng hóa"
                      value={selectedCategoryValue}
                      options={categoryOptions}
                      onValueChange={(nextValue) => {
                        onChange({
                          category:
                            nextValue === "uncategorized"
                              ? ""
                              : nextValue.replace(/^category:/, ""),
                        });
                      }}
                      className="w-full"
                      triggerClassName="h-10 rounded-md border-slate-300 bg-white font-medium text-slate-800 shadow-none hover:bg-emerald-50/50 focus-visible:ring-2 focus-visible:ring-emerald-100"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/60 p-4 shadow-[6px_8px_14px_rgba(15,23,42,0.14)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <Input
                      label="Tạo nhanh danh mục mới"
                      value={newCategoryName}
                      onChange={(event) =>
                        onNewCategoryNameChange(event.target.value)
                      }
                      placeholder="Nhập tên danh mục mới"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={!newCategoryName.trim()}
                    onClick={onCreateCategory}
                    className="h-10 shrink-0 rounded-md border-emerald-700 bg-white px-4 font-semibold text-emerald-800 hover:bg-emerald-800 hover:text-[#F6C85F]"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Thêm danh mục
                  </Button>
                </div>
              </section>
            </div>
          ) : (
            <div className="space-y-5">
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Hàng hóa thành phần
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Tìm và thêm nguyên liệu cấu thành sản phẩm.
                    </p>
                  </div>

                  <span className="text-xs font-semibold text-emerald-700">
                    Đã chọn {form.components.length} thành phần
                  </span>
                </div>

                <div ref={dropdownRef} className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                  <input
                    value={componentQuery}
                    onChange={(event) =>
                      onComponentQueryChange(event.target.value)
                    }
                    placeholder="Tìm theo mã hoặc tên hàng hóa"
                    className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />

                  {componentSuggestions.length > 0 ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                      {componentSuggestions.map((product) => (
                        <button
                          key={product.product_code}
                          type="button"
                          onClick={() => onAddComponent(product)}
                          className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-3 text-left transition-colors hover:bg-emerald-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {product.product_name}
                            </p>
                            <p className="mt-0.5 font-mono text-xs text-slate-500">
                              {product.product_code}
                            </p>
                          </div>

                          <div className="shrink-0 text-right text-xs text-slate-500">
                            <p>
                              Giá vốn:{" "}
                              <span className="font-semibold text-slate-800">
                                {formatCurrency(product.cost)}đ
                              </span>
                            </p>
                            <p className="mt-0.5">
                              Tồn: {formatQuantity(product.stockQuantity)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="bg-slate-100 text-xs font-semibold text-slate-700">
                      <tr>
                        <th className="w-14 px-4 py-3 text-center">STT</th>
                        <th className="px-4 py-3 text-left">Mã hàng hóa</th>
                        <th className="px-4 py-3 text-left">Tên thành phần</th>
                        <th className="px-4 py-3 text-right">Số lượng</th>
                        <th className="px-4 py-3 text-right">Giá vốn</th>
                        <th className="px-4 py-3 text-right">Thành tiền</th>
                        <th className="w-16 px-4 py-3 text-center">Xóa</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {componentRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-14 text-center">
                            <PackagePlus className="mx-auto h-7 w-7 text-slate-300" />
                            <p className="mt-2 font-medium text-slate-700">
                              Chưa có thành phần
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Tìm sản phẩm phía trên để thêm vào danh sách.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        componentRows.map((component, index) => (
                          <tr
                            key={component.localId}
                            className="transition-colors hover:bg-emerald-50/40"
                          >
                            <td className="px-4 py-3 text-center text-slate-500">
                              {index + 1}
                            </td>

                            <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                              {component.productCode}
                            </td>

                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-900">
                                {component.productName}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                Tồn kho:{" "}
                                {formatQuantity(component.stockQuantity)}
                              </p>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                min={0.001}
                                step="0.001"
                                value={component.quantity}
                                onChange={(event) =>
                                  onUpdateComponentQuantity(
                                    component.localId,
                                    event.target.value,
                                  )
                                }
                                className="ml-auto h-9 w-24 rounded-md border border-slate-300 px-2 text-right text-sm tabular-nums outline-none transition-[border-color,box-shadow] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                              />
                            </td>

                            <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                              {formatCurrency(component.unitCost)}đ
                            </td>

                            <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                              {formatCurrency(component.lineTotal)}đ
                            </td>

                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  onRemoveComponent(component.localId)
                                }
                                aria-label={`Xóa ${component.productName}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-rose-600 transition-[background-color,color,transform] hover:bg-rose-600 hover:text-white active:scale-[0.96]"
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

                <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    Tổng cộng {componentRows.length} thành phần
                  </p>

                  <div className="flex items-center justify-between gap-5 sm:justify-end">
                    <span className="text-sm font-semibold text-slate-700">
                      Tổng giá vốn
                    </span>
                    <span className="text-lg font-bold tabular-nums text-emerald-800">
                      {formatCurrency(componentCostTotal)}đ
                    </span>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="hidden text-xs text-slate-500 sm:block">
            Kiểm tra kỹ thông tin trước khi lưu.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
              className="h-10 rounded-md border-slate-300 bg-white px-5 shadow-none hover:bg-slate-100"
            >
              Hủy
            </Button>

            <Button
              type="button"
              onClick={onSubmit}
              isLoading={saving}
              className="h-10 rounded-md bg-emerald-800 px-5 font-semibold text-[#F6C85F] shadow-none hover:bg-[#F6C85F] hover:text-emerald-900"
            >
              <Check className="mr-2 h-4 w-4" />
              {mode === "create" ? "Thêm hàng hóa" : "Lưu thay đổi"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

const normalizeCategoryName = (value: string) =>
  value.trim().toLocaleLowerCase("vi");

const categoryColorMap: Record<string, string> = {
  "ăn sáng": "bg-amber-100 text-amber-800 ring-amber-200",
  "cơm văn phòng": "bg-sky-100 text-sky-800 ring-sky-200",
  combo: "bg-violet-100 text-violet-800 ring-violet-200",
  "đồ nguội": "bg-slate-200 text-slate-800 ring-slate-300",
  "đồ nướng": "bg-orange-100 text-orange-800 ring-orange-200",
  lẩu: "bg-rose-100 text-rose-800 ring-rose-200",
  "món chiên/xào": "bg-yellow-100 text-yellow-800 ring-yellow-200",
  "món tặng": "bg-pink-100 text-pink-800 ring-pink-200",
  "món thêm": "bg-indigo-100 text-indigo-800 ring-indigo-200",
  "nguyên liệu": "bg-emerald-100 text-emerald-800 ring-emerald-200",
  nước: "bg-cyan-100 text-cyan-800 ring-cyan-200",
  "phụ thu": "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200",
  "salad/gỏi": "bg-lime-100 text-lime-800 ring-lime-200",
  "topping thêm": "bg-teal-100 text-teal-800 ring-teal-200",
};

const getCategoryBadgeClass = (categoryName: string) =>
  categoryColorMap[normalizeCategoryName(categoryName)] ??
  "bg-slate-100 text-slate-700 ring-slate-200";

export default function ProductsPage() {
  const router = useRouter();
  const { storeId } = useStore();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedAction, setSelectedAction] = useState<ProductAction>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isNormalizingCategoryRefs, setIsNormalizingCategoryRefs] =
    useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [modalTab, setModalTab] = useState<ModalTab>("info");
  const [editingProductCode, setEditingProductCode] = useState("");
  const [formState, setFormState] =
    useState<ProductFormState>(createEmptyForm());
  const [newCategoryName, setNewCategoryName] = useState("");
  const [componentQuery, setComponentQuery] = useState("");
  const [toast, setToast] = useState<ToastState>({
    open: false,
    title: "",
    description: "",
    variant: "info",
  });
  const showToast = (
    title: string,
    variant: ToastVariant = "info",
    description?: string,
  ) => {
    setToast({
      open: true,
      title,
      description,
      variant,
    });
  };

  const closeToast = () => {
    setToast((current) => ({
      ...current,
      open: false,
    }));
  };
  const categoryFilterOptions = useMemo(
    () => buildCategoryFilterOptions(categories),
    [categories],
  );
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const keyword = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !keyword ||
        product.product_code.toLowerCase().includes(keyword) ||
        product.product_name.toLowerCase().includes(keyword);

      if (!matchesSearch) {
        return false;
      }

      if (!filterCategory) {
        return true;
      }

      const matchedCategory = categories.find(
        (category) => category.id === filterCategory,
      );
      if (!matchedCategory) {
        return product.category === filterCategory;
      }

      return (
        product.category === matchedCategory.id ||
        product.categoryName === matchedCategory.name
      );
    });
  }, [categories, filterCategory, products, searchTerm]);

  const productPage = useMemo(
    () => paginateItems(filteredProducts, currentPage),
    [currentPage, filteredProducts],
  );

  useEffect(() => {
    if (currentPage !== productPage.pagination.currentPage) {
      setCurrentPage(productPage.pagination.currentPage);
    }
  }, [currentPage, productPage.pagination.currentPage]);

  const selectedCategoryFilter: CategoryFilterValue = filterCategory
    ? `category:${filterCategory}`
    : "all";

  const handleProductAction = async (action: Exclude<ProductAction, "">) => {
    setSelectedAction(action);

    try {
      switch (action) {
        case "check":
          router.push("/product/checks");
          break;

        case "receipt":
          router.push("/product/receipts");
          break;

        case "import":
          importInputRef.current?.click();
          break;

        case "categories":
          router.push("/categories");
          break;

        case "normalize":
          await handleNormalizeCategoryRefs();
          break;
      }
    } finally {
      window.setTimeout(() => {
        setSelectedAction("");
      }, 0);
    }
  };

  const resolvedProductActionOptions = useMemo(
    () =>
      productActionOptions.map((option) =>
        option.value === "import"
          ? {
              ...option,
              label: importing ? "Đang import..." : "Import Excel",
              disabled: importing,
            }
          : option.value === "normalize"
            ? {
                ...option,
                label: isNormalizingCategoryRefs
                  ? "Đang chuẩn hóa..."
                  : "Chuẩn hóa category",
                disabled: isNormalizingCategoryRefs,
              }
            : option,
      ),
    [importing, isNormalizingCategoryRefs],
  );

  async function loadProducts() {
    const items = await getAllProducts(storeId);
    setProducts(items);
  }

  async function loadIngredients() {
    const { items } = await getIngredients(storeId);
    setIngredients(items.map((item) => ({
      product_code: item.ingredientCode,
      product_name: item.ingredientName,
      cost: item.cost,
      price: null,
      has_cost: item.cost !== null,
      isSelling: item.isActive,
      stockQuantity: item.stockQuantity,
      unit: item.unit,
      description: item.description,
      storeId: item.storeId,
    })));
  }

  async function loadCategories() {
    const items = await getCategories(storeId);
    setCategories(items);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        await Promise.all([loadProducts(), loadIngredients(), loadCategories()]);
      } finally {
        setLoading(false);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const resolveCategoryId = (rawCategory?: string) => {
    const normalized = (rawCategory || "").trim();
    if (!normalized) return "";

    const matched = categories.find(
      (category) => category.id === normalized || category.name === normalized,
    );

    return matched?.id || normalized;
  };

  const closeModal = () => {
    setShowModal(false);
    setModalTab("info");
    setEditingProductCode("");
    setFormState(createEmptyForm());
    setNewCategoryName("");
    setComponentQuery("");
  };

  const openCreateModal = () => {
    setModalMode("create");
    setFormState(createEmptyForm());
    setShowModal(true);
    setModalTab("info");
    setEditingProductCode("");
    setNewCategoryName("");
    setComponentQuery("");
  };

  const openEditModal = (product: Product) => {
    setModalMode("edit");
    setEditingProductCode(product.product_code);
    setFormState({
      code: product.product_code,
      name: product.product_name,
      cost:
        product.cost !== null && product.cost !== undefined
          ? String(product.cost)
          : "",
      price:
        product.price !== null && product.price !== undefined
          ? String(product.price)
          : "",
      category: resolveCategoryId(product.category),
      components: (product.components || []).map((component) => ({
        localId: createLocalId(),
        productCode: component.productCode,
        productName: component.productName,
        quantity: String(component.quantity),
      })),
    });
    setShowModal(true);
    setModalTab("info");
    setNewCategoryName("");
    setComponentQuery("");
  };

  async function handleImport(file: File) {
    setImporting(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            defval: "",
          });

          const headerIndex = rows.findIndex((row) => {
            if (!Array.isArray(row)) return false;
            return row.some((cell) =>
              normalizeExcelHeader(cell).includes("ma hang"),
            );
          });

          if (headerIndex === -1) {
            alert("Không tìm thấy header Excel.");
            return;
          }

          const headerRow = rows[headerIndex] || [];
          const dataRows = rows.slice(headerIndex + 1);
          const codeIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("ma hang"),
          );
          const nameIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("ten hang"),
          );
          const categoryIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("nhom hang"),
          );
          const priceIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("gia ban"),
          );
          const costIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("gia von"),
          );
          const stockIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("ton kho"),
          );
          const componentsIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("hang thanh phan"),
          );
          const isSellingIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("dang kinh doanh"),
          );

          const mapped = dataRows
            .filter((row) => {
              const code = codeIdx >= 0 ? row[codeIdx] : row[0];
              const name = nameIdx >= 0 ? row[nameIdx] : row[1];
              return (
                String(code ?? "").trim() !== "" &&
                String(name ?? "").trim() !== ""
              );
            })
            .map((row) => {
              const categoryName = categoryIdx >= 0 ? row[categoryIdx] : "";
              const parsedPrice =
                priceIdx >= 0 ? parseExcelNumber(row[priceIdx]) : null;
              const parsedCost =
                costIdx >= 0 ? parseExcelNumber(row[costIdx]) : null;
              const parsedStock =
                stockIdx >= 0 ? parseExcelNumber(row[stockIdx]) : null;
              const normalizedCategory =
                typeof categoryName === "string" ? categoryName.trim() : "";
              const matchedCategoryId =
                categories.find(
                  (category) =>
                    category.name.toLowerCase() ===
                    normalizedCategory.toLowerCase(),
                )?.id || normalizedCategory;

              return {
                product_code: String(
                  codeIdx >= 0 ? row[codeIdx] : row[0],
                ).trim(),
                product_name: String(
                  nameIdx >= 0 ? row[nameIdx] : row[1],
                ).trim(),
                category: matchedCategoryId,
                cost: Number.isFinite(parsedCost) ? Number(parsedCost) : null,
                price: Number.isFinite(parsedPrice)
                  ? Number(parsedPrice)
                  : null,
                stockQuantity: Number.isFinite(parsedStock)
                  ? Number(parsedStock)
                  : 0,
                isSelling:
                  isSellingIdx >= 0
                    ? parseExcelBoolean(row[isSellingIdx], true)
                    : true,
                components:
                  componentsIdx >= 0
                    ? parseComponentCell(row[componentsIdx])
                    : [],
              };
            });

          if (mapped.length === 0) {
            alert("File Excel không có dòng hàng hoá hợp lệ để import.");
            return;
          }

          await upsertProductsFromExcel(mapped, storeId);
          setCurrentPage(1);
          await loadProducts();
          alert(`Import thành công ${mapped.length} hàng hoá.`);
        } catch (error) {
          console.error(error);
          alert("Không thể import file Excel.");
        } finally {
          setImporting(false);
        }
      };

      reader.onerror = () => {
        setImporting(false);
        alert("Không đọc được file Excel.");
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error(error);
      setImporting(false);
      alert("Không thể import file Excel.");
    }
  }

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) {
      return;
    }

    const id = await addCategory(newCategoryName, undefined, storeId);
    if (!id) {
      return;
    }

    await loadCategories();
    setFormState((current) => ({
      ...current,
      category: id,
    }));
    setNewCategoryName("");
  }

  async function handleSaveProduct() {
    if (!formState.code.trim() || !formState.name.trim()) {
      showToast(
        "Thông tin chưa đầy đủ",
        "warning",
        "Vui lòng nhập mã và tên hàng hóa.",
      );
      return;
    }

    setSaving(true);

    try {
      const payloadComponents = formState.components
        .map((component) => ({
          productCode: component.productCode,
          quantity: parseNumberInput(component.quantity),
        }))
        .filter((component) => component.productCode && component.quantity > 0);

      if (modalMode === "create") {
        await addProduct({
          product_code: formState.code.trim(),
          product_name: formState.name.trim(),
          cost: formState.cost.trim() ? parseNumberInput(formState.cost) : null,
          price: formState.price.trim()
            ? parseNumberInput(formState.price)
            : null,
          category: resolveCategoryId(formState.category),
          has_cost: Boolean(formState.cost.trim()),
          isSelling: true,
          stockQuantity: 0,
          components: payloadComponents,
          storeId,
        });

        setCurrentPage(1);

        showToast(
          "Đã thêm hàng hóa",
          "success",
          `${formState.name.trim()} đã được thêm vào danh sách.`,
        );
      } else {
        await updateProductCost(
          editingProductCode,
          {
            productName: formState.name.trim(),
            cost: formState.cost.trim()
              ? parseNumberInput(formState.cost)
              : null,
            price: formState.price.trim()
              ? parseNumberInput(formState.price)
              : null,
            category: resolveCategoryId(formState.category),
            components: payloadComponents,
          },
          storeId,
        );

        showToast(
          "Đã cập nhật hàng hóa",
          "success",
          `${formState.name.trim()} đã được cập nhật thành công.`,
        );
      }

      await loadProducts();
      closeModal();
    } catch (error) {
      console.error(error);

      showToast(
        "Không thể lưu hàng hóa",
        "error",
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi. Vui lòng thử lại.",
      );
    } finally {
      setSaving(false);
    }
  }

  const openDeleteDialog = (product: Product) => {
    setDeletingProduct(product);
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeletingProduct(null);
  };

  async function confirmDeleteProduct() {
    if (!deletingProduct) return;

    setDeleting(true);

    try {
      await deleteProduct(deletingProduct.product_code, storeId);
      setDeletingProduct(null);
      await loadProducts();
    } catch (error) {
      console.error(error);
      alert("Không thể xoá hàng hoá.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleSelling(product: Product) {
    try {
      await setProductSellingStatus(
        product.product_code,
        product.isSelling === false,
        storeId,
      );
      await loadProducts();
    } catch (error) {
      console.error(error);
      alert("Không thể cập nhật trạng thái bán.");
    }
  }

  async function handleNormalizeCategoryRefs() {
    setIsNormalizingCategoryRefs(true);

    try {
      const result = await normalizeProductCategoryReferences(storeId);
      await Promise.all([loadProducts(), loadCategories()]);
      alert(
        `Đã chuẩn hoá ${result.updatedProductCount} sản phẩm và tạo ${result.createdCategoryCount} danh mục mới.`,
      );
    } catch (error) {
      console.error(error);
      alert("Không thể chuẩn hoá category.");
    } finally {
      setIsNormalizingCategoryRefs(false);
    }
  }

  const productStats = useMemo(
    () => ({
      total: products.length,
      selling: products.filter((product) => product.isSelling !== false).length,
      stopped: products.filter((product) => product.isSelling === false).length,
      categories: categories.length,
    }),
    [categories.length, products],
  );

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <main className="min-h-screen bg-slate-50 text-slate-950 antialiased">
        <div className="mx-auto max-w-[1520px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <header className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-smooch text-5xl font-bold text-emerald-800">
                Danh sách hàng hóa
              </h1>

              <p className="font-firasans mt-1 max-w-2xl text-pretty text-sm font-bold text-[#d6ba5d]">
                Quản lý giá bán, giá vốn, tồn kho và thành phần cấu thành
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="h-10 gap-1.5 rounded-[2px] border-2 border-slate-900 bg-emerald-700 px-3 text-sm font-semibold text-white shadow-[4px_4px_0_#0f172a] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-emerald-800 hover:text-white hover:shadow-[6px_6px_0_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:scale-100 active:shadow-[2px_2px_0_#0f172a]"
                onClick={openCreateModal}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                Thêm hàng hóa
              </Button>

              <SelectBox<ProductAction>
                ariaLabel="Chọn thao tác hàng hóa"
                value={selectedAction}
                placeholder="Thao tác"
                options={resolvedProductActionOptions}
                onValueChange={(nextAction) => {
                  if (!nextAction) return;
                  void handleProductAction(nextAction);
                }}
                className="w-[180px]"
                triggerClassName="h-10 rounded-[2px] border-2 border-slate-900 bg-white px-3 font-semibold text-slate-900 shadow-[4px_4px_0_#0f172a] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-[6px_6px_0_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#0f172a]"
              />

              <input
                ref={importInputRef}
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) {
                    void handleImport(file);
                  }

                  event.target.value = "";
                }}
              />
            </div>
          </header>

          <section className="overflow-hidden rounded border border-slate-200 bg-white">
            <div className="grid grid-cols-2 border-b border-slate-200 lg:grid-cols-4">
              {[
                ["Tổng hàng hóa", productStats.total],
                ["Đang bán", productStats.selling],
                ["Tạm dừng", productStats.stopped],
                ["Danh mục", productStats.categories],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={`group relative bg-white px-4 py-4 transition-[transform,box-shadow,background-color] duration-300 ease-out hover:z-10 hover:-translate-y-1 hover:bg-emerald-50/40 hover:shadow-[0_14px_30px_rgba(15,23,42,0.14)] lg:px-5 ${
                    index > 0 ? "border-l border-slate-200" : ""
                  } ${
                    index > 1 ? "border-t border-slate-200 lg:border-t-0" : ""
                  }`}
                >
                  <p className="text-xs font-medium text-slate-600 transition-colors duration-300 group-hover:text-emerald-700">
                    {label}
                  </p>

                  <p className="mt-1 text-xl font-bold tabular-nums text-slate-950 transition-colors duration-300 group-hover:text-emerald-800">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Tìm mã hoặc tên hàng hóa"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <SelectBox<CategoryFilterValue>
                ariaLabel="Lọc theo danh mục hàng hóa"
                value={selectedCategoryFilter}
                options={categoryFilterOptions}
                onValueChange={(nextValue) => {
                  setFilterCategory(
                    nextValue === "all"
                      ? ""
                      : nextValue.replace(/^category:/, ""),
                  );
                  setCurrentPage(1);
                }}
                className="w-full sm:w-[220px]"
                triggerClassName="h-10 rounded-md border-slate-300 bg-white font-medium text-slate-700 shadow-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-100"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Mã hàng hóa</th>
                    <th className="px-4 py-3">Tên hàng hóa</th>
                    <th className="px-4 py-3">Danh mục</th>
                    <th className="px-4 py-3 text-right">Giá bán</th>
                    <th className="px-4 py-3 text-right">Giá vốn</th>
                    <th className="px-4 py-3 text-right">Tồn kho</th>
                    <th className="px-4 py-3 text-center">Thành phần</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="w-28 px-4 py-3 text-center">Thao tác</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-14 text-center text-slate-600"
                      >
                        Đang tải dữ liệu hàng hóa...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-14 text-center">
                        <CircleAlert className="mx-auto h-6 w-6 text-slate-400" />

                        <p className="mt-2 font-medium">
                          Không có hàng hóa phù hợp
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Thử thay đổi từ khóa hoặc danh mục.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    productPage.items.map((product) => {
                      const categoryLabel =
                        categories.find(
                          (category) =>
                            category.id === product.category ||
                            category.name === product.categoryName,
                        )?.name ||
                        product.categoryName ||
                        product.category ||
                        "Chưa phân loại";

                      return (
                        <tr
                          key={product.product_code}
                          tabIndex={0}
                          onClick={() => openEditModal(product)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openEditModal(product);
                            }
                          }}
                          className="cursor-pointer bg-white transition-[background-color,box-shadow] hover:bg-emerald-50/60 hover:shadow-[inset_3px_0_0_#047857] focus-visible:bg-emerald-50/60 focus-visible:outline-none focus-visible:shadow-[inset_3px_0_0_#047857]"
                        >
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                            {product.product_code}
                          </td>

                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">
                              {product.product_name}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              Giá vốn BOM:{" "}
                              {formatCurrency(product.componentCostTotal)}đ
                            </p>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex max-w-[220px] truncate rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${getCategoryBadgeClass(categoryLabel)}`}
                            >
                              {categoryLabel}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-700">
                            {product.price !== null &&
                            product.price !== undefined
                              ? `${formatCurrency(product.price)}đ`
                              : "0đ"}
                          </td>

                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                            {product.cost !== null && product.cost !== undefined
                              ? `${formatCurrency(product.cost)}đ`
                              : "0đ"}
                          </td>

                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                            {formatQuantity(product.stockQuantity)}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex min-w-8 justify-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-700">
                              {product.componentCount || 0}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleToggleSelling(product);
                              }}
                              className={`group inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold transition-[background-color,color,transform] duration-200 ${
                                product.isSelling === false
                                  ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                  : "bg-emerald-800 text-[#ffb800] hover:bg-[#ffb800] hover:text-emerald-900 active:scale-[0.96]"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full transition-colors duration-200 ${
                                  product.isSelling === false
                                    ? "bg-slate-500"
                                    : "bg-[#ffb800] group-hover:bg-emerald-900"
                                }`}
                              />

                              {product.isSelling === false
                                ? "Tạm dừng"
                                : "Đang bán"}
                            </button>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditModal(product);
                                }}
                                aria-label={`Sửa ${product.product_name}`}
                                title="Sửa"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-emerald-700 transition-[background-color,color,transform,box-shadow] duration-200 hover:bg-emerald-800 hover:text-[#ffb800] hover:shadow-sm active:scale-[0.96]"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDeleteDialog(product);
                                }}
                                aria-label={`Xóa ${product.product_name}`}
                                title="Xóa"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-rose-600 transition-[background-color,color,transform] hover:bg-rose-600 hover:text-white active:scale-[0.96]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {!loading && filteredProducts.length > 0 ? (
              <Pagination
                currentPage={productPage.pagination.currentPage}
                totalItems={filteredProducts.length}
                onPageChange={setCurrentPage}
              />
            ) : null}
          </section>
        </div>
      </main>

      <ConfirmDialog
        open={Boolean(deletingProduct)}
        title="Xóa hàng hóa?"
        description={
          deletingProduct ? (
            <div className="space-y-2">
              <p>
                Bạn có chắc muốn xóa{" "}
                <strong className="font-semibold text-slate-900">
                  {deletingProduct.product_name}
                </strong>
                ?
              </p>

              <p className="text-xs text-slate-500">
                Mã hàng hóa:{" "}
                <span className="font-mono font-semibold">
                  {deletingProduct.product_code}
                </span>
              </p>

              <p className="text-xs font-medium text-rose-700">
                Hành động này không thể hoàn tác.
              </p>
            </div>
          ) : null
        }
        confirmLabel="Xóa hàng hóa"
        cancelLabel="Hủy"
        variant="destructive"
        icon={Trash2}
        isLoading={deleting}
        onCancel={closeDeleteDialog}
        onConfirm={() => void confirmDeleteProduct()}
      />

      <Toast
        open={toast.open}
        title={toast.title}
        description={toast.description}
        variant={toast.variant}
        duration={3750}
        onDismiss={closeToast}
      />

      <ProductModal
        open={showModal}
        mode={modalMode}
        form={formState}
        categories={categories}
        products={ingredients}
        saving={saving}
        newCategoryName={newCategoryName}
        componentQuery={componentQuery}
        tab={modalTab}
        onClose={closeModal}
        onSubmit={handleSaveProduct}
        onChange={(patch) =>
          setFormState((current) => ({ ...current, ...patch }))
        }
        onTabChange={setModalTab}
        onNewCategoryNameChange={setNewCategoryName}
        onCreateCategory={handleCreateCategory}
        onComponentQueryChange={setComponentQuery}
        onAddComponent={(product) => {
          setFormState((current) => ({
            ...current,
            components: [
              ...current.components,
              {
                localId: createLocalId(),
                productCode: product.product_code,
                productName: product.product_name,
                quantity: "1",
              },
            ],
          }));

          setComponentQuery("");
          setModalTab("components");
        }}
        onRemoveComponent={(localId) =>
          setFormState((current) => ({
            ...current,
            components: current.components.filter(
              (component) => component.localId !== localId,
            ),
          }))
        }
        onUpdateComponentQuantity={(localId, quantity) =>
          setFormState((current) => ({
            ...current,
            components: current.components.map((component) =>
              component.localId === localId
                ? { ...component, quantity }
                : component,
            ),
          }))
        }
      />
    </RoleGuard>
  );
}
