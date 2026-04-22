"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Monitor,
  RefreshCcw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { getActivityLogs, ActivityLog, ActivityMachine } from "@/services/activityLogService";

const EVENT_OPTIONS = [
  { value: "", label: "Tất cả sự kiện" },
  { value: "app_opened", label: "Mở app" },
  { value: "app_closed", label: "Đóng app" },
  { value: "file_created", label: "Tạo file" },
  { value: "file_changed", label: "Sửa file" },
  { value: "file_deleted", label: "Xóa file" },
  { value: "file_renamed", label: "Đổi tên file" },
  { value: "browser_tab_active", label: "Tab trình duyệt" },
  { value: "dns_domain", label: "Truy cập domain" },
  { value: "agent_started", label: "Agent chạy" },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100, 300];

function formatDateTime(value: string) {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
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
  if (eventType.includes("app")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  return "bg-slate-100 text-slate-700 border-slate-200";
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

function LogRow({ item }: { item: ActivityLog }) {
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
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${eventBadgeClass(item.eventType)}`}>
          {eventLabel(item.eventType)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">
        <div className="font-medium">{item.target || item.appName || item.action || "-"}</div>
        {item.appName && item.target !== item.appName ? (
          <div className="mt-1 text-xs text-slate-500">{item.appName}</div>
        ) : null}
      </td>
      <td className="px-4 py-3 text-sm text-slate-500">{item.processId || "-"}</td>
    </tr>
  );
}

export default function ActivityLogsPage() {
  const [items, setItems] = useState<ActivityLog[]>([]);
  const [machines, setMachines] = useState<ActivityMachine[]>([]);
  const [machineId, setMachineId] = useState("");
  const [eventType, setEventType] = useState("");
  const [startDate, setStartDate] = useState(getTodayInputValue);
  const [endDate, setEndDate] = useState(getTodayInputValue);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filters = useMemo(
    () => ({
      machineId,
      eventType,
      startDate: startDate ? `${startDate} 00:00:00` : undefined,
      endDate: endDate ? `${endDate} 23:59:59` : undefined,
      limit: 300,
    }),
    [machineId, eventType, startDate, endDate]
  );

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageStartIndex = (page - 1) * pageSize;
  const pageItems = items.slice(pageStartIndex, pageStartIndex + pageSize);
  const pageStart = items.length ? pageStartIndex + 1 : 0;
  const pageEnd = Math.min(items.length, pageStartIndex + pageSize);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const data = await getActivityLogs(filters);
      setItems(data.items);
      setMachines(data.machines);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : "Không tải được nhật ký máy.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [filters]);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              <Activity className="h-4 w-4" />
              Activity audit
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              Nhật ký máy thu ngân
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Theo dõi app, file và domain mà agent Windows gửi về server.
            </p>
          </div>

          <Button onClick={() => void loadData()} isLoading={loading} className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Làm mới
          </Button>
        </div>

        {machines.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {machines.map((machine) => (
              <MachineCard key={machine.machineId} machine={machine} />
            ))}
          </div>
        ) : null}

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-500">Máy</span>
                <select
                  value={machineId}
                  onChange={(event) => setMachineId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
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
                <span className="text-xs font-semibold uppercase text-slate-500">Loại sự kiện</span>
                <select
                  value={eventType}
                  onChange={(event) => setEventType(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                >
                  {EVENT_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-500">Từ ngày</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-500">Đến ngày</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                />
              </label>

              <div className="flex items-end">
                <div className="flex h-10 w-full items-center gap-2 rounded-lg bg-slate-100 px-3 text-sm text-slate-600">
                  <Search className="h-4 w-4" />
                  {items.length} dòng log
                </div>
              </div>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase text-slate-500">Dòng/trang</span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option} dòng
                    </option>
                  ))}
                </select>
              </label>
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
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-500">
              Hiển thị {pageStart}-{pageEnd} trong {items.length} dòng log
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                className="gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                Trước
              </Button>
              <div className="min-w-24 rounded-lg bg-slate-100 px-3 py-2 text-center text-sm font-semibold text-slate-700">
                {page}/{totalPages}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                className="gap-1.5"
              >
                Sau
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Máy</th>
                  <th className="px-4 py-3">Sự kiện</th>
                  <th className="px-4 py-3">Mục tiêu</th>
                  <th className="px-4 py-3">PID</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      Đang tải log...
                    </td>
                  </tr>
                ) : pageItems.length ? (
                  pageItems.map((item) => <LogRow key={`${item.machineId}-${item.eventId}`} item={item} />)
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      Chưa có log phù hợp bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-500">
              Trang {page} trên {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              >
                Trước
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
              >
                Sau
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
