"use client";

import { useState, useEffect } from "react";
import { parseExcel } from "@/services/excel";
import { calculateCost, SaleRow } from "@/services/cost";
import InputMoney from "@/components/InputMoney";
import ResultTable from "@/components/ResultTable";
import { Upload, FileSpreadsheet, Save, Loader2, DollarSign, TrendingUp, Package, Activity } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { fetchProductCosts, seedProductCosts } from "@/services/productService";
import { saveReport } from "@/services/reportService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { cn } from "@/lib/utils";

export default function HomePage() {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const { user, role, loading } = useAuth();
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const { storeId, storeName } = useStore();
  const router = useRouter();
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [salary, setSalary] = useState(0);
  const [electric, setElectric] = useState(0);
  const [other, setOther] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [fileName, setFileName] = useState<string>("");
  const [reportStartDate, setReportStartDate] = useState("");
  const [reportEndDate, setReportEndDate] = useState("");
  const [includeInCashFlow, setIncludeInCashFlow] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (role !== "admin") {
        router.push("/pos");
      }
    }
  }, [user, role, loading, router]);

  if (loading || !user || role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  async function handleFile(file: File) {
    if (!file) return;
    setIsProcessing(true);
    setFileName(file.name);
    try {
      const rows = await parseExcel(file);
      const headerIndex = rows.findIndex(
        (row) => row?.includes("Mã hàng") && row?.includes("SL bán"),
      );

      if (headerIndex === -1) {
        alert(
          "Không tìm thấy header bảng dữ liệu (Tìm cột 'Mã hàng' và 'SL bán')",
        );
        return;
      }

      const dataRows = rows.slice(headerIndex + 1);

      const mapped = dataRows
        .filter(
          (r) => typeof r[1] === "string" && !r[1].includes("SL mặt hàng"),
        )
        .map((r) => ({
          product_code: String(r[1]),
          product_name: String(r[2]),
          quantity: Number(r[5] ?? 0),
        }));

      const costMap = await fetchProductCosts(storeId);
      const { detail } = calculateCost(mapped, costMap);
      setRows(detail);
    } catch (err) {
      console.error(err);
      alert("Lỗi đọc file Excel");
    } finally {
      setIsProcessing(false);
    }
  }

  // Calculate values for display only
  const materialCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalCost = materialCost + salary + electric + other;
  const profit = revenue - totalCost;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : "0";

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);

  const handleRevenueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/,/g, "");
    if (rawValue === "") {
      setRevenue(0);
      return;
    }
    if (!/^\d*$/.test(rawValue)) return;
    setRevenue(Number(rawValue));
  };

  const handleSaveReport = async () => {
    if (!fileName || rows.length === 0) {
      alert("Chưa có dữ liệu để lưu");
      return;
    }

    if (!revenue) {
      if (!confirm("Chưa nhập doanh thu. Bạn có muốn tiếp tục lưu?")) return;
    }

    try {
      const materialCost = rows.reduce((s, r) => s + r.cost, 0);
      const totalCost = materialCost + salary + electric + other;
      const profit = revenue - totalCost;

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
        details: rows.map((r) => ({
          product_code: r.product_code,
          product_name: r.product_name,
          quantity: r.quantity,
          costUnit: r.costUnit,
          cost: r.cost,
        })),
      });

      alert("Đã lưu báo cáo thành công!");
    } catch (error) {
      console.error(error);
      alert("Lỗi khi lưu báo cáo");
    }
  };

  // Helper to set dates quickly
  const setQuickDate = (type: "this_month" | "last_month") => {
    const now = new Date();
    let start, end;

    if (type === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    setReportStartDate(start.toISOString().split("T")[0]);
    setReportEndDate(end.toISOString().split("T")[0]);
  };

  return (
    <div className="p-4 lg:p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Dashboard
            </h1>
            <p className="text-slate-500 mt-1">
              Hiệu quả kinh doanh tại <span className="font-semibold text-emerald-600">{storeName}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white p-2 pr-4 rounded-full border border-slate-100 shadow-sm">
             <div className="p-2 bg-emerald-50 rounded-full">
                <Activity className="w-5 h-5 text-emerald-600" />
             </div>
             <div>
                <div className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString('vi-VN')}</div>
                <div className="text-xs text-slate-500">Today's Overview</div>
             </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm ring-1 ring-slate-100 bg-emerald-600 text-white overflow-hidden relative">
               <CardContent className="p-6 relative z-10">
                  <div className="flex justify-between items-start mb-2">
                     <p className="text-emerald-100 text-sm font-medium">Doanh thu</p>
                     <div className="p-2 bg-white/20 rounded-lg">
                       <DollarSign className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div className="relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={revenue === 0 ? "" : revenue.toLocaleString("en-US")}
                        onChange={handleRevenueChange}
                        className="text-3xl font-bold bg-transparent border-none p-0 h-auto text-white focus-visible:ring-0 placeholder:text-emerald-200 shadow-none w-full"
                        placeholder="0"
                      />
                  </div>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-sm ring-1 ring-slate-100">
               <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                       <p className="text-slate-500 text-sm font-medium mb-1">Lợi nhuận ròng</p>
                       <h3 className={cn("text-2xl font-bold", profit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                          {formatMoney(profit)}
                       </h3>
                    </div>
                    <div className={cn("p-2 rounded-lg", profit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                       <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                     <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", profit >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                        {margin}%
                     </span>
                     <span className="text-xs text-slate-400">biên lợi nhuận</span>
                  </div>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-sm ring-1 ring-slate-100">
               <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                       <p className="text-slate-500 text-sm font-medium mb-1">Đơn hàng</p>
                       <h3 className="text-2xl font-bold text-slate-900">{rows.length}</h3>
                    </div>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                       <Package className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">đã tải lên từ file</div>
               </CardContent>
            </Card>

            <Card className="border-0 shadow-sm ring-1 ring-slate-100">
               <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                       <p className="text-slate-500 text-sm font-medium mb-1">Tổng chi phí</p>
                       <h3 className="text-2xl font-bold text-slate-900">{formatMoney(totalCost)}</h3>
                    </div>
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                       <Activity className="w-5 h-5" />
                    </div>
                  </div>
                   <div className="mt-2 text-xs text-slate-400">cố định & biến đổi</div>
               </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Input & Data (8 cols) */}
          <div className="xl:col-span-8 space-y-6">
            {/* 1. Configuration & Upload */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Config */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase text-slate-500 tracking-wider">
                    Cấu hình thời gian
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                        Từ ngày
                      </label>
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-primary/20 focus:border-primary px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                        Đến ngày
                      </label>
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="w-full text-sm border-slate-200 rounded-lg focus:ring-primary/20 focus:border-primary px-3 py-2"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="includeInCashFlow"
                      checked={includeInCashFlow}
                      onChange={(e) => setIncludeInCashFlow(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                    <label
                      htmlFor="includeInCashFlow"
                      className="text-sm font-medium text-slate-600 cursor-pointer select-none"
                    >
                      Tính vào tổng dòng tiền
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* Upload Area */}
              <Card className="border-dashed border-2 bg-slate-50/50 hover:bg-slate-50 hover:border-emerald-300 transition-colors cursor-pointer group relative overflow-hidden">
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={(e) =>
                    e.target.files && handleFile(e.target.files[0])
                  }
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center space-y-2 group-hover:scale-105 transition-transform">
                    <div className="p-3 bg-white rounded-full shadow-sm w-fit mx-auto text-emerald-600">
                      {isProcessing ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">
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

            {/* 2. Detailed Data Table */}
            {rows.length > 0 && (
              <Card className="overflow-hidden border-0 shadow-sm ring-1 ring-slate-200">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-100 text-blue-600 rounded">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <h3 className="font-semibold text-slate-700">
                        Chi tiết đơn hàng
                      </h3>
                    </div>
                    <span className="text-xs font-bold bg-slate-200 px-2.5 py-1 rounded-full text-slate-600">
                      {rows.length} rows
                    </span>
                  </div>
                </CardHeader>
                <div className="max-h-[500px] overflow-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-5 py-3">Mã hàng</th>
                        <th className="px-5 py-3">Tên sản phẩm</th>
                        <th className="px-5 py-3 text-right">Số lượng</th>
                        <th className="px-5 py-3 text-right">Giá vốn</th>
                        <th className="px-5 py-3 text-right">Tổng vốn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((r, i) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-5 py-3 font-mono text-slate-500 text-xs">
                            {r.product_code}
                          </td>
                          <td className="px-5 py-3 font-medium text-slate-700">
                            {r.product_name}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-slate-600 bg-slate-50/30">
                            {r.quantity}
                          </td>
                          <td className="px-5 py-3 text-right text-slate-500 tabular-nums">
                            {r.costUnit.toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-rose-600 tabular-nums">
                            {r.cost.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          {/* RIGHT COLUMN: Costs & Results (4 cols) */}
          <div className="xl:col-span-4 space-y-6">
            {/* Cost Input Panel */}
            <Card className="border-0 shadow-none bg-slate-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase text-slate-400 tracking-wider">
                  Chi phí vận hành
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InputMoney
                  label="Lương nhân viên"
                  set={setSalary}
                  value={salary}
                />
                <InputMoney
                  label="Điện / Nước / Net"
                  set={setElectric}
                  value={electric}
                />
                <InputMoney label="Chi phí khác" set={setOther} value={other} />
              </CardContent>
            </Card>

            {/* Result Summary */}
            <ResultTable
              revenue={revenue}
              materialCost={materialCost}
              salary={salary}
              electric={electric}
              other={other}
            />

            <Button
              onClick={handleSaveReport}
              className="w-full h-12 bg-primary hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200 rounded-xl text-base font-bold transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <Save className="w-5 h-5 mr-2" /> Lưu Báo Cáo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
