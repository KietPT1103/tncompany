import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  BadgeCheck,
  Camera,
  ChevronLeft,
  ChevronRight,
  FilterX,
  ImageIcon,
  ListChecks,
  MapPin,
  ReceiptText,
  Search,
  UserRound,
  Wallet,
  PackagePlus,
} from "lucide-react";
import {
  getAreas,
  getInventoryReceipts,
  type Area,
  type InventoryReceipt,
  type ReceiptFilters,
  type ReceiptStatus,
} from "@/services/inventoryReceiptService";
import PrivateApiImage from "@/components/PrivateApiImage";
import { SelectBox } from "@/components/ui/SelectBox";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import {
  inventoryReceiptFiltersFromSearchParams,
  inventoryReceiptFiltersToSearchParams,
} from "./inventoryReceiptFilters";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/lib/permissions";

const tabs: Array<{ status?: ReceiptStatus; label: string }> = [
  { status: "pending_explanation", label: "Chưa giải trình" },
  { status: "draft", label: "Đang giải trình" },
  { status: "completed", label: "Đã hoàn thành" },
  { status: "cancelled", label: "Đã hủy" },
  { label: "Tất cả" },
];
const labels: Record<ReceiptStatus, string> = {
  pending_explanation: "Chưa giải trình",
  draft: "Đang giải trình",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
};
const badges: Record<ReceiptStatus, string> = {
  pending_explanation: "bg-amber-100 text-amber-800",
  draft: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-slate-100 text-slate-700",
};
const tabClassName = (active: boolean) =>
  active
    ? "bg-emerald-800 text-white shadow-[0_2px_6px_rgba(6,78,59,0.2)]"
    : "text-emerald-900 hover:bg-emerald-50 hover:text-emerald-950";

const filterControlClassName =
  "min-h-11 w-full rounded-sm border border-emerald-900/25 bg-white px-3 text-sm font-medium text-slate-800 shadow-none outline-none transition-[background-color,border-color,box-shadow,color] duration-150 placeholder:text-slate-500 hover:border-emerald-700 focus:border-[#F6C85F] focus:ring-2 focus:ring-[#F6C85F]/35";
const tableHeaderIconClassName = "h-3.5 w-3.5 shrink-0";

const formatFilterDate = (value?: string) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("vi-VN")
    : "không giới hạn";

