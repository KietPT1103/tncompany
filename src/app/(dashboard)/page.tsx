"use client";

import { useEffect, useState } from "react";
import { parseSalesReportWorkbook } from "@/services/excel";
import { calculateCost, SaleRow } from "@/services/cost";
import OperatingCostPanel from "@/app/(dashboard)/_components/OperatingCostPanel";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  DollarSign,
  TrendingUp,
  Package,
  Activity,
  ArchiveX,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fetchProductCosts } from "@/services/productService";
import { saveReport } from "@/services/reportService";
import {
  applyInventoryConsumption,
  getInventoryConsumptions,
  InventoryConsumptionPreview,
  InventoryConsumptionRecord,
  previewInventoryConsumption,
} from "@/services/inventoryConsumptionService";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import DateRangePicker from "@/app/(dashboard)/timesheet/DateRangePicker";
import { CalendarDays } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type SalesImportRow = {
  product_code: string;
  product_name: string;
  quantity: number;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);

const formatNumber = (value: number, maximumFractionDigits = 3) =>
  Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits });

export default function HomePage() {
  const { user, role, loading } = useAuth();
  const { storeId, storeName } = useStore();
  const router = useRouter();

  const [rows, setRows] = useState<SaleRow[]>([]);
  const [salesRows, setSalesRows] = useState<SalesImportRow[]>([]);
  const [salary, setSalary] = useState(0);
  const [electric, setElectric] = useState(0);
  const [other, setOther] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [fileName, setFileName] = useState("");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [includeInCashFlow, setIncludeInCashFlow] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [isApplyingInventory, setIsApplyingInventory] = useState(false);
  const [inventoryPreview, setInventoryPreview] =
    useState<InventoryConsumptionPreview | null>(null);
  const [recentConsumptions, setRecentConsumptions] = useState<
    InventoryConsumptionRecord[]
  >([]);
  const [inventoryApplied, setInventoryApplied] = useState(false);
  const [mode, setMode] = useState<"month" | "custom">("month");
  const [selectedMonth, setSelectedMonth] = useState("2026-07");
  const [selectedPeriod, setSelectedPeriod] = useState<1 | 2>(1);
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-15");

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (role !== "admin") {
        router.push("/pos");
      }
    }
  }, [user, role, loading, router]);

  async function loadRecentConsumptions() {
    try {
      const items = await getInventoryConsumptions(storeId, 8);
      setRecentConsumptions(items);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    loadRecentConsumptions();
  }, [storeId]);

  if (loading || !user || role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  async function handleFile(file: File) {
    if (!file) return;

    setIsProcessing(true);
    setInventoryApplied(false);
    setFileName(file.name);

    try {
      const parsedReport = await parseSalesReportWorkbook(file);
      const importedSalesRows = parsedReport.rows.map((row) => ({
        product_code: row.product_code,
        product_name: row.product_name,
        quantity: row.quantity,
      }));

      setSalesRows(importedSalesRows);

      if (parsedReport.startDate) {
        setReportStartDate(parsedReport.startDate);
      }
      if (parsedReport.endDate) {
        setReportEndDate(parsedReport.endDate);
      }
      if (parsedReport.totalNetRevenue > 0) {
        setRevenue(parsedReport.totalNetRevenue);
      }

      const costMap = await fetchProductCosts(storeId);
      const { detail } = calculateCost(importedSalesRows, costMap);
      setRows(detail);

      const preview = await previewInventoryConsumption({
        storeId,
        fileName: parsedReport.fileName,
        startDate: parsedReport.startDate || undefined,
        endDate: parsedReport.endDate || undefined,
        salesItems: importedSalesRows.map((row) => ({
          productCode: row.product_code,
          productName: row.product_name,
          quantity: row.quantity,
        })),
      });
      setInventoryPreview(preview);
    } catch (error) {
      console.error(error);
      setRows([]);
      setSalesRows([]);
      setInventoryPreview(null);
      alert(
        "Không thể đọc file báo cáo bán hàng hoặc xem trước tiêu hao.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  const materialCost = rows.reduce((sum, row) => sum + row.cost, 0);
  const totalCost = materialCost + salary + electric + other;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0";

  const handleRevenueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value.replace(/,/g, "");
    if (rawValue === "") {
      setRevenue(0);
      return;
    }
    if (!/^\d*$/.test(rawValue)) return;
    setRevenue(Number(rawValue));
  };

  const handleSaveReport = async () => {
    if (!fileName || rows.length === 0) {
      alert("Chưa có dữ liệu để lưu.");
      return;
    }

    if (
      !revenue &&
      !confirm("Chưa nhập doanh thu. Bạn có muốn tiếp tục lưu?")
    ) {
      return;
    }

    setIsSavingReport(true);

    try {
      await saveReport({
        fileName,
        revenue,
        salary,
        electric,
        other,
        totalMaterialCost: materialCost,
        totalCost,
        profit,
        storeId,
        createdAt: reportEndDate ? new Date(reportEndDate) : new Date(),
        startDate: reportStartDate ? new Date(reportStartDate) : undefined,
        endDate: reportEndDate ? new Date(reportEndDate) : undefined,
        includeInCashFlow,
        details: rows.map((row) => ({
          product_code: row.product_code,
          product_name: row.product_name,
          quantity: row.quantity,
          costUnit: row.costUnit,
          cost: row.cost,
        })),
      });

      alert("Đã lưu báo cáo thành công.");
    } catch (error) {
      console.error(error);
      alert("Không thể lưu báo cáo.");
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleApplyInventoryConsumption = async () => {
    if (!fileName || salesRows.length === 0) {
      alert("Chưa có báo cáo bán hàng để ghi nhận.");
      return;
    }

    if (!inventoryPreview || inventoryPreview.items.length === 0) {
      alert("Không có nguyên liệu hợp lệ để ghi nhận.");
      return;
    }

    if (inventoryPreview.errors.length > 0) {
      alert(
        "Báo cáo đang có lỗi công thức hoặc mã hàng. Hãy xử lý trước khi ghi nhận.",
      );
      return;
    }

    if (
      !confirm(
        `Sẽ ghi nhận tiêu hao của ${inventoryPreview.items.length} nguyên liệu theo file ${fileName}. Tiếp tục?`,
      )
    ) {
      return;
    }

    setIsApplyingInventory(true);

    try {
      await applyInventoryConsumption({
        storeId,
        fileName,
        startDate: reportStartDate || undefined,
        endDate: reportEndDate || undefined,
        salesItems: salesRows.map((row) => ({
          productCode: row.product_code,
          productName: row.product_name,
          quantity: row.quantity,
        })),
      });

      setInventoryApplied(true);
      await loadRecentConsumptions();
      alert("Đã ghi nhận tiêu hao theo công thức.");
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Không thể ghi nhận tiêu hao theo báo cáo.",
      );
    } finally {
      setIsApplyingInventory(false);
    }
  };

  return (
    <div className="px-4 py-5 font-sans text-slate-800 sm:px-6 lg:px-6 lg:py-6 2xl:px-8">
      <div className="mx-auto max-w-[1440px] space-y-5 2xl:max-w-[1680px]">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="font-smooch text-6xl text-emerald-800 font-bold tracking-tight">
              Tính Cost &amp; Lợi nhuận
            </h1>
            <p className="mt-1 font-firasans text-slate-500">
              Tổng hợp doanh thu, giá vốn và chi phí vận hành tại{" "}
              <span className="font-semibold text-[#d6ba5d]">
                {storeName}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white p-2 pr-4 shadow-[6px_8px_14px_rgba(6,78,59,0.22)]">
            <div className="rounded-full bg-emerald-700 p-2">
              <Activity className="h-5 w-5 text-[#F6C85F]" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">
                {new Date().toLocaleDateString("vi-VN")}
              </div>
              <div className="text-xs text-slate-500">Today's Overview</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Card className="relative overflow-hidden rounded-2xl bg-emerald-800 shadow-[6px_8px_14px_rgba(6,78,59,0.22)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/30" />

            <CardContent className="p-6">
              <div className="mb-3 flex items-start justify-between">
                <p className="text-sm font-semibold text-[#F6C85F]">
                  Doanh thu
                </p>

                <div className="rounded-xl bg-white/10 p-2.5 ring-1 ring-inset ring-[#F6C85F]/30">
                  <DollarSign className="h-5 w-5 text-[#F6C85F]" />
                </div>
              </div>

              <div className="rounded-xl border border-[#F6C85F]/80 bg-black/5 px-3 py-1.5 text-3xl font-bold text-[#F6C85F]">
                {revenue === 0 ? "0" : revenue.toLocaleString("en-US")}
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden rounded-2xl bg-[#ECBE40] shadow-[6px_8px_14px_rgba(180,140,24,0.24)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/40" />

            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="mb-1 text-sm font-semibold text-emerald-950">
                    Lợi nhuận ròng
                  </p>

                  <h3
                    className={cn(
                      "text-2xl font-bold",
                      profit >= 0 ? "text-emerald-900" : "text-rose-700",
                    )}
                  >
                    {formatMoney(profit)}
                  </h3>
                </div>

                <div
                  className={cn(
                    "rounded-xl p-2.5 ring-1 ring-inset",
                    profit >= 0
                      ? "bg-emerald-800 text-white ring-emerald-900/20"
                      : "bg-rose-100 text-rose-700 ring-rose-200",
                  )}
                >
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-bold",
                    profit >= 0
                      ? "bg-emerald-900 text-white"
                      : "bg-rose-700 text-white",
                  )}
                >
                  {margin}%
                </span>

                <span className="text-xs font-medium text-emerald-950/70">
                  Biên lợi nhuận
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-sky-50 shadow-[6px_8px_14px_rgba(14,116,144,0.14)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white" />

            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="mb-1 text-sm font-semibold text-slate-600">
                    Món đã bán
                  </p>

                  <h3 className="text-2xl font-bold text-slate-900">
                    {salesRows.length}
                  </h3>
                </div>

                <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700 ring-1 ring-inset ring-sky-200">
                  <Package className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-3 text-xs font-medium text-slate-500">
                Đọc từ file báo cáo bán hàng
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-amber-50 shadow-[6px_8px_14px_rgba(217,119,6,0.14)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white" />

            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="mb-1 text-sm font-semibold text-slate-600">
                    Nguyên liệu sẽ trừ
                  </p>

                  <h3 className="text-2xl font-bold text-slate-900">
                    {inventoryPreview?.items.length || 0}
                  </h3>
                </div>

                <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700 ring-1 ring-inset ring-amber-200">
                  <ArchiveX className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-3 text-xs font-medium text-slate-500">
                {inventoryPreview
                  ? `${formatNumber(inventoryPreview.totalConsumedQuantity)} đơn vị nguyên liệu`
                  : "Chưa có preview trừ kho"}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 2xl:grid-cols-[minmax(0,1fr)_minmax(380px,420px)]">
          <div className="space-y-5 xl:col-span-8 2xl:col-span-1">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="relative overflow-visible rounded-xl border border-slate-200 bg-white shadow-[6px_8px_14px_rgba(6,78,59,0.22)]">
                <CardHeader className="border-b border-slate-100 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-[#F6C85F] shadow-sm">
                        <CalendarDays className="h-5 w-5" />
                      </div>

                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">
                          Cấu hình thời gian
                        </CardTitle>

                        <CardDescription className="mt-0.5 text-xs text-slate-500">
                          Chọn kỳ hoặc khoảng ngày cần thống kê
                        </CardDescription>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                        mode === "month"
                          ? "bg-emerald-700 text-[#F6C85F]"
                          : "bg-amber-400 text-emerald-800",
                      )}
                    >
                      {mode === "month" ? "Theo đợt" : "Tùy chỉnh"}
                    </span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 p-5">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Khoảng thời gian
                    </p>

                    <DateRangePicker
                      startDate={startDate}
                      endDate={endDate}
                      mode={mode}
                      selectedMonth={selectedMonth}
                      selectedPeriod={selectedPeriod}
                      onSelectPeriod={(month, period) => {
                        setSelectedMonth(month);
                        setSelectedPeriod(period);
                        setMode("month");

                        const [year, monthNumber] = month
                          .split("-")
                          .map(Number);

                        const nextStart =
                          period === 1 ? `${month}-01` : `${month}-16`;

                        const lastDay = new Date(
                          year,
                          monthNumber,
                          0,
                        ).getDate();

                        const nextEnd =
                          period === 1
                            ? `${month}-15`
                            : `${month}-${String(lastDay).padStart(2, "0")}`;

                        setStartDate(nextStart);
                        setEndDate(nextEnd);
                      }}
                      onSelectRange={(nextStartDate, nextEndDate) => {
                        setStartDate(nextStartDate);
                        setEndDate(nextEndDate);
                        setMode("custom");
                      }}
                      onClear={() => {
                        setStartDate("");
                        setEndDate("");
                        setMode("custom");
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Từ ngày
                      </p>

                      <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                        {startDate
                          ? new Date(
                              `${startDate}T12:00:00`,
                            ).toLocaleDateString("vi-VN")
                          : "--/--/----"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Đến ngày
                      </p>

                      <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                        {endDate
                          ? new Date(`${endDate}T12:00:00`).toLocaleDateString(
                              "vi-VN",
                            )
                          : "--/--/----"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-800 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#F6C85F]" />

                      <span className="text-xs font-medium text-[#F6C85F]">
                        {mode === "month"
                          ? `${selectedMonth} · Đợt ${selectedPeriod}`
                          : "Khoảng ngày tùy chỉnh"}
                      </span>
                    </div>

                    {startDate && endDate ? (
                      <span className="text-xs font-semibold text-[#F6C85F]">
                        {Math.floor(
                          (new Date(`${endDate}T12:00:00`).getTime() -
                            new Date(`${startDate}T12:00:00`).getTime()) /
                            86400000,
                        ) + 1}{" "}
                        ngày
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card className="group relative cursor-pointer overflow-hidden border-2 border-transparent bg-slate-50/50 shadow-[6px_8px_14px_rgba(6,78,59,0.22)] transition-[border-color,background-color] hover:border-dashed hover:border-emerald-600 hover:bg-slate-50">
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={(event) =>
                    event.target.files && handleFile(event.target.files[0])
                  }
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="space-y-2 text-center transition-transform group-hover:scale-105">
                    <div className="mx-auto w-fit rounded-full bg-white p-3 text-emerald-700 shadow-sm">
                      {isProcessing ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <Upload className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold ">
                        {fileName || "Upload file Excel bán hàng"}
                      </p>
                      <p className="text-xs text-slate-400">
                        Kéo thả hoặc nhấn để chọn
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {rows.length > 0 ? (
              <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-slate-200">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded bg-blue-100 p-1.5 text-blue-600">
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>
                      <h3 className="font-semibold text-slate-700">
                        Chi tiết món bán
                      </h3>
                    </div>
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {rows.length} rows
                    </span>
                  </div>
                </CardHeader>
                <div className="max-h-[420px] overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold uppercase text-slate-500 shadow-sm">
                      <tr>
                        <th className="px-5 py-3">Mã hàng</th>
                        <th className="px-5 py-3">Tên sản phẩm</th>
                        <th className="px-5 py-3 text-right">Số lượng</th>
                        <th className="px-5 py-3 text-right">Giá vốn</th>
                        <th className="px-5 py-3 text-right">Tổng vốn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row, index) => (
                        <tr
                          key={`${row.product_code}-${index}`}
                          className="transition-colors hover:bg-slate-50"
                        >
                          <td className="px-5 py-3 font-mono text-xs text-slate-500">
                            {row.product_code}
                          </td>
                          <td className="px-5 py-3 font-medium text-slate-700">
                            {row.product_name}
                          </td>
                          <td className="bg-slate-50/30 px-5 py-3 text-right font-bold text-slate-600">
                            {formatNumber(row.quantity)}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums text-slate-500">
                            {formatNumber(row.costUnit, 0)}
                          </td>
                          <td className="px-5 py-3 text-right font-bold tabular-nums text-rose-600">
                            {formatNumber(row.cost, 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}

            {inventoryPreview ? (
              <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-slate-200">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-800">
                        Tiêu hao dự kiến theo công thức
                      </CardTitle>
                      <p className="mt-1 text-sm text-slate-500">
                        Tính theo BOM từ báo cáo bán hàng, không trừ kho vật lý.
                      </p>
                    </div>
                    {inventoryApplied ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Đã áp dụng
                      </span>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-0">
                  {inventoryPreview.errors.length > 0 ? (
                    <div className="border-b border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                      <div className="mb-2 font-semibold">
                        Có lỗi cần xử lý trước khi trừ kho:
                      </div>
                      <ul className="list-disc pl-5">
                        {inventoryPreview.errors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 px-5 pt-5 md:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Nguyên liệu bị trừ
                      </div>
                      <div className="mt-2 text-2xl font-bold text-slate-900">
                        {inventoryPreview.items.length}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Tổng số lượng tiêu hao
                      </div>
                      <div className="mt-2 text-2xl font-bold text-slate-900">
                        {formatNumber(inventoryPreview.totalConsumedQuantity)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Giá vốn nguyên liệu
                      </div>
                      <div className="mt-2 text-2xl font-bold text-slate-900">
                        {formatMoney(inventoryPreview.totalConsumedCost)}
                      </div>
                    </div>
                  </div>

                  <div className="max-h-[420px] overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold uppercase text-slate-500 shadow-sm">
                        <tr>
                          <th className="px-5 py-3">Mã nguyên liệu</th>
                          <th className="px-5 py-3">Tên nguyên liệu</th>
                          <th className="px-5 py-3 text-right">Sẽ trừ</th>
                          <th className="px-5 py-3 text-right">Tồn trước</th>
                          <th className="px-5 py-3 text-right">Tồn sau</th>
                          <th className="px-5 py-3 text-right">Giá vốn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inventoryPreview.items.map((item) => (
                          <tr
                            key={item.productCode}
                            className="transition-colors hover:bg-slate-50"
                          >
                            <td className="px-5 py-3 font-mono text-xs text-slate-500">
                              {item.productCode}
                            </td>
                            <td className="px-5 py-3 font-medium text-slate-700">
                              {item.productName}
                            </td>
                            <td className="px-5 py-3 text-right font-bold text-rose-600">
                              {formatNumber(item.quantity)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-500">
                              {formatNumber(item.stockBefore)}
                            </td>
                            <td
                              className={cn(
                                "px-5 py-3 text-right font-semibold",
                                item.stockAfter < 0
                                  ? "text-rose-600"
                                  : "text-slate-900",
                              )}
                            >
                              {formatNumber(item.stockAfter)}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-500">
                              {formatMoney(item.costUnit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 md:flex-row">
                    <Button
                      onClick={handleApplyInventoryConsumption}
                      disabled={
                        isApplyingInventory ||
                        inventoryApplied ||
                        inventoryPreview.items.length === 0 ||
                        inventoryPreview.errors.length > 0
                      }
                      className="h-12 rounded-xl bg-amber-500 text-white hover:bg-amber-600"
                    >
                      {isApplyingInventory ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ArchiveX className="mr-2 h-4 w-4" />
                      )}
                      Ghi nhận tiêu hao
                    </Button>
                    <div className="flex items-center text-sm text-slate-500">
                      Hệ thống sẽ chặn ghi nhận lặp cùng một báo cáo đã áp dụng trước
                      đó.
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-5 xl:col-span-4 2xl:col-span-1">
            <OperatingCostPanel
              revenue={revenue}
              materialCost={materialCost}
              salary={salary}
              electric={electric}
              other={other}
              onSalaryChange={setSalary}
              onElectricChange={setElectric}
              onOtherChange={setOther}
              onSave={() => void handleSaveReport()}
              isSaving={isSavingReport}
            />

            <Card className="border-0 ring-1 ring-slate-100 shadow-[6px_8px_14px_rgba(6,78,59,0.22)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-800">
                  Lịch sử ghi nhận tiêu hao
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentConsumptions.length === 0 ? (
                  <div className="text-sm text-slate-400">
                    Chưa có lần tiêu hao nào được ghi nhận.
                  </div>
                ) : (
                  recentConsumptions.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {item.sourceFileName}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.reportStartDate || "--"} đến{" "}
                            {item.reportEndDate || "--"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-900">
                            {item.appliedItemCount} NL
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {new Date(
                              item.createdAt.replace(" ", "T"),
                            ).toLocaleString("vi-VN")}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-slate-500">Tổng tiêu hao</span>
                        <span className="font-semibold text-slate-900">
                          {formatNumber(item.totalConsumedQuantity)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-sm">
                        <span className="text-slate-500">Giá vốn tiêu hao</span>
                        <span className="font-semibold text-slate-900">
                          {formatMoney(item.totalConsumedCost)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
