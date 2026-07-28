"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  exportSampleBills,
  getSampleBillProducts,
  type FarmPriceSchedule,
  type SampleBillType,
} from "@/services/sampleBillProducts";

import {
  analyzeVirtualBillFeasibility,
  DEFAULT_MAX_BILL_TOTAL,
  generateSampleBills,
  type VirtualBill,
  type VirtualBillProductRule,
  type VirtualBillProduct,
} from "@/services/virtualBillGenerator";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SingleDatePicker } from "@/components/ui/SingleDatePicker";
import { SelectBox, type SelectBoxOption } from "@/components/ui/SelectBox";
import RoleGuard from "@/components/RoleGuard";
import {
  CheckCircle2,
  Coffee,
  CookingPot,
  Tractor,
  Download,
  FileSpreadsheet,
  Loader2,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

type FormState = {
  date: string;
  totalRevenue: string;
  minQuantity: string;
  maxQuantity: string;
};

type BillRow = {
  billCode: string;
  customerName: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type NoticeState = {
  tone: "success" | "warning" | "error" | "info";
  title: string;
  detail?: string;
};

type ProductFilter = "all" | "selected";

const productFilterOptions: readonly SelectBoxOption<ProductFilter>[] = [
  { value: "all", label: "Tất cả", icon: SlidersHorizontal },
  { value: "selected", label: "Đã chọn", icon: CheckCircle2 },
];

type WorkspaceTab = "products" | "bills";
type CatalogProduct = VirtualBillProduct & {
  id: string;
  minQuantity: number;
  maxQuantity: number;
  farmSchedule: FarmPriceSchedule;
};

const pageConfig: Record<
  SampleBillType,
  {
    title: string;
    description: string;
    icon: typeof Coffee;
  }
> = {
  coffee: {
    title: "Tạo bill mẫu nước",
    description: "Danh mục quầy nước",
    icon: Coffee,
  },
  hotpot: {
    title: "Tạo bill mẫu lẩu",
    description: "Danh mục lẩu và bếp",
    icon: CookingPot,
  },
  farm: {
    title: "Tạo bill mẫu farm",
    description: "Danh mục vé và dịch vụ Farm",
    icon: Tractor,
  },
};

const isWeekendDate = (date: string) => {
  if (!date) return false;
  const day = new Date(`${date}T12:00:00`).getDay();
  return day === 0 || day === 6;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

const parseMoney = (value: string) => {
  const amount = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
};

const formatMoneyInput = (value: string) => {
  const amount = parseMoney(value);
  return amount > 0 ? formatCurrency(amount) : "";
};

const formatDateInput = (date: Date) => {
  const local = new Date(date.getTime());
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().split("T")[0];
};

const buildBillRows = (bills: VirtualBill[]): BillRow[] =>
  bills.flatMap((bill) =>
    bill.items.map((item) => ({
      billCode: bill.billCode,
      customerName: "Khách hàng lẻ",
      productCode: item.productCode,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
  );

const noticeClasses: Record<NoticeState["tone"], string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  error: "border-rose-200 bg-rose-50 text-rose-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

const statusClasses = {
  matched: "bg-emerald-100 text-emerald-800",
  short: "bg-amber-100 text-amber-900",
  over: "bg-rose-100 text-rose-800",
  pending: "bg-slate-100 text-slate-600",
};

export default function SampleBillGeneratorPage({
  billType = "coffee",
}: {
  billType?: SampleBillType;
}) {
  const config = pageConfig[billType];
  const PageIcon = config.icon;
  const today = formatDateInput(new Date());

  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [rules, setRules] = useState<Record<string, VirtualBillProductRule>>(
    {},
  );
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [holidayOverride, setHolidayOverride] = useState(false);
  const [form, setForm] = useState<FormState>({
    date: today,
    totalRevenue: "",
    minQuantity: "4",
    maxQuantity: "10",
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [tab, setTab] = useState<WorkspaceTab>("products");
  const [activeBill, setActiveBill] = useState("all");
  const [bills, setBills] = useState<VirtualBill[]>([]);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const clearResults = () => {
    setBills([]);
    setActiveBill("all");
  };

  useEffect(() => {
    let active = true;

    const loadCatalog = async () => {
      setCatalogLoading(true);
      try {
        const items = await getSampleBillProducts(billType);
        if (!active) return;
        const mapped: CatalogProduct[] = items.map((product) => ({
          id: product.id,
          product_code: product.productCode,
          product_name: product.productName,
          price: product.price,
          isSelling: product.isActive,
          minQuantity: product.minQuantity,
          maxQuantity: product.maxQuantity,
          farmSchedule: product.farmSchedule,
        }));
        setCatalog(mapped);
        setRules(
          Object.fromEntries(
            mapped.map((product) => [
              product.product_code,
              {
                minQuantity: product.minQuantity,
                maxQuantity: product.maxQuantity,
              },
            ]),
          ),
        );
        setSelectedCodes(
          mapped
            .filter((product) => product.isSelling !== false)
            .map((product) => product.product_code),
        );
      } catch (error) {
        console.error(error);
        if (active) {
          setNotice({
            tone: "error",
            title: "Không tải được danh mục sản phẩm",
            detail:
              error instanceof Error
                ? error.message
                : "Vui lòng mở DS sản phẩm để kiểm tra dữ liệu.",
          });
        }
      } finally {
        if (active) setCatalogLoading(false);
      }
    };

    void loadCatalog();
    return () => {
      active = false;
    };
  }, [billType]);

  const weekend = isWeekendDate(form.date);
  const activeFarmSchedule: FarmPriceSchedule =
    weekend || holidayOverride ? "weekend_holiday" : "weekday";
  const eligibleCatalog = useMemo(
    () =>
      catalog.filter(
        (product) =>
          product.isSelling !== false &&
          (billType !== "farm" ||
            product.farmSchedule === activeFarmSchedule ||
            product.farmSchedule === "both"),
      ),
    [activeFarmSchedule, billType, catalog],
  );
  const eligibleKey = eligibleCatalog
    .map((product) => product.product_code)
    .join("|");

  useEffect(() => {
    const eligibleCodes = eligibleCatalog.map(
      (product) => product.product_code,
    );
    setSelectedCodes((current) => {
      const kept = current.filter((code) => eligibleCodes.includes(code));
      return kept.length > 0 ? kept : eligibleCodes;
    });
    setBills([]);
    setActiveBill("all");
  }, [eligibleKey]);

  const selectedSet = useMemo(() => new Set(selectedCodes), [selectedCodes]);
  const selectedProducts = useMemo(
    () =>
      eligibleCatalog.filter((product) =>
        selectedSet.has(product.product_code),
      ),
    [eligibleCatalog, selectedSet],
  );
  const minQuantity = Math.max(1, Number(form.minQuantity) || 4);
  const maxQuantity = Math.max(minQuantity, Number(form.maxQuantity) || 10);
  const targetRevenue = parseMoney(form.totalRevenue);
  const selectedRules = useMemo(
    () =>
      Object.fromEntries(
        selectedProducts.map((product) => [
          product.product_code,
          rules[product.product_code] || {
            minQuantity,
            maxQuantity,
          },
        ]),
      ),
    [maxQuantity, minQuantity, rules, selectedProducts],
  );
  const feasibility = useMemo(
    () =>
      analyzeVirtualBillFeasibility({
        totalRevenue: targetRevenue,
        products: selectedProducts,
        minQuantity,
        maxQuantity,
        productRules: selectedRules,
        maxBillTotal: DEFAULT_MAX_BILL_TOTAL,
      }),
    [maxQuantity, minQuantity, selectedProducts, selectedRules, targetRevenue],
  );
  const rows = useMemo(() => buildBillRows(bills), [bills]);
  const generatedTotal = useMemo(
    () => bills.reduce((sum, bill) => sum + bill.total, 0),
    [bills],
  );
  const reconciliation = useMemo(() => {
    if (bills.length === 0) {
      return {
        status: "pending" as const,
        label: "Chưa đối soát",
        delta: 0,
      };
    }

    const delta = generatedTotal - targetRevenue;
    if (delta === 0) {
      return {
        status: "matched" as const,
        label: "Khớp",
        delta,
      };
    }

    return {
      status: delta < 0 ? ("short" as const) : ("over" as const),
      label: delta < 0 ? "Thiếu" : "Vượt",
      delta,
    };
  }, [bills.length, generatedTotal, targetRevenue]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return eligibleCatalog.filter((product) => {
      const matchesFilter =
        filter === "all" || selectedSet.has(product.product_code);
      const matchesSearch =
        !query ||
        product.product_code.toLocaleLowerCase("vi").includes(query) ||
        product.product_name.toLocaleLowerCase("vi").includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [eligibleCatalog, filter, search, selectedSet]);

  const visibleRows = useMemo(
    () =>
      activeBill === "all"
        ? rows
        : rows.filter((row) => row.billCode === activeBill),
    [activeBill, rows],
  );

  const getRule = (productCode: string) =>
    rules[productCode] || { minQuantity, maxQuantity };

  const updateRule = (
    productCode: string,
    field: keyof VirtualBillProductRule,
    value: number,
  ) => {
    const current = getRule(productCode);
    const normalized = Math.max(1, Math.min(99, Math.round(value || 1)));
    const next =
      field === "minQuantity"
        ? {
            minQuantity: normalized,
            maxQuantity: Math.max(normalized, current.maxQuantity),
          }
        : {
            minQuantity: Math.min(current.minQuantity, normalized),
            maxQuantity: normalized,
          };
    setRules((previous) => ({ ...previous, [productCode]: next }));
    clearResults();
  };

  const toggleProduct = (productCode: string) => {
    setSelectedCodes((current) =>
      current.includes(productCode)
        ? current.filter((code) => code !== productCode)
        : [...current, productCode],
    );
    clearResults();
  };

  const toggleAllProducts = () => {
    setSelectedCodes(
      selectedCodes.length === eligibleCatalog.length
        ? []
        : eligibleCatalog.map((product) => product.product_code),
    );
    clearResults();
  };

  const generateForRevenue = async (revenue: number) => {
    if (!form.date || selectedProducts.length === 0) {
      setNotice({
        tone: "error",
        title: !form.date
          ? "Chưa chọn ngày tạo bill"
          : "Cần chọn ít nhất một sản phẩm",
      });
      return;
    }

    setGenerating(true);
    setNotice(null);
    await new Promise((resolve) => window.setTimeout(resolve, 120));

    try {
      const generated = generateSampleBills({
        date: form.date,
        totalRevenue: revenue,
        products: selectedProducts,
        minQuantity,
        maxQuantity,
        productRules: selectedRules,
        maxBillTotal: DEFAULT_MAX_BILL_TOTAL,
      });
      setBills(generated);
      setActiveBill("all");
      setTab("bills");
      setNotice({
        tone: "success",
        title: `Đã tạo ${generated.length} bill mẫu`,
        detail: "Tổng tiền khớp tuyệt đối với doanh thu mục tiêu.",
      });
    } catch (error) {
      console.error(error);
      setNotice({
        tone: "error",
        title: "Không thể tạo bill với cấu hình hiện tại",
        detail:
          error instanceof Error
            ? error.message
            : "Hãy điều chỉnh sản phẩm hoặc giới hạn số lượng.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = () => {
    if (targetRevenue <= 0) {
      setNotice({
        tone: "error",
        title: "Doanh thu mục tiêu phải lớn hơn 0",
      });
      return;
    }
    if (!feasibility.exact) {
      setNotice({
        tone: "warning",
        title: "Không thể khớp tuyệt đối",
        detail: feasibility.nearestTotal
          ? `Phương án gần nhất là ${formatCurrency(
              feasibility.nearestTotal,
            )} VND, chênh ${formatCurrency(
              Math.abs(feasibility.delta),
            )} VND. Phương án này chỉ để tham khảo.`
          : feasibility.reason,
      });
      return;
    }

    void generateForRevenue(targetRevenue);
  };

  const handleExport = async () => {
    if (
      rows.length === 0 ||
      generatedTotal !== targetRevenue ||
      reconciliation.status !== "matched"
    ) {
      setNotice({
        tone: "error",
        title: "Chỉ được xuất file khi đối soát Khớp",
      });
      return;
    }

    setExporting(true);
    try {
      await exportSampleBills({
        billType,
        date: form.date,
        targetRevenue,
        rows,
      });
      setNotice({
        tone: "success",
        title: "Đã xuất file Excel",
        detail: "Các dòng đã được tô màu theo từng bill.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Không xuất được file Excel",
        detail: error instanceof Error ? error.message : "Vui lòng thử lại.",
      });
    } finally {
      setExporting(false);
    }
  };
  const reset = () => {
    setForm({
      date: today,
      totalRevenue: "",
      minQuantity: "4",
      maxQuantity: "10",
    });
    setRules(
      Object.fromEntries(
        catalog.map((product) => [
          product.product_code,
          {
            minQuantity: product.minQuantity,
            maxQuantity: product.maxQuantity,
          },
        ]),
      ),
    );
    setSelectedCodes(eligibleCatalog.map((product) => product.product_code));
    setTab("products");
    setNotice(null);
    clearResults();
  };

  return (
    <RoleGuard allowedRoles={["admin"]} permission="sample_bills.access">
      <main className="min-h-screen bg-slate-50 text-slate-950 antialiased">
        <div className="mx-auto max-w-[1520px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <header className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-[#d6ba5d]">
                <PageIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-balance font-smooch text-4xl text-emerald-800 font-bold">
                    {config.title}
                  </h1>
                  <span className="font-firasans rounded-full bg-slate-200 px-2.5 py-1 text-sm font-bold text-slate-700">
                    Dữ liệu tạm
                  </span>
                </div>
                <p className="font-firasans max-w-2xl text-pretty text-sm leading-6 text-[#d6ba5d] font-bold">
                  {config.description}. Kết quả không được lưu vào database.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="h-9 gap-1.5 self-start rounded-[3px] border border-emerald-600 bg-white px-3 text-sm font-medium text-emerald-800 shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out hover:border-emerald-700 hover:bg-emerald-700 hover:text-white hover:shadow-[0_2px_6px_rgba(15,23,42,0.08)] active:scale-[0.97] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:opacity-100 sm:self-auto"
              disabled={
                exporting ||
                rows.length === 0 ||
                reconciliation.status !== "matched"
              }
              onClick={() => void handleExport()}
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 shrink-0" />
              )}
              Xuất Excel
            </Button>
          </header>

          <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-stretch">
            <aside className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-emerald-700" />
                  <h2 className="font-semibold">Thiết lập dữ liệu</h2>
                </div>
              </div>

              <div className="space-y-5 p-5">
                <Link
                  href="/sample-bills/products"
                  className="flex min-h-16 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 transition-[transform,background-color,border-color] hover:border-emerald-300 hover:bg-emerald-50 active:scale-[0.96]"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-emerald-700 shadow-sm">
                    <PackageCheck className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      DS sản phẩm
                    </span>
                    <span className="mt-0.5 block text-xs tabular-nums text-slate-600">
                      {eligibleCatalog.length} sản phẩm phù hợp
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-emerald-700">
                    Quản lý
                  </span>
                </Link>

                <section className="space-y-4">
                  <SingleDatePicker
                    label="Ngày tạo bill"
                    value={form.date}
                    onChange={(date) => {
                      setForm((current) => ({
                        ...current,
                        date,
                      }));
                      clearResults();
                      setHolidayOverride(false);
                    }}
                  />
                  {billType === "farm" ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {activeFarmSchedule === "weekday"
                              ? "Giá ngày thường"
                              : "Giá cuối tuần / lễ"}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            {weekend
                              ? "Tự động theo ngày cuối tuần"
                              : holidayOverride
                                ? "Đã đánh dấu ngày lễ"
                                : "Ngày trong tuần"}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-label="Đánh dấu ngày lễ"
                          aria-checked={holidayOverride}
                          disabled={weekend}
                          onClick={() => {
                            setHolidayOverride((current) => !current);
                            clearResults();
                          }}
                          className={`group relative h-7 w-12 shrink-0 rounded-full border transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-100 ${
                            holidayOverride || weekend
                              ? "border-emerald-800 bg-emerald-700 shadow-[0_2px_6px_rgba(4,120,87,0.28)] hover:bg-emerald-800"
                              : "border-slate-300 bg-slate-300 shadow-inner hover:border-slate-400 hover:bg-slate-400"
                          } ${weekend ? "cursor-not-allowed border-emerald-700 bg-emerald-700" : ""}`}
                        >
                          <span
                            className={`pointer-events-none absolute top-[3px] flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-[0_1px_4px_rgba(15,23,42,0.3)] transition-[transform,box-shadow] duration-200 ease-out group-hover:shadow-[0_2px_6px_rgba(15,23,42,0.35)] ${
                              holidayOverride || weekend
                                ? "translate-x-[25px]"
                                : "translate-x-[3px]"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-1">
                    <label
                      htmlFor="target-revenue"
                      className="text-sm font-medium"
                    >
                      Tổng doanh thu mục tiêu
                    </label>
                    <div className="relative">
                      <input
                        id="target-revenue"
                        type="text"
                        inputMode="numeric"
                        placeholder="0"
                        value={formatMoneyInput(form.totalRevenue)}
                        onChange={(event) => {
                          setForm((current) => ({
                            ...current,
                            totalRevenue: event.target.value.replace(
                              /[^\d]/g,
                              "",
                            ),
                          }));
                          clearResults();
                        }}
                        className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 pr-12 text-sm font-semibold tabular-nums outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                        VND
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="text-sm font-medium">
                        Số lượng mỗi món
                      </label>
                      <span className="text-right text-xs text-slate-500">
                        Chỉnh riêng trong bảng
                      </span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                      <Input
                        label="Tối thiểu"
                        type="number"
                        min={1}
                        max={99}
                        value={form.minQuantity}
                        className="tabular-nums"
                        onChange={(event) => {
                          setForm((current) => ({
                            ...current,
                            minQuantity: event.target.value.replace(
                              /[^\d]/g,
                              "",
                            ),
                          }));
                          clearResults();
                        }}
                      />
                      <span className="pb-3 text-slate-400">–</span>
                      <Input
                        label="Tối đa"
                        type="number"
                        min={1}
                        max={99}
                        value={form.maxQuantity}
                        className="tabular-nums"
                        onChange={(event) => {
                          setForm((current) => ({
                            ...current,
                            maxQuantity: event.target.value.replace(
                              /[^\d]/g,
                              "",
                            ),
                          }));
                          clearResults();
                        }}
                      />
                    </div>
                  </div>
                </section>

                <div
                  className={`rounded-lg border px-3.5 py-3 ${
                    targetRevenue <= 0
                      ? "border-slate-200 bg-slate-50"
                      : feasibility.exact
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {targetRevenue <= 0 ? (
                      <Sparkles className="mt-0.5 h-4 w-4 text-slate-500" />
                    ) : feasibility.exact ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />
                    ) : (
                      <TriangleAlert className="mt-0.5 h-4 w-4 text-amber-700" />
                    )}
                    <div>
                      <p className="text-sm font-semibold">
                        {targetRevenue <= 0
                          ? "Chờ doanh thu mục tiêu"
                          : feasibility.exact
                            ? "Có thể khớp tuyệt đối"
                            : "Cần phương án gần nhất"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {targetRevenue <= 0
                          ? "Số bill sẽ xuất hiện sau khi nhập doanh thu."
                          : `Ước tính ${feasibility.estimatedBillCount} bill từ ${feasibility.selectedProductCount} sản phẩm đã chọn.`}
                      </p>
                    </div>
                  </div>
                </div>

                {notice ? (
                  <div
                    aria-live="polite"
                    className={`rounded-lg border px-3.5 py-3 ${noticeClasses[notice.tone]}`}
                  >
                    <p className="text-sm font-semibold">{notice.title}</p>
                    {notice.detail ? (
                      <p className="mt-1 text-xs leading-5 opacity-80">
                        {notice.detail}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <Button
                    className="h-9 flex-1 gap-1.5 rounded-[3px] border border-emerald-700 bg-emerald-700 px-3 text-sm font-semibold text-white shadow-[0_2px_5px_rgba(4,120,87,0.18)] transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out hover:border-emerald-800 hover:bg-emerald-800 hover:text-white hover:shadow-[0_3px_8px_rgba(4,120,87,0.24)] active:scale-[0.97] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:opacity-100"
                    onClick={handleGenerate}
                    isLoading={generating}
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    Tạo bill mẫu
                  </Button>

                  <Button
                    variant="outline"
                    className="group h-9 flex-1 gap-1.5 rounded-[3px] border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-none transition-[background-color,border-color,color,transform] duration-200 ease-out hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 active:scale-[0.97]"
                    onClick={reset}
                  >
                    <RotateCcw className="h-3.5 w-3.5 shrink-0 transition-transform duration-500 ease-out group-hover:rotate-[-180deg]" />
                    Đặt lại
                  </Button>
                </div>
              </div>
            </aside>

            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white xl:h-0 xl:min-h-full">
              <div className="grid grid-cols-2 border-b border-slate-200 lg:grid-cols-4">
                {[
                  ["Mục tiêu", `${formatCurrency(targetRevenue)} VND`],
                  ["Đã tạo", `${formatCurrency(generatedTotal)} VND`],
                  [
                    "Số bill",
                    String(bills.length || feasibility.estimatedBillCount || 0),
                  ],
                ].map(([label, value], index) => (
                  <div
                    key={label}
                    className={`group relative bg-white px-4 py-4 transition-[transform,box-shadow,background-color] duration-300 ease-out hover:z-10 hover:-translate-y-1 hover:bg-emerald-50/40 hover:shadow-[0_14px_30px_rgba(15,23,42,0.14)] lg:px-5 ${
                      index > 0 ? "border-l border-slate-200" : ""
                    } ${
                      index === 2
                        ? "border-t border-slate-200 lg:border-t-0"
                        : ""
                    }`}
                  >
                    <p className="text-xs font-medium text-slate-500 transition-colors duration-300 group-hover:text-emerald-700">
                      {label}
                    </p>

                    <p className="mt-1 truncate text-base font-bold tabular-nums text-slate-950 transition-colors duration-300 group-hover:text-emerald-800">
                      {value}
                    </p>
                  </div>
                ))}

                <div className="group relative border-l border-t border-slate-200 bg-white px-4 py-4 transition-[transform,box-shadow,background-color] duration-300 ease-out hover:z-10 hover:-translate-y-1 hover:bg-emerald-50/40 hover:shadow-[0_14px_30px_rgba(15,23,42,0.14)] lg:border-t-0 lg:px-5">
                  <p className="text-xs font-medium text-slate-500 transition-colors duration-300 group-hover:text-emerald-700">
                    Đối soát
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold transition-[transform,box-shadow] duration-300 group-hover:scale-[1.03] group-hover:shadow-sm ${statusClasses[reconciliation.status]}`}
                    >
                      {reconciliation.label}
                    </span>

                    {reconciliation.delta !== 0 ? (
                      <span className="text-xs font-semibold tabular-nums text-slate-600 transition-colors duration-300 group-hover:text-emerald-800">
                        {reconciliation.delta > 0 ? "+" : "-"}
                        {formatCurrency(Math.abs(reconciliation.delta))}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 border-b border-slate-200 px-4 pt-2 sm:px-5">
                {(["products", "bills"] as WorkspaceTab[]).map((item) => {
                  const active = tab === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTab(item)}
                      className={`relative min-h-11 px-3 text-sm font-semibold transition-colors ${
                        active
                          ? "text-emerald-700"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {item === "products"
                        ? `Sản phẩm (${selectedCodes.length})`
                        : `Bill xem trước (${bills.length})`}
                      {active ? (
                        <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-600" />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {tab === "products" ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:px-5">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Tìm theo mã hoặc tên sản phẩm"
                        className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                    <SelectBox
                      ariaLabel="Lọc danh sách sản phẩm"
                      value={filter}
                      options={productFilterOptions}
                      onValueChange={(nextValue) => setFilter(nextValue)}
                      className="w-full sm:w-[180px]"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 border-slate-300 bg-white transition-[transform,background-color] active:scale-[0.96]"
                      onClick={toggleAllProducts}
                    >
                      {selectedCodes.length === eligibleCatalog.length
                        ? "Bỏ chọn tất cả"
                        : "Chọn tất cả"}
                    </Button>
                  </div>

                  <div className="hidden grid-cols-[44px_minmax(220px,1fr)_120px_184px] bg-slate-100 px-4 py-3 text-xs font-semibold text-slate-600 sm:grid">
                    <span className="text-center">Chọn</span>
                    <span>Sản phẩm</span>
                    <span className="text-right">Đơn giá</span>
                    <span className="text-center">Số lượng mỗi bill</span>
                  </div>

                  {catalogLoading ? (
                    <div className="space-y-3 p-5">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-14 animate-pulse rounded-md bg-slate-100"
                        />
                      ))}
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="px-5 py-16 text-center">
                      <PackageCheck className="mx-auto h-8 w-8 text-slate-400" />
                      <p className="mt-3 font-semibold">
                        Không có sản phẩm phù hợp
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Thử đổi từ khóa hoặc bộ lọc.
                      </p>
                    </div>
                  ) : (
                    //max:620px
                    <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
                      {filteredProducts.map((product) => {
                        const selected = selectedSet.has(product.product_code);
                        const rule = getRule(product.product_code);

                        return (
                          <div
                            key={product.product_code}
                            className={`grid grid-cols-[44px_minmax(0,1fr)] gap-y-3 px-4 py-3 transition-colors sm:grid-cols-[44px_minmax(220px,1fr)_120px_184px] sm:items-center ${
                              selected
                                ? "bg-white hover:bg-emerald-50/40"
                                : "bg-slate-50/60"
                            }`}
                          >
                            <div className="flex justify-center">
                              <input
                                type="checkbox"
                                checked={selected}
                                aria-label={`Chọn ${product.product_name}`}
                                onChange={() =>
                                  toggleProduct(product.product_code)
                                }
                                className="h-5 w-5 rounded border-slate-300 accent-emerald-600"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold">
                                {product.product_name}
                              </p>
                              <p className="mt-0.5 font-mono text-xs text-slate-500">
                                {product.product_code}
                              </p>
                            </div>
                            <p className="col-start-2 text-sm font-semibold tabular-nums text-slate-700 sm:col-start-auto sm:text-right">
                              {formatCurrency(Number(product.price || 0))} VND
                            </p>
                            <div className="col-start-2 flex items-center gap-2 sm:col-start-auto sm:justify-center">
                              <input
                                type="number"
                                min={1}
                                max={99}
                                disabled={!selected}
                                value={rule.minQuantity}
                                aria-label={`Số lượng tối thiểu của ${product.product_name}`}
                                onChange={(event) =>
                                  updateRule(
                                    product.product_code,
                                    "minQuantity",
                                    Number(event.target.value),
                                  )
                                }
                                className="h-10 w-16 rounded-md border border-slate-300 bg-white text-center text-sm tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                              />
                              <span className="text-slate-400">–</span>
                              <input
                                type="number"
                                min={1}
                                max={99}
                                disabled={!selected}
                                value={rule.maxQuantity}
                                aria-label={`Số lượng tối đa của ${product.product_name}`}
                                onChange={(event) =>
                                  updateRule(
                                    product.product_code,
                                    "maxQuantity",
                                    Number(event.target.value),
                                  )
                                }
                                className="h-10 w-16 rounded-md border border-slate-300 bg-white text-center text-sm tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : bills.length === 0 ? (
                <div className="px-5 py-20 text-center">
                  <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <ReceiptText className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 font-semibold">Chưa có bill xem trước</h3>
                  <p className="mx-auto mt-1 max-w-md text-pretty text-sm leading-6 text-slate-600">
                    Chọn sản phẩm, nhập doanh thu và tạo bill để kiểm tra trước
                    khi xuất Excel.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-5 border-slate-300 bg-white transition-[transform,background-color] active:scale-[0.96]"
                    onClick={() => setTab("products")}
                  >
                    Kiểm tra sản phẩm
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2 overflow-x-auto border-b border-slate-200 p-4 sm:px-5">
                    <button
                      type="button"
                      onClick={() => setActiveBill("all")}
                      className={`min-h-10 shrink-0 rounded px-3 text-xs font-semibold transition-[transform,background-color,color] active:scale-[0.96] ${
                        activeBill === "all"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      Tất cả ({rows.length})
                    </button>
                    {bills.map((bill) => (
                      <button
                        key={bill.billCode}
                        type="button"
                        onClick={() => setActiveBill(bill.billCode)}
                        className={`min-h-8 shrink-0 rounded px-2 text-xs font-semibold tabular-nums transition-[transform,background-color,color] active:scale-[0.96] ${
                          activeBill === bill.billCode
                            ? "bg-emerald-600 text-white"
                            : "bg-emerald-100 text-emerald-800 hover:bg-emerald-700 hover:text-white"
                        }`}
                      >
                        Bill {bill.billCode} · {formatCurrency(bill.total)}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-[620px] overflow-auto">
                    <table className="min-w-[940px] w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 shadow-[0_1px_0_rgba(148,163,184,0.35)]">
                        <tr>
                          {[
                            "Mã bill",
                            "Tên khách hàng",
                            "Mã hàng hóa",
                            "Tên hàng hóa, dịch vụ",
                            "Số lượng",
                            "Đơn giá",
                            "Thành tiền",
                          ].map((label, index) => (
                            <th
                              key={label}
                              className={`px-3 py-3 font-semibold ${
                                index >= 4 ? "text-right" : "text-left"
                              }`}
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visibleRows.map((row, index) => (
                          <tr
                            key={`${row.billCode}-${row.productCode}-${index}`}
                            className="hover:bg-slate-50"
                          >
                            <td className="px-3 py-3 font-semibold tabular-nums">
                              {row.billCode}
                            </td>
                            <td className="px-3 py-3 text-slate-600">
                              {row.customerName}
                            </td>
                            <td className="px-3 py-3 font-mono text-xs text-slate-600">
                              {row.productCode}
                            </td>
                            <td className="px-3 py-3 font-medium">
                              {row.productName}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                              {row.quantity}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                              {formatCurrency(row.unitPrice)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums">
                              {formatCurrency(row.lineTotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </RoleGuard>
  );
}
