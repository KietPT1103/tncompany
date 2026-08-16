import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/features/auth/AuthProvider";
import { getBills } from "@/services/api";
import type { Bill } from "@/types";

const STORES = [
  { id: "cafe", name: "Cafe" },
  { id: "restaurant", name: "Bếp" },
  { id: "bakery", name: "Tiệm bánh" },
  { id: "farm", name: "Farm" },
] as const;

type Tab = "overview" | "sales" | "machines" | "account";
type RangeMode = "day" | "week" | "month" | "custom";
type ProductStat = { name: string; quantity: number; revenue: number };
type MachineStat = { name: string; orders: number; revenue: number; lastSale?: Date };
type DateRange = { start: Date; end: Date; previousStart: Date; previousEnd: Date };

const localKey = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};
const dayStart = (date: Date) => { const value = new Date(date); value.setHours(0, 0, 0, 0); return value; };
const dayEnd = (date: Date) => { const value = new Date(date); value.setHours(23, 59, 59, 999); return value; };
const createdAt = (bill: Bill) => bill.createdAt?.seconds ? new Date(bill.createdAt.seconds * 1000) : undefined;
const money = (value: number) => `${Math.round(value).toLocaleString("vi-VN")} ₫`;
const compactMoney = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}tr` : value >= 1_000 ? `${Math.round(value / 1_000)}k` : `${Math.round(value)}`;
const change = (current: number, previous: number) => previous ? ((current - previous) / previous) * 100 : current ? 100 : 0;
const parseDate = (value: string) => {
  const parts = value.trim().split(/[\/-]/).map(Number);
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};
const inputDate = (date: Date) => date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

function getRange(mode: RangeMode, anchor: Date, customStart: Date, customEnd: Date): DateRange {
  let start = dayStart(anchor);
  let end = dayEnd(anchor);
  if (mode === "week") {
    const mondayOffset = (anchor.getDay() + 6) % 7;
    start = dayStart(new Date(anchor));
    start.setDate(start.getDate() - mondayOffset);
    end = dayEnd(new Date(start));
    end.setDate(end.getDate() + 6);
  } else if (mode === "month") {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    end = dayEnd(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0));
  } else if (mode === "custom") {
    start = dayStart(customStart);
    end = dayEnd(customEnd);
  }
  const duration = end.getTime() - start.getTime() + 1;
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - duration + 1);
  return { start, end, previousStart, previousEnd };
}

function SectionTitle({ title, caption }: { title: string; caption?: string }) {
  return <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>{title}</Text>{caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}</View></View>;
}

function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><Text style={styles.emptyIcon}>⌁</Text><Text style={styles.emptyText}>{text}</Text></View>;
}

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [storeId, setStoreId] = useState<(typeof STORES)[number]["id"]>("cafe");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [rangeMode, setRangeMode] = useState<RangeMode>("day");
  const [customStart, setCustomStart] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 6); return date; });
  const [customEnd, setCustomEnd] = useState(() => new Date());
  const [customStartText, setCustomStartText] = useState(() => inputDate(customStart));
  const [customEndText, setCustomEndText] = useState(() => inputDate(customEnd));
  const [customError, setCustomError] = useState("");
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date>();

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user]);

  const activeRange = useMemo(
    () => getRange(rangeMode, selectedDate, customStart, customEnd),
    [customEnd, customStart, rangeMode, selectedDate],
  );

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const chartStart = new Date(activeRange.start);
      if (rangeMode === "day") chartStart.setDate(chartStart.getDate() - 6);
      const requestStart = activeRange.previousStart < chartStart ? activeRange.previousStart : chartStart;
      setBills(await getBills({ storeId, startDate: requestStart, endDate: activeRange.end, includeCancelled: true }));
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeRange, rangeMode, storeId]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const completed = bills.filter((bill) => bill.status !== "cancelled");
    const inRange = (bill: Bill, start: Date, end: Date) => {
      const date = createdAt(bill);
      return date ? date >= start && date <= end : false;
    };
    const current = completed.filter((bill) => inRange(bill, activeRange.start, activeRange.end));
    const previous = completed.filter((bill) => inRange(bill, activeRange.previousStart, activeRange.previousEnd));
    const cancelled = bills.filter((bill) => bill.status === "cancelled" && inRange(bill, activeRange.start, activeRange.end));
    const revenue = current.reduce((sum, bill) => sum + Number(bill.total || 0), 0);
    const previousRevenue = previous.reduce((sum, bill) => sum + Number(bill.total || 0), 0);
    const cash = current.filter((bill) => bill.paymentMethod !== "transfer").reduce((sum, bill) => sum + Number(bill.total || 0), 0);

    const chartStart = rangeMode === "day" ? (() => { const value = new Date(selectedDate); value.setDate(value.getDate() - 6); return dayStart(value); })() : activeRange.start;
    const chartEnd = rangeMode === "day" ? activeRange.end : activeRange.end;
    const totalChartDays = Math.max(1, Math.round((dayStart(chartEnd).getTime() - dayStart(chartStart).getTime()) / 86_400_000) + 1);
    const chartStep = totalChartDays > 14 ? Math.ceil(totalChartDays / 10) : 1;
    const days = Array.from({ length: Math.ceil(totalChartDays / chartStep) }, (_, index) => {
      const start = dayStart(new Date(chartStart)); start.setDate(start.getDate() + index * chartStep);
      const end = dayEnd(new Date(start)); end.setDate(end.getDate() + chartStep - 1);
      if (end > chartEnd) end.setTime(chartEnd.getTime());
      const items = completed.filter((bill) => inRange(bill, start, end));
      return {
        label: chartStep === 1 ? `${start.getDate()}/${start.getMonth() + 1}` : `${start.getDate()}-${end.getDate()}/${end.getMonth() + 1}`,
        revenue: items.reduce((sum, bill) => sum + Number(bill.total || 0), 0),
      };
    });

    const productMap = new Map<string, ProductStat>();
    current.forEach((bill) => bill.items.forEach((item) => {
      const value = productMap.get(item.name) || { name: item.name, quantity: 0, revenue: 0 };
      value.quantity += Number(item.quantity || 0); value.revenue += Number(item.lineTotal || 0); productMap.set(item.name, value);
    }));
    const products = [...productMap.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 5);

    const machineMap = new Map<string, MachineStat>();
    current.forEach((bill) => {
      const name = bill.cashierName?.trim() || (bill.orderSource === "bar" ? "Máy quầy bar" : "Máy POS chính");
      const value = machineMap.get(name) || { name, orders: 0, revenue: 0 };
      value.orders += 1; value.revenue += Number(bill.total || 0);
      const date = createdAt(bill); if (date && (!value.lastSale || date > value.lastSale)) value.lastSale = date;
      machineMap.set(name, value);
    });
    const shifts = [
      { name: "Ca 1", time: "00:00–08:00", startHour: 0, endHour: 8 },
      { name: "Ca 2", time: "08:00–16:00", startHour: 8, endHour: 16 },
      { name: "Ca 3", time: "16:00–24:00", startHour: 16, endHour: 24 },
    ].map((shift) => {
      const items = current.filter((bill) => {
        const date = createdAt(bill);
        return date ? date.getHours() >= shift.startHour && date.getHours() < shift.endHour : false;
      });
      return { ...shift, orders: items.length, revenue: items.reduce((sum, bill) => sum + Number(bill.total || 0), 0) };
    });
    return { current, previous, cancelled, revenue, previousRevenue, cash, transfer: revenue - cash, days, products, shifts, machines: [...machineMap.values()].sort((a, b) => b.revenue - a.revenue) };
  }, [activeRange, bills, rangeMode, selectedDate]);

  const maxDay = Math.max(...stats.days.map((day) => day.revenue), 1);
  const revenueDelta = change(stats.revenue, stats.previousRevenue);
  const orderDelta = change(stats.current.length, stats.previous.length);
  const storeName = STORES.find((store) => store.id === storeId)?.name || "Cửa hàng";
  const isToday = localKey(selectedDate) === localKey(new Date());
  const rangeLabel = rangeMode === "day"
    ? (isToday ? "Hôm nay" : selectedDate.toLocaleDateString("vi-VN", { weekday: "long" }))
    : rangeMode === "week"
      ? `${activeRange.start.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} – ${activeRange.end.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`
      : rangeMode === "month"
        ? selectedDate.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })
        : `${inputDate(activeRange.start)} – ${inputDate(activeRange.end)}`;
  const comparisonLabel = rangeMode === "day" ? "so với hôm trước" : rangeMode === "week" ? "so với tuần trước" : rangeMode === "month" ? "so với tháng trước" : "so với khoảng trước";
  const periodName = rangeMode === "day" ? (isToday ? "hôm nay" : "trong ngày") : rangeMode === "week" ? "trong tuần" : rangeMode === "month" ? "trong tháng" : "trong khoảng";

  function moveDate(amount: number) {
    const next = new Date(selectedDate);
    if (rangeMode === "month") next.setMonth(next.getMonth() + amount);
    else next.setDate(next.getDate() + amount * (rangeMode === "week" ? 7 : 1));
    if (next > new Date()) return;
    setSelectedDate(next);
  }

  function applyCustomRange() {
    const start = parseDate(customStartText);
    const end = parseDate(customEndText);
    if (!start || !end) return setCustomError("Nhập ngày đúng định dạng DD/MM/YYYY.");
    if (start > end) return setCustomError("Ngày bắt đầu phải trước ngày kết thúc.");
    if (end > new Date()) return setCustomError("Không thể chọn ngày trong tương lai.");
    setCustomError("");
    setCustomStart(start);
    setCustomEnd(end);
  }

  async function logout() { await signOut(); router.replace("/login"); }

  return <SafeAreaView edges={["top"]} style={styles.safe}>
    <View style={styles.topbar}>
      <View><Text style={styles.eyebrow}>TN ADMIN</Text><Text style={styles.greeting}>Xin chào, {user?.displayName || "Admin"}</Text></View>
      <Pressable onPress={() => setTab("account")} style={styles.avatar}><Text style={styles.avatarText}>{(user?.displayName || "A").slice(0, 1).toUpperCase()}</Text><View style={styles.online} /></Pressable>
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storeStrip} contentContainerStyle={styles.storeStripContent}>
      {STORES.map((store) => <Pressable key={store.id} onPress={() => setStoreId(store.id)} style={[styles.storeChip, store.id === storeId && styles.storeChipActive]}><Text style={[styles.storeChipText, store.id === storeId && styles.storeChipTextActive]}>{store.name}</Text></Pressable>)}
    </ScrollView>

    <View style={styles.periodTabs}>
      {([[
        "day", "Ngày"], ["week", "Tuần"], ["month", "Tháng"], ["custom", "Khoảng ngày"]
      ] as [RangeMode, string][]).map(([mode, label]) => <Pressable key={mode} onPress={() => setRangeMode(mode)} style={[styles.periodTab, rangeMode === mode && styles.periodTabActive]}><Text style={[styles.periodTabText, rangeMode === mode && styles.periodTabTextActive]}>{label}</Text></Pressable>)}
    </View>

    {rangeMode === "custom" ? <View style={styles.customRange}>
      <View style={styles.customField}><Text style={styles.customLabel}>Từ ngày</Text><TextInput keyboardType="numbers-and-punctuation" onChangeText={setCustomStartText} placeholder="DD/MM/YYYY" style={styles.customInput} value={customStartText} /></View>
      <Text style={styles.customDash}>–</Text>
      <View style={styles.customField}><Text style={styles.customLabel}>Đến ngày</Text><TextInput keyboardType="numbers-and-punctuation" onChangeText={setCustomEndText} placeholder="DD/MM/YYYY" style={styles.customInput} value={customEndText} /></View>
      <Pressable onPress={applyCustomRange} style={styles.applyButton}><Text style={styles.applyButtonText}>Xem</Text></Pressable>
      {customError ? <Text style={styles.customError}>{customError}</Text> : null}
    </View> : null}

    <View style={styles.dateBar}>
      <Pressable disabled={rangeMode === "custom"} onPress={() => moveDate(-1)} style={[styles.dateArrow, rangeMode === "custom" && styles.dateArrowDisabled]}><Text style={styles.dateArrowText}>‹</Text></Pressable>
      <View><Text style={styles.dateLabel}>{rangeLabel}</Text><Text style={styles.dateValue}>{rangeMode === "day" ? selectedDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : `${stats?.current?.length || 0} giao dịch`}</Text></View>
      <Pressable disabled={isToday || rangeMode === "custom"} onPress={() => moveDate(1)} style={[styles.dateArrow, (isToday || rangeMode === "custom") && styles.dateArrowDisabled]}><Text style={styles.dateArrowText}>›</Text></Pressable>
    </View>

    {loading ? <View style={styles.loading}><ActivityIndicator color="#08745a" size="large" /><Text style={styles.loadingText}>Đang tổng hợp số liệu…</Text></View> :
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#08745a" />}>
      {error ? <Pressable onPress={() => void load()} style={styles.error}><Text style={styles.errorTitle}>Chưa tải được dữ liệu</Text><Text style={styles.errorText}>{error}</Text><Text style={styles.retry}>Chạm để thử lại</Text></Pressable> : null}

      {tab === "overview" ? <>
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} /><Text style={styles.heroLabel}>DOANH THU {periodName.toUpperCase()}</Text><Text style={styles.heroValue}>{money(stats.revenue)}</Text>
          <View style={styles.heroFooter}><View style={[styles.deltaPill, revenueDelta < 0 && styles.deltaPillDown]}><Text style={styles.deltaText}>{revenueDelta >= 0 ? "↗" : "↘"} {Math.abs(revenueDelta).toFixed(1)}%</Text></View><Text style={styles.heroCompare}>{comparisonLabel}</Text></View>
        </View>
        <View style={styles.metricGrid}>
          <View style={styles.metricCard}><Text style={styles.metricIcon}>▤</Text><Text style={styles.metricLabel}>Đơn hoàn thành</Text><Text style={styles.metricValue}>{stats.current.length}</Text><Text style={[styles.metricChange, orderDelta < 0 && styles.negative]}>{orderDelta >= 0 ? "+" : ""}{orderDelta.toFixed(1)}%</Text></View>
          <View style={styles.metricCard}><Text style={styles.metricIcon}>◎</Text><Text style={styles.metricLabel}>Trung bình đơn</Text><Text style={styles.metricValue}>{compactMoney(stats.current.length ? stats.revenue / stats.current.length : 0)}</Text><Text style={styles.metricNote}>{stats.cancelled.length} đơn hủy</Text></View>
        </View>
        {rangeMode === "day" ? <View style={styles.card}><SectionTitle title="Doanh thu 3 ca" caption="Ca 1: 00–08h · Ca 2: 08–16h · Ca 3: 16–24h" /><View style={styles.shiftGrid}>{stats.shifts.map((shift, index) => <View key={shift.name} style={[styles.shiftCard, index === 1 && styles.shiftCardActive]}><View style={styles.shiftHeader}><Text style={[styles.shiftName, index === 1 && styles.shiftNameActive]}>{shift.name}</Text><Text style={styles.shiftTime}>{shift.time}</Text></View><Text numberOfLines={1} adjustsFontSizeToFit style={styles.shiftRevenue}>{money(shift.revenue)}</Text><Text style={styles.shiftOrders}>{shift.orders} đơn</Text></View>)}</View></View> : null}
        <View style={styles.card}><SectionTitle title={rangeMode === "day" ? "Doanh thu 7 ngày" : `Doanh thu theo ${rangeMode === "month" ? "tháng" : "kỳ"}`} caption={`Xu hướng tại ${storeName}`} /><View style={styles.chart}>
          {stats.days.map((day, index) => { const active = index === stats.days.length - 1; const height = day.revenue ? Math.max(18, (day.revenue / maxDay) * 120) : 4; return <View key={`${day.label}-${index}`} style={styles.barColumn}><Text style={styles.barValue}>{day.revenue ? compactMoney(day.revenue) : ""}</Text><View style={styles.barTrack}><View style={[styles.bar, { height }, active && styles.barActive]} /></View><Text style={[styles.barLabel, active && styles.barLabelActive]}>{day.label}</Text></View>; })}
        </View></View>
        <View style={styles.card}><SectionTitle title="Thanh toán" caption="Cơ cấu doanh thu trong ngày" /><View style={styles.paymentRow}><View style={styles.paymentItem}><View style={[styles.paymentDot, { backgroundColor: "#08745a" }]} /><View><Text style={styles.paymentLabel}>Tiền mặt</Text><Text style={styles.paymentValue}>{money(stats.cash)}</Text></View></View><View style={styles.paymentItem}><View style={[styles.paymentDot, { backgroundColor: "#f59e0b" }]} /><View><Text style={styles.paymentLabel}>Chuyển khoản</Text><Text style={styles.paymentValue}>{money(stats.transfer)}</Text></View></View></View><View style={styles.payTrack}>{stats.revenue ? <><View style={[styles.payCash, { flex: stats.cash || 0.001 }]} /><View style={[styles.payTransfer, { flex: stats.transfer || 0.001 }]} /></> : null}</View></View>
        <View style={styles.card}><SectionTitle title="Món bán chạy" caption="Theo số lượng đã bán" />{stats.products.length ? stats.products.slice(0, 4).map((product, index) => <View style={styles.listRow} key={product.name}><View style={[styles.rank, index === 0 && styles.rankFirst]}><Text style={[styles.rankText, index === 0 && styles.rankTextFirst]}>{index + 1}</Text></View><View style={styles.listMain}><Text numberOfLines={1} style={styles.listTitle}>{product.name}</Text><Text style={styles.listCaption}>{product.quantity} món</Text></View><Text style={styles.listAmount}>{compactMoney(product.revenue)}</Text></View>) : <Empty text="Chưa có món bán ra trong ngày này" />}</View>
      </> : null}

      {tab === "sales" ? <>
        <View style={styles.summaryBanner}><Text style={styles.summaryTitle}>Tóm tắt bán hàng</Text><Text style={styles.summaryText}>{stats.current.length ? `${stats.current.length} đơn hoàn thành mang về ${money(stats.revenue)}. ${stats.products[0] ? `${stats.products[0].name} là món bán chạy nhất.` : ""}` : "Chưa có giao dịch trong kỳ được chọn."}</Text></View>
        <View style={styles.card}><SectionTitle title="Hóa đơn gần nhất" caption={`${stats.current.length} giao dịch hoàn thành`} />{stats.current.length ? [...stats.current].sort((a, b) => (createdAt(b)?.getTime() || 0) - (createdAt(a)?.getTime() || 0)).map((bill) => <View style={styles.billRow} key={bill.id}><View style={styles.billIcon}><Text>▤</Text></View><View style={styles.listMain}><Text style={styles.listTitle}>{bill.tableNumber || "Bán mang đi"}</Text><Text style={styles.listCaption}>{createdAt(bill)?.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} · {createdAt(bill)?.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · {bill.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} món · {bill.paymentMethod === "transfer" ? "Chuyển khoản" : "Tiền mặt"}</Text></View><Text style={styles.listAmount}>{compactMoney(bill.total)}</Text></View>) : <Empty text="Chưa có hóa đơn trong kỳ này" />}</View>
      </> : null}

      {tab === "machines" ? <>
        <View style={styles.summaryBanner}><Text style={styles.summaryKicker}>MÁY ĐANG PHÁT SINH GIAO DỊCH</Text><Text style={styles.summaryNumber}>{stats.machines.length}</Text><Text style={styles.summaryText}>Doanh thu được nhóm theo máy hoặc nhân viên thu ngân tạo bill.</Text></View>
        <View style={styles.card}><SectionTitle title="Doanh thu từng máy" caption="Xếp hạng theo doanh thu" />{stats.machines.length ? stats.machines.map((machine, index) => <View style={styles.machineCard} key={machine.name}><View style={styles.machineTop}><View style={styles.machineIcon}><Text style={styles.machineIconText}>POS</Text><View style={styles.machineOnline} /></View><View style={styles.listMain}><Text style={styles.listTitle}>{machine.name}</Text><Text style={styles.listCaption}>{machine.orders} hóa đơn · Gần nhất {machine.lastSale?.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</Text></View><View><Text style={styles.machineRank}>#{index + 1}</Text></View></View><View style={styles.machineRevenue}><Text style={styles.machineRevenueLabel}>Doanh thu</Text><Text style={styles.machineRevenueValue}>{money(machine.revenue)}</Text></View></View>) : <Empty text="Chưa có máy nào phát sinh giao dịch" />}</View>
      </> : null}

      {tab === "account" ? <>
        <View style={styles.profileCard}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{(user?.displayName || "A").slice(0, 1).toUpperCase()}</Text></View><Text style={styles.profileName}>{user?.displayName}</Text><Text style={styles.profileEmail}>{user?.email}</Text><View style={styles.adminBadge}><Text style={styles.adminBadgeText}>QUẢN TRỊ VIÊN</Text></View></View>
        <View style={styles.card}><SectionTitle title="Thông tin ứng dụng" /><View style={styles.settingRow}><Text style={styles.settingLabel}>Phiên bản</Text><Text style={styles.settingValue}>1.0.0</Text></View><View style={styles.settingRow}><Text style={styles.settingLabel}>Cập nhật dữ liệu</Text><Text style={styles.settingValue}>{lastUpdated?.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) || "—"}</Text></View><View style={styles.settingRow}><Text style={styles.settingLabel}>Trạng thái</Text><Text style={[styles.settingValue, { color: "#08745a" }]}>● Đã kết nối</Text></View></View>
        <Pressable onPress={logout} style={styles.logout}><Text style={styles.logoutText}>Đăng xuất</Text></Pressable>
      </> : null}
      <Text style={styles.updated}>{lastUpdated ? `Dữ liệu cập nhật lúc ${lastUpdated.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : ""}</Text>
    </ScrollView>}

    <View style={styles.bottomNav}>{([
      ["overview", "⌂", "Tổng quan"], ["sales", "▤", "Bán hàng"], ["machines", "▣", "Máy"], ["account", "●", "Tài khoản"],
    ] as [Tab, string, string][]).map(([key, icon, label]) => <Pressable key={key} onPress={() => setTab(key)} style={styles.navItem}><Text style={[styles.navIcon, tab === key && styles.navActive]}>{icon}</Text><Text style={[styles.navLabel, tab === key && styles.navActive]}>{label}</Text>{tab === key ? <View style={styles.navDot} /> : null}</Pressable>)}</View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f8f7" }, topbar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff" }, eyebrow: { color: "#08745a", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }, greeting: { color: "#13241f", fontSize: 20, fontWeight: "900", marginTop: 4, letterSpacing: -0.4 }, avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#e1f2ec", alignItems: "center", justifyContent: "center" }, avatarText: { color: "#08745a", fontWeight: "900", fontSize: 16 }, online: { position: "absolute", width: 10, height: 10, borderRadius: 5, right: -1, bottom: -1, backgroundColor: "#22c55e", borderWidth: 2, borderColor: "#fff" },
  storeStrip: { flexGrow: 0, backgroundColor: "#fff", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#eef2f1" }, storeStripContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 }, storeChip: { paddingHorizontal: 15, height: 34, justifyContent: "center", borderRadius: 12, backgroundColor: "#f2f5f4" }, storeChipActive: { backgroundColor: "#08745a" }, storeChipText: { color: "#64748b", fontSize: 13, fontWeight: "700" }, storeChipTextActive: { color: "#fff" },
  periodTabs: { flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#edf1ef" }, periodTab: { flex: 1, minHeight: 34, paddingHorizontal: 4, borderRadius: 10, alignItems: "center", justifyContent: "center" }, periodTabActive: { backgroundColor: "#e2f2ed" }, periodTabText: { color: "#94a3b8", fontSize: 11, fontWeight: "800" }, periodTabTextActive: { color: "#08745a" },
  customRange: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 7, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#f8faf9", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#edf1ef" }, customField: { flex: 1 }, customLabel: { color: "#64748b", fontSize: 9, fontWeight: "800", marginBottom: 4 }, customInput: { height: 38, borderWidth: 1, borderColor: "#dbe4e0", borderRadius: 10, paddingHorizontal: 9, backgroundColor: "#fff", color: "#1e293b", fontSize: 11, fontWeight: "700" }, customDash: { color: "#94a3b8", marginBottom: 11 }, applyButton: { height: 38, paddingHorizontal: 13, borderRadius: 10, backgroundColor: "#08745a", alignItems: "center", justifyContent: "center" }, applyButtonText: { color: "#fff", fontSize: 11, fontWeight: "900" }, customError: { width: "100%", color: "#be123c", fontSize: 10, fontWeight: "700" },
  dateBar: { height: 58, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#edf1ef" }, dateArrow: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#f1f5f3", alignItems: "center", justifyContent: "center" }, dateArrowDisabled: { opacity: 0.35 }, dateArrowText: { color: "#334155", fontSize: 25, lineHeight: 27 }, dateLabel: { color: "#1e293b", fontSize: 13, fontWeight: "800", textAlign: "center", textTransform: "capitalize" }, dateValue: { color: "#94a3b8", fontSize: 10, textAlign: "center", marginTop: 2 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" }, loadingText: { color: "#64748b", fontSize: 13, marginTop: 12 }, content: { padding: 16, paddingBottom: 28, gap: 13 }, error: { backgroundColor: "#fff1f2", borderWidth: 1, borderColor: "#fecdd3", borderRadius: 15, padding: 14 }, errorTitle: { color: "#9f1239", fontWeight: "800" }, errorText: { color: "#be123c", fontSize: 12, marginTop: 4 }, retry: { color: "#9f1239", fontSize: 12, fontWeight: "800", marginTop: 8 },
  heroCard: { minHeight: 176, borderRadius: 24, backgroundColor: "#075e4b", padding: 21, overflow: "hidden", shadowColor: "#064e3b", shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }, heroGlow: { position: "absolute", width: 180, height: 180, borderRadius: 90, right: -55, top: -85, backgroundColor: "rgba(255,255,255,0.06)" }, heroLabel: { color: "#a7dfcf", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }, heroValue: { color: "#fff", fontSize: 34, fontWeight: "900", letterSpacing: -1.2, marginTop: 18 }, heroFooter: { flexDirection: "row", alignItems: "center", marginTop: 22, gap: 8 }, deltaPill: { backgroundColor: "#d1fae5", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 }, deltaPillDown: { backgroundColor: "#ffe4e6" }, deltaText: { color: "#065f46", fontSize: 11, fontWeight: "900" }, heroCompare: { color: "#b7d6ce", fontSize: 11 },
  metricGrid: { flexDirection: "row", gap: 12 }, metricCard: { flex: 1, backgroundColor: "#fff", borderRadius: 19, padding: 15, borderWidth: 1, borderColor: "#e8eeeb" }, metricIcon: { color: "#08745a", fontSize: 18, fontWeight: "900" }, metricLabel: { color: "#64748b", fontSize: 11, fontWeight: "700", marginTop: 11 }, metricValue: { color: "#10231e", fontSize: 25, fontWeight: "900", marginTop: 5 }, metricChange: { color: "#059669", fontSize: 10, fontWeight: "800", marginTop: 5 }, negative: { color: "#e11d48" }, metricNote: { color: "#94a3b8", fontSize: 10, marginTop: 5 },
  shiftGrid: { flexDirection: "row", gap: 8 }, shiftCard: { flex: 1, minWidth: 0, backgroundColor: "#f7faf9", borderWidth: 1, borderColor: "#e7eeeb", borderRadius: 14, padding: 10 }, shiftCardActive: { backgroundColor: "#eaf6f2", borderColor: "#b9ded2" }, shiftHeader: { minHeight: 30 }, shiftName: { color: "#475569", fontSize: 11, fontWeight: "900" }, shiftNameActive: { color: "#08745a" }, shiftTime: { color: "#94a3b8", fontSize: 8, marginTop: 2 }, shiftRevenue: { color: "#13241f", fontSize: 13, fontWeight: "900", marginTop: 8 }, shiftOrders: { color: "#64748b", fontSize: 9, marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 17, borderWidth: 1, borderColor: "#e8eeeb" }, sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 15 }, sectionTitle: { color: "#14241f", fontSize: 16, fontWeight: "900", letterSpacing: -0.2 }, sectionCaption: { color: "#94a3b8", fontSize: 11, marginTop: 3 },
  chart: { flexDirection: "row", height: 178, gap: 5, alignItems: "flex-end" }, barColumn: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end" }, barValue: { color: "#94a3b8", fontSize: 7, fontWeight: "700", height: 14 }, barTrack: { height: 120, width: "65%", borderRadius: 6, backgroundColor: "#f1f5f3", justifyContent: "flex-end", overflow: "hidden" }, bar: { width: "100%", backgroundColor: "#cbded8", borderRadius: 6 }, barActive: { backgroundColor: "#08745a" }, barLabel: { color: "#94a3b8", fontSize: 9, marginTop: 8, fontWeight: "700", textTransform: "capitalize" }, barLabelActive: { color: "#08745a", fontWeight: "900" },
  paymentRow: { flexDirection: "row", gap: 10 }, paymentItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#f8faf9", padding: 11, borderRadius: 14 }, paymentDot: { width: 9, height: 9, borderRadius: 5 }, paymentLabel: { color: "#64748b", fontSize: 9, fontWeight: "700" }, paymentValue: { color: "#1e293b", fontSize: 12, fontWeight: "900", marginTop: 3 }, payTrack: { height: 7, flexDirection: "row", borderRadius: 8, overflow: "hidden", backgroundColor: "#e2e8f0", marginTop: 13 }, payCash: { backgroundColor: "#08745a" }, payTransfer: { backgroundColor: "#f59e0b" },
  listRow: { flexDirection: "row", alignItems: "center", minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#edf1ef" }, rank: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f3", marginRight: 11 }, rankFirst: { backgroundColor: "#fef3c7" }, rankText: { color: "#64748b", fontSize: 11, fontWeight: "900" }, rankTextFirst: { color: "#b45309" }, listMain: { flex: 1, minWidth: 0 }, listTitle: { color: "#1e293b", fontSize: 13, fontWeight: "800" }, listCaption: { color: "#94a3b8", fontSize: 10, marginTop: 3 }, listAmount: { color: "#0f172a", fontSize: 12, fontWeight: "900", marginLeft: 8 },
  summaryBanner: { backgroundColor: "#e6f3ef", borderRadius: 20, padding: 18 }, summaryKicker: { color: "#08745a", fontSize: 10, fontWeight: "900", letterSpacing: 1 }, summaryNumber: { color: "#075e4b", fontSize: 40, fontWeight: "900", marginTop: 6 }, summaryTitle: { color: "#075e4b", fontSize: 18, fontWeight: "900" }, summaryText: { color: "#44645b", fontSize: 13, lineHeight: 20, marginTop: 6 }, billRow: { flexDirection: "row", alignItems: "center", minHeight: 64, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#edf1ef" }, billIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#e6f3ef", alignItems: "center", justifyContent: "center", marginRight: 11 },
  machineCard: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e7edeb", paddingVertical: 14 }, machineTop: { flexDirection: "row", alignItems: "center" }, machineIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: "#e6f3ef", alignItems: "center", justifyContent: "center", marginRight: 11 }, machineIconText: { color: "#08745a", fontSize: 9, fontWeight: "900" }, machineOnline: { position: "absolute", width: 9, height: 9, borderRadius: 5, backgroundColor: "#22c55e", right: 0, bottom: 0, borderWidth: 2, borderColor: "#fff" }, machineRank: { color: "#94a3b8", fontSize: 11, fontWeight: "800" }, machineRevenue: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#f8faf9", padding: 10, borderRadius: 10, marginTop: 10 }, machineRevenueLabel: { color: "#64748b", fontSize: 11 }, machineRevenueValue: { color: "#075e4b", fontSize: 12, fontWeight: "900" },
  profileCard: { backgroundColor: "#075e4b", borderRadius: 23, padding: 24, alignItems: "center" }, profileAvatar: { width: 70, height: 70, borderRadius: 24, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }, profileAvatarText: { color: "#08745a", fontSize: 28, fontWeight: "900" }, profileName: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 13 }, profileEmail: { color: "#b7d6ce", fontSize: 12, marginTop: 4 }, adminBadge: { backgroundColor: "rgba(255,255,255,0.12)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginTop: 12 }, adminBadgeText: { color: "#d1fae5", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, settingRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#edf1ef" }, settingLabel: { color: "#64748b", fontSize: 13 }, settingValue: { color: "#1e293b", fontSize: 13, fontWeight: "800" }, logout: { height: 52, borderRadius: 15, backgroundColor: "#fff1f2", borderWidth: 1, borderColor: "#fecdd3", alignItems: "center", justifyContent: "center" }, logoutText: { color: "#be123c", fontSize: 14, fontWeight: "900" },
  empty: { minHeight: 120, borderRadius: 15, backgroundColor: "#f8faf9", alignItems: "center", justifyContent: "center", padding: 15 }, emptyIcon: { color: "#cbd5e1", fontSize: 28 }, emptyText: { color: "#94a3b8", fontSize: 12, marginTop: 7, textAlign: "center" }, updated: { color: "#a3afab", fontSize: 10, textAlign: "center", marginVertical: 4 },
  bottomNav: { height: 72, flexDirection: "row", backgroundColor: "#fff", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#dfe7e3", paddingBottom: 5 }, navItem: { flex: 1, alignItems: "center", justifyContent: "center" }, navIcon: { color: "#94a3b8", fontSize: 18, fontWeight: "800", height: 23 }, navLabel: { color: "#94a3b8", fontSize: 9, fontWeight: "700", marginTop: 2 }, navActive: { color: "#08745a", fontWeight: "900" }, navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#08745a", marginTop: 4 },
});
