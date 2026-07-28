"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Ban,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  CircleAlert,
  CircleOff,
  Coffee,
  CookingPot,
  FileUp,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Tractor,
  X,
} from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SelectBox, type SelectBoxOption } from "@/components/ui/SelectBox";
import { paginateItems, sortByCreatedAtDesc } from "@/lib/listPagination";
import {
  parseSampleBillProductWorkbook,
  type ParsedSampleBillProductRow,
} from "@/services/excel";
import {
  createSampleBillProduct,
  deleteSampleBillProduct,
  getSampleBillProducts,
  importSampleBillProducts,
  updateSampleBillProduct,
  type FarmPriceSchedule,
  type SampleBillProduct,
  type SampleBillProductInput,
  type SampleBillType,
} from "@/services/sampleBillProducts";

type Notice = {
  tone: "success" | "warning" | "error";
  title: string;
  detail?: string;
};

type ProductForm = SampleBillProductInput;

type StagedProduct = ParsedSampleBillProductRow & {
  billType: SampleBillType | "";
  farmSchedule: FarmPriceSchedule;
  minQuantity: number;
  maxQuantity: number;
};

const billTypeLabels: Record<SampleBillType, string> = {
  coffee: "Nước",
  hotpot: "Lẩu",
  farm: "Farm",
};

const scheduleLabels: Record<FarmPriceSchedule, string> = {
  none: "Không áp dụng",
  weekday: "Ngày thường",
  weekend_holiday: "Cuối tuần / lễ",
  both: "Cả hai",
};

const typeBadgeClasses: Record<SampleBillType, string> = {
  coffee: "bg-sky-100 text-sky-800",
  hotpot: "bg-rose-100 text-rose-800",
  farm: "bg-emerald-100 text-emerald-800",
};

const billTypeOptions: readonly SelectBoxOption<SampleBillType>[] = [
  { value: "coffee", label: billTypeLabels.coffee, icon: Coffee },
  { value: "hotpot", label: billTypeLabels.hotpot, icon: CookingPot },
  { value: "farm", label: billTypeLabels.farm, icon: Tractor },
];

const billTypeFilterOptions: readonly SelectBoxOption<
  "all" | SampleBillType
>[] = [
  { value: "all", label: "Tất cả loại", icon: Layers3 },
  ...billTypeOptions,
];

const statusFilterOptions: readonly SelectBoxOption<
  "all" | "active" | "inactive"
>[] = [
  { value: "all", label: "Tất cả trạng thái", icon: Layers3 },
  { value: "active", label: "Đang dùng", icon: CheckCircle2 },
  { value: "inactive", label: "Tạm ẩn", icon: CircleOff },
];

const farmScheduleOptions: readonly SelectBoxOption<FarmPriceSchedule>[] = [
  { value: "none", label: scheduleLabels.none, icon: Ban },
  { value: "weekday", label: scheduleLabels.weekday, icon: CalendarDays },
  {
    value: "weekend_holiday",
    label: scheduleLabels.weekend_holiday,
    icon: CalendarCheck2,
  },
  { value: "both", label: scheduleLabels.both, icon: CalendarRange },
];

const activeFarmScheduleOptions = farmScheduleOptions.filter(
  (option) => option.value !== "none",
);

const noticeClasses: Record<Notice["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  error: "border-rose-200 bg-rose-50 text-rose-950",
};