export default function FieldInventoryReceiptsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreateManualReceipt = hasPermission(user, "inventory_receipts.create")
    && hasPermission(user, "inventory_receipts.complete");
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [areas, setAreas] = useState<Area[]>([]);
  const [items, setItems] = useState<InventoryReceipt[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const searchKey = searchParams.toString();
  const filters = useMemo(
    () =>
      inventoryReceiptFiltersFromSearchParams(new URLSearchParams(searchKey)),
    [searchKey],
  );
  const key = useMemo(() => JSON.stringify(filters), [filters]);
  useEffect(() => {
    getAreas()
      .then(setAreas)
      .catch(() => setAreas([]));
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getInventoryReceipts(filters)
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setCounts(data.counts);
        setPagination(data.pagination);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setItems([]);
        setError(
          reason instanceof Error
            ? reason.message
            : "Không thể tải danh sách phiếu nhập.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, reloadKey]);
  const change = (next: Partial<ReceiptFilters>) => {
    const updated = { ...filters, ...next, page: next.page ?? 1 };
    setSearchParams(inventoryReceiptFiltersToSearchParams(updated), {
      replace: true,
    });
  };
  const returnTo = `${location.pathname}${searchKey ? `?${searchKey}` : ""}`;
  const dateRangeSummary =
    filters.dateFrom || filters.dateTo
      ? `Từ ${formatFilterDate(filters.dateFrom)} đến ${formatFilterDate(filters.dateTo)}`
      : "Tất cả thời gian";

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-950 sm:p-6 2xl:p-8">
      <div className="mx-auto max-w-[1680px]">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="font-firasans text-sm font-bold uppercase tracking-[.2em] text-[#d6ba5d]">
              Kho vận
            </div>
            <h1 className="mt-2 font-smooch text-4xl font-bold leading-none text-emerald-800 sm:text-5xl">
              Phiếu nhập hiện trường
            </h1>
            <p className="font-firasans mt-2 text-slate-600">
              Theo dõi ảnh hóa đơn, giải trình và trạng thái nhập kho.
            </p>
          </div>
          {canCreateManualReceipt && <button
            type="button"
            onClick={() => navigate("/admin/inventory-receipts/manual")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-emerald-800 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F]"
          >
            <PackagePlus className="h-4 w-4" /> Nhập kho thủ công
          </button>}
        </div>
        <div className="mt-7 overflow-x-auto rounded-sm border border-slate-200 bg-white p-1.5 shadow-sm">
          <div className="flex min-w-max gap-1.5">
            {tabs.map((tab) => {
              const active = filters.status === tab.status;
              return (
                <button
                  key={tab.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => change({ status: tab.status })}
                  className={`group inline-flex min-h-11 items-center gap-2 rounded-sm px-3.5 py-2 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-1 active:scale-[0.98] motion-reduce:transition-none ${tabClassName(active)}`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`inline-flex min-w-6 items-center justify-center rounded-sm px-1.5 py-0.5 text-xs font-bold tabular-nums transition-colors ${active ? "bg-[#F6C85F] text-emerald-950" : "bg-slate-100 text-slate-600 group-hover:bg-[#F6C85F] group-hover:text-emerald-950"}`}
                  >
                    {counts[tab.status || "all"] || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 grid items-end gap-3 rounded-sm border border-slate-200 bg-white p-3 shadow-sm sm:p-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[minmax(240px,2fr)_minmax(150px,1fr)_minmax(300px,2fr)_minmax(160px,1fr)_minmax(190px,1.4fr)_minmax(120px,.8fr)]">
          <label className="relative xl:col-span-2 2xl:col-span-1">
            <span className="sr-only">Tìm theo mã phiếu hoặc địa điểm</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-emerald-800" />
            <input
              value={filters.keyword || ""}
              onChange={(e) => change({ keyword: e.target.value })}
              placeholder="Mã phiếu, địa điểm..."
              className={`${filterControlClassName} pl-10`}
            />
          </label>
          <SelectBox
            ariaLabel="Lọc theo khu vực"
            value={filters.areaId || "all"}
            options={[
              { value: "all", label: "Tất cả khu vực" },
              ...areas.map((area) => ({ value: area.id, label: area.name })),
            ]}
            onValueChange={(value) =>
              change({ areaId: value === "all" ? "" : value })
            }
            className="w-full"
            triggerClassName="h-11 rounded-sm border-emerald-900/25 bg-white text-emerald-950 shadow-none hover:border-emerald-700 hover:bg-slate-50 focus-visible:ring-[#F6C85F]/35"
          />
          <DateRangePicker
            label="Khoảng thời gian"
            startDate={filters.dateFrom || ""}
            endDate={filters.dateTo || ""}
            onChange={(dateFrom, dateTo) => change({ dateFrom, dateTo })}
            hideLabel
            summary={dateRangeSummary}
            className="w-full"
            triggerClassName="h-11 rounded-sm border-emerald-900/25 bg-white text-slate-800 shadow-none hover:border-emerald-700 hover:bg-slate-50 focus-visible:border-[#F6C85F] focus-visible:ring-[#F6C85F]/35 sm:h-11"
          />
          <input
            aria-label="Lọc theo mã tài khoản người chụp ảnh"
            title="Nhập mã tài khoản nhân viên đã chụp ảnh"
            value={filters.employeeId || ""}
            onChange={(e) => change({ employeeId: e.target.value })}
            placeholder="Mã tài khoản chụp"
            className={filterControlClassName}
          />
          <input
            aria-label="Lọc theo tên hoặc mã hàng trong phiếu"
            title="Tìm phiếu có dòng hàng theo tên hoặc mã"
            value={filters.productKeyword || ""}
            onChange={(e) => change({ productKeyword: e.target.value })}
            placeholder="Tên hoặc mã hàng"
            className={filterControlClassName}
          />
          <button
            onClick={() =>
              setSearchParams(
                inventoryReceiptFiltersToSearchParams({
                  status: filters.status,
                  page: 1,
                  limit: 20,
                }),
                { replace: true },
              )
            }
            className="flex min-h-11 items-center justify-center gap-2 rounded-sm border border-emerald-800 bg-white px-3 text-sm font-bold text-emerald-900 shadow-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-emerald-800 hover:bg-emerald-800 hover:text-[#F6C85F] hover:shadow-[0_2px_6px_rgba(6,78,59,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-1 active:scale-[0.98] motion-reduce:transition-none"
          >
            <FilterX className="h-4 w-4" /> Đặt lại
          </button>
        </div>
        <div className="mt-3 overflow-hidden rounded-sm border bg-white">
          <div className="hidden grid-cols-[72px_minmax(180px,1.2fr)_minmax(100px,.7fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(100px,.7fr)_minmax(130px,.8fr)_minmax(120px,.8fr)] gap-4 border-b border-emerald-900 bg-emerald-900 px-5 py-3 text-xs font-bold uppercase text-[#F6C85F] xl:grid 2xl:px-6">
            <span className="inline-flex items-center gap-1.5 font-black text-[#F6C85F]">
              <ImageIcon
                className={tableHeaderIconClassName}
                aria-hidden="true"
              />
              Ảnh
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ReceiptText
                className={tableHeaderIconClassName}
                aria-hidden="true"
              />
              Phiếu
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className={tableHeaderIconClassName} aria-hidden="true" />
              Khu
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Camera className={tableHeaderIconClassName} aria-hidden="true" />
              Người chụp ảnh
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserRound
                className={tableHeaderIconClassName}
                aria-hidden="true"
              />
              Người tạo đơn
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ListChecks
                className={tableHeaderIconClassName}
                aria-hidden="true"
              />
              Số liệu
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Wallet className={tableHeaderIconClassName} aria-hidden="true" />
              Tổng tiền
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck
                className={tableHeaderIconClassName}
                aria-hidden="true"
              />
              Trạng thái
            </span>
          </div>
          {loading ? (
            <div className="p-12 text-center text-slate-500">Đang tải…</div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-sm font-semibold text-red-600">{error}</p>
              <button
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Thử lại
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              Không có phiếu phù hợp.
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                onClick={() =>
                  navigate(`/admin/inventory-receipts/${item.id}`, {
                    state: { returnTo },
                  })
                }
                aria-label={`Mở chi tiết phiếu ${item.receiptCode}`}
                className="grid w-full gap-3 border-b px-5 py-4 text-left transition-colors duration-150 hover:bg-[#FFF8E5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 xl:grid-cols-[72px_minmax(180px,1.2fr)_minmax(100px,.7fr)_minmax(150px,1fr)_minmax(150px,1fr)_minmax(100px,.7fr)_minmax(130px,.8fr)_minmax(120px,.8fr)] xl:items-center xl:gap-4 2xl:px-6"
              >
                <div className="h-14 w-14 overflow-hidden rounded-xl bg-slate-100">
                  {item.thumbnailUrl ? (
                    <PrivateApiImage
                      src={item.thumbnailUrl}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="m-4 h-6 w-6 text-slate-300" />
                  )}
                </div>
                <div>
                  <div className="font-bold">{item.receiptCode}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </div>
                </div>
                <b className="text-slate-700">{item.area.name}</b>
                <span className="text-sm font-medium text-slate-700">
                  {item.capturedByName || item.createdByName || "Chưa xác định"}
                </span>
                <span className="text-sm font-medium text-slate-700">
                  {item.orderCreatorName || "Chưa nhập"}
                </span>
                <span className="text-sm text-slate-600">
                  {item.status === "pending_explanation"
                    ? "Chưa nhập"
                    : `${item.itemCount} món`}
                  <small className="block">{item.imageCount} ảnh</small>
                </span>
                <b>
                  {item.status === "pending_explanation"
                    ? "Chưa nhập"
                    : `${item.totalAmount.toLocaleString("vi-VN")} ₫`}
                </b>
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${item.isLocked ? "bg-amber-100 text-amber-800" : badges[item.status]}`}
                >
                  {item.isLocked ? "Đã khóa" : labels[item.status]}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            aria-label="Trang trước"
            disabled={pagination.page <= 1}
            onClick={() => change({ page: pagination.page - 1 })}
            className="grid min-h-11 min-w-11 place-items-center rounded-xl border bg-white p-2 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft />
          </button>
          <span className="text-sm">
            Trang {pagination.page}/{Math.max(1, pagination.pages)}
          </span>
          <button
            aria-label="Trang sau"
            disabled={pagination.page >= pagination.pages}
            onClick={() => change({ page: pagination.page + 1 })}
            className="grid min-h-11 min-w-11 place-items-center rounded-xl border bg-white p-2 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}
