import type { OverviewSnapshot } from "./overviewData";
import OverviewMetricChart from "./OverviewMetricChart";

export default function OverviewSalesChart({ snapshot }: { snapshot: OverviewSnapshot }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <OverviewMetricChart
        id="net-revenue-chart"
        title="Doanh thu thuần"
        subtitle="Chỉ tính đơn hoàn tất"
        metric="revenue"
        metricValue={snapshot.totalRevenue}
        hourlyPoints={snapshot.hourlySeries}
        dailyPoints={snapshot.salesSeries}
      />
      <OverviewMetricChart
        id="customer-count-chart"
        title="Lượng khách hàng"
        subtitle="Quy đổi theo số ly đồ uống (1 ly = 1 khách hàng)"
        metric="customers"
        metricValue={snapshot.customerCount}
        hourlyPoints={snapshot.hourlySeries}
        dailyPoints={snapshot.salesSeries}
      />
    </div>
  );
}
