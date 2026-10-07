import { useState } from "react";
import type { SalesPoint } from "./overviewData";
import { buildComboChartLayout } from "./overviewComboChartData";

const number = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);
const compactMoney = (value: number) => value >= 1_000_000
  ? `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value / 1_000_000)} tr`
  : value >= 1_000 ? `${number(value / 1_000)}k` : number(value);

export default function OverviewComboChart({ id, points }: { id: string; points: SalesPoint[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const layout = buildComboChartLayout(points);
  const active = layout.points.find((point) => point.key === activeKey);
  const baseline = layout.top + layout.plotHeight;
  return (
    <div className="px-5 pb-4 pt-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium">
        <span className="inline-flex items-center gap-2 text-emerald-800"><span className="h-3 w-3 rounded-sm bg-emerald-600" aria-hidden="true" />Doanh thu (trục trái)</span>
        <span className="inline-flex items-center gap-2 text-orange-700"><span className="h-0.5 w-5 bg-orange-600" aria-hidden="true" />Số ly bán ra (trục phải)</span>
      </div>
      <p className="mt-2 min-h-5 text-xs tabular-nums text-slate-700" aria-live="polite">
        {active ? `${active.label}: ${number(active.revenue)} ₫ · ${number(active.customers)} ly` : "Di chuột hoặc dùng phím Tab để xem từng mốc."}
      </p>
      <div className="overflow-x-auto" onMouseLeave={() => setActiveKey(null)}>
        <svg viewBox={`0 0 ${layout.width} 260`} className="block w-full min-w-[560px]" role="group" aria-labelledby={`${id}-combo-title ${id}-combo-desc`}>
          <title id={`${id}-combo-title`}>Doanh thu và số ly bán ra</title>
          <desc id={`${id}-combo-desc`}>Cột xanh: doanh thu bằng VND, trục trái. Đường cam: số ly bán ra, trục phải. Chỉ tính đơn hoàn tất.</desc>
          {[0, 0.5, 1].map((ratio) => {
            const y = baseline - ratio * layout.plotHeight;
            return <g key={ratio}>
              <line x1={layout.left} x2={layout.width - layout.left} y1={y} y2={y} stroke="#e2e8f0" />
              <text x={layout.left - 10} y={y + 4} textAnchor="end" className="fill-slate-500 text-[11px]">{compactMoney(layout.maxRevenue * ratio)}</text>
              <text x={layout.width - layout.left + 10} y={y + 4} className="fill-orange-700 text-[11px]">{number(Math.round(layout.maxQuantity * ratio))}</text>
            </g>;
          })}
          {layout.points.map((point, index) => <g key={point.key}>
            <rect x={point.x - point.barWidth / 2} y={baseline - point.barHeight} width={point.barWidth} height={point.barHeight} rx={2} className="fill-emerald-600" />
            {(index === points.length - 1 || index % Math.max(1, Math.ceil(points.length / 8)) === 0) && <text x={point.x} y={baseline + 20} textAnchor="middle" className="fill-slate-500 text-[10px]">{point.label}</text>}
          </g>)}
          <polyline points={layout.points.map((point) => `${point.x},${point.lineY}`).join(" ")} fill="none" stroke="#ea580c" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {layout.points.map((point) => <g key={point.key} tabIndex={0} role="img" aria-label={`${point.label}: ${number(point.revenue)} đồng, ${number(point.customers)} ly`} onMouseEnter={() => setActiveKey(point.key)} onPointerDown={() => setActiveKey(point.key)} onFocus={() => setActiveKey(point.key)} onBlur={() => setActiveKey(null)} className="group outline-none">
            <rect x={point.x - layout.plotWidth / Math.max(points.length, 1) / 2} y={layout.top} width={layout.plotWidth / Math.max(points.length, 1)} height={layout.plotHeight} fill="transparent" className="group-focus-visible:stroke-slate-500" />
            <circle cx={point.x} cy={point.lineY} r={activeKey === point.key || points.length === 1 ? 4 : 0} fill="#ea580c" stroke="white" strokeWidth={1.5} />
          </g>)}
        </svg>
      </div>
    </div>
  );
}
