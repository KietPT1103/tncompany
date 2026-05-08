"use client";

import { useEffect, useState } from "react";
import { parseSalesReportWorkbook } from "@/services/excel";
import { calculateCost, SaleRow } from "@/services/cost";
import InputMoney from "@/components/InputMoney";
import ResultTable from "@/components/ResultTable";
import {
  Upload,
  FileSpreadsheet,
  Save,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
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
  const [inventoryPreview, setInventoryPreview] = useState<InventoryConsumptionPreview | null>(null);
  const [recentConsumptions, setRecentConsumptions] = useState<InventoryConsumptionRecord[]>([]);
  const [inventoryApplied, setInventoryApplied] = useState(false);

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
      alert("Không thể đọc file báo cáo bán hàng hoặc preview dữ liệu trừ kho.");
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

    if (!revenue && !confirm("Chưa nhập doanh thu. Bạn có muốn tiếp tục lưu?")) {
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
      alert("Chưa có báo cáo bán hàng để trừ kho.");
      return;
    }

    if (!inventoryPreview || inventoryPreview.items.length === 0) {
      alert("Không có nguyên liệu hợp lệ để trừ kho.");
      return;
    }

    if (inventoryPreview.errors.length > 0) {
      alert("Báo cáo đang có lỗi công thức hoặc mã hàng. Hãy xử lý trước khi trừ kho.");
      return;
    }

    if (
      !confirm(
        `Sẽ trừ ${inventoryPreview.items.length} nguyên liệu trong kho theo file ${fileName}. Tiếp tục?`
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
      alert("Đã trừ kho theo công thức thành công.");
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Không thể trừ kho theo báo cáo.");
    } finally {
      setIsApplyingInventory(false);
    }
  };

  return (
    <div className="p-4 font-sans text-slate-800 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
            <p className="mt-1 text-slate-500">
              Hiệu quả kinh doanh tại{" "}
              <span className="font-semibold text-emerald-600">{storeName}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-slate-100 bg-white p-2 pr-4 shadow-sm">
            <div className="rounded-full bg-emerald-50 p-2">
              <Activity className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">
                {new Date().toLocaleDateString("vi-VN")}
              </div>
              <div className="text-xs text-slate-500">Today's Overview</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="relative overflow-hidden border-0 bg-emerald-600 text-white shadow-sm">
            <CardContent className="p-6">
              <div className="mb-2 flex items-start justify-between">
                <p className="text-sm font-medium text-emerald-100">Doanh thu</p>
                <div className="rounded-lg bg-white/20 p-2">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
              </div>
              <Input
                type="text"
                inputMode="numeric"
                value={revenue === 0 ? "" : revenue.toLocaleString("en-US")}
                onChange={handleRevenueChange}
                className="h-auto border-none bg-transparent p-0 text-3xl font-bold text-white shadow-none focus-visible:ring-0 placeholder:text-emerald-200"
                placeholder="0"
              />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-slate-100">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-500">Lợi nhuận ròng</p>
                  <h3
                    className={cn(
                      "text-2xl font-bold",
                      profit >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}
                  >
                    {formatMoney(profit)}
                  </h3>
                </div>
                <div
                  className={cn(
                    "rounded-lg p-2",
                    profit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                  )}
                >
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs font-bold",
                    profit >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  )}
                >
                  {margin}%
                </span>
                <span className="text-xs text-slate-400">biên lợi nhuận</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-slate-100">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-500">Món đã bán</p>
                  <h3 className="text-2xl font-bold text-slate-900">{salesRows.length}</h3>
                </div>
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <Package className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-400">đọc từ file báo cáo bán hàng</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-slate-100">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-500">Nguyên liệu sẽ trừ</p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {inventoryPreview?.items.length || 0}
                  </h3>
                </div>
                <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                  <ArchiveX className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {inventoryPreview
                  ? `${formatNumber(inventoryPreview.totalConsumedQuantity)} đơn vị nguyên liệu`
                  : "chưa có preview trừ kho"}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                    Cấu hình thời gian
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">
                        Từ ngày
                      </label>
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={(event) => setReportStartDate(event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">
                        Đến ngày
                      </label>
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(event) => setReportEndDate(event.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:ring-primary/20"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="includeInCashFlow"
                      checked={includeInCashFlow}
                      onChange={(event) => setIncludeInCashFlow(event.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label
                      htmlFor="includeInCashFlow"
                      className="cursor-pointer select-none text-sm font-medium text-slate-600"
                    >
                      Tính vào tổng dòng tiền
                    </label>
                  </div>
                </CardContent>
              </Card>

              <Card className="group relative cursor-pointer overflow-hidden border-2 border-dashed bg-slate-50/50 transition-colors hover:border-emerald-300 hover:bg-slate-50">
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={(event) => event.target.files && handleFile(event.target.files[0])}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="space-y-2 text-center transition-transform group-hover:scale-105">
                    <div className="mx-auto w-fit rounded-full bg-white p-3 text-emerald-600 shadow-sm">
                      {isProcessing ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <Upload className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">
                        {fileName || "Upload file Excel bán hàng"}
                      </p>
                      <p className="text-xs text-slate-400">Kéo thả hoặc nhấn để chọn</p>
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
                      <h3 className="font-semibold text-slate-700">Chi tiết món bán</h3>
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
                        <tr key={`${row.product_code}-${index}`} className="transition-colors hover:bg-slate-50">
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
                        Dự kiến trừ kho theo công thức
                      </CardTitle>
                      <p className="mt-1 text-sm text-slate-500">
                        Trừ theo BOM thành phần từ file báo cáo bán hàng vừa upload.
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
                      <div className="mb-2 font-semibold">Có lỗi cần xử lý trước khi trừ kho:</div>
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
                          <tr key={item.productCode} className="transition-colors hover:bg-slate-50">
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
                                item.stockAfter < 0 ? "text-rose-600" : "text-slate-900"
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
                      Trừ kho theo công thức
                    </Button>
                    <div className="flex items-center text-sm text-slate-500">
                      Hệ thống sẽ chặn trừ lặp cùng một báo cáo đã áp dụng trước đó.
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6 xl:col-span-4">
            <Card className="border-0 bg-slate-50 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Chi phí vận hành
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InputMoney label="Lương nhân viên" set={setSalary} value={salary} />
                <InputMoney label="Điện / Nước / Net" set={setElectric} value={electric} />
                <InputMoney label="Chi phí khác" set={setOther} value={other} />
              </CardContent>
            </Card>

            <ResultTable
              revenue={revenue}
              materialCost={materialCost}
              salary={salary}
              electric={electric}
              other={other}
            />

            <Button
              onClick={handleSaveReport}
              isLoading={isSavingReport}
              className="h-12 w-full rounded-xl bg-primary text-base font-bold text-white shadow-lg shadow-emerald-200 transition-all hover:-translate-y-1 hover:bg-emerald-600 hover:shadow-xl"
            >
              <Save className="mr-2 h-5 w-5" /> Lưu Báo Cáo
            </Button>

            <Card className="border-0 shadow-sm ring-1 ring-slate-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-slate-800">
                  Lịch sử trừ kho gần đây
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentConsumptions.length === 0 ? (
                  <div className="text-sm text-slate-400">Chưa có lần trừ kho nào được ghi nhận.</div>
                ) : (
                  recentConsumptions.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{item.sourceFileName}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.reportStartDate || "--"} đến {item.reportEndDate || "--"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-900">
                            {item.appliedItemCount} NL
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {new Date(item.createdAt.replace(" ", "T")).toLocaleString("vi-VN")}
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
