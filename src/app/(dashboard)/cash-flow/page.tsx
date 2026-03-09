"use client";

import { useEffect, useState, useMemo } from "react";
import { getReports, Report } from "@/services/reportService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Link from "next/link";
import { ArrowLeft, BarChart3, Printer, X, Check, Calendar, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";

import RoleGuard from "@/components/RoleGuard";

export default function CashFlowPage() {
  const { storeId } = useStore();
  const [year, setYear] = useState(new Date().getFullYear());
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  type PrintScope =
    | "ALL"
    | "CUSTOM"
    | "Q1"
    | "Q2"
    | "Q3"
    | "Q4"
    | "M1"
    | "M2"
    | "M3"
    | "M4"
    | "M5"
    | "M6"
    | "M7"
    | "M8"
    | "M9"
    | "M10"
    | "M11"
    | "M12";

  // Print State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printScope, setPrintScope] = useState<PrintScope>("ALL");
  const printDate = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Custom Date Range State
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Initialize custom dates when year changes
  useEffect(() => {
    setCustomStartDate(`${year}-01-01`);
    setCustomEndDate(`${year}-12-31`);
  }, [year]);

  // Load data for the selected year
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const startDate = new Date(year, 0, 1); // Jan 1st
        const endDate = new Date(year, 11, 31, 23, 59, 59); // Dec 31st
        // Fetch up to 1000 reports for the year to ensure we cover enough data for stats
        const data = await getReports(1000, startDate, endDate, storeId);
        setReports(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [year, storeId]);

  // Aggregation Logic
  const stats = useMemo(() => {
    const quarters = [
      { id: 1, label: "Quý 1 (T1-T3)", revenue: 0, cost: 0, profit: 0 },
      { id: 2, label: "Quý 2 (T4-T6)", revenue: 0, cost: 0, profit: 0 },
      { id: 3, label: "Quý 3 (T7-T9)", revenue: 0, cost: 0, profit: 0 },
      { id: 4, label: "Quý 4 (T10-T12)", revenue: 0, cost: 0, profit: 0 },
    ];

    const months = Array.from({ length: 12 }, (_, idx) => ({
      id: idx + 1,
      label: `Tháng ${idx + 1}`,
      revenue: 0,
      cost: 0,
      profit: 0,
    }));

    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;

    reports.forEach((r) => {
      // Skip if not included in cash flow
      if (r.includeInCashFlow === false) return;

      if (!r.createdAt?.seconds) return;
      const date = new Date(r.createdAt.seconds * 1000);
      const month = date.getMonth(); // 0-11
      const quarterIndex = Math.floor(month / 3);

      const isCustomScope = printScope === "CUSTOM";
      const isMonthScope = printScope.startsWith("M");
      const isQuarterScope = printScope.startsWith("Q");

      // Filter cho phạm vi được chọn
      if (isCustomScope) {
        const rDate = date.toISOString().split("T")[0];
        if (customStartDate && rDate < customStartDate) return;
        if (customEndDate && rDate > customEndDate) return;
      } else if (isMonthScope) {
        const targetMonth = Number(printScope.replace("M", "")) - 1;
        if (month !== targetMonth) return;
      } else if (isQuarterScope) {
        const targetQuarter = Number(printScope.replace("Q", "")) - 1;
        if (quarterIndex !== targetQuarter) return;
      }

      totalRevenue += r.revenue;
      totalCost += r.totalCost;
      totalProfit += r.profit;

      quarters[quarterIndex].revenue += r.revenue;
      quarters[quarterIndex].cost += r.totalCost;
      quarters[quarterIndex].profit += r.profit;

      months[month].revenue += r.revenue;
      months[month].cost += r.totalCost;
      months[month].profit += r.profit;
    });

    return { totalRevenue, totalCost, totalProfit, quarters, months };
  }, [reports, printScope, customStartDate, customEndDate, year]); // Added year to deps just in case

  const StatCard = ({
    title,
    revenue,
    cost,
    profit,
    highlight,
    compact = false
  }: {
    title: string;
    revenue: number;
    cost: number;
    profit: number;
    highlight?: boolean;
    compact?: boolean;
  }) => (
    <div
      className={cn(
        "rounded-2xl border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md cursor-pointer",
        "print:border-gray-300 print:shadow-none print:hover:transform-none",
        highlight && "ring-2 ring-primary/20 border-primary/50 bg-primary/5 print:bg-gray-50",
        compact ? "p-4" : "p-6"
      )}
    >
      <h3 className={cn("font-semibold leading-none tracking-tight text-slate-700 flex items-center justify-between", compact ? "mb-3 text-base" : "mb-5 text-lg")}>
        {title}
        {highlight && <Check className="w-4 h-4 text-primary" />}
      </h3>
      <div className={cn("space-y-2", compact ? "text-sm" : "")}>
        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            Doanh thu
          </span>
          <span className="font-semibold text-slate-700">{revenue.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <TrendingDown className="w-4 h-4 text-slate-400" />
            Chi phí
          </span>
          <span className="font-semibold text-rose-600">
            {cost.toLocaleString()}
          </span>
        </div>
        <div className={cn("flex justify-between items-center p-2 rounded-lg font-bold border-t border-dashed border-slate-200 mt-2",
            profit >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
        )}>
          <span className="flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 opacity-70" />
            Lợi nhuận
          </span>
          <span>
            {profit.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );

  const handlePrint = () => {
    setShowPrintModal(false);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <div
        className={cn(
          "min-h-screen bg-[#F8FAFC] font-sans text-slate-800 print:bg-white",
          `print-scope-${printScope}`
        )}
      >
        {/* Global Print Styles */}
        <style>{`
          @media print {
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              background: white;
              -webkit-print-color-adjust: exact;
            }
            .no-print {
              display: none !important;
            }
            .grid {
              display: block !important;
            }
            .grid > div {
              margin-bottom: 20px;
              page-break-inside: avoid;
            }
          }
        `}</style>

        {/* Print Modal */}
        {showPrintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm no-print p-4 transition-all duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
              <div className="p-5 border-b flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
                  <Printer className="w-5 h-5 text-primary" />
                  Tùy chọn in ấn
                </h3>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                    Phạm vi thời gian
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPrintScope("ALL")}
                      className={cn(
                        "p-3 text-sm border-2 rounded-xl flex items-center justify-center gap-2 transition-all font-medium",
                        printScope === "ALL"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-slate-100 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {printScope === "ALL" && <Check className="w-4 h-4" />} Cả năm
                    </button>
                    <button
                      onClick={() => setPrintScope("CUSTOM")}
                      className={cn(
                        "p-3 text-sm border-2 rounded-xl flex items-center justify-center gap-2 transition-all font-medium",
                        printScope === "CUSTOM"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-slate-100 bg-white text-slate-600 hover:border-slate-300"
                      )}
                    >
                      {printScope === "CUSTOM" && <Check className="w-4 h-4" />} Tùy chọn
                    </button>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Theo Quý</div>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map((q) => (
                        <button
                          key={q}
                          onClick={() => setPrintScope(`Q${q}` as PrintScope)}
                          className={cn(
                            "py-2 px-1 text-xs border rounded-lg flex flex-col items-center justify-center gap-1 transition-all font-medium",
                            printScope === `Q${q}`
                                ? "border-primary bg-primary/5 text-primary shadow-sm"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <span className="text-lg leading-none">Q{q}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Theo Tháng</div>
                    <div className="grid grid-cols-6 gap-2">
                      {Array.from({ length: 12 }, (_, idx) => idx + 1).map(
                        (month) => (
                          <button
                            key={month}
                            onClick={() =>
                              setPrintScope(`M${month}` as PrintScope)
                            }
                            className={cn(
                              "py-2 px-1 text-xs border rounded-lg flex items-center justify-center transition-all font-medium",
                              printScope === `M${month}`
                                ? "border-primary bg-primary/5 text-primary shadow-sm"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            T{month}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  
                  {printScope === "CUSTOM" && (
                    <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2 fade-in">
                        <div>
                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                            Từ ngày
                        </label>
                        <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => setCustomStartDate(e.target.value)}
                            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                        />
                        </div>
                        <div>
                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">
                            Đến ngày
                        </label>
                        <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => setCustomEndDate(e.target.value)}
                            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                        />
                        </div>
                    </div>
                  )}

                </div>
              </div>
              <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowPrintModal(false)}
                  className="text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                >
                  Hủy bỏ
                </Button>
                <Button
                  onClick={handlePrint}
                  className="bg-primary hover:bg-blue-700 text-white shadow-lg shadow-primary/30 flex gap-2 rounded-xl px-6"
                >
                  <Printer className="w-4 h-4" /> Xác nhận In
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto p-6 md:p-8 lg:p-12 space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-5">
              <Link
                href="/"
                className="group p-3 rounded-2xl hover:bg-slate-100 bg-slate-50 transition-all text-slate-500 hover:text-primary border border-transparent hover:border-slate-200"
                title="Trở về trang chủ"
              >
                <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl">
                        <BarChart3 className="w-8 h-8 text-primary" />
                    </div>
                  Thống kê Dòng Tiền
                </h1>
                <p className="text-slate-500 mt-1 font-medium">
                  Tổng hợp tình hình kinh doanh & lợi nhuận
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                <button
                  onClick={() => setYear(year - 1)}
                  className="w-9 h-9 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-lg text-slate-600 transition-all"
                >
                  ←
                </button>
                <span className="font-bold px-4 text-slate-800 bg-white shadow-sm py-1.5 rounded-md min-w-[100px] text-center border border-slate-100">Năm {year}</span>
                <button
                  onClick={() => setYear(year + 1)}
                  className="w-9 h-9 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-lg text-slate-600 transition-all"
                >
                  →
                </button>
              </div>
              
              <Button
                variant="outline"
                className="flex gap-2 bg-white hover:bg-slate-50 border-slate-200 text-slate-700 h-12 px-5 rounded-xl border-2"
                onClick={() => setShowPrintModal(true)}
              >
                <Printer className="w-4 h-4" />
                In báo cáo
              </Button>
            </div>
          </div>

          {/* Print Header (Visible only when printing) */}
          <div className="hidden print:block mb-8 text-center border-b pb-6">
            <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tight mb-2">
              Báo cáo Dòng Tiền - Năm {year}
            </h1>
            <p className="text-slate-600 text-lg">
              {printScope === "ALL" && "Báo cáo tổng hợp cả năm"}
              {printScope.startsWith("M") &&
                `Báo cáo Tháng ${printScope.substring(1)}`}
              {printScope.startsWith("Q") &&
                `Báo cáo Quý ${printScope.substring(1)}`}
              {printScope === "CUSTOM" &&
                `Báo cáo từ ${new Date(customStartDate).toLocaleDateString(
                  "vi-VN"
                )} đến ${new Date(customEndDate).toLocaleDateString("vi-VN")}`}
            </p>
            <p className="text-sm text-slate-400 mt-4 italic">
              Ngày xuất báo cáo: {new Date(printDate).toLocaleDateString("vi-VN")}
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 animate-pulse">
                <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
              <div className="text-lg font-medium">Đang tính toán dữ liệu...</div>
            </div>
          ) : (
            <div className="space-y-12 pb-12">
              {/* ANNUAL SUMMARY - BENTO GRID HERO */}
              <section className="print-section" data-id="annual">
                <div className="flex items-center gap-3 mb-6 no-print">
                    <div className="w-1.5 h-8 bg-primary rounded-full"></div>
                    <h2 className="text-xl font-bold text-slate-800">
                        {printScope === "ALL" ? `Tổng quan tài chính ${year}` : "Tổng kết theo phạm vi chọn"}
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Revenue Card */}
                  <Card className="rounded-3xl border-0 shadow-lg shadow-blue-900/5 bg-gradient-to-br from-blue-500 to-blue-600 text-white overflow-hidden relative group print:bg-none print:shadow-none print:text-black print:border">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                        <TrendingUp className="w-24 h-24" />
                    </div>
                    <CardHeader className="pb-2 relative z-10">
                      <CardTitle className="text-blue-100 font-medium text-base tracking-wide uppercase flex items-center gap-2">
                        <div className="p-1 bg-white/20 rounded-md"><TrendingUp className="w-4 h-4 text-white" /></div>
                        Tổng doanh thu
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 relative z-10">
                      <div className="text-3xl md:text-4xl font-bold tracking-tight">
                        {stats.totalRevenue.toLocaleString()}
                        <span className="text-lg font-normal text-blue-200 ml-1">đ</span>
                      </div>
                      <div className="mt-4 text-sm text-blue-100 bg-blue-600/30 inline-block px-3 py-1 rounded-full border border-blue-400/30">
                        Doanh thu trước phí
                      </div>
                    </CardContent>
                  </Card>

                  {/* Cost Card */}
                  <Card className="rounded-3xl border-slate-200 bg-white text-slate-800 shadow-sm relative overflow-hidden group hover:shadow-md transition-all print:border">
                     <div className="absolute right-0 top-0 w-32 h-32 bg-rose-50 rounded-bl-full -mr-6 -mt-6"></div>
                    <CardHeader className="pb-2 relative z-10">
                      <CardTitle className="text-slate-500 font-medium text-base tracking-wide uppercase flex items-center gap-2">
                        <div className="p-1 bg-rose-100 rounded-md"><TrendingDown className="w-4 h-4 text-rose-600" /></div>
                        Tổng chi phí
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 relative z-10">
                      <div className="text-3xl md:text-4xl font-bold tracking-tight text-rose-600">
                        {stats.totalCost.toLocaleString()}
                        <span className="text-lg font-normal text-rose-300 ml-1">đ</span>
                      </div>
                      <div className="mt-4 text-sm text-slate-400 flex items-center gap-2">
                        Bao gồm cost nhập hàng và lương
                      </div>
                    </CardContent>
                  </Card>

                  {/* Profit Card */}
                   <Card className={cn(
                       "rounded-3xl border-0 shadow-lg shadow-emerald-900/5 text-white overflow-hidden relative group print:bg-none print:shadow-none print:text-black print:border",
                       stats.totalProfit >= 0 ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : "bg-gradient-to-br from-rose-500 to-rose-600"
                   )}>
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                        <DollarSign className="w-24 h-24" />
                    </div>
                    <CardHeader className="pb-2 relative z-10">
                      <CardTitle className={cn("font-medium text-base tracking-wide uppercase flex items-center gap-2", stats.totalProfit >= 0 ? "text-emerald-100" : "text-rose-100")}>
                        <div className="p-1 bg-white/20 rounded-md"><DollarSign className="w-4 h-4 text-white" /></div>
                        Lợi nhuận ròng
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 relative z-10">
                      <div className="text-3xl md:text-4xl font-bold tracking-tight">
                        {stats.totalProfit.toLocaleString()}
                        <span className={cn("text-lg font-normal ml-1", stats.totalProfit >= 0 ? "text-emerald-200" : "text-rose-200")}>đ</span>
                      </div>
                         <div className={cn("mt-4 text-sm inline-block px-3 py-1 rounded-full border", 
                            stats.totalProfit >= 0 ? "bg-emerald-600/30 border-emerald-400/30 text-emerald-100" : "bg-rose-600/30 border-rose-400/30 text-rose-100"
                         )}>
                        {stats.totalProfit >= 0 ? "Kinh doanh có lãi" : "Đang lỗ"}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>

              {/* MONTHLY DETAIL */}
              <section
                className={cn(
                  "print-section space-y-6",
                  printScope === "ALL" || printScope.startsWith("M")
                    ? ""
                    : "print:hidden",
                  printScope === "CUSTOM" && "hidden"
                )}
                data-id="monthly"
              >
                 <div className="flex items-center gap-3 no-print border-t pt-8">
                    <div className="w-1.5 h-8 bg-purple-500 rounded-full"></div>
                    <h2 className="text-xl font-bold text-slate-800">
                        Chi tiết từng Tháng
                    </h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {stats.months.map((m, idx) => (
                    <div
                      key={m.id}
                      className={cn(
                        printScope === "ALL" || printScope === `M${idx + 1}`
                          ? "block"
                          : "print:hidden"
                      )}
                    >
                      <StatCard
                        title={m.label}
                        revenue={m.revenue}
                        cost={m.cost}
                        profit={m.profit}
                        highlight={printScope === `M${idx + 1}`}
                        compact={true}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* QUARTERLY DETAIL */}
              <section
                className={cn(
                  "print-section space-y-6",
                  printScope === "ALL" || printScope.startsWith("Q")
                    ? ""
                    : "print:hidden",
                  // Hide detailed sections in CUSTOM mode
                  printScope === "CUSTOM" && "hidden"
                )}
                data-id={printScope}
              >
                <div className="flex items-center gap-3 no-print border-t pt-8">
                    <div className="w-1.5 h-8 bg-cta rounded-full"></div>
                    <h2 className="text-xl font-bold text-slate-800">
                        Tổng hợp theo Quý
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {stats.quarters.map((q, idx) => (
                    <div
                      key={q.id}
                      className={cn(
                        printScope === "ALL" || printScope === `Q${idx + 1}`
                          ? "block"
                          : "print:hidden"
                      )}
                    >
                      <StatCard
                        title={q.label}
                        revenue={q.revenue}
                        cost={q.cost}
                        profit={q.profit}
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