const emptyForm: ProductForm = {
  productCode: "",
  productName: "",
  unit: "",
  price: 0,
  billType: "coffee",
  farmSchedule: "none",
  minQuantity: 4,
  maxQuantity: 10,
  isActive: true,
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi");

const inferQuantityRange = (name: string, billType: SampleBillType) => {
  if (billType !== "farm") {
    return { minQuantity: 4, maxQuantity: 10 };
  }

  const normalized = normalizeText(name);
  if (normalized.includes("80cm") || normalized.includes("ngua")) {
    return { minQuantity: 1, maxQuantity: 1 };
  }
  if (normalized.includes("tre em")) {
    return { minQuantity: 13, maxQuantity: 16 };
  }
  if (normalized.includes("nguoi lon")) {
    return { minQuantity: 7, maxQuantity: 10 };
  }

  return { minQuantity: 1, maxQuantity: 10 };
};

function Modal({
  open,
  title,
  subtitle,
  mode = "default",
  onClose,
  children,
  footer,
  widthClass = "max-w-2xl",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  mode?: "default" | "create" | "edit" | "import";
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  widthClass?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 backdrop-blur-[2px] sm:items-center sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)] sm:rounded-xl ${widthClass}`}
      >
        <header className="flex items-start justify-between bg-[linear-gradient(135deg,#064E3B,#033C2F)] px-5 py-5 text-white sm:px-6">
          <div className="min-w-0">
            {mode !== "default" ? (
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#F6C85F] ring-1 ring-white/15">
                {mode === "create" ? (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Tạo mới
                  </>
                ) : mode === "edit" ? (
                  <>
                    <Pencil className="h-3.5 w-3.5" />
                    Chỉnh sửa
                  </>
                ) : (
                  <>
                    <FileUp className="h-3.5 w-3.5" />
                    Nhập dữ liệu
                  </>
                )}
              </div>
            ) : null}

            <h2 className="truncate text-xl font-bold sm:text-2xl">{title}</h2>

            {subtitle ? (
              <p className="mt-1 text-sm leading-5 text-emerald-100">
                {subtitle}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-emerald-100 transition-[background-color,color,transform] duration-200 hover:bg-white/15 hover:text-[#F6C85F] active:scale-[0.96]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
          {children}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="hidden text-xs text-slate-500 sm:block">
            Kiểm tra kỹ thông tin trước khi lưu.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {footer}
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function SampleBillProductsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<SampleBillProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | SampleBillType>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SampleBillProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [importOpen, setImportOpen] = useState(false);
  const [sourceFileName, setSourceFileName] = useState("");
  const [duplicateCodes, setDuplicateCodes] = useState<string[]>([]);
  const [staging, setStaging] = useState<StagedProduct[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [formError, setFormError] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    try {
      setProducts(await getSampleBillProducts());
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Không tải được DS sản phẩm",
        detail: error instanceof Error ? error.message : "Vui lòng thử lại.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, []);

  const existingByCode = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.productCode.toLocaleLowerCase("vi"),
          product,
        ]),
      ),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi");
    return sortByCreatedAtDesc(
      products.filter((product) => {
        const matchesQuery =
          !normalizedQuery ||
          product.productCode
            .toLocaleLowerCase("vi")
            .includes(normalizedQuery) ||
          product.productName.toLocaleLowerCase("vi").includes(normalizedQuery);
        const matchesType =
          typeFilter === "all" || product.billType === typeFilter;
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && product.isActive) ||
          (statusFilter === "inactive" && !product.isActive);
        return matchesQuery && matchesType && matchesStatus;
      }),
    );
  }, [products, query, statusFilter, typeFilter]);

  const productPage = useMemo(
    () => paginateItems(filteredProducts, currentPage),
    [currentPage, filteredProducts],
  );

  useEffect(() => {
    if (currentPage !== productPage.pagination.currentPage) {
      setCurrentPage(productPage.pagination.currentPage);
    }
  }, [currentPage, productPage.pagination.currentPage]);

  const stats = useMemo(
    () => ({
      total: products.length,
      coffee: products.filter((product) => product.billType === "coffee")
        .length,
      hotpot: products.filter((product) => product.billType === "hotpot")
        .length,
      farm: products.filter((product) => product.billType === "farm").length,
    }),
    [products],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setFormOpen(true);
  };

  const openEdit = (product: SampleBillProduct) => {
    setEditing(product);
    setForm({
      productCode: product.productCode,
      productName: product.productName,
      unit: product.unit,
      price: product.price,
      billType: product.billType,
      farmSchedule: product.farmSchedule,
      minQuantity: product.minQuantity,
      maxQuantity: product.maxQuantity,
      isActive: product.isActive,
    });
    setFormOpen(true);
  };

  const updateFormType = (billType: SampleBillType) => {
    const range = inferQuantityRange(form.productName, billType);
    setForm((current) => ({
      ...current,
      billType,
      farmSchedule: billType === "farm" ? "weekday" : "none",
      ...range,
    }));
  };

  const saveProduct = async () => {
    if (!form.productCode.trim()) {
      setFormError("Vui lòng nhập mã sản phẩm.");
      return;
    }

    if (!form.productName.trim()) {
      setFormError("Vui lòng nhập tên sản phẩm.");
      return;
    }

    if (form.price < 0) {
      setFormError("Đơn giá không được nhỏ hơn 0.");
      return;
    }

    if (form.maxQuantity < form.minQuantity) {
      setFormError(
        "Số lượng tối đa phải lớn hơn hoặc bằng số lượng tối thiểu.",
      );
      return;
    }

    if (form.billType === "farm" && form.farmSchedule === "none") {
      setFormError("Vui lòng chọn lịch giá cho sản phẩm Farm.");
      return;
    }

    setFormError("");

    setSaving(true);
    try {
      const payload: ProductForm = {
        ...form,
        productCode: form.productCode.trim(),
        productName: form.productName.trim(),
        unit: form.unit.trim(),
        farmSchedule: form.billType === "farm" ? form.farmSchedule : "none",
      };
      if (editing) {
        await updateSampleBillProduct(editing.id, payload);
      } else {
        await createSampleBillProduct(payload);
        setCurrentPage(1);
      }
      setFormOpen(false);
      setNotice({
        tone: "success",
        title: editing ? "Đã cập nhật sản phẩm" : "Đã thêm sản phẩm",
      });
      await loadProducts();
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Không lưu được sản phẩm",
        detail: error instanceof Error ? error.message : "Vui lòng thử lại.",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async (product: SampleBillProduct) => {
    if (
      !window.confirm(`Xóa ${product.productName} khỏi DS sản phẩm bill mẫu?`)
    ) {
      return;
    }

    try {
      await deleteSampleBillProduct(product.id);
      setNotice({ tone: "success", title: "Đã xóa sản phẩm" });
      await loadProducts();
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Không xóa được sản phẩm",
        detail: error instanceof Error ? error.message : "Vui lòng thử lại.",
      });
    }
  };

  const toggleProductStatus = async (product: SampleBillProduct) => {
    setUpdatingStatusId(product.id);

    try {
      await updateSampleBillProduct(product.id, {
        productCode: product.productCode,
        productName: product.productName,
        unit: product.unit,
        price: product.price,
        billType: product.billType,
        farmSchedule: product.farmSchedule,
        minQuantity: product.minQuantity,
        maxQuantity: product.maxQuantity,
        isActive: !product.isActive,
      });

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                isActive: !item.isActive,
              }
            : item,
        ),
      );
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Không cập nhật được trạng thái",
        detail: error instanceof Error ? error.message : "Vui lòng thử lại.",
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleFile = async (file: File) => {
    setNotice(null);
    setImportError("");
    try {
      const parsed = await parseSampleBillProductWorkbook(file);
      const normalizedName = normalizeText(file.name);
      const inferredType: SampleBillType | "" = normalizedName.includes("farm")
        ? "farm"
        : "";
      const inferredSchedule: FarmPriceSchedule =
        inferredType === "farm"
          ? normalizedName.includes("ngay_thuong")
            ? "weekday"
            : normalizedName.includes("cuoi_tuan") ||
                normalizedName.includes("le_")
              ? "weekend_holiday"
              : "none"
          : "none";
      const staged = parsed.products.map((product) => ({
        ...product,
        billType: inferredType,
        farmSchedule: inferredSchedule,
        ...inferQuantityRange(product.productName, inferredType || "coffee"),
      }));
      setSourceFileName(parsed.fileName);
      setDuplicateCodes(parsed.duplicateCodes);
      setStaging(staged);
      setImportOpen(true);
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Không đọc được file Excel",
        detail:
          error instanceof Error ? error.message : "Vui lòng kiểm tra file.",
      });
    }
  };

  const updateStage = (index: number, changes: Partial<StagedProduct>) => {
    setStaging((current) =>
      current.map((product, productIndex) =>
        productIndex === index ? { ...product, ...changes } : product,
      ),
    );
  };

  const updateStageType = (index: number, billType: SampleBillType) => {
    const product = staging[index];
    updateStage(index, {
      billType,
      farmSchedule: billType === "farm" ? "weekday" : "none",
      ...inferQuantityRange(product.productName, billType),
    });
  };

  const applyBulkType = (billType: SampleBillType) => {
    setStaging((current) =>
      current.map((product) => ({
        ...product,
        billType,
        farmSchedule: billType === "farm" ? "weekday" : "none",
        ...inferQuantityRange(product.productName, billType),
      })),
    );
  };

  const applyBulkSchedule = (farmSchedule: FarmPriceSchedule) => {
    setStaging((current) =>
      current.map((product) =>
        product.billType === "farm" ? { ...product, farmSchedule } : product,
      ),
    );
  };

  const getStageState = (product: StagedProduct) => {
    const existing = existingByCode.get(
      product.productCode.toLocaleLowerCase("vi"),
    );
    const conflict =
      existing &&
      existing.billType === "farm" &&
      product.billType === "farm" &&
      existing.farmSchedule !== product.farmSchedule &&
      existing.farmSchedule !== "both" &&
      product.farmSchedule !== "both" &&
      existing.price !== product.price;

    if (conflict) return "conflict";
    return existing ? "update" : "new";
  };

  const importInvalid =
    duplicateCodes.length > 0 ||
    staging.length === 0 ||
    staging.some(
      (product) =>
        !product.billType ||
        product.minQuantity < 1 ||
        product.maxQuantity < product.minQuantity ||
        (product.billType === "farm" && product.farmSchedule === "none") ||
        getStageState(product) === "conflict",
    );

  const confirmImport = async () => {
    if (importInvalid) return;

    setImportError("");
    setImporting(true);
    try {
      const result = await importSampleBillProducts(
        staging.map((product) => ({
          productCode: product.productCode,
          productName: product.productName,
          unit: product.unit,
          price: product.price,
          billType: product.billType as SampleBillType,
          farmSchedule:
            product.billType === "farm" ? product.farmSchedule : "none",
          minQuantity: product.minQuantity,
          maxQuantity: product.maxQuantity,
          isActive: true,
        })),
      );
      setImportError("");
      setImportOpen(false);
      setNotice({
        tone: "success",
        title: "Đã nhập DS sản phẩm",
        detail: `Thêm mới ${result.created}, cập nhật ${result.updated}.`,
      });
      if (result.created > 0) setCurrentPage(1);
      await loadProducts();
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Vui lòng kiểm tra dữ liệu.";
      setImportError(detail);
      setNotice({
        tone: "error",
        title: "Không nhập được sản phẩm",
        detail,
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <RoleGuard allowedRoles={["admin"]} permission="sample_bills.access">
      <main className="min-h-screen bg-slate-50 text-slate-950 antialiased">
        <div className="mx-auto max-w-[1520px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <header className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-smooch text-5xl text-emerald-800 font-bold">
                Danh sách sản phẩm tạo bill
              </h1>
              <p className="font-firasans text-[#d6ba5d] font-bold mt-1 text-pretty text-sm">
                Kho dữ liệu riêng cho bill mẫu
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                  event.target.value = "";
                }}
              />
              <Button
                variant="outline"
                className="h-10 gap-1.5 rounded-[2px] border-2 border-slate-900 bg-white px-3 text-sm font-semibold text-slate-900 shadow-[4px_4px_0_#0f172a] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900 hover:shadow-[6px_6px_0_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:scale-100 active:shadow-[2px_2px_0_#0f172a]"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-3.5 w-3.5 shrink-0" />
                Upload Excel
              </Button>

              <Button
                className="h-10 gap-1.5 rounded-[2px] border-2 border-slate-900 bg-emerald-700 px-3 text-sm font-semibold text-white shadow-[4px_4px_0_#0f172a] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-emerald-800 hover:text-white hover:shadow-[6px_6px_0_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:scale-100 active:shadow-[2px_2px_0_#0f172a]"
                onClick={openCreate}
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                Thêm sản phẩm
              </Button>
            </div>
          </header>

          <section className="overflow-hidden rounded border border-slate-200 bg-white">
            <div className="grid grid-cols-2 border-b border-slate-200 lg:grid-cols-4">
              {[
                ["Tổng sản phẩm", stats.total],
                ["Nước", stats.coffee],
                ["Lẩu", stats.hotpot],
                ["Farm", stats.farm],
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
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Tìm mã hoặc tên sản phẩm"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <SelectBox
                  ariaLabel="Lọc loại sản phẩm"
                  value={typeFilter}
                  options={billTypeFilterOptions}
                  onValueChange={(nextValue) => {
                    setTypeFilter(nextValue);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-[180px]"
                />
                <SelectBox
                  ariaLabel="Lọc trạng thái"
                  value={statusFilter}
                  options={statusFilterOptions}
                  onValueChange={(nextValue) => {
                    setStatusFilter(nextValue);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-[204px]"
                />
              </div>
            </div>

            {notice ? (
              <div
                aria-live="polite"
                className={`m-4 rounded-lg border px-4 py-3 lg:m-5 ${noticeClasses[notice.tone]}`}
              >
                <p className="text-sm font-semibold">{notice.title}</p>
                {notice.detail ? (
                  <p className="mt-1 text-xs leading-5 opacity-80">
                    {notice.detail}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Mã</th>
                    <th className="px-4 py-3">Tên sản phẩm</th>
                    <th className="px-4 py-3">Loại</th>
                    <th className="px-4 py-3">Lịch giá Farm</th>
                    <th className="px-4 py-3 text-right">Đơn giá</th>
                    <th className="px-4 py-3 text-center">Số lượng</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="w-28 px-4 py-3 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-14 text-center text-slate-600"
                      >
                        Đang tải dữ liệu...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-14 text-center">
                        <CircleAlert className="mx-auto h-6 w-6 text-slate-400" />
                        <p className="mt-2 font-medium">
                          Chưa có sản phẩm phù hợp
                        </p>
                      </td>
                    </tr>
                  ) : (
                    productPage.items.map((product) => (
                      <tr
                        key={product.id}
                        className="bg-white hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 font-semibold">
                          {product.productCode}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{product.productName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {product.unit || "Chưa có đơn vị"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${typeBadgeClasses[product.billType]}`}
                          >
                            {billTypeLabels[product.billType]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {scheduleLabels[product.farmSchedule]}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatCurrency(product.price)}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums">
                          {product.minQuantity}–{product.maxQuantity}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={updatingStatusId === product.id}
                            onClick={() => void toggleProductStatus(product)}
                            aria-label={
                              product.isActive
                                ? `Tạm ẩn ${product.productName}`
                                : `Bật sử dụng ${product.productName}`
                            }
                            title={
                              product.isActive
                                ? "Click để tạm ẩn"
                                : "Click để bật sử dụng"
                            }
                            className={`group inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold transition-[background-color,color,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                              product.isActive
                                ? "bg-emerald-800 text-[#F6C85F] hover:bg-[#F6C85F] hover:text-emerald-900 active:scale-[0.96]"
                                : "bg-slate-200 text-slate-700 hover:bg-slate-700 hover:text-white active:scale-[0.96]"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full transition-colors duration-200 ${
                                product.isActive
                                  ? "bg-[#F6C85F] group-hover:bg-emerald-900"
                                  : "bg-slate-500 group-hover:bg-white"
                              }`}
                            />

                            {updatingStatusId === product.id
                              ? "Đang cập nhật"
                              : product.isActive
                                ? "Đang dùng"
                                : "Tạm ẩn"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(product)}
                              aria-label={`Sửa ${product.productName}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-emerald-700 transition-[background-color,color,transform,box-shadow] duration-200 hover:bg-emerald-800 hover:text-[#F6C85F] hover:shadow-sm active:scale-[0.96]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeProduct(product)}
                              aria-label={`Xóa ${product.productName}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-rose-600 transition-[background-color,color,transform] hover:bg-rose-600 hover:text-white active:scale-[0.96]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
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

      <Modal
        open={formOpen}
        title={editing ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}
        subtitle={
          editing
            ? `${form.productName || "Sản phẩm"} · ${form.productCode}`
            : "Khai báo thông tin và quy tắc sử dụng trong bill mẫu."
        }
        mode={editing ? "edit" : "create"}
        onClose={() => {
          if (saving) return;
          setFormOpen(false);
        }}
        widthClass="max-w-3xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setFormOpen(false)}
              className="h-10 min-w-[96px] rounded-md border-slate-300 bg-white px-5 font-semibold text-slate-800 shadow-none hover:bg-slate-100"
            >
              Hủy
            </Button>

            <Button
              type="button"
              disabled={saving}
              onClick={() => void saveProduct()}
              className="h-10 min-w-[160px] gap-2 whitespace-nowrap rounded-md bg-emerald-800 px-5 font-semibold text-[#F6C85F] shadow-none transition-[background-color,color,transform] hover:bg-[#F6C85F] hover:text-emerald-900 active:scale-[0.97]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}

              {editing ? "Lưu thay đổi" : "Thêm sản phẩm"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {formError ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{formError}</p>
            </div>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[5px_7px_14px_rgba(15,23,42,0.10)] sm:p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Thông tin cơ bản
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Mã, tên và đơn vị dùng để nhận diện sản phẩm.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Mã sản phẩm"
                value={form.productCode}
                disabled={Boolean(editing)}
                placeholder="VD: SP000001"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    productCode: event.target.value,
                  }))
                }
              />

              <Input
                label="Tên sản phẩm"
                value={form.productName}
                placeholder="VD: Cà phê sữa"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    productName: event.target.value,
                  }))
                }
              />

              <Input
                label="Đơn vị"
                value={form.unit}
                placeholder="VD: Ly, phần, vé"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    unit: event.target.value,
                  }))
                }
              />

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-900">
                  Đơn giá
                </label>

                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        price: Number(event.target.value) || 0,
                      }))
                    }
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 pr-10 text-sm font-semibold tabular-nums text-slate-900 outline-none transition-[border-color,box-shadow] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />

                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                    đ
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[5px_7px_14px_rgba(15,23,42,0.10)] sm:p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Phân loại bill
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Chọn khu vực áp dụng và lịch giá tương ứng.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-slate-900">
                  Loại bill
                </span>

                <SelectBox<SampleBillType>
                  ariaLabel="Loại bill"
                  value={form.billType}
                  options={billTypeOptions}
                  onValueChange={updateFormType}
                  className="w-full"
                  triggerClassName="h-10 rounded-md border-slate-300 bg-white font-medium text-slate-800 shadow-none hover:bg-emerald-50/50 focus-visible:ring-2 focus-visible:ring-emerald-100"
                />
              </div>

              <div
                className={`space-y-1.5 transition-opacity ${
                  form.billType === "farm" ? "opacity-100" : "opacity-55"
                }`}
              >
                <span className="text-sm font-medium text-slate-900">
                  Lịch giá Farm
                </span>

                <SelectBox<FarmPriceSchedule>
                  ariaLabel="Lịch giá Farm"
                  value={form.farmSchedule}
                  options={farmScheduleOptions}
                  disabled={form.billType !== "farm"}
                  onValueChange={(nextValue) =>
                    setForm((current) => ({
                      ...current,
                      farmSchedule: nextValue,
                    }))
                  }
                  className="w-full"
                  triggerClassName="h-10 rounded-md border-slate-300 bg-white font-medium text-slate-800 shadow-none hover:bg-emerald-50/50 focus-visible:ring-2 focus-visible:ring-emerald-100"
                />

                {form.billType !== "farm" ? (
                  <p className="text-xs text-slate-500">
                    Chỉ áp dụng cho sản phẩm Farm.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[5px_7px_14px_rgba(15,23,42,0.10)] sm:p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Quy tắc số lượng
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Khoảng số lượng được phép sử dụng khi hệ thống tạo bill mẫu.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Số lượng tối thiểu"
                type="number"
                min={1}
                value={form.minQuantity}
                className="tabular-nums"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    minQuantity: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
              />

              <Input
                label="Số lượng tối đa"
                type="number"
                min={1}
                value={form.maxQuantity}
                className="tabular-nums"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxQuantity: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
              />
            </div>

            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
              Hệ thống sẽ tạo số lượng ngẫu nhiên từ{" "}
              <strong>{form.minQuantity}</strong> đến{" "}
              <strong>{form.maxQuantity}</strong>.
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[5px_7px_14px_rgba(15,23,42,0.10)] sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Trạng thái sử dụng
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Sản phẩm tạm ẩn sẽ không được dùng khi tạo bill.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={form.isActive}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    isActive: !current.isActive,
                  }))
                }
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 ${
                  form.isActive ? "bg-emerald-700" : "bg-slate-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    form.isActive ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div
              className={`mt-3 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold ${
                form.isActive
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  form.isActive ? "bg-emerald-600" : "bg-slate-500"
                }`}
              />

              {form.isActive ? "Đang sử dụng" : "Tạm ẩn"}
            </div>
          </section>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        title={`Phân loại trước khi nhập · ${sourceFileName}`}
        onClose={() => {
          if (importing) return;
          setImportOpen(false);
          setImportError("");
        }}
        widthClass="max-w-6xl"
        footer={
          <>
            <Button
              variant="outline"
              className="h-10"
              disabled={importing}
              onClick={() => {
                setImportOpen(false);
                setImportError("");
              }}
            >
              Hủy
            </Button>
            <Button
              className="h-10 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={importing || importInvalid}
              onClick={() => void confirmImport()}
            >
              {importing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Xác nhận nhập {staging.length} sản phẩm
            </Button>
          </>
        }
      >
        <div className="mb-4 flex flex-col gap-3 rounded-lg bg-slate-50 p-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold">Gán hàng loạt</p>
            <p className="mt-1 text-xs text-slate-600">
              Mọi dòng phải có đúng một loại trước khi lưu
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["coffee", "hotpot", "farm"] as SampleBillType[]).map((type) => {
              const Icon =
                type === "coffee"
                  ? Coffee
                  : type === "hotpot"
                    ? CookingPot
                    : Tractor;
              return (
                <Button
                  key={type}
                  variant="outline"
                  className="h-10 gap-2 bg-white"
                  onClick={() => applyBulkType(type)}
                >
                  <Icon className="h-4 w-4" />
                  {billTypeLabels[type]}
                </Button>
              );
            })}
            <SelectBox<FarmPriceSchedule | "">
              ariaLabel="Gán lịch giá Farm hàng loạt"
              value=""
              placeholder="Lịch giá Farm"
              options={activeFarmScheduleOptions}
              onValueChange={(nextValue) => {
                if (nextValue) applyBulkSchedule(nextValue);
              }}
              className="w-full sm:w-[196px]"
            />
          </div>
        </div>

        {importError ? (
          <div
            aria-live="assertive"
            className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950"
          >
            <p className="font-semibold">Không nhập được danh sách sản phẩm</p>
            <p className="mt-1 break-words text-xs leading-5">{importError}</p>
          </div>
        ) : null}

        {duplicateCodes.length > 0 ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            Mã bị trùng trong file: {duplicateCodes.join(", ")}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[1040px] border-collapse text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-700">
              <tr>
                <th className="px-3 py-3">Mã / Tên</th>
                <th className="px-3 py-3 text-right">Đơn giá</th>
                <th className="px-3 py-3">Loại</th>
                <th className="px-3 py-3">Lịch giá Farm</th>
                <th className="px-3 py-3 text-center">Min</th>
                <th className="px-3 py-3 text-center">Max</th>
                <th className="px-3 py-3">Thay đổi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staging.map((product, index) => {
                const state = getStageState(product);
                return (
                  <tr key={`${product.productCode}-${product.sourceRowNumber}`}>
                    <td className="px-3 py-3">
                      <p className="font-semibold">{product.productCode}</p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {product.productName}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="px-3 py-3">
                      <SelectBox<SampleBillType | "">
                        ariaLabel={`Loại bill của ${product.productName}`}
                        value={product.billType}
                        placeholder="Chọn loại"
                        options={billTypeOptions}
                        onValueChange={(nextValue) => {
                          if (nextValue) updateStageType(index, nextValue);
                        }}
                        className="min-w-32"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <SelectBox
                        ariaLabel={`Lịch giá Farm của ${product.productName}`}
                        value={product.farmSchedule}
                        placeholder="Chọn lịch giá"
                        options={activeFarmScheduleOptions}
                        disabled={product.billType !== "farm"}
                        onValueChange={(nextValue) =>
                          updateStage(index, { farmSchedule: nextValue })
                        }
                        className="min-w-44"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min={1}
                        value={product.minQuantity}
                        onChange={(event) =>
                          updateStage(index, {
                            minQuantity: Math.max(
                              1,
                              Number(event.target.value) || 1,
                            ),
                          })
                        }
                        className="h-10 w-20 rounded-md border border-slate-300 px-2 text-center tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min={1}
                        value={product.maxQuantity}
                        onChange={(event) =>
                          updateStage(index, {
                            maxQuantity: Math.max(
                              1,
                              Number(event.target.value) || 1,
                            ),
                          })
                        }
                        className="h-10 w-20 rounded-md border border-slate-300 px-2 text-center tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          state === "conflict"
                            ? "text-xs font-bold text-rose-700"
                            : state === "update"
                              ? "text-xs font-bold text-amber-700"
                              : "text-xs font-bold text-emerald-700"
                        }
                      >
                        {state === "conflict"
                          ? "Xung đột giá"
                          : state === "update"
                            ? "Cập nhật"
                            : "Thêm mới"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {importInvalid ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Hoàn tất phân loại, lịch giá và khoảng số lượng trước khi xác nhận.
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Dữ liệu sẵn sàng để nhập
          </div>
        )}
      </Modal>
    </RoleGuard>
  );
}
