"use client";

// THESIS: A familiar back-office report viewer with TN Services' emerald-and-gold visual identity.
// OWN-WORLD: Compact controls, restrained surfaces, and spreadsheet-like data density.
// STORY: Choose a scope, inspect reconciled sales, then export the exact same dataset.
// FIRST VIEWPORT: Report identity and primary export controls stay visible above the fold.
// FORM: Filters lead into a printable A4 document rather than a dashboard of summary cards.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileDown,
  FileSpreadsheet,
  Focus,
  Maximize2,
  Minus,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";

import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { SelectBox } from "@/components/ui/SelectBox";
import { Tooltip } from "@/components/ui/Tooltip";
import { useStore } from "@/context/StoreContext";
import { cn } from "@/lib/utils";
import { getAllBills } from "@/services/billService";
import { getAllProducts } from "@/services/products";
import {
  aggregateProductSales,
  calculateProductSalesTotals,
  createProductSalesExportBytes,
  normalizeReportText,
  PRODUCT_SALES_EXPORT_FILENAME,
  type ProductSalesRow,
} from "./productSalesReport";

const ROWS_PER_PAGE = 18;
const DEFAULT_REPORT_ZOOM = 1.2;
const MIN_REPORT_ZOOM = 0.6;
const MAX_REPORT_ZOOM = 1.8;
const REPORT_ZOOM_STEP = DEFAULT_REPORT_ZOOM * 0.1;
const MONEY_FORMATTER = new Intl.NumberFormat("vi-VN");
const QUANTITY_FORMATTER = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

type ProductKind = "food" | "drink" | "other";

const todayValue = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const monthStartValue = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
};

const parseInputDate = (value: string, endOfDay = false) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
};

const formatReportDate = (value: string) =>
  parseInputDate(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

const classifyProduct = (row: ProductSalesRow): ProductKind => {
  const value = normalizeReportText(`${row.category} ${row.name}`);
  if (/nuoc|tra|ca phe|coffee|soda|bia|ruou|sinh to|nuoc ep|do uong/.test(value)) return "drink";
  if (/mon|thuc an|do an|banh|lau|com|bun|pho|mi|food/.test(value)) return "food";
  return "other";
};

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-emerald-800/20 bg-white text-emerald-800 transition-[background-color,border-color,color,transform] duration-150 hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
      >
        {children}
      </button>
    </Tooltip>
  );
}

function ExportMenu({
  onExcel,
  onPdf,
  disabled = false,
}: {
  onExcel: () => void;
  onPdf: () => void;
  disabled?: boolean;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 160);
  }, [cancelClose]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = 92;
    const viewportPadding = 8;
    const left = Math.min(
      Math.max(viewportPadding, rect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding,
    );
    const top =
      window.innerHeight - rect.bottom >= menuHeight + viewportPadding
        ? rect.bottom + 6
        : Math.max(viewportPadding, rect.top - menuHeight - 6);
    setPosition({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  const menu = open ? (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Chọn định dạng xuất file"
      onPointerEnter={cancelClose}
      onPointerLeave={scheduleClose}
      onFocusCapture={cancelClose}
      className="fixed z-[150] w-44 animate-in rounded-md border border-slate-200 bg-white p-1.5 shadow-[0_6px_18px_rgba(15,23,42,0.16)] duration-150 fade-in-0 zoom-in-95 motion-reduce:animate-none"
      style={position}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onExcel();
          setOpen(false);
        }}
        disabled={disabled}
        className="flex h-10 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm font-semibold text-emerald-900 transition-colors hover:bg-emerald-50 focus-visible:bg-emerald-50 focus-visible:outline-none disabled:opacity-50"
      >
        <FileSpreadsheet className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        Xuất Excel
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onPdf();
          setOpen(false);
        }}
        disabled={disabled}
        className="flex h-10 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm font-semibold text-emerald-900 transition-colors hover:bg-emerald-50 focus-visible:bg-emerald-50 focus-visible:outline-none disabled:opacity-50"
      >
        <FileDown className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        Xuất PDF
      </button>
    </div>
  ) : null;

  return (
    <div
      className="relative shrink-0"
      onPointerEnter={openMenu}
      onPointerLeave={scheduleClose}
      onFocusCapture={openMenu}
      onBlurCapture={scheduleClose}
    >
      <Tooltip content="Xuất file">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          disabled={disabled}
          aria-label="Xuất file"
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-800/20 bg-white text-emerald-800 transition-[background-color,border-color,color,transform] duration-150 hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </button>
      </Tooltip>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}

