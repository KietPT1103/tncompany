"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import { addCategory, Category, getCategories } from "@/services/categoryService";
import { useStore } from "@/context/StoreContext";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  ChevronDown,
  FolderTree,
  Menu,
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

const formatCurrency = (value: number | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 });

const formatQuantity = (value: number | string | null | undefined) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 3 });

const createLocalId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
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

  const normalized = value.replace(/\s/g, "").replace(/,/g, "").replace(/[^\d.-]/g, "");
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
    .filter((item): item is { productCode: string; quantity: number } => Boolean(item));
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
  const selectedCodes = new Set(form.components.map((item) => item.productCode));
  const componentSuggestions = useMemo(() => {
    const keyword = componentQuery.trim().toLowerCase();
    if (!keyword) return [];

    return products
      .filter((product) => {
        if (product.product_code === form.code) return false;
        if (selectedCodes.has(product.product_code)) return false;

        return (
          product.product_code.toLowerCase().includes(keyword) ||
          product.product_name.toLowerCase().includes(keyword)
        );
      })
      .slice(0, 8);
  }, [componentQuery, form.code, products, selectedCodes]);

  const componentRows = useMemo(
    () =>
      form.components.map((component) => {
        const matched = products.find((product) => product.product_code === component.productCode);
        const unitCost = matched?.cost ?? 0;
        const quantity = parseNumberInput(component.quantity);

        return {
          ...component,
          unitCost,
          stockQuantity: matched?.stockQuantity ?? 0,
          lineTotal: quantity * unitCost,
        };
      }),
    [form.components, products]
  );

  const componentCostTotal = useMemo(
    () => componentRows.reduce((sum, item) => sum + item.lineTotal, 0),
    [componentRows]
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
    return () => window.removeEventListener("mousedown", handleMouseDown);
  }, [onComponentQueryChange, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              {mode === "create" ? "Thêm hàng hoá" : "Sửa hàng hoá"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "create"
                ? "Tạo hàng hoá mới và khai báo thành phần nếu đây là món chế biến."
                : `${form.name || "Hàng hoá"} (${form.code})`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 px-6">
          <div className="flex gap-6">
            {[
              { key: "info", label: "Thông tin" },
              { key: "components", label: "Thành phần" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key as ModalTab)}
                className={`border-b-2 px-1 py-3 text-sm font-medium transition ${
                  tab === item.key
                    ? "border-emerald-500 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {tab === "info" ? (
            <div className="grid gap-5 md:grid-cols-2">
              <Input
                label="Mã hàng hoá"
                value={form.code}
                onChange={(event) => onChange({ code: event.target.value })}
                disabled={mode === "edit"}
                placeholder="VD: SP000001"
              />
              <Input
                label="Tên hàng hoá"
                value={form.name}
                onChange={(event) => onChange({ name: event.target.value })}
                placeholder="VD: Tôm nguyên liệu (kg)"
              />
              <Input
                label="Giá vốn hiện tại"
                type="number"
                value={form.cost}
                onChange={(event) => onChange({ cost: event.target.value })}
                placeholder="0"
              />
              <Input
                label="Giá bán"
                type="number"
                value={form.price}
                onChange={(event) => onChange({ price: event.target.value })}
                placeholder="0"
              />
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-900">Danh mục</label>
                <select
                  value={form.category}
                  onChange={(event) => onChange({ category: event.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Chưa phân loại</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Input
                  label="Tạo danh mục mới"
                  value={newCategoryName}
                  onChange={(event) => onNewCategoryNameChange(event.target.value)}
                  placeholder="Nhập tên danh mục"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={onCreateCategory}
                >
                  Lưu danh mục
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-900">
                  Hàng hoá thành phần
                </label>
                <div ref={dropdownRef} className="relative max-w-xl">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={componentQuery}
                    onChange={(event) => onComponentQueryChange(event.target.value)}
                    placeholder="Thêm hàng hoá thành phần"
                    className="h-11 w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />

                  {componentSuggestions.length > 0 ? (
                    <div className="absolute left-0 top-[calc(100%+8px)] z-10 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                      {componentSuggestions.map((product) => (
                        <button
                          key={product.product_code}
                          type="button"
                          onClick={() => onAddComponent(product)}
                          className="flex w-full items-start justify-between rounded-xl px-3 py-3 text-left transition hover:bg-slate-50"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">
                              {product.product_name}
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              {product.product_code}
                            </div>
                          </div>
                          <div className="text-right text-sm text-slate-500">
                            <div>Giá vốn: {formatCurrency(product.cost)}đ</div>
                            <div>Tồn: {formatQuantity(product.stockQuantity)}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-sky-50 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left">STT</th>
                      <th className="px-4 py-3 text-left">Mã hàng hoá</th>
                      <th className="px-4 py-3 text-left">Tên hàng thành phần</th>
                      <th className="px-4 py-3 text-right">Số lượng</th>
                      <th className="px-4 py-3 text-right">Giá vốn</th>
                      <th className="px-4 py-3 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {componentRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          Chưa có thành phần nào.
                        </td>
                      </tr>
                    ) : (
                      componentRows.map((component, index) => (
                        <tr key={component.localId}>
                          <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => onRemoveComponent(component.localId)}
                                className="rounded-full p-1 text-rose-500 transition hover:bg-rose-50"
                                aria-label="Xoá thành phần"
                              >
                                <X className="h-4 w-4" />
                              </button>
                              <span>{component.productCode}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">
                              {component.productName}
                            </div>
                            <div className="text-xs text-slate-500">
                              Tồn kho: {formatQuantity(component.stockQuantity)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              value={component.quantity}
                              onChange={(event) =>
                                onUpdateComponentQuantity(component.localId, event.target.value)
                              }
                              className="ml-auto h-10 w-28 rounded-2xl border border-slate-300 px-3 text-right outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                            />
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {formatCurrency(component.unitCost)}đ
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(component.lineTotal)}đ
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ml-auto max-w-sm space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-slate-700">Tổng giá vốn thành phần</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(componentCostTotal)}đ
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Button type="button" variant="outline" className="rounded-2xl" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="button"
            className="rounded-2xl bg-emerald-600 hover:bg-emerald-700"
            onClick={onSubmit}
            isLoading={saving}
          >
            <Check className="mr-2 h-4 w-4" />
            Lưu
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const { storeId } = useStore();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isNormalizingCategoryRefs, setIsNormalizingCategoryRefs] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [modalTab, setModalTab] = useState<ModalTab>("info");
  const [editingProductCode, setEditingProductCode] = useState("");
  const [formState, setFormState] = useState<ProductFormState>(createEmptyForm());
  const [newCategoryName, setNewCategoryName] = useState("");
  const [componentQuery, setComponentQuery] = useState("");

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

      const matchedCategory = categories.find((category) => category.id === filterCategory);
      if (!matchedCategory) {
        return product.category === filterCategory;
      }

      return (
        product.category === matchedCategory.id || product.categoryName === matchedCategory.name
      );
    });
  }, [categories, filterCategory, products, searchTerm]);

  async function loadProducts() {
    const items = await getAllProducts(storeId);
    setProducts(items);
  }

  async function loadCategories() {
    const items = await getCategories(storeId);
    setCategories(items);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        await Promise.all([loadProducts(), loadCategories()]);
      } finally {
        setLoading(false);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    if (!showActionMenu) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (
        actionMenuRef.current &&
        target instanceof Node &&
        !actionMenuRef.current.contains(target)
      ) {
        setShowActionMenu(false);
      }
    };

    window.addEventListener("mousedown", handleMouseDown);
    return () => window.removeEventListener("mousedown", handleMouseDown);
  }, [showActionMenu]);

  const resolveCategoryId = (rawCategory?: string) => {
    const normalized = (rawCategory || "").trim();
    if (!normalized) return "";

    const matched = categories.find(
      (category) => category.id === normalized || category.name === normalized
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
        product.cost !== null && product.cost !== undefined ? String(product.cost) : "",
      price:
        product.price !== null && product.price !== undefined ? String(product.price) : "",
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
          const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

          const headerIndex = rows.findIndex((row) => {
            if (!Array.isArray(row)) return false;
            return row.some((cell) => normalizeExcelHeader(cell).includes("ma hang"));
          });

          if (headerIndex === -1) {
            alert("Không tìm thấy header Excel.");
            return;
          }

          const headerRow = rows[headerIndex] || [];
          const dataRows = rows.slice(headerIndex + 1);
          const codeIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("ma hang")
          );
          const nameIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("ten hang")
          );
          const categoryIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("nhom hang")
          );
          const priceIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("gia ban")
          );
          const costIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("gia von")
          );
          const stockIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("ton kho")
          );
          const componentsIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("hang thanh phan")
          );
          const isSellingIdx = headerRow.findIndex((cell) =>
            normalizeExcelHeader(cell).includes("dang kinh doanh")
          );

          const mapped = dataRows
            .filter((row) => {
              const code = codeIdx >= 0 ? row[codeIdx] : row[0];
              const name = nameIdx >= 0 ? row[nameIdx] : row[1];
              return String(code ?? "").trim() !== "" && String(name ?? "").trim() !== "";
            })
            .map((row) => {
              const categoryName = categoryIdx >= 0 ? row[categoryIdx] : "";
              const parsedPrice = priceIdx >= 0 ? parseExcelNumber(row[priceIdx]) : null;
              const parsedCost = costIdx >= 0 ? parseExcelNumber(row[costIdx]) : null;
              const parsedStock = stockIdx >= 0 ? parseExcelNumber(row[stockIdx]) : null;
              const normalizedCategory =
                typeof categoryName === "string" ? categoryName.trim() : "";
              const matchedCategoryId =
                categories.find(
                  (category) =>
                    category.name.toLowerCase() === normalizedCategory.toLowerCase()
                )?.id || normalizedCategory;

              return {
                product_code: String(codeIdx >= 0 ? row[codeIdx] : row[0]).trim(),
                product_name: String(nameIdx >= 0 ? row[nameIdx] : row[1]).trim(),
                category: matchedCategoryId,
                cost: Number.isFinite(parsedCost) ? Number(parsedCost) : null,
                price: Number.isFinite(parsedPrice) ? Number(parsedPrice) : null,
                stockQuantity: Number.isFinite(parsedStock) ? Number(parsedStock) : 0,
                isSelling:
                  isSellingIdx >= 0 ? parseExcelBoolean(row[isSellingIdx], true) : true,
                components:
                  componentsIdx >= 0 ? parseComponentCell(row[componentsIdx]) : [],
              };
            });

          if (mapped.length === 0) {
            alert("File Excel không có dòng hàng hoá hợp lệ để import.");
            return;
          }

          await upsertProductsFromExcel(mapped, storeId);
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
      alert("Vui lòng nhập mã và tên hàng hoá.");
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
          price: formState.price.trim() ? parseNumberInput(formState.price) : null,
          category: resolveCategoryId(formState.category),
          has_cost: Boolean(formState.cost.trim()),
          isSelling: true,
          stockQuantity: 0,
          components: payloadComponents,
          storeId,
        });
      } else {
        await updateProductCost(
          editingProductCode,
          {
            productName: formState.name.trim(),
            cost: formState.cost.trim() ? parseNumberInput(formState.cost) : null,
            price: formState.price.trim() ? parseNumberInput(formState.price) : null,
            category: resolveCategoryId(formState.category),
            components: payloadComponents,
          },
          storeId
        );
      }

      await loadProducts();
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Không thể lưu hàng hoá.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productCode: string) {
    if (!window.confirm(`Bạn chắc chắn muốn xoá hàng hoá ${productCode}?`)) {
      return;
    }

    try {
      await deleteProduct(productCode, storeId);
      await loadProducts();
    } catch (error) {
      console.error(error);
      alert("Không thể xoá hàng hoá.");
    }
  }

  async function handleToggleSelling(product: Product) {
    try {
      await setProductSellingStatus(
        product.product_code,
        product.isSelling === false,
        storeId
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
        `Đã chuẩn hoá ${result.updatedProductCount} sản phẩm và tạo ${result.createdCategoryCount} danh mục mới.`
      );
    } catch (error) {
      console.error(error);
      alert("Không thể chuẩn hoá category.");
    } finally {
      setIsNormalizingCategoryRefs(false);
    }
  }

  const actionMenuItems = [
    {
      key: "check",
      icon: ClipboardList,
      label: "Kiểm kho",
      href: "/product/checks",
    },
    {
      key: "receipt",
      icon: PackagePlus,
      label: "Nhập hàng",
      href: "/product/receipts",
    },
    {
      key: "import",
      icon: Upload,
      label: importing ? "Đang import..." : "Import Excel",
      onClick: () => importInputRef.current?.click(),
      disabled: importing,
    },
    {
      key: "categories",
      icon: FolderTree,
      label: "Danh mục",
      href: "/categories",
    },
    {
      key: "normalize",
      icon: RefreshCcw,
      label: isNormalizingCategoryRefs ? "Đang chuẩn hoá..." : "Chuẩn hoá category",
      onClick: handleNormalizeCategoryRefs,
      disabled: isNormalizingCategoryRefs,
    },
  ];

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <main className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
              title="Trở về dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Hàng hoá</h1>
              <p className="mt-1 text-sm text-slate-500">
                Quản lý giá vốn, tồn kho và thành phần cấu thành của từng hàng hoá.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto">
            <Button
              type="button"
              size="icon"
              className="h-11 w-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700"
              onClick={openCreateModal}
              title="Thêm hàng hoá"
            >
              <Plus className="h-5 w-5" />
            </Button>

            <div ref={actionMenuRef} className="relative">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl border-slate-200 px-3"
                onClick={() => setShowActionMenu((current) => !current)}
              >
                <Menu className="h-5 w-5" />
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>

              {showActionMenu ? (
                <div className="absolute right-0 top-[calc(100%+10px)] z-20 min-w-[220px] rounded-3xl border border-slate-200 bg-white p-2 shadow-xl">
                  {actionMenuItems.map((item) => {
                    const Icon = item.icon;

                    if (item.href) {
                      return (
                        <Link
                          key={item.key}
                          href={item.href}
                          onClick={() => setShowActionMenu(false)}
                          className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          <Icon className="h-4 w-4 text-slate-500" />
                          {item.label}
                        </Link>
                      );
                    }

                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setShowActionMenu(false);
                          item.onClick?.();
                        }}
                        disabled={item.disabled}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Icon className="h-4 w-4 text-slate-500" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <input
              ref={importInputRef}
              type="file"
              accept=".xls,.xlsx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  handleImport(file);
                }
                event.target.value = "";
              }}
            />
          </div>
        </div>

        <Card className="rounded-[28px] border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm theo mã hoặc tên hàng hoá"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <select
                value={filterCategory}
                onChange={(event) => setFilterCategory(event.target.value)}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">Tất cả danh mục</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-[28px] border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="bg-sky-50 text-slate-700">
                <tr>
                  <th className="px-5 py-4 text-left font-semibold">Mã hàng hoá</th>
                  <th className="px-5 py-4 text-left font-semibold">Tên hàng</th>
                  <th className="px-5 py-4 text-left font-semibold">Loại thực đơn</th>
                  <th className="px-5 py-4 text-right font-semibold">Giá bán</th>
                  <th className="px-5 py-4 text-right font-semibold">Giá vốn</th>
                  <th className="px-5 py-4 text-right font-semibold">Tồn kho</th>
                  <th className="px-5 py-4 text-right font-semibold">Thành phần</th>
                  <th className="px-5 py-4 text-center font-semibold">Trạng thái</th>
                  <th className="px-5 py-4 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-slate-400">
                      Đang tải dữ liệu hàng hoá...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-slate-400">
                      Không có hàng hoá phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const categoryLabel =
                      categories.find(
                        (category) =>
                          category.id === product.category ||
                          category.name === product.categoryName
                      )?.name ||
                      product.categoryName ||
                      product.category ||
                      "Chưa phân loại";

                    return (
                      <tr key={product.product_code} className="transition hover:bg-slate-50/80">
                        <td className="px-5 py-4 font-mono text-slate-700">
                          {product.product_code}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">{product.product_name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Giá vốn BOM: {formatCurrency(product.componentCostTotal)}đ
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{categoryLabel}</td>
                        <td className="px-5 py-4 text-right text-slate-700">
                          {product.price !== null && product.price !== undefined
                            ? `${formatCurrency(product.price)}đ`
                            : "0đ"}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-900">
                          {product.cost !== null && product.cost !== undefined
                            ? `${formatCurrency(product.cost)}đ`
                            : "0đ"}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-900">
                          {formatQuantity(product.stockQuantity)}
                        </td>
                        <td className="px-5 py-4 text-right text-slate-700">
                          {product.componentCount || 0}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelling(product)}
                            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                              product.isSelling === false
                                ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            }`}
                          >
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${
                                product.isSelling === false ? "bg-slate-400" : "bg-emerald-500"
                              }`}
                            />
                            {product.isSelling === false ? "Tạm dừng" : "Đang bán"}
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-2xl text-slate-500 hover:bg-slate-100"
                              onClick={() => openEditModal(product)}
                              title="Sửa"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-2xl text-rose-600 hover:bg-rose-50"
                              onClick={() => handleDelete(product.product_code)}
                              title="Xoá"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <ProductModal
          open={showModal}
          mode={modalMode}
          form={formState}
          categories={categories}
          products={products}
          saving={saving}
          newCategoryName={newCategoryName}
          componentQuery={componentQuery}
          tab={modalTab}
          onClose={closeModal}
          onSubmit={handleSaveProduct}
          onChange={(patch) => setFormState((current) => ({ ...current, ...patch }))}
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
              components: current.components.filter((component) => component.localId !== localId),
            }))
          }
          onUpdateComponentQuantity={(localId, quantity) =>
            setFormState((current) => ({
              ...current,
              components: current.components.map((component) =>
                component.localId === localId ? { ...component, quantity } : component
              ),
            }))
          }
        />
      </main>
    </RoleGuard>
  );
}
