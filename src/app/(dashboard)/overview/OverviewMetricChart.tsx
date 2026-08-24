import { useState } from "react";
import { BarChart3, UsersRound } from "lucide-react";
import type { SalesPoint } from "./overviewData";

type ChartMetric = "revenue" | "customers";
type ChartView = "hour" | "day";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

const formatCompactMoney = (value: number) => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)} tr`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
};

function MetricValue({
  metric,
  value,
}: {
  metric: ChartMetric;
  value: number;
}) {
  return (
    <span className="whitespace-nowrap text-xl font-bold tabular-nums text-sky-700 sm:text-2xl">
      {metric === "revenue" ? formatMoney(value) : `${formatNumber(value)} khách hàng`}
    </span>
  );
}

export default function OverviewMetricChart({
  id,
  title,
  subtitle,
  metric,
  metricValue,
  hourlyPoints,
  dailyPoints,
}: {
  id: string;
  title: string;
  subtitle: string;
  metric: ChartMetric;
  metricValue: number;
  hourlyPoints: SalesPoint[];
  dailyPoints: SalesPoint[];
}) {
  const [view, setView] = useState<ChartView>("hour");
  const points = view === "hour" ? hourlyPoints : dailyPoints;
  const values = points.map((point) => (metric === "revenue" ? point.revenue : point.customers));
  const maxValue = Math.max(...values, 1);
  const Icon = metric === "revenue" ? BarChart3 : UsersRound;
  const valueLabel = metric === "revenue" ? "Doanh thu" : "khách hàng";
  const accent =
    metric === "customers"
      ? {
          icon: "text-sky-700",
          bar: "bg-sky-600",
          barHover: "group-hover:bg-sky-800",
        }
      : {
          icon: "text-emerald-700",
          bar: "bg-emerald-600",
          barHover: "group-hover:bg-emerald-800",
        };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="min-w-0 overflow-visible rounded-lg border border-slate-200 bg-white"
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${accent.icon}`} aria-hidden="true" />
            <h2 id={`${id}-title`} className="text-base font-semibold text-slate-900">
              {title}
            </h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <MetricValue metric={metric} value={metricValue} />
      </div>

      <div
        className="flex items-center gap-1 border-b border-slate-200 px-5 pt-2"
        role="tablist"
        aria-label={`Chế độ xem ${title.toLocaleLowerCase("vi")}`}
      >
        {([
          ["hour", "Theo giờ"],
          ["day", "Theo ngày"],
        ] as const).map(([option, label]) => {
          const active = view === option;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`${id}-chart`}
              onClick={() => setView(option)}
              className={
                active
                  ? "border-b-2 border-sky-500 px-0.5 pb-2.5 text-sm font-semibold text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                  : "border-b-2 border-transparent px-0.5 pb-2.5 text-sm font-medium text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {metricValue === 0 ? (
        <div className="flex min-h-64 items-center justify-center px-6 py-12 text-center" role="status">
          <div>
            <p className="font-semibold text-slate-800">Chưa có dữ liệu trong kỳ</p>
            <p className="mt-1 text-sm text-slate-500">
              {metric === "customers"
                ? "Các ly đồ uống trong bill hoàn tất sẽ hiển thị tại đây."
                : "Các bill hoàn tất sẽ hiển thị tại đây."}
            </p>
          </div>
        </div>
      ) : (
        <div id={`${id}-chart`} className="overflow-x-auto px-5 pb-5 pt-4">
          <div className="flex min-w-[560px] gap-3 sm:min-w-0">
            <div className="flex h-64 w-12 shrink-0 flex-col justify-between pb-8 pt-10 text-right text-[11px] tabular-nums text-slate-400">
              <span>{metric === "revenue" ? formatCompactMoney(maxValue) : formatNumber(maxValue)}</span>
              <span>{metric === "revenue" ? formatCompactMoney(maxValue / 2) : formatNumber(Math.round(maxValue / 2))}</span>
              <span>0</span>
            </div>

            <div className="relative h-64 min-w-0 flex-1 border-b border-slate-200 bg-[linear-gradient(to_bottom,transparent_39.5%,#e2e8f0_40%,transparent_40.5%,transparent_69.5%,#e2e8f0_70%,transparent_70.5%)]">
              <div className="absolute inset-x-1 bottom-8 top-10 flex items-end justify-between gap-1">
                {points.map((point, index) => {
                  const value = metric === "revenue" ? point.revenue : point.customers;
                  const height = value ? Math.max((value / maxValue) * 100, 3) : 1;
                  const isFirst = index === 0;
                  const isLast = index === points.length - 1;
                  const tooltipPosition = isFirst
                    ? "left-0 translate-x-0"
                    : isLast
                      ? "left-auto right-0 translate-x-0"
                      : "left-1/2 -translate-x-1/2";

                  return (
                    <div key={point.key} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                      <div
                        className={`absolute bottom-full z-20 mb-2 hidden max-w-[180px] whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg group-hover:block ${tooltipPosition}`}
                      >
                        {point.label}: {metric === "revenue" ? formatMoney(value) : `${formatNumber(value)} ${valueLabel}`}
                      </div>
                      <div
                        aria-label={`${point.label}: ${metric === "revenue" ? formatMoney(value) : `${formatNumber(value)} ${valueLabel}`}`}
                        className={`w-full max-w-8 rounded-t ${accent.bar} ${accent.barHover} transition-[height,background-color] duration-200`}
                        style={{ height: `${height}%` }}
                      />
                      <span className="absolute top-full mt-2 w-12 truncate text-center text-[10px] text-slate-500">
                        {shouldShowLabel(points.length, index) ? point.label : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function shouldShowLabel(pointCount: number, index: number) {
  if (pointCount <= 10) return true;
  return index % Math.ceil(pointCount / 8) === 0;
}
