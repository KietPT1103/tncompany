import type { SalesPoint } from "./overviewData";

export function buildComboChartLayout(series: SalesPoint[]) {
  const width = 720;
  const left = 62;
  const top = 24;
  const plotHeight = 200;
  const plotWidth = width - left * 2;
  const step = plotWidth / Math.max(series.length, 1);
  const maxRevenue = Math.max(1, ...series.map((point) => point.revenue));
  const maxQuantity = Math.max(1, ...series.map((point) => point.customers));
  return {
    width, left, top, plotHeight, plotWidth, maxRevenue, maxQuantity,
    points: series.map((point, index) => ({
      ...point,
      x: left + step * (index + 0.5),
      barWidth: Math.min(32, step * 0.7),
      barHeight: Math.max(0, point.revenue) / maxRevenue * plotHeight,
      lineY: top + plotHeight - Math.max(0, point.customers) / maxQuantity * plotHeight,
    })),
  };
}
