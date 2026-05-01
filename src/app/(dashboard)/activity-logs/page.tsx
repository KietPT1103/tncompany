"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
  Download,
  Monitor,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
  ActivityLog,
  ActivityLogPagination,
  ActivityMachine,
  ActivityScreenshotExportJob,
  advanceActivityLogScreenshotExport,
  createActivityLogScreenshotExport,
  deleteActivityLogScreenshots,
  downloadActivityLogScreenshotExportArchive,
  getActivityLog,
  getActivityLogs,
} from "@/services/activityLogService";

const EVENT_OPTIONS = [
  { value: "app_active", label: "Cửa sổ đang dùng" },
  { value: "app_opened", label: "Mở ứng dụng" },
  { value: "app_closed", label: "Đóng ứng dụng" },
  { value: "file_created", label: "Tạo tệp" },
  { value: "file_changed", label: "Sửa tệp" },
  { value: "file_deleted", label: "Xóa tệp" },
  { value: "file_renamed", label: "Đổi tên tệp" },
  { value: "browser_tab_active", label: "Tab trình duyệt" },
  { value: "dns_domain", label: "Truy cập domain" },
  { value: "agent_started", label: "Agent chạy" },
  { value: "agent_crashed", label: "Agent bị lỗi" },
  { value: "keyboard", label: "Gõ phím" },
  { value: "mouse", label: "Click chuột" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const EMPTY_PAGINATION: ActivityLogPagination = {
  page: 1,
  perPage: 25,
  total: 0,
  lastPage: 1,
  from: 0,
  to: 0,
};

type DownloadJobState = {
  machineId: string;
  label: string;
  processed: number;
  total: number;
  status: "queued" | "processing" | "downloading" | "completed" | "failed";
  error: string;
};

function formatDateTime(value: string) {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function getTodayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function eventLabel(eventType: string) {
  return EVENT_OPTIONS.find((option) => option.value === eventType)?.label || eventType;
}

function eventBadgeClass(eventType: string) {
  if (eventType.includes("deleted")) return "bg-rose-50 text-rose-700 border-rose-100";
  if (eventType.includes("browser")) return "bg-violet-50 text-violet-700 border-violet-100";
  if (eventType.includes("file")) return "bg-blue-50 text-blue-700 border-blue-100";
  if (eventType.includes("dns")) return "bg-amber-50 text-amber-700 border-amber-100";
  if (eventType.startsWith("agent_")) return "bg-rose-50 text-rose-700 border-rose-100";
  if (eventType.includes("app")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (eventType === "keyboard") return "bg-cyan-50 text-cyan-700 border-cyan-100";
  if (eventType === "mouse") return "bg-orange-50 text-orange-700 border-orange-100";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function formatDetails(details: ActivityLog["details"]) {
  if (!details || Object.keys(details).length === 0) {
    return "";
  }

  return JSON.stringify(details, null, 2);
}

function splitDetails(details: ActivityLog["details"]) {
  if (!details || Object.keys(details).length === 0) {
    return {
      screenshotDataUrl: "",
      screenshotUrl: "",
      screenshotName: "",
      text: "",
    };
  }

  const normalized = { ...details };
  const screenshotDataUrl =
    typeof normalized.screenshotDataUrl === "string" ? normalized.screenshotDataUrl : "";
  const screenshotUrl = typeof normalized.screenshotUrl === "string" ? normalized.screenshotUrl : "";
  const screenshotName =
    typeof normalized.screenshotName === "string" ? normalized.screenshotName : "";

  delete normalized.screenshotDataUrl;
  delete normalized.screenshotUrl;
  delete normalized.screenshotName;
  delete normalized.screenshotMime;

  return {
    screenshotDataUrl,
    screenshotUrl,
    screenshotName,
    text: formatDetails(normalized),
  };
}

function canOpenDetail(item: ActivityLog) {
  return item.hasScreenshot || item.hasDetails;
}

function buildScreenshotFileName(item: ActivityLog) {
  if (
    item.details &&
    typeof item.details.screenshotName === "string" &&
    item.details.screenshotName.trim() !== ""
  ) {
    return item.details.screenshotName;
  }

  const safeMachine = item.machineId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const safeEvent = item.eventType.replace(/[^a-zA-Z0-9_-]/g, "-");
  const timestamp = item.eventTime.replace(/[^0-9]/g, "").slice(0, 14) || "capture";
  return `${safeMachine}-${safeEvent}-${timestamp}.jpg`;
}

function buildVisiblePages(page: number, lastPage: number) {
  if (lastPage <= 7) {
    return Array.from({ length: lastPage }, (_, index) => index + 1);
  }

  const pages: Array<number | string> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(lastPage - 1, page + 1);

  if (start > 2) {
    pages.push("left-gap");
  }

  for (let current = start; current <= end; current += 1) {
    pages.push(current);
  }

  if (end < lastPage - 1) {
    pages.push("right-gap");
  }

  pages.push(lastPage);
  return pages;
}

function downloadStatusLabel(status: DownloadJobState["status"]) {
  switch (status) {
    case "queued":
      return "Đang chờ";
    case "processing":
      return "Đang xử lý";
    case "downloading":
      return "Đang tải";
    case "completed":
      return "Hoàn tất";
    case "failed":
      return "Thất bại";
    default:
      return status;
  }
}

function MachineCard({ machine }: { machine: ActivityMachine }) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-emerald-600" />
              <div className="truncate text-sm font-semibold text-slate-900">
                {machine.displayName || machine.machineId}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {machine.lastSeenAt ? `Lần cuối: ${formatDateTime(machine.lastSeenAt)}` : "Chưa có log"}
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              machine.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {machine.isActive ? "Active" : "Off"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function LogRow({ item, onOpenDetail }: { item: ActivityLog; onOpenDetail: () => void }) {
  const canExpand = canOpenDetail(item);

  return (
    <tr className="border-b border-slate-100 align-top hover:bg-slate-50">
      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-slate-400" />
          {formatDateTime(item.eventTime)}
        </div>
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{item.machineId}</td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${eventBadgeClass(
            item.eventType
          )}`}
        >
          {eventLabel(item.eventType)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">
        <div className="font-medium">{item.target || item.appName || item.action || "-"}</div>
        {item.appName && item.target !== item.appName ? (
          <div className="mt-1 text-xs text-slate-500">{item.appName}</div>
        ) : null}
      </td>
      <td className="px-4 py-3 text-sm text-slate-500">
        <div>{item.processId ?? "-"}</div>
        <div className="mt-1 text-xs">Nhận: {formatDateTime(item.receivedAt)}</div>
      </td>
      <td className="px-4 py-3 text-right text-sm">
        {canExpand ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenDetail}
            className="h-8 px-2 text-slate-600"
          >
            Chi tiết
          </Button>
        ) : (
          <span className="text-slate-400">-</span>
        )}
      </td>
    </tr>
  );
}

function PaginationControls({
  loading,
  pagination,
  pageJump,
  onPageJumpChange,
  onJump,
  onPageChange,
}: {
  loading: boolean;
  pagination: ActivityLogPagination;
  pageJump: string;
  onPageJumpChange: (value: string) => void;
  onJump: () => void;
  onPageChange: (page: number) => void;
}) {
  const pages = buildVisiblePages(pagination.page, pagination.lastPage);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="text-sm text-slate-500">
        Trang {pagination.page}/{pagination.lastPage} | {pagination.total} dòng log
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || pagination.page <= 1}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pages.map((pageItem) =>
          typeof pageItem === "number" ? (
            <Button
              key={pageItem}
              type="button"
              variant={pageItem === pagination.page ? "default" : "outline"}
              size="sm"
              disabled={loading}
              onClick={() => onPageChange(pageItem)}
              className="min-w-10"
            >
              {pageItem}
            </Button>
          ) : (
            <span key={pageItem} className="px-1 text-sm text-slate-400">
              ...
            </span>
          )
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || pagination.page >= pagination.lastPage}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || pagination.page >= pagination.lastPage}
          onClick={() => onPageChange(pagination.lastPage)}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>

        <div className="ml-1 flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={pagination.lastPage}
            value={pageJump}
            onChange={(event) => onPageJumpChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onJump();
              }
            }}
            className="h-9 w-20 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-500"
          />
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={onJump}>
            Đến trang
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({
  item,
  loading,
  error,
  onClose,
}: {
  item?: ActivityLog;
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  if (!item && !loading && !error) {
    return null;
  }

  const { screenshotDataUrl, screenshotUrl, screenshotName, text: detailsText } = splitDetails(
    item?.details ?? null
  );
  const screenshotSource = screenshotUrl || screenshotDataUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chi tiết log</div>
            {item ? (
              <div className="mt-1 text-sm text-slate-600">
                {item.machineId} | {eventLabel(item.eventType)} | {formatDateTime(item.eventTime)}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {item && screenshotSource ? (
              <a
                href={screenshotSource}
                download={screenshotName || buildScreenshotFileName(item)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Tải ảnh
              </a>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-9 w-9 px-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="max-h-[calc(90vh-80px)] overflow-auto p-5">
          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Đang tải chi tiết...
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {!loading && !error ? (
            <div className="space-y-4">
              {screenshotSource ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ảnh màn hình
                  </div>
                  <img
                    src={screenshotSource}
                    alt="Screenshot captured by Cashier Monitor"
                    className="max-h-[65vh] w-full rounded-xl border border-slate-200 bg-white object-contain"
                  />
                </div>
              ) : null}

              {detailsText ? (
                <pre className="max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-700">
                  {detailsText}
                </pre>
              ) : !screenshotSource ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Không có chi tiết bổ sung.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ActivityLogsPage() {
  const [items, setItems] = useState<ActivityLog[]>([]);
  const [machines, setMachines] = useState<ActivityMachine[]>([]);
  const [machineId, setMachineId] = useState("");
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput.trim());
  const [startDate, setStartDate] = useState(getTodayInputValue);
  const [endDate, setEndDate] = useState(getTodayInputValue);
  const [downloadDate, setDownloadDate] = useState(getTodayInputValue);
  const [selectedDownloadMachineIds, setSelectedDownloadMachineIds] = useState<string[]>([]);
  const [isDownloadPanelOpen, setIsDownloadPanelOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [pageJump, setPageJump] = useState("1");
  const [pagination, setPagination] = useState<ActivityLogPagination>({
    ...EMPTY_PAGINATION,
    perPage: pageSize,
  });
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [detailItems, setDetailItems] = useState<Record<number, ActivityLog>>({});
  const [detailLoading, setDetailLoading] = useState<Record<number, boolean>>({});
  const [detailErrors, setDetailErrors] = useState<Record<number, string>>({});
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadJobs, setDownloadJobs] = useState<DownloadJobState[]>([]);

  const selectedTypesKey = useMemo(() => selectedEventTypes.join("|"), [selectedEventTypes]);
  const hasDateRangeError = Boolean(startDate && endDate && startDate > endDate);
  const showDownloadPanel = isDownloadPanelOpen || downloadJobs.length > 0;

  const filters = useMemo(
    () => ({
      machineId: machineId || undefined,
      eventTypes: selectedEventTypes,
      search: deferredSearch || undefined,
      startDate: startDate ? `${startDate} 00:00:00` : undefined,
      endDate: endDate ? `${endDate} 23:59:59` : undefined,
      page,
      perPage: pageSize,
    }),
    [deferredSearch, endDate, machineId, page, pageSize, selectedEventTypes, startDate]
  );

  const downloadFilters = useMemo(
    () => ({
      machineId: machineId || undefined,
      eventTypes: selectedEventTypes,
      search: deferredSearch || undefined,
      startDate: downloadDate ? `${downloadDate} 00:00:00` : undefined,
      endDate: downloadDate ? `${downloadDate} 23:59:59` : undefined,
    }),
    [deferredSearch, downloadDate, machineId, selectedEventTypes]
  );

  const availableDownloadMachines = useMemo(
    () => (machineId ? machines.filter((machine) => machine.machineId === machineId) : machines),
    [machineId, machines]
  );

  function updateDownloadJob(machineIdValue: string, patch: Partial<DownloadJobState>) {
    setDownloadJobs((current) =>
      current.map((job) =>
        job.machineId === machineIdValue
          ? {
              ...job,
              ...patch,
            }
          : job
      )
    );
  }

  function resetDetailState() {
    setSelectedLogId(null);
    setDetailItems({});
    setDetailLoading({});
    setDetailErrors({});
  }

  async function loadDetail(id: number) {
    if (detailItems[id] || detailLoading[id]) {
      return;
    }

    setDetailLoading((current) => ({
      ...current,
      [id]: true,
    }));
    setDetailErrors((current) => ({
      ...current,
      [id]: "",
    }));

    try {
      const response = await getActivityLog(id);
      setDetailItems((current) => ({
        ...current,
        [id]: response.item,
      }));
    } catch (detailLoadError) {
      setDetailErrors((current) => ({
        ...current,
        [id]: detailLoadError instanceof Error ? detailLoadError.message : "Không tải được chi tiết log.",
      }));
    } finally {
      setDetailLoading((current) => ({
        ...current,
        [id]: false,
      }));
    }
  }

  async function handleDownloadScreenshots() {
    if (!downloadDate) {
      setError("Vui lòng chọn ngày cần tải ảnh.");
      setIsDownloadPanelOpen(true);
      return;
    }

    setError("");
    setDownloadLoading(true);
    setIsDownloadPanelOpen(true);

    try {
      const targetMachines =
        selectedDownloadMachineIds.length > 0
          ? availableDownloadMachines.filter((machine) =>
              selectedDownloadMachineIds.includes(machine.machineId)
            )
          : availableDownloadMachines;

      if (targetMachines.length === 0) {
        setError("Không có máy nào để tải ảnh.");
        return;
      }

      setDownloadJobs(
        targetMachines.map((machine) => ({
          machineId: machine.machineId,
          label: machine.displayName || machine.machineId,
          processed: 0,
          total: 0,
          status: "queued",
          error: "",
        }))
      );

      const results = await Promise.allSettled(
        targetMachines.map((machine) =>
          (async () => {
            let job: ActivityScreenshotExportJob = await createActivityLogScreenshotExport({
              ...downloadFilters,
              machineId: machine.machineId,
            });

            updateDownloadJob(machine.machineId, {
              processed: job.processed,
              total: job.total,
              status: job.status === "ready" ? "downloading" : "processing",
              error: "",
            });

            while (job.status !== "ready") {
              job = await advanceActivityLogScreenshotExport(job.jobId);
              updateDownloadJob(machine.machineId, {
                processed: job.processed,
                total: job.total,
                status: job.status === "ready" ? "downloading" : "processing",
                error: "",
              });
            }

            const archive = await downloadActivityLogScreenshotExportArchive(job);
            const objectUrl = URL.createObjectURL(archive.blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = archive.fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(objectUrl);

            updateDownloadJob(machine.machineId, {
              processed: job.total,
              total: job.total,
              status: "completed",
              error: "",
            });
          })()
        )
      );

      let hasFailure = false;

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          return;
        }

        const machine = targetMachines[index];
        hasFailure = true;
        updateDownloadJob(machine.machineId, {
          status: "failed",
          error: result.reason instanceof Error ? result.reason.message : "Tải thất bại.",
        });
      });

      if (hasFailure) {
        setError("Một số máy tải không thành công. Hãy thử lại với bộ lọc hẹp hơn.");
      }
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Không tải được file ZIP ảnh.");
    } finally {
      setDownloadLoading(false);
    }
  }

  async function handleDeleteScreenshots() {
    if (hasDateRangeError) {
      setError("Từ ngày không được lớn hơn đến ngày.");
      return;
    }

    const confirmed = window.confirm("Xóa toàn bộ ảnh đang khớp với bộ lọc hiện tại?");
    if (!confirmed) {
      return;
    }

    setError("");
    setDeleteLoading(true);

    try {
      await deleteActivityLogScreenshots(filters);
      resetDetailState();
      setPage(1);
      setRefreshSeed((current) => current + 1);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không xóa được ảnh theo bộ lọc.");
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleToggleEventType(eventType: string) {
    setSelectedEventTypes((current) =>
      current.includes(eventType)
        ? current.filter((value) => value !== eventType)
        : [...current, eventType]
    );
  }

  function handleToggleDownloadMachine(machineIdValue: string) {
    setSelectedDownloadMachineIds((current) =>
      current.includes(machineIdValue)
        ? current.filter((value) => value !== machineIdValue)
        : [...current, machineIdValue]
    );
  }

  function handleJumpPage() {
    const nextPage = Number(pageJump);
    if (!Number.isFinite(nextPage)) {
      setPageJump(String(pagination.page));
      return;
    }

    setPage(Math.min(pagination.lastPage, Math.max(1, Math.trunc(nextPage))));
  }

  function handleOpenDetail(item: ActivityLog) {
    setSelectedLogId(item.id);

    if (canOpenDetail(item) && !detailItems[item.id] && !detailLoading[item.id]) {
      void loadDetail(item.id);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, machineId, pageSize, selectedTypesKey, startDate, endDate]);

  useEffect(() => {
    setPageJump(String(pagination.page));
  }, [pagination.page]);

  useEffect(() => {
    const allowedMachineIds = new Set(availableDownloadMachines.map((machine) => machine.machineId));

    setSelectedDownloadMachineIds((current) => {
      const next = current.filter((value) => allowedMachineIds.has(value));
      return next.length === current.length ? current : next;
    });
  }, [availableDownloadMachines]);

  useEffect(() => {
    resetDetailState();
  }, [deferredSearch, machineId, selectedTypesKey, startDate, endDate]);

  useEffect(() => {
    if (hasDateRangeError) {
      setItems([]);
      setPagination({
        ...EMPTY_PAGINATION,
        page: 1,
        perPage: pageSize,
      });
      setLoading(false);
      setError("Từ ngày không được lớn hơn đến ngày.");
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError("");

    void getActivityLogs(filters)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setItems(data.items);
        setMachines(data.machines);
        setPagination(data.pagination);

        if (data.pagination.page !== page) {
          setPage(data.pagination.page);
        }
      })
      .catch((loadError) => {
        if (cancelled) {
          return;
        }

        console.error(loadError);
        setItems([]);
        setPagination({
          ...EMPTY_PAGINATION,
          page: 1,
          perPage: pageSize,
        });
        setError(loadError instanceof Error ? loadError.message : "Không tải được nhật ký máy.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters, hasDateRangeError, page, pageSize, refreshSeed]);

  const selectedItem = selectedLogId
    ? detailItems[selectedLogId] ?? items.find((item) => item.id === selectedLogId)
    : undefined;

  return (
    <main className="min-h-screen bg-slate-50/70 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[28px] border border-slate-200/80 bg-white px-5 py-5 shadow-sm md:px-7 md:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                <Activity className="h-4 w-4" />
                Nhật ký hoạt động
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                Nhật ký máy thu ngân
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Theo dõi theo trang, lọc nhiều loại sự kiện, tìm nhanh và xuất ảnh đúng theo bộ lọc hiện tại.
              </p>
            </div>

            <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">
              <Button
                type="button"
                variant={showDownloadPanel ? "default" : "outline"}
                onClick={() => setIsDownloadPanelOpen((current) => !current)}
                disabled={downloadLoading && downloadJobs.length > 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {showDownloadPanel ? "Ẩn tải xuống" : "Tải xuống"}
              </Button>
              <Button
                onClick={() => setRefreshSeed((current) => current + 1)}
                isLoading={loading}
                className="gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                Làm mới
              </Button>
            </div>
          </div>

          {showDownloadPanel ? (
            <div className="mt-5 space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/60 p-4 md:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-2xl">
                  <div className="text-sm font-semibold text-slate-900">Tải ảnh theo bộ lọc</div>
                  <div className="mt-1 text-sm text-slate-500">
                    Tải sẽ dùng bộ lọc hiện tại. Nếu không chọn máy ở dưới, hệ thống sẽ tải tất cả máy phù hợp.
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row xl:items-end">
                  <label className="flex min-w-[170px] flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Ngày tải ảnh
                    </span>
                    <input
                      type="date"
                      value={downloadDate}
                      onChange={(event) => setDownloadDate(event.target.value)}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleDownloadScreenshots()}
                    isLoading={downloadLoading}
                    disabled={deleteLoading}
                    className="gap-2 sm:min-w-[180px]"
                  >
                    <Download className="h-4 w-4" />
                    Bắt đầu tải
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleDeleteScreenshots()}
                    isLoading={deleteLoading}
                    disabled={downloadLoading}
                    className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50 sm:min-w-[220px]"
                  >
                    <X className="h-4 w-4" />
                    Xóa ảnh theo bộ lọc
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                Ảnh sẽ được xuất thành file ZIP theo từng máy. Máy nào hoàn tất trước sẽ tự tải xuống trước.
              </div>

              {availableDownloadMachines.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Chọn máy để tải</div>
                      <div className="text-sm text-slate-500">
                        Bỏ trống nghĩa là dùng tất cả máy trong bộ lọc hiện tại.
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDownloadMachineIds([])}
                      disabled={selectedDownloadMachineIds.length === 0}
                      className="h-8 px-2 text-slate-500"
                    >
                      Chọn tất cả
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDownloadMachineIds([])}
                      className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                        selectedDownloadMachineIds.length === 0
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      Tất cả máy
                    </button>
                    {availableDownloadMachines.map((machine) => {
                      const active = selectedDownloadMachineIds.includes(machine.machineId);

                      return (
                        <button
                          key={machine.machineId}
                          type="button"
                          onClick={() => handleToggleDownloadMachine(machine.machineId)}
                          className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                            active
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {machine.displayName || machine.machineId}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {downloadJobs.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-3">
                    <div className="text-sm font-semibold text-slate-900">Tiến độ tải ảnh</div>
                    <div className="text-sm text-slate-500">
                      Mỗi máy chạy một job riêng. File ZIP sẽ tự tải khi job đó hoàn tất.
                    </div>
                  </div>

                  <div className="space-y-3">
                    {downloadJobs.map((job) => {
                      const progress =
                        job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 0;

                      return (
                        <div key={job.machineId} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">{job.label}</div>
                              <div className="text-xs text-slate-500">
                                {job.processed}/{job.total || "?"} ảnh
                              </div>
                            </div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {downloadStatusLabel(job.status)}
                            </div>
                          </div>

                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full transition-all ${
                                job.status === "failed"
                                  ? "bg-rose-500"
                                  : job.status === "completed"
                                  ? "bg-emerald-500"
                                  : "bg-sky-500"
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>

                          {job.error ? <div className="mt-2 text-xs text-rose-600">{job.error}</div> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {machines.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {machines.map((machine) => (
              <MachineCard key={machine.machineId} machine={machine} />
            ))}
          </div>
        ) : null}

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="space-y-5 p-4 md:p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Bộ lọc nhật ký</div>
                <div className="text-sm text-slate-500">
                  Thu hẹp dữ liệu theo máy, khoảng thời gian và loại sự kiện.
                </div>
              </div>
              <div className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-medium text-slate-700">
                <Search className="h-4 w-4 text-slate-500" />
                {pagination.total} dòng log
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.65fr)_minmax(0,0.95fr)_minmax(0,0.95fr)]">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Máy</span>
                <select
                  value={machineId}
                  onChange={(event) => setMachineId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500"
                >
                  <option value="">Tất cả máy</option>
                  {machines.map((machine) => (
                    <option key={machine.machineId} value={machine.machineId}>
                      {machine.displayName || machine.machineId}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tìm kiếm</span>
                <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 transition focus-within:border-emerald-500">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Máy, ứng dụng, thao tác, mục tiêu..."
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Từ ngày</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Đến ngày</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500"
                />
              </label>
            </div>

            <div className="grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2 xl:grid-cols-[240px_minmax(0,1fr)]">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Dòng trên trang
                </span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-500"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option} dòng
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-end">
                <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {selectedEventTypes.length > 0
                    ? `Đang lọc ${selectedEventTypes.length} loại sự kiện.`
                    : "Chưa chọn loại sự kiện, đang hiển thị tất cả."}
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Loại sự kiện
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    Chọn nhiều nhóm để lọc chéo dữ liệu.
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={selectedEventTypes.length === 0}
                  onClick={() => setSelectedEventTypes([])}
                  className="h-8 px-2 text-slate-500"
                >
                  Bỏ chọn
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {EVENT_OPTIONS.map((option) => {
                  const active = selectedEventTypes.includes(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleToggleEventType(option.value)}
                      className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        ) : null}

        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="border-b border-slate-100 bg-white px-4 py-3">
            <PaginationControls
              loading={loading}
              pagination={pagination}
              pageJump={pageJump}
              onPageJumpChange={setPageJump}
              onJump={handleJumpPage}
              onPageChange={setPage}
            />
          </div>
          <div className="border-b border-slate-100 bg-white px-4 py-3 text-sm text-slate-500">
            Hiển thị {pagination.from}-{pagination.to} trong {pagination.total} dòng log
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Máy</th>
                  <th className="px-4 py-3">Sự kiện</th>
                  <th className="px-4 py-3">Mục tiêu</th>
                  <th className="px-4 py-3">PID / thời điểm nhận</th>
                  <th className="px-4 py-3 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                      Đang tải log...
                    </td>
                  </tr>
                ) : items.length > 0 ? (
                  items.map((item) => (
                    <LogRow
                      key={`${item.machineId}-${item.eventId}`}
                      item={item}
                      onOpenDetail={() => handleOpenDetail(item)}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                      Chưa có log phù hợp với bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-white px-4 py-3">
            <PaginationControls
              loading={loading}
              pagination={pagination}
              pageJump={pageJump}
              onPageJumpChange={setPageJump}
              onJump={handleJumpPage}
              onPageChange={setPage}
            />
          </div>
        </Card>
      </div>

      <DetailModal
        item={selectedItem}
        loading={selectedLogId ? !!detailLoading[selectedLogId] : false}
        error={selectedLogId ? detailErrors[selectedLogId] ?? "" : ""}
        onClose={() => setSelectedLogId(null)}
      />
    </main>
  );
}