function ReportDocument({
  rows,
  storeName,
  startDate,
  endDate,
  pageNumber,
  pageCount,
  showAllRows = false,
}: {
  rows: ProductSalesRow[];
  storeName: string;
  startDate: string;
  endDate: string;
  pageNumber: number;
  pageCount: number;
  showAllRows?: boolean;
}) {
  const totals = calculateProductSalesTotals(rows);
  const visibleRows = showAllRows
    ? rows
    : rows.slice((pageNumber - 1) * ROWS_PER_PAGE, pageNumber * ROWS_PER_PAGE);

  return (
    <article className="product-report-sheet relative min-h-[1122px] w-[794px] bg-white px-10 pb-14 pt-9 text-[11px] leading-[1.35] text-slate-900 shadow-[0_5px_18px_rgba(15,23,42,0.14)] print:min-h-0 print:w-full print:px-7 print:pb-10 print:pt-5 print:shadow-none">
      <div className="mb-5 text-center">
        <p className="mb-1 text-[10px] text-slate-500">Ngày lập: {new Date().toLocaleString("vi-VN")}</p>
        <h2 className="text-[19px] font-bold text-emerald-950">BÁO CÁO BÁN HÀNG THEO HÀNG HÓA</h2>
        <p className="mt-1 font-semibold">Từ ngày {formatReportDate(startDate)} đến ngày {formatReportDate(endDate)}</p>
        <p>Chi nhánh: <strong>{storeName}</strong></p>
        <p className="mt-0.5 text-[10px] italic text-slate-500">(Đã phân bổ giảm giá hóa đơn, giảm giá phiếu trả)</p>
      </div>

      <table className="w-full table-fixed border-collapse tabular-nums">
        <colgroup>
          <col className="w-[13%]" /><col className="w-[29%]" /><col className="w-[9%]" />
          <col className="w-[14%]" /><col className="w-[9%]" /><col className="w-[12%]" /><col className="w-[14%]" />
        </colgroup>
        <thead>
          <tr className="bg-emerald-800 text-white">
            <th className="border border-emerald-950/25 px-2 py-2 text-left">Mã hàng</th>
            <th className="border border-emerald-950/25 px-2 py-2 text-left">Tên hàng</th>
            <th className="border border-emerald-950/25 px-2 py-2 text-right">SL bán</th>
            <th className="border border-emerald-950/25 px-2 py-2 text-right">Doanh thu</th>
            <th className="border border-emerald-950/25 px-2 py-2 text-right">SL trả</th>
            <th className="border border-emerald-950/25 px-2 py-2 text-right">Giá trị trả</th>
            <th className="border border-emerald-950/25 px-2 py-2 text-right"><span className="whitespace-nowrap">Doanh thu thuần</span></th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-[#FFF5CC] font-bold text-emerald-950">
            <td className="border border-slate-300 px-2 py-2" colSpan={2}>SL mặt hàng: {rows.length}</td>
            <td className="border border-slate-300 px-2 py-2 text-right">{QUANTITY_FORMATTER.format(totals.soldQuantity)}</td>
            <td className="border border-slate-300 px-2 py-2 text-right">{MONEY_FORMATTER.format(totals.grossRevenue)}</td>
            <td className="border border-slate-300 px-2 py-2 text-right">{QUANTITY_FORMATTER.format(totals.returnedQuantity)}</td>
            <td className="border border-slate-300 px-2 py-2 text-right">{MONEY_FORMATTER.format(totals.returnedValue)}</td>
            <td className="border border-slate-300 px-2 py-2 text-right font-bold text-blue-700">{MONEY_FORMATTER.format(totals.netRevenue)}</td>
          </tr>
          {visibleRows.map((row) => (
            <tr key={row.code} className="odd:bg-white even:bg-slate-50/70">
              <td className="border border-slate-300 px-2 py-2 font-semibold text-blue-700">{row.code}</td>
              <td className="border border-slate-300 px-2 py-2">{row.name}</td>
              <td className="border border-slate-300 px-2 py-2 text-right">{QUANTITY_FORMATTER.format(row.soldQuantity)}</td>
              <td className="border border-slate-300 px-2 py-2 text-right">{MONEY_FORMATTER.format(row.grossRevenue)}</td>
              <td className="border border-slate-300 px-2 py-2 text-right">{QUANTITY_FORMATTER.format(row.returnedQuantity)}</td>
              <td className="border border-slate-300 px-2 py-2 text-right">{MONEY_FORMATTER.format(row.returnedValue)}</td>
              <td className="border border-slate-300 px-2 py-2 text-right font-semibold">{MONEY_FORMATTER.format(row.netRevenue)}</td>
            </tr>
          ))}
          {visibleRows.length === 0 ? (
            <tr><td colSpan={7} className="border border-slate-300 px-4 py-12 text-center text-slate-500">Không có dữ liệu bán hàng trong phạm vi đã chọn.</td></tr>
          ) : null}
        </tbody>
      </table>

      {!showAllRows ? (
        <footer className="absolute inset-x-10 bottom-7 flex items-center justify-between border-t border-slate-200 pt-2 text-[10px] text-slate-500">
          <span>TN Services · {storeName}</span><span>Trang {pageNumber}/{pageCount}</span>
        </footer>
      ) : null}
    </article>
  );
}

export default function ProductSalesReportPage() {
  const { storeId, storeName } = useStore();
  const viewerRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState(monthStartValue);
  const [endDate, setEndDate] = useState(todayValue);
  const [rows, setRows] = useState<ProductSalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [kinds, setKinds] = useState<Record<ProductKind, boolean>>({ food: true, drink: true, other: true });
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(DEFAULT_REPORT_ZOOM);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bills, products] = await Promise.all([
        getAllBills({ storeId, startDate: parseInputDate(startDate), endDate: parseInputDate(endDate, true), includeCancelled: true }),
        getAllProducts(storeId),
      ]);
      setRows(aggregateProductSales(bills, products));
      setPage(1);
    } catch (caughtError) {
      console.error(caughtError);
      setError("Không tải được dữ liệu báo cáo. Hãy kiểm tra kết nối và thử lại.");
    } finally {
      setLoading(false);
    }
  }, [endDate, startDate, storeId]);

  useEffect(() => { void loadReport(); }, [loadReport]);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((row) => row.category))).sort((a, b) => a.localeCompare(b, "vi")),
    [rows],
  );
  const filteredRows = useMemo(() => {
    const query = normalizeReportText(search);
    return rows.filter((row) => {
      const matchesQuery = !query || normalizeReportText(`${row.code} ${row.name}`).includes(query);
      return matchesQuery && (category === "all" || row.category === category) && kinds[classifyProduct(row)];
    });
  }, [category, kinds, rows, search]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));

  useEffect(() => { setPage((current) => Math.min(current, pageCount)); }, [pageCount]);

  const exportExcel = () => {
    const bytes = createProductSalesExportBytes({
      rows: filteredRows,
      startDate: parseInputDate(startDate),
      endDate: parseInputDate(endDate),
      storeName,
    });
    const blob = new Blob([bytes], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = PRODUCT_SALES_EXPORT_FILENAME;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const exportPdf = () => window.print();

  return (
    <main className="min-h-full bg-[#F4F7F6] font-nunito text-slate-900 print:bg-white">
      <style>{`
        @page { size: A4 portrait; margin: 9mm; }
        @media print {
          body * { visibility: hidden !important; }
          .product-report-print, .product-report-print * { visibility: visible !important; }
          .product-report-print { position: absolute; inset: 0; display: block !important; }
          .product-report-print .product-report-sheet { page-break-after: always; }
          .product-report-print .product-report-sheet:last-child { page-break-after: auto; }
        }
      `}</style>

      <header className="border-b border-emerald-950/10 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-800 text-[#F6C85F]">
              <PackageSearch className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-emerald-950 sm:text-2xl">Báo cáo hàng hoá</h1>
              <p className="truncate text-sm text-slate-600">Bán hàng · {storeName}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-emerald-950/10 bg-white px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1680px]">
          <button type="button" className="relative h-11 px-1 text-sm font-bold text-emerald-900 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#D7A917]">Hàng hoá</button>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1680px] gap-5 p-4 sm:p-6 xl:grid-cols-[286px_minmax(0,1fr)] xl:p-8">
        <aside className="self-start rounded-lg border border-emerald-950/10 bg-white p-4 shadow-[0_2px_7px_rgba(15,23,42,0.06)] xl:sticky xl:top-5">
          <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
            <div><h2 className="text-base font-bold text-emerald-950">Bộ lọc báo cáo</h2><p className="mt-0.5 text-xs text-slate-500">Phạm vi dữ liệu xuất file</p></div>
            <Tooltip content="Tải lại dữ liệu"><button type="button" onClick={() => void loadReport()} disabled={loading} aria-label="Tải lại dữ liệu" className="flex h-9 w-9 items-center justify-center rounded-md text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:opacity-50"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin motion-reduce:animate-none")} /></button></Tooltip>
          </div>

          <div className="space-y-4">
            <div><span className="mb-1 block text-sm font-medium text-slate-700">Mối quan tâm</span><div className="flex h-10 items-center rounded-md border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-900">Bán hàng</div></div>
            <DateRangePicker label="Thời gian" startDate={startDate} endDate={endDate} onChange={(from, to) => { setStartDate(from); setEndDate(to); }} />
            <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">Tìm hàng hoá</span><span className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Mã hoặc tên hàng" className="h-10 w-full rounded-md border border-slate-300 bg-slate-50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-slate-500 hover:border-emerald-500 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/15" /></span></label>
            <div><span className="mb-1 block text-sm font-medium text-slate-700">Nhóm hàng</span><SelectBox value={category} options={[{ value: "all", label: "Tất cả nhóm hàng" }, ...categories.map((value) => ({ value, label: value }))]} onValueChange={(value) => { setCategory(value); setPage(1); }} ariaLabel="Chọn nhóm hàng" className="w-full" triggerClassName="w-full" /></div>
            <fieldset><legend className="mb-2 text-sm font-medium text-slate-700">Loại hàng</legend><div className="grid grid-cols-3 gap-1.5 xl:grid-cols-1">
              {([{ key: "food", label: "Đồ ăn" }, { key: "drink", label: "Đồ uống" }, { key: "other", label: "Khác" }] as const).map((item) => (
                <label key={item.key} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-emerald-950 transition-colors hover:bg-emerald-50"><input type="checkbox" checked={kinds[item.key]} onChange={(event) => { setKinds((current) => ({ ...current, [item.key]: event.target.checked })); setPage(1); }} className="h-4 w-4 accent-emerald-700" />{item.label}</label>
              ))}
            </div></fieldset>
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-lg border border-emerald-950/10 bg-white shadow-[0_2px_7px_rgba(15,23,42,0.06)]">
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 sm:px-4">
            <div className="flex items-center gap-2 text-sm"><span className="font-bold text-emerald-950">Bản xem trước</span><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">{filteredRows.length} mặt hàng</span></div>
            <div className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5">
              <ToolbarButton label="Trang trước" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></ToolbarButton>
              <span className="min-w-[68px] text-center text-xs font-semibold tabular-nums text-slate-600">{page} / {pageCount}</span>
              <ToolbarButton label="Trang sau" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount}><ChevronRight className="h-4 w-4" /></ToolbarButton>
              <span className="mx-1 h-6 w-px bg-slate-200" />
              <ToolbarButton label="Thu nhỏ" onClick={() => setZoom((value) => Math.max(MIN_REPORT_ZOOM, Number((value - REPORT_ZOOM_STEP).toFixed(2))))}><Minus className="h-4 w-4" /></ToolbarButton>
              <button type="button" onClick={() => setZoom(DEFAULT_REPORT_ZOOM)} className="h-9 min-w-[52px] rounded-md px-2 text-xs font-bold tabular-nums text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">{Math.round((zoom / DEFAULT_REPORT_ZOOM) * 100)}%</button>
              <ToolbarButton label="Phóng to" onClick={() => setZoom((value) => Math.min(MAX_REPORT_ZOOM, Number((value + REPORT_ZOOM_STEP).toFixed(2))))}><Plus className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton label="Vừa khung" onClick={() => setZoom(0.85)}><Focus className="h-4 w-4" /></ToolbarButton>
              <ToolbarButton label="Toàn màn hình" onClick={() => viewerRef.current?.requestFullscreen?.()}><Maximize2 className="h-4 w-4" /></ToolbarButton>
              <ExportMenu onExcel={exportExcel} onPdf={exportPdf} disabled={loading} />
            </div>
          </div>

          {error ? <div role="alert" className="m-4 flex items-center justify-between gap-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-800"><span>{error}</span><button type="button" onClick={() => void loadReport()} className="shrink-0 underline underline-offset-2">Thử lại</button></div> : null}
          <div ref={viewerRef} className="min-h-[720px] overflow-auto bg-[#E8ECEB] p-4 sm:p-7 fullscreen:p-8">
            {loading ? (
              <div className="flex min-h-[620px] items-center justify-center text-sm font-semibold text-slate-600"><RefreshCw className="mr-2 h-4 w-4 animate-spin text-emerald-700 motion-reduce:animate-none" />Đang lập báo cáo...</div>
            ) : (
              <div className="mx-auto" style={{ width: `${794 * zoom}px`, minHeight: `${1122 * zoom}px` }}>
                <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
                  <ReportDocument rows={filteredRows} storeName={storeName} startDate={startDate} endDate={endDate} pageNumber={page} pageCount={pageCount} />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="product-report-print hidden print:block">
        {Array.from({ length: pageCount }, (_, index) => (
          <ReportDocument key={index} rows={filteredRows} storeName={storeName} startDate={startDate} endDate={endDate} pageNumber={index + 1} pageCount={pageCount} />
        ))}
      </div>
    </main>
  );
}
