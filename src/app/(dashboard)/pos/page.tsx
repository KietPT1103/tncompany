"use client";

import { Fragment, type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Coffee,
  CreditCard,
  HandCoins,
  Landmark,
  LayoutGrid,
  Menu,
  Minus,
  NotebookTabs,
  Plus,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
  LogOut,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Bill,
  BillSurcharge,
  DiscountType,
  getBills,
  getBillsByShift,
  PaymentMethod,
  saveBill,
} from "@/services/billService";
import {
  CashVoucher,
  CashVoucherCategory,
  CashVoucherType,
  createCashVoucher,
  getCashVoucherCategories,
  getCashVouchers,
} from "@/services/cashVoucherService";
import { getAllProducts, Product } from "@/services/products";
import { addTable, CafeTable, getTables } from "@/services/tableService";
import { Category, getCategories, updateCategory } from "@/services/categoryService";
import RoleGuard from "@/components/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { normalizeSearchText } from "@/lib/utils";
import { getOrCreatePosDevice, PosDeviceIdentity } from "@/lib/posDevice";
import {
  CashierShift,
  closeShift,
  getOpenShiftByCashier,
  getShiftHandoverAmount,
  getShiftsForReport,
  openShift,
  ShiftSummary,
  ShiftType,
  summarizeBillsForShift,
} from "@/services/shiftService";
import {
  clearLiveOrder,
  getLiveOrders,
  LiveOrderItem,
  subscribeLiveOrders,
  upsertLiveOrder,
} from "@/services/liveOrderService";
import {
  createKitchenPrintJob,
  KitchenPrintJob,
  markKitchenPrintJobPrinted,
  subscribePendingKitchenPrintJobs,
} from "@/services/kitchenPrintJobService";
import {
  createBarPrintJob,
} from "@/services/barPrintJobService";
import {
  PosSurcharge,
  SurchargeType,
  createSurcharge,
  deleteSurcharge,
  getSurcharges,
  updateSurcharge,
} from "@/services/surchargeService";
import { subscribeStoreEvents } from "@/services/realtimeService";

const ALL_CATEGORY = "Tất cả";
const ALL_CATEGORY_ID = "ALL";
const CAFE_STORE_ID = "cafe";
const TAKEAWAY_ID = "__takeaway";
const TAKEAWAY_NAME = "Mang về";
const TABLES_PER_PAGE = 20;
const MENU_ITEMS_PER_PAGE = 15;
const HOTPOT_STORE_ID = "restaurant";
const BAKERY_STORE_ID = "bakery";
const FARM_STORE_ID = "farm";
const FARM_ORDER_KEY = "__farm_no_table";
const FARM_ORDER_LABEL = "Farm - no table";
const SHIFT_ENABLED_STORES = new Set(["cafe", "restaurant", "bakery"]);
const THREE_SHIFT_STORES = new Set(["cafe", "restaurant"]);
const CASH_ROUNDING_STEPS = [5000, 10000, 20000, 50000];
const CASH_NOTE_VALUES = [50000, 100000, 200000, 500000];
const KITCHEN_AUTO_PRINT_KEY_PREFIX = "pos:kitchen-auto-print";
const KITCHEN_TERMINAL_NAME_KEY_PREFIX = "pos:kitchen-terminal-name";
const RECEIPT_STORE_INFO: Record<
  string,
  { title: string; address: string; phone: string }
> = {
  cafe: {
    title: "TIỆM CÀ PHÊ ÔNG QUAN",
    address: "ĐC: Cuối hẻm 583, đường 30/4, P. Hưng Lợi, Q. Ninh Kiều, TP. Cần Thơ",
    phone: "ĐT: 0772.770.789",
  },
  bakery: {
    title: "TIỆM BÁNH ÔNG QUAN",
    address: "ĐC: Cuối hẻm 583, đường 30/4, P. Hưng Lợi, TP. Cần Thơ",
    phone: "ĐT: 0772.770.789",
  },
  restaurant: {
    title: "TIỆM LẨU ÔNG QUAN",
    address: "ĐC: Cuối hẻm 583, đường 30/4, P. Tân An, TP. Cần Thơ",
    phone: "ĐT: 0939.976.565",
  },
  farm: {
    title: "ÔNG QUAN FARM",
    address: "ĐC: Cuối hẻm 583, đường 30/4, TP. Cần Thơ",
    phone: "ĐT: 0772.770.789",
  },
};

const formatCurrency = (value: number) =>
  value.toLocaleString("vi-VN", { minimumFractionDigits: 0 });
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[
        character
      ] || character
  );
const getCashDifferenceInfo = (difference: number) => {
  if (difference > 0) return { label: "Dư", amount: difference };
  if (difference < 0) return { label: "Thiếu", amount: Math.abs(difference) };
  return { label: "Khớp", amount: 0 };
};
const PRINT_FONT_FAMILY = "'Tahoma', 'Segoe UI', Arial, sans-serif";
const PRINT_TAIL_SPACE_MM = 8;

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: string;
};

type CartItem = MenuItem & { quantity: number; note?: string };
type OrderDraft = {
  items: Record<string, CartItem>;
};
type PendingAddedItems = Record<string, Record<string, number>>;
type ReceiptItem = Omit<CartItem, "price"> & {
  price: number;
  basePrice: number;
  surchargePerUnit: number;
  surchargeTotal: number;
  lineTotal: number;
};
type ReceiptData = {
  table: string;
  items: ReceiptItem[];
  subtotal: number;
  surchargeTotal: number;
  appliedSurcharges: BillSurcharge[];
  total: number;
  time: string;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  changeAmount?: number;
};
type SoldBillsSortKey = "time" | "total" | "code" | "table";
type SortDirection = "asc" | "desc";
type DailyReportTab = "overview" | "bills" | "products";
type DailyReportShift = Exclude<ShiftType, "single"> | "all";
type DailyReportPaymentFilter = "all" | PaymentMethod;
type SoldProductKind = "drink" | "bakery";
type DailyProductRow = {
  key: string;
  name: string;
  categoryId: string | null;
  categoryName: string;
  quantity: number;
  revenue: number;
  billCount: number;
};
type DailyProductGroup = {
  key: string;
  title: string;
  unit: string;
  rows: DailyProductRow[];
  total: number;
};
type EndOfDayHandover = {
  shifts: Record<Exclude<ShiftType, "single">, number>;
  total: number;
  expectedTotal: number;
  difference: number;
  totalSales: number;
  cashSales: number;
  transferSales: number;
  incomeVouchers: number;
  expenseVouchers: number;
};

const toLocalDateInput = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const getLocalDayRange = (dateValue: string) => {
  const [year, month, day] = dateValue.split("-").map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  return { start, end };
};

export default function CafePosPage() {
  const { role, user, logout } = useAuth();
  const { storeId: selectedStoreId, setStoreId } = useStore();
  const assignedStoreId =
    user?.storeId === "cafe" ||
    user?.storeId === "restaurant" ||
    user?.storeId === "bakery" ||
    user?.storeId === "farm"
      ? user.storeId
      : null;
  const storeId =
    (role === "user" || role === "server" || role === "bartender") && assignedStoreId
      ? assignedStoreId
      : selectedStoreId;
  const isHotpotStore = storeId === HOTPOT_STORE_ID;
  const isBakeryStore = storeId === BAKERY_STORE_ID;
  const isFarmStore = storeId === FARM_STORE_ID;
  const isShiftEnabledStore = SHIFT_ENABLED_STORES.has(storeId);
  const isServiceAccountEmail = (user?.email || "")
    .trim()
    .toLowerCase()
    .endsWith("@service.local");
  const isServerAccount = role === "server" || isServiceAccountEmail;
  const isBartenderAccount = role === "bartender";
  const isCashierAccount = role === "user";
  const isRestaurantServer = isServerAccount && isHotpotStore;
  const canUseKitchenAutoPrint = isHotpotStore && !isRestaurantServer;
  const canUseBarAutoPrint = storeId === CAFE_STORE_ID;
  const isShiftEnabledForUser = isShiftEnabledStore && isCashierAccount;
  const usesThreeShiftByAccount = THREE_SHIFT_STORES.has(storeId);
  const posTitle = isBartenderAccount
    ? "Bấm bill tại quầy pha chế"
    : isBakeryStore
    ? "Bán hàng tại tiệm bánh"
    : isFarmStore
    ? "Bán hàng tại Farm"
    : "Bán hàng tại quán";

  useEffect(() => {
    if (
      (role === "user" || role === "server" || role === "bartender") &&
      assignedStoreId &&
      selectedStoreId !== assignedStoreId
    ) {
      setStoreId(assignedStoreId);
    }
  }, [assignedStoreId, role, selectedStoreId, setStoreId]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORY_ID);
  const [activeTab, setActiveTab] = useState<"tables" | "menu">("tables");
  const [tableSearch, setTableSearch] = useState("");
  const [orderDrafts, setOrderDrafts] = useState<Record<string, OrderDraft>>(
    {}
  );
  const [pendingAddedItems, setPendingAddedItems] = useState<PendingAddedItems>(
    {}
  );
  const [isPaying, setIsPaying] = useState(false);
  const paymentInFlightRef = useRef(false);
  const checkoutRequestIdRef = useRef<string | null>(null);
  const [newTableName, setNewTableName] = useState("");
  const [newTableArea, setNewTableArea] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const [menuPage, setMenuPage] = useState(1);
  const [isSeedingTables, setIsSeedingTables] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showSoldBills, setShowSoldBills] = useState(false);
  const [soldBills, setSoldBills] = useState<Bill[]>([]);
  const [isLoadingSoldBills, setIsLoadingSoldBills] = useState(false);
  const [soldBillsDate, setSoldBillsDate] = useState(() => toLocalDateInput(new Date()));
  const [soldBillsShift, setSoldBillsShift] = useState<DailyReportShift>("all");
  const [soldBillsPaymentTab, setSoldBillsPaymentTab] =
    useState<PaymentMethod>("cash");
  const [soldBillsSearch, setSoldBillsSearch] = useState("");
  const [soldBillsSortKey, setSoldBillsSortKey] =
    useState<SoldBillsSortKey>("time");
  const [soldBillsSortDirection, setSoldBillsSortDirection] =
    useState<SortDirection>("desc");
  const [expandedSoldBillId, setExpandedSoldBillId] = useState<string | null>(null);
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const [surcharges, setSurcharges] = useState<PosSurcharge[]>([]);
  const [showSurchargeModal, setShowSurchargeModal] = useState(false);
  const [editingSurchargeId, setEditingSurchargeId] = useState<string | null>(null);
  const [surchargeNameInput, setSurchargeNameInput] = useState("");
  const [surchargeTypeInput, setSurchargeTypeInput] =
    useState<SurchargeType>("percent");
  const [surchargeValueInput, setSurchargeValueInput] = useState("");
  const [surchargeEnabledInput, setSurchargeEnabledInput] = useState(true);
  const [isSavingSurcharge, setIsSavingSurcharge] = useState(false);
  const [updatingSurchargeId, setUpdatingSurchargeId] = useState<string | null>(
    null
  );
  const [deletingSurchargeId, setDeletingSurchargeId] = useState<string | null>(
    null
  );
  const [menuOrderIds, setMenuOrderIds] = useState<string[]>([]);
  const [draggingMenuItemId, setDraggingMenuItemId] = useState<string | null>(
    null
  );
  const suppressNextMenuClickRef = useRef(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountInput, setDiscountInput] = useState("");

  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const [deviceIdentity, setDeviceIdentity] = useState<PosDeviceIdentity | null>(null);
  const [shiftSyncNotice, setShiftSyncNotice] = useState("");
  const [isLoadingShift, setIsLoadingShift] = useState(false);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const [isOpeningShift, setIsOpeningShift] = useState(false);

  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [isPreparingCloseShift, setIsPreparingCloseShift] = useState(false);
  const [closeShiftSummary, setCloseShiftSummary] = useState<ShiftSummary | null>(
    null
  );
  const [closeShiftDrinkItems, setCloseShiftDrinkItems] = useState(0);
  const [closeShiftBakeryItems, setCloseShiftBakeryItems] = useState(0);
  const [closingCashInput, setClosingCashInput] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [isClosingShift, setIsClosingShift] = useState(false);

  const [showDailyReport, setShowDailyReport] = useState(false);
  const [dailyReport, setDailyReport] = useState<ShiftSummary | null>(
    null
  );
  const [dailyReportBills, setDailyReportBills] = useState<Bill[]>([]);
  const [dailyReportVouchers, setDailyReportVouchers] = useState<CashVoucher[]>([]);
  const [dailyReportShifts, setDailyReportShifts] = useState<CashierShift[]>([]);
  const [dailyReportTab, setDailyReportTab] = useState<DailyReportTab>("overview");
  const [dailyReportPaymentFilter, setDailyReportPaymentFilter] =
    useState<DailyReportPaymentFilter>("all");
  const [dailyReportDate, setDailyReportDate] = useState(() => toLocalDateInput(new Date()));
  const [dailyReportShift, setDailyReportShift] = useState<DailyReportShift>("shift_1");
  const [updatingDailyReportCategoryId, setUpdatingDailyReportCategoryId] = useState<string | null>(null);
  const [expandedDailyBillHours, setExpandedDailyBillHours] = useState<Set<number>>(
    () => new Set()
  );
  const [expandedDailyReportBillId, setExpandedDailyReportBillId] = useState<string | null>(null);
  const [isLoadingDailyReport, setIsLoadingDailyReport] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState<CashVoucherType | null>(
    null
  );
  const [voucherAmountInput, setVoucherAmountInput] = useState("");
  const [voucherCategory, setVoucherCategory] = useState("");
  const [voucherCategories, setVoucherCategories] = useState<CashVoucherCategory[]>([]);
  const [voucherPersonName, setVoucherPersonName] = useState("");
  const [voucherNote, setVoucherNote] = useState("");
  const [voucherIncludeInCashFlow, setVoucherIncludeInCashFlow] = useState(true);
  const [voucherDateTime, setVoucherDateTime] = useState("");
  const [isSavingVoucher, setIsSavingVoucher] = useState(false);
  const [isKitchenAutoPrintEnabled, setIsKitchenAutoPrintEnabled] = useState(false);
  const [kitchenTerminalName, setKitchenTerminalName] = useState("May bep chinh");
  const [kitchenPrintLogs, setKitchenPrintLogs] = useState<string[]>([]);
  const printingKitchenJobsRef = useRef<Set<string>>(new Set());
  const orderSyncTimersRef = useRef<Map<string, number>>(new Map());
  const menuOrderStorageKey = useMemo(
    () => `pos:menu-order:${storeId || "default"}`,
    [storeId]
  );
  const kitchenAutoPrintStorageKey = useMemo(
    () => `${KITCHEN_AUTO_PRINT_KEY_PREFIX}:${storeId || "default"}`,
    [storeId]
  );
  const kitchenTerminalNameStorageKey = useMemo(
    () => `${KITCHEN_TERMINAL_NAME_KEY_PREFIX}:${storeId || "default"}`,
    [storeId]
  );
  const dailyReportSplitCategoryIds = useMemo(
    () => categories.filter((item) => item.isSeparatedInSalesReport === true).map((item) => item.id),
    [categories]
  );
  const appendKitchenPrintLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString("vi-VN");
    setKitchenPrintLogs((prev) => [`[${time}] ${message}`, ...prev].slice(0, 8));
  }, []);

  const parseMoney = (value: string) => {
    const numeric = Number(value.replace(/[^\d]/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const formatMoneyInput = (value: string) => {
    const amount = parseMoney(value);
    return amount > 0 ? formatCurrency(amount) : "";
  };

  const toDateTimeLocalValue = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const resetVoucherForm = (type: CashVoucherType) => {
    setShowVoucherModal(type);
    setVoucherAmountInput("");
    setVoucherCategory("");
    setVoucherPersonName("");
    setVoucherNote("");
    setVoucherIncludeInCashFlow(true);
    setVoucherDateTime(toDateTimeLocalValue(new Date()));
  };

  const cashierName = useMemo(() => {
    const prefix = user?.email?.split("@")[0] || "";
    if (prefix.toLowerCase().startsWith("thungan")) {
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    if (user?.displayName) return user.displayName;
    if (prefix) return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    return "Thu ngân";
  }, [user?.displayName, user?.email]);

  const resolveShiftType = (): ShiftType => {
    if (!usesThreeShiftByAccount) return "single";
    const prefix = (user?.email?.split("@")[0] || "").toLowerCase();
    if (prefix.includes("thungan1") || prefix.includes("bep1")) return "shift_1";
    if (prefix.includes("thungan2") || prefix.includes("bep2")) return "shift_2";
    if (prefix.includes("thungan3") || prefix.includes("bep3")) return "shift_3";
    return "single";
  };

  useEffect(() => {
    async function loadData() {
      if (!storeId) return;
      try {
        const [productList, tableList, categoryList, voucherCategoryList] = await Promise.all([
          getAllProducts(storeId),
          getTables(storeId),
          getCategories(storeId),
          getCashVoucherCategories(storeId),
        ]);
        setProducts(productList);
        setTables(tableList);
        setCategories(categoryList);
        setVoucherCategories(voucherCategoryList);
        if (isFarmStore) {
          setTableNumber("");
        } else if (
          tableNumber &&
          !tableList.some((t) => t.name === tableNumber)
        ) {
          setTableNumber("");
        }
      } catch (error) {
        console.error("Failed to load POS data", error);
      }
    }
    loadData();
  }, [storeId, isFarmStore, tableNumber]);

  const refreshSurcharges = useCallback(async () => {
    if (!storeId) {
      setSurcharges([]);
      return;
    }
    try {
      setSurcharges(await getSurcharges(storeId));
    } catch (error) {
      console.error("Không tải được cài đặt phụ thu", error);
    }
  }, [storeId]);

  useEffect(() => {
    void refreshSurcharges();
  }, [refreshSurcharges]);

  useEffect(() => {
    if (!storeId) return;
    return subscribeStoreEvents(storeId, ["surcharges-updated"], () => void refreshSurcharges());
  }, [refreshSurcharges, storeId]);

  useEffect(() => {
    setDeviceIdentity(getOrCreatePosDevice());
  }, []);

  const handleToggleDailyReportSplitCategory = async (categoryItem: Category) => {
    if (role !== "admin" || updatingDailyReportCategoryId) return;
    const nextValue = categoryItem.isSeparatedInSalesReport !== true;
    setUpdatingDailyReportCategoryId(categoryItem.id);
    try {
      await updateCategory(categoryItem.id, { isSeparatedInSalesReport: nextValue });
      setCategories((current) => current.map((item) =>
        item.id === categoryItem.id
          ? { ...item, isSeparatedInSalesReport: nextValue }
          : item
      ));
    } catch (error) {
      console.error(error);
      alert("Không thể lưu cấu hình category báo cáo.");
    } finally {
      setUpdatingDailyReportCategoryId(null);
    }
  };

  useEffect(() => {
    if (!user || !storeId || !isShiftEnabledForUser) {
      setActiveShift(null);
      setShowOpenShiftModal(false);
      return;
    }

    let stopped = false;
    let checking = false;
    let firstLoad = true;

    async function loadShiftState() {
      if (checking) return;
      checking = true;
      if (firstLoad) setIsLoadingShift(true);
      try {
        const open = await getOpenShiftByCashier(storeId, user.uid);
        if (stopped) return;
        setActiveShift((current) => {
          if (
            open &&
            (!current || current.id !== open.id) &&
            deviceIdentity?.id &&
            open.openedByDeviceId &&
            open.openedByDeviceId !== deviceIdentity.id
          ) {
            setShiftSyncNotice(
              `Ca đã được mở trên ${open.openedByDeviceName || "thiết bị khác"}. Máy này đã tự đồng bộ vào cùng ca.`
            );
          }
          return open;
        });
        setShowOpenShiftModal(!open);
        if (open) {
          setOpeningCashInput("");
          setOpeningNote("");
        }
      } catch (error) {
        if (!stopped) console.error("Failed to load shift state", error);
      } finally {
        checking = false;
        if (firstLoad && !stopped) setIsLoadingShift(false);
        firstLoad = false;
      }
    }
    void loadShiftState();
    const unsubscribe = subscribeStoreEvents(storeId, ["shifts-updated"], () => void loadShiftState());
    const fallbackTimer = window.setInterval(() => void loadShiftState(), 120000);
    return () => {
      stopped = true;
      unsubscribe();
      window.clearInterval(fallbackTimer);
    };
  }, [deviceIdentity?.id, isShiftEnabledForUser, storeId, user?.uid]);

  useEffect(() => {
    if (!shiftSyncNotice) return;
    const timer = window.setTimeout(() => setShiftSyncNotice(""), 7000);
    return () => window.clearTimeout(timer);
  }, [shiftSyncNotice]);

  useEffect(() => {
    if (!storeId) {
      setOrderDrafts({});
      return;
    }

    const applyOrders = (orders: Awaited<ReturnType<typeof getLiveOrders>>) => {
        const next: Record<string, OrderDraft> = {};
        orders.forEach((order) => {
          const orderKey = order.orderKey?.trim();
          if (!orderKey) return;
          const mappedItems = (order.items || []).reduce<Record<string, CartItem>>(
            (acc, item) => {
              if (!item.menuId || !item.quantity) return acc;
              acc[item.menuId] = {
                id: item.menuId,
                name: item.name,
                price: item.price || 0,
                quantity: item.quantity,
                note: item.note || "",
                category: item.category || "Khác",
              };
              return acc;
            },
            {}
          );
          if (Object.keys(mappedItems).length === 0) return;
          next[orderKey] = { items: mappedItems };
        });
        setOrderDrafts(next);
    };
    const handleError = (error: Error) => {
      console.error("Không đồng bộ được đơn realtime", error);
    };

    const unsubscribe = subscribeLiveOrders(storeId, applyOrders, handleError);

    return () => unsubscribe();
  }, [storeId]);

  useEffect(() => {
    if (!storeId) {
      setMenuOrderIds([]);
      return;
    }

    const productIds = Array.from(
      new Set(products.map((product) => product.product_code).filter(Boolean))
    );

    if (productIds.length === 0) {
      setMenuOrderIds([]);
      return;
    }

    let storedOrder: string[] = [];
    try {
      const raw = window.localStorage.getItem(menuOrderStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          storedOrder = parsed.filter(
            (value): value is string => typeof value === "string"
          );
        }
      }
    } catch (error) {
      console.warn("Không đọc được thứ tự món đã lưu", error);
    }

    const validIds = new Set(productIds);
    const nextOrder = storedOrder.filter((id) => validIds.has(id));
    const existing = new Set(nextOrder);
    productIds.forEach((id) => {
      if (!existing.has(id)) {
        nextOrder.push(id);
      }
    });

    setMenuOrderIds(nextOrder);
  }, [menuOrderStorageKey, products, storeId]);

  useEffect(() => {
    if (!storeId || menuOrderIds.length === 0) return;

    try {
      window.localStorage.setItem(
        menuOrderStorageKey,
        JSON.stringify(menuOrderIds)
      );
    } catch (error) {
      console.warn("Không lưu được thứ tự món", error);
    }
  }, [menuOrderIds, menuOrderStorageKey, storeId]);

  useEffect(() => {
    if (!storeId) {
      setIsKitchenAutoPrintEnabled(false);
      setKitchenTerminalName("May bep chinh");
      return;
    }

    try {
      const savedEnabled = window.localStorage.getItem(kitchenAutoPrintStorageKey);
      setIsKitchenAutoPrintEnabled(savedEnabled === "1");
      const savedName = window.localStorage.getItem(kitchenTerminalNameStorageKey);
      if (savedName?.trim()) {
        setKitchenTerminalName(savedName.trim());
      } else {
        setKitchenTerminalName("May bep chinh");
      }
    } catch (error) {
      console.warn("Không đọc được cài đặt auto in bếp", error);
    }
  }, [
    kitchenAutoPrintStorageKey,
    kitchenTerminalNameStorageKey,
    storeId,
  ]);

  useEffect(() => {
    if (!storeId) return;
    try {
      window.localStorage.setItem(
        kitchenAutoPrintStorageKey,
        isKitchenAutoPrintEnabled ? "1" : "0"
      );
      window.localStorage.setItem(
        kitchenTerminalNameStorageKey,
        kitchenTerminalName.trim() || "May bep chinh"
      );
    } catch (error) {
      console.warn("Không lưu được cài đặt auto in bếp", error);
    }
  }, [
    isKitchenAutoPrintEnabled,
    kitchenAutoPrintStorageKey,
    kitchenTerminalName,
    kitchenTerminalNameStorageKey,
    storeId,
  ]);

  const hiddenCategoryKeySet = useMemo(() => {
    const keys = new Set<string>();
    categories.forEach((categoryItem) => {
      if (!categoryItem.isHidden) return;
      const idKey = (categoryItem.id || "").trim().toLowerCase();
      const nameKey = (categoryItem.name || "").trim().toLowerCase();
      if (idKey) keys.add(idKey);
      if (nameKey) keys.add(nameKey);
    });
    return keys;
  }, [categories]);

  const categoryOptions = useMemo(() => {
    if (categories.length > 0) {
      return [
        { id: ALL_CATEGORY_ID, name: ALL_CATEGORY },
        ...categories
          .filter((categoryItem) => !categoryItem.isHidden)
          .map((categoryItem) => ({ id: categoryItem.id, name: categoryItem.name })),
      ];
    }
    const setCat = new Set<string>();
    products.forEach((p) => setCat.add(p.category || "Khác"));
    return [
      { id: ALL_CATEGORY_ID, name: ALL_CATEGORY },
      ...Array.from(setCat).map((name) => ({ id: name, name })),
    ];
  }, [categories, products]);

  useEffect(() => {
    if (category === ALL_CATEGORY_ID) return;
    const selectedCategory = categories.find(
      (categoryItem) =>
        categoryItem.id === category || categoryItem.name === category
    );
    if (selectedCategory?.isHidden) {
      setCategory(ALL_CATEGORY_ID);
    }
  }, [category, categories]);

  const tableOptions = useMemo(() => {
    if (isFarmStore) return [];
    if (isHotpotStore) return tables;
    return [{ id: TAKEAWAY_ID, name: TAKEAWAY_NAME }, ...tables];
  }, [tables, isFarmStore, isHotpotStore]);

  useEffect(() => {
    if (isFarmStore) {
      setActiveTab("menu");
      setTableNumber("");
    } else {
      setActiveTab("tables");
      setTableNumber("");
    }
  }, [isFarmStore, storeId]);

  const activeOrderKey = useMemo(() => {
    if (isFarmStore) return FARM_ORDER_KEY;
    return tableNumber.trim();
  }, [isFarmStore, tableNumber]);

  const activeOrder = activeOrderKey
    ? orderDrafts[activeOrderKey]
    : undefined;
  const cart = activeOrder?.items || {};
  const activePendingAddedItems = activeOrderKey
    ? pendingAddedItems[activeOrderKey] || {}
    : {};

  const filteredTables = useMemo(() => {
    const keyword = normalizeSearchText(tableSearch);
    return tableOptions.filter((t) =>
      normalizeSearchText(t.name).includes(keyword)
    );
  }, [tableOptions, tableSearch]);

  const sortedTables = useMemo(() => {
    const sorted = [...filteredTables].sort((a, b) => {
      if (a.id === TAKEAWAY_ID) return -1;
      if (b.id === TAKEAWAY_ID) return 1;
      return a.name.localeCompare(b.name, "vi", {
        sensitivity: "base",
        numeric: true,
      });
    });
    return sorted;
  }, [filteredTables]);

  const totalTablePages = Math.max(
    1,
    Math.ceil(sortedTables.length / TABLES_PER_PAGE)
  );

  useEffect(() => {
    setTablePage(1);
  }, [tableSearch, tableOptions.length]);

  useEffect(() => {
    setTablePage((prev) => Math.min(prev, totalTablePages));
  }, [totalTablePages]);

  const paginatedTables = useMemo(() => {
    const start = (tablePage - 1) * TABLES_PER_PAGE;
    return sortedTables.slice(start, start + TABLES_PER_PAGE);
  }, [sortedTables, tablePage]);

  const getCategoryLabel = (cat?: string) => {
    if (!cat) return "Khác";
    const found = categories.find((c) => c.id === cat || c.name === cat);
    return found?.name || cat;
  };

  const canPrintPreparationItem = (itemCategory?: string) => {
    if (!itemCategory) return true;
    const matchedCategory = categories.find(
      (categoryItem) =>
        categoryItem.id === itemCategory || categoryItem.name === itemCategory
    );
    return matchedCategory?.isPreparationPrintEnabled !== false;
  };

  const getSoldProductKind = useCallback(
    (menuId: string, _itemName: string): SoldProductKind => {
      const product = products.find((item) => item.product_code === menuId);
      const categoryValue = product?.categoryName || product?.category || "";
      const category = categories.find(
        (item) =>
          item.id === product?.category ||
          normalizeSearchText(item.name) === normalizeSearchText(categoryValue)
      );
      const categoryName = category?.name || product?.categoryName || "";
      return normalizeSearchText(categoryName) === "banh" ? "bakery" : "drink";
    },
    [categories, products]
  );

  const isCategoryMatch = (itemCategory: string, selected: string) => {
    if (selected === ALL_CATEGORY_ID) return true;
    if (itemCategory === selected) return true;
    const itemCat = categories.find(
      (c) => c.id === itemCategory || c.name === itemCategory
    );
    const selectedCat = categories.find(
      (c) => c.id === selected || c.name === selected
    );
    if (
      itemCat &&
      selectedCat &&
      (itemCat.id === selectedCat.id || itemCat.name === selectedCat.name)
    ) {
      return true;
    }
    return false;
  };

  const filteredMenu = useMemo(() => {
    const orderMap = new Map<string, number>(
      menuOrderIds.map((id, index) => [id, index])
    );

    const items: MenuItem[] = products
      .filter((p) => {
        if (p.isSelling === false) return false;
        const categoryKey = (p.category || "").trim().toLowerCase();
        if (!categoryKey) return true;
        return !hiddenCategoryKeySet.has(categoryKey);
      })
      .map((p) => ({
        id: p.product_code,
        name: p.product_name,
        price: p.price ?? 0,
        category: p.category || "Khác",
      }))
      .sort((a, b) => {
        const aOrder = orderMap.get(a.id);
        const bOrder = orderMap.get(b.id);

        if (aOrder !== undefined && bOrder !== undefined) {
          return aOrder - bOrder;
        }
        if (aOrder !== undefined) return -1;
        if (bOrder !== undefined) return 1;

        return a.name.localeCompare(b.name, "vi", {
          sensitivity: "base",
          numeric: true,
        });
      });

    return items.filter((item) => {
      const keyword = normalizeSearchText(menuSearch);
      const matchCategory = isCategoryMatch(item.category, category);
      const matchText =
        !keyword || normalizeSearchText(item.name).includes(keyword);
      return matchCategory && matchText;
    });
  }, [category, products, menuSearch, categories, menuOrderIds, hiddenCategoryKeySet]);

  const totalMenuPages = Math.max(
    1,
    Math.ceil(filteredMenu.length / MENU_ITEMS_PER_PAGE)
  );

  useEffect(() => {
    setMenuPage((current) => Math.min(current, totalMenuPages));
  }, [totalMenuPages]);

  const paginatedMenu = useMemo(() => {
    const start = (menuPage - 1) * MENU_ITEMS_PER_PAGE;
    return filteredMenu.slice(start, start + MENU_ITEMS_PER_PAGE);
  }, [filteredMenu, menuPage]);

  const formatSurchargeValue = useCallback(
    (surcharge: { type: SurchargeType; value: number }) => {
      if (surcharge.type === "percent") {
        const valueText = Number.isInteger(surcharge.value)
          ? surcharge.value.toString()
          : surcharge.value.toString();
        return `${valueText}%`;
      }
      return `${formatCurrency(Math.max(0, Math.round(surcharge.value)))} đ/món`;
    },
    []
  );

  const enabledSurcharges = useMemo(
    () => surcharges.filter((item) => item.isEnabled && item.value > 0),
    [surcharges]
  );

  const calculateOrderPricing = useCallback(
    (items: CartItem[], appliedSurcharges: PosSurcharge[]) => {
      const surchargeSummaryMap = new Map<string, BillSurcharge>();
      appliedSurcharges.forEach((surcharge) => {
        surchargeSummaryMap.set(surcharge.id, {
          id: surcharge.id,
          name: surcharge.name,
          type: surcharge.type,
          value: surcharge.value,
          amount: 0,
        });
      });

      let subtotal = 0;
      let surchargeTotal = 0;
      const pricedItems: ReceiptItem[] = [];

      items.forEach((item) => {
        const quantity = Math.max(1, item.quantity || 0);
        const basePrice = Math.max(0, Math.round(Number(item.price) || 0));
        let surchargePerUnit = 0;

        appliedSurcharges.forEach((surcharge) => {
          const rawUnitAmount =
            surcharge.type === "percent"
              ? (basePrice * surcharge.value) / 100
              : surcharge.value;
          const surchargeUnit = Math.max(0, Math.round(rawUnitAmount));
          if (surchargeUnit <= 0) return;

          surchargePerUnit += surchargeUnit;
          const lineSurcharge = surchargeUnit * quantity;
          surchargeTotal += lineSurcharge;

          const summary = surchargeSummaryMap.get(surcharge.id);
          if (summary) {
            summary.amount += lineSurcharge;
          }
        });

        const lineBaseTotal = basePrice * quantity;
        const lineSurchargeTotal = surchargePerUnit * quantity;
        const finalPrice = basePrice + surchargePerUnit;
        const lineTotal = lineBaseTotal + lineSurchargeTotal;
        subtotal += lineBaseTotal;

        pricedItems.push({
          ...item,
          quantity,
          price: finalPrice,
          basePrice,
          surchargePerUnit,
          surchargeTotal: lineSurchargeTotal,
          lineTotal,
        });
      });

      const surchargeSummaries = Array.from(surchargeSummaryMap.values()).filter(
        (item) => item.amount > 0
      );

      return {
        items: pricedItems,
        subtotal,
        surchargeTotal,
        total: subtotal + surchargeTotal,
        surchargeSummaries,
      };
    },
    []
  );

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartPricing = useMemo(
    () => calculateOrderPricing(cartItems, enabledSurcharges),
    [calculateOrderPricing, cartItems, enabledSurcharges]
  );
  const cartPricingById = useMemo(() => {
    const mapped: Record<string, ReceiptItem> = {};
    cartPricing.items.forEach((item) => {
      mapped[item.id] = item;
    });
    return mapped;
  }, [cartPricing.items]);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalPrice = cartPricing.subtotal;
  const totalSurchargeAmount = cartPricing.surchargeTotal;
  const totalPrice = cartPricing.total;
  const appliedSurchargeSummaries = cartPricing.surchargeSummaries;
  const pendingAddedCount = Object.values(activePendingAddedItems).reduce(
    (sum, qty) => sum + qty,
    0
  );
  const cashReceived = parseMoney(cashReceivedInput);
  const receiptItemCount = useMemo(
    () =>
      receiptData
        ? receiptData.items.reduce((sum, item) => sum + item.quantity, 0)
        : 0,
    [receiptData]
  );
  const receiptGrossTotal = receiptData?.total || 0;
  const enteredDiscountValue =
    discountType === "percent"
      ? Math.max(0, Math.min(100, Number(discountInput.replace(",", ".")) || 0))
      : parseMoney(discountInput);
  const receiptDiscountAmount = Math.min(
    receiptGrossTotal,
    discountType === "percent"
      ? Math.round((receiptGrossTotal * enteredDiscountValue) / 100)
      : enteredDiscountValue
  );
  const receiptPayableTotal = Math.max(receiptGrossTotal - receiptDiscountAmount, 0);
  const payableTotal = showReceipt && receiptData ? receiptPayableTotal : totalPrice;
  const quickCashValues = useMemo(() => {
    if (payableTotal <= 0) return [];
    const candidates = new Set<number>();
    const addAmount = (amount: number) => {
      if (amount >= payableTotal) candidates.add(amount);
    };
    const roundUp = (value: number, step: number) =>
      Math.ceil(value / step) * step;

    addAmount(payableTotal);
    CASH_ROUNDING_STEPS.forEach((step) =>
      addAmount(roundUp(payableTotal, step))
    );
    CASH_NOTE_VALUES.forEach((amount) => addAmount(amount));

    return Array.from(candidates).sort((a, b) => a - b);
  }, [payableTotal]);

  useEffect(() => {
    if (paymentMethod === "transfer") {
      setCashReceivedInput("");
      return;
    }
    if (cashReceivedInput.trim() === "" && payableTotal > 0) {
      setCashReceivedInput(String(payableTotal));
    }
  }, [paymentMethod, payableTotal, cashReceivedInput]);

  useEffect(() => {
    if (!showReceipt || !receiptData || paymentMethod !== "cash") return;
    setCashReceivedInput(String(receiptPayableTotal));
  }, [discountInput, discountType, paymentMethod, receiptData, receiptPayableTotal, showReceipt]);

  useEffect(
    () => () => {
      orderSyncTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      orderSyncTimersRef.current.clear();
    },
    []
  );
  const tableDraftCounts = useMemo(() => {
    const result: Record<string, number> = {};
    Object.entries(orderDrafts).forEach(([key, draft]) => {
      if (!key || key === FARM_ORDER_KEY) return;
      result[key] = Object.values(draft.items).reduce(
        (sum, item) => sum + item.quantity,
        0
      );
    });
    return result;
  }, [orderDrafts]);

  useEffect(() => {
    if (!isRestaurantServer) return;
    setPendingAddedItems((prev) => {
      const next: PendingAddedItems = {};
      Object.entries(prev).forEach(([orderKey, itemMap]) => {
        if (!orderDrafts[orderKey]) return;
        const filtered = Object.entries(itemMap).reduce<Record<string, number>>(
          (acc, [itemId, qty]) => {
            if (!orderDrafts[orderKey]?.items[itemId]) return acc;
            if (qty > 0) acc[itemId] = qty;
            return acc;
          },
          {}
        );
        if (Object.keys(filtered).length > 0) {
          next[orderKey] = filtered;
        }
      });
      return next;
    });
  }, [isRestaurantServer, orderDrafts]);

  const toLiveOrderItems = (draft: OrderDraft): LiveOrderItem[] =>
    Object.values(draft.items)
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        menuId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        // Keep raw note while typing to avoid stripping trailing spaces mid-input.
        note: item.note || "",
        category: item.category || "",
      }));

  const syncOrderDraft = async (orderKey: string, draft: OrderDraft) => {
    if (!storeId || !orderKey) return;
    const items = toLiveOrderItems(draft);
    if (items.length === 0) {
      await clearLiveOrder(storeId, orderKey);
      return;
    }

    const tableLabel =
      isFarmStore || orderKey === FARM_ORDER_KEY ? FARM_ORDER_LABEL : orderKey;

    await upsertLiveOrder({
      storeId,
      orderKey,
      tableNumber: tableLabel,
      items,
      updatedById: user?.uid,
      updatedByName: cashierName,
      updatedByRole: role || "user",
    });
  };

  const scheduleOrderDraftSync = (orderKey: string, draft: OrderDraft) => {
    const existingTimer = orderSyncTimersRef.current.get(orderKey);
    if (existingTimer) window.clearTimeout(existingTimer);
    const timer = window.setTimeout(() => {
      orderSyncTimersRef.current.delete(orderKey);
      void syncOrderDraft(orderKey, draft).catch((error) => {
        console.error("Không cập nhật được đơn realtime", error);
      });
    }, 300);
    orderSyncTimersRef.current.set(orderKey, timer);
  };

  const updateActiveOrder = (updater: (draft: OrderDraft) => OrderDraft) => {
    if (!activeOrderKey) {
      alert("Vui lòng chọn bàn trước khi gọi món.");
      return;
    }

    setOrderDrafts((prev) => {
      const current = prev[activeOrderKey] || { items: {} };
      const updated = updater(current);
      const normalizedItems = Object.values(updated.items).reduce<
        Record<string, CartItem>
      >((acc, item) => {
        if (!item.id || item.quantity <= 0) return acc;
        acc[item.id] = {
          ...item,
          quantity: Math.max(1, item.quantity),
          note: item.note || "",
          category: item.category || "Khác",
        };
        return acc;
      }, {});
      const normalizedDraft: OrderDraft = { items: normalizedItems };

      const next = { ...prev };
      if (Object.keys(normalizedItems).length === 0) {
        delete next[activeOrderKey];
      } else {
        next[activeOrderKey] = normalizedDraft;
      }

      scheduleOrderDraftSync(activeOrderKey, normalizedDraft);

      return next;
    });
  };

  const handleAddItem = (item: MenuItem) => {
    updateActiveOrder((draft) => {
      const current = draft.items[item.id];
      const quantity = current ? current.quantity + 1 : 1;
      return {
        ...draft,
        items: {
          ...draft.items,
          [item.id]: { ...item, quantity, note: current?.note || "" },
        },
      };
    });

    if (isRestaurantServer && activeOrderKey) {
      setPendingAddedItems((prev) => {
        const currentByOrder = prev[activeOrderKey] || {};
        return {
          ...prev,
          [activeOrderKey]: {
            ...currentByOrder,
            [item.id]: (currentByOrder[item.id] || 0) + 1,
          },
        };
      });
    }
  };

  const handleChangeQty = (id: string, delta: number) => {
    if (isRestaurantServer && delta < 0) {
      const pendingQty = activePendingAddedItems[id] || 0;
      if (pendingQty < Math.abs(delta)) return;
    }

    updateActiveOrder((draft) => {
      const current = draft.items[id];
      if (!current) return draft;
      const quantity = current.quantity + delta;
      if (quantity <= 0) {
        const { [id]: _, ...rest } = draft.items;
        return { ...draft, items: rest };
      }
      return {
        ...draft,
        items: {
          ...draft.items,
          [id]: { ...current, quantity },
        },
      };
    });

    if (isRestaurantServer && activeOrderKey) {
      setPendingAddedItems((prev) => {
        const currentByOrder = prev[activeOrderKey] || {};
        if (delta > 0) {
          return {
            ...prev,
            [activeOrderKey]: {
              ...currentByOrder,
              [id]: (currentByOrder[id] || 0) + delta,
            },
          };
        }

        if (delta < 0) {
          const currentPending = currentByOrder[id] || 0;
          if (currentPending <= 0) return prev;

          const nextPending = Math.max(currentPending + delta, 0);
          const nextByOrder = { ...currentByOrder };
          if (nextPending > 0) {
            nextByOrder[id] = nextPending;
          } else {
            delete nextByOrder[id];
          }

          const next = { ...prev };
          if (Object.keys(nextByOrder).length === 0) {
            delete next[activeOrderKey];
          } else {
            next[activeOrderKey] = nextByOrder;
          }
          return next;
        }

        return prev;
      });
    }
  };

  const handleItemNoteChange = (id: string, value: string) => {
    updateActiveOrder((draft) => {
      const current = draft.items[id];
      if (!current) return draft;
      return {
        ...draft,
        items: {
          ...draft.items,
          [id]: { ...current, note: value },
        },
      };
    });
  };

  const handleMenuItemDragStart = (
    event: DragEvent<HTMLButtonElement>,
    itemId: string
  ) => {
    setDraggingMenuItemId(itemId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
  };

  const handleMenuItemDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const handleMenuItemDrop = (
    event: DragEvent<HTMLButtonElement>,
    targetId: string
  ) => {
    event.preventDefault();
    const sourceId =
      draggingMenuItemId || event.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) {
      setDraggingMenuItemId(null);
      return;
    }

    setMenuOrderIds((prev) => {
      const baseOrder =
        prev.length > 0
          ? [...prev]
          : products.map((product) => product.product_code);
      const sourceIndex = baseOrder.indexOf(sourceId);
      const targetIndex = baseOrder.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;

      const [movedId] = baseOrder.splice(sourceIndex, 1);
      baseOrder.splice(targetIndex, 0, movedId);
      return baseOrder;
    });

    suppressNextMenuClickRef.current = true;
    window.setTimeout(() => {
      suppressNextMenuClickRef.current = false;
    }, 0);
    setDraggingMenuItemId(null);
  };

  const handleMenuItemDragEnd = () => {
    setDraggingMenuItemId(null);
  };

  const buildReceiptItemsHtml = (items: ReceiptItem[]) =>
    items
      .map(
        (item) => `
          <tr>
            <td style="padding:4px 0; vertical-align:top;">
              <div class="receipt-item-name">${escapeHtml(item.name)}</div>
              ${item.note?.trim() ? `<div class="receipt-item-note">- ${escapeHtml(item.note.trim())}</div>` : ""}
            </td>
            <td style="text-align:right;padding:4px 0; vertical-align:top;">${formatCurrency(
              item.price
            )}</td>
            <td style="text-align:center;padding:4px 0; vertical-align:top;">${
              item.quantity
            }</td>
            <td style="text-align:right;padding:4px 0; vertical-align:top;">${formatCurrency(
              item.lineTotal
            )}</td>
          </tr>
        `
      )
      .join("");

  const printHtmlDocument = (html: string) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      throw new Error("Không thể tạo tài liệu in.");
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 500);
    };
  };

  const printPaymentReceipt = (options: {
    billCode?: string;
    title: string;
    tableLabel: string;
    createdAtText: string;
    items: ReceiptItem[];
    total: number;
    discountType?: DiscountType;
    discountValue?: number;
    discountAmount?: number;
    includePaymentInfo: boolean;
    paidAmount?: number;
    changeAmount?: number;
    paymentMethod?: PaymentMethod;
    cashierName?: string;
    isBarOrder?: boolean;
  }) => {
    const storeInfo = RECEIPT_STORE_INFO[storeId] || RECEIPT_STORE_INFO.cafe;
    const printAt = new Date();
    const printTime = printAt.toLocaleString("vi-VN");
    const itemRows = buildReceiptItemsHtml(options.items);
    const discount = Math.max(0, Math.min(options.discountAmount || 0, options.total));
    const finalAmount = Math.max(options.total - discount, 0);
    const receiptPaymentMethod = options.paymentMethod || paymentMethod;
    const receiptCashierName = options.cashierName || cashierName;
    const isBarReceipt = options.isBarOrder ?? isBartenderAccount;

    const paymentRows = options.includePaymentInfo
      ? `
          <div class="line-row"><span>Thanh toán:</span><span>${
            receiptPaymentMethod === "transfer" ? "Chuyển khoản" : "Tiền mặt"
          }</span></div>
          <div class="line-row"><span>Tiền khách đưa:</span><span>${formatCurrency(
            options.paidAmount || finalAmount
          )}</span></div>
          <div class="line-row"><span>Tiền trả lại:</span><span>${formatCurrency(
            options.changeAmount || 0
          )}</span></div>
        `
      : "";

    const html = `
      <html lang="vi">
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <title>${options.title} - ${options.tableLabel}</title>
          <style>
            @page { size: 80mm auto; margin: 4mm; }
            body { font-family: ${PRINT_FONT_FAMILY}; width: 80mm; margin: 0 auto; padding: 0; }
            h1, h2, h3, p { margin: 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .header { text-align: center; margin-bottom: 6px; }
            .title { font-size: 24px; font-weight: 800; text-transform: uppercase; }
            .sub { font-size: 12px; margin-top: 1px; }
            .section-title { font-size: 24px; font-weight: 800; text-transform: uppercase; text-align:center; margin-top: 8px; margin-bottom: 2px; }
            .bill-code { font-size: 13px; text-align:center; margin-bottom: 6px; }
            .line-row { display:flex; justify-content:space-between; gap:8px; margin: 2px 0; font-size: 12px; }
            .line-row strong { font-size: 14px; }
            .grid-head td { font-weight: 700; text-transform: uppercase; font-size: 11px; border-bottom: 1px solid #000; padding-bottom: 3px; }
            .receipt-item-name { font-size: 13px; font-weight: 500; line-height: 1.25; }
            .receipt-item-note { margin-top: 2px; font-size: 12px; font-weight: 700; line-height: 1.25; color: #222; }
            hr { border: 0; border-top: 1px dashed #999; margin: 8px 0; }
            .vat-note { margin-top: 7px; text-align:center; font-size: 11px; font-style: italic; }
            .thanks { margin-top: 8px; text-align:center; font-weight:700; font-size:14px; }
            .footer { margin-top: 8px; text-align:center; font-size: 12px; }
            .tail-space { height: ${PRINT_TAIL_SPACE_MM}mm; }
          </style>
        </head>
        <body>
          <div class="header">
            <p class="title">${storeInfo.title}</p>
            <p class="sub">${storeInfo.address}</p>
            <p class="sub"><strong>${storeInfo.phone}</strong></p>
          </div>
          <p class="section-title">${options.title}</p>
          ${options.billCode ? `<p class="bill-code">${options.billCode}</p>` : ""}
          ${isBarReceipt ? '<p class="bill-code"><strong>ĐƠN DO PHA CHẾ TẠO</strong></p>' : ""}
          <div class="line-row"><span><strong>${options.tableLabel}</strong></span><span>${isBarReceipt ? "Pha chế" : "Thu ngân"}: ${receiptCashierName}</span></div>
          <div class="line-row"><span>Giờ vào: ${options.createdAtText}</span><span>Giờ in: ${printTime}</span></div>
          <hr />
          <table>
            <thead>
              <tr class="grid-head">
                <td>Tên hàng</td>
                <td style="text-align:right;">Đ.Giá</td>
                <td style="text-align:center;">SL</td>
                <td style="text-align:right;">Thành tiền</td>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <hr />
          <div class="line-row"><span>Tổng tiền hàng:</span><span><strong>${formatCurrency(
            options.total
          )}</strong></span></div>
          <div class="line-row"><span>Chiết khấu${
            options.discountType === "percent" && (options.discountValue || 0) > 0
              ? ` (${options.discountValue}%)`
              : ""
          }:</span><span>${formatCurrency(discount)}</span></div>
          <div class="line-row"><span><strong>Tổng cộng:</strong></span><span><strong>${formatCurrency(
            finalAmount
          )}</strong></span></div>
          ${paymentRows}
          <p class="vat-note">Giá trên chưa bao gồm thuế VAT.</p>
          <p class="thanks">Cảm ơn quý khách và hẹn gặp lại!</p>
          <div class="footer">
            <p>Mật khẩu Wifi: ongquanxincamon</p>
            <p>Quý khách vui lòng phản hồi qua fanpage để quán phục vụ tốt hơn.</p>
          </div>
          <div class="tail-space"></div>
        </body>
      </html>
    `;
    printHtmlDocument(html);
  };

  const buildPrepItemsHtml = (items: CartItem[]) =>
    items
      .map((item) => {
        const itemLabel = item.id ? `${item.name} (${item.id})` : item.name;
        return `
          <tr>
            <td class="item-name">${itemLabel}</td>
            <td class="item-unit">&nbsp;</td>
            <td class="item-qty">${item.quantity}</td>
          </tr>
        `;
      })
      .join("");

  const formatPrepTicketJobCode = (jobId: string) => {
    const normalized = (jobId || "").replace(/[^0-9A-Za-z]/g, "").slice(-6).toUpperCase();
    if (normalized.length === 6) {
      return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
    }
    return normalized || "JOB";
  };

  const formatPrepTicketDateTime = (date: Date) => {
    const dateText = date.toLocaleDateString("vi-VN");
    const timeText = date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${dateText} ${timeText}`;
  };

  const printPrepTicket = (options: {
    tableLabel: string;
    staffName: string;
    jobCode: string;
    printedAtText: string;
    items: CartItem[];
    tailSpaceMm?: number;
  }) => {
    const tailSpace = Math.max(0, options.tailSpaceMm ?? PRINT_TAIL_SPACE_MM);
    const itemRows = buildPrepItemsHtml(options.items);
    const html = `
      <html lang="vi">
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <title>PHIEU CHE BIEN - ${options.tableLabel}</title>
          <style>
            @page { size: 80mm auto; margin: 4mm; }
            body { font-family: ${PRINT_FONT_FAMILY}; width: 80mm; margin: 0 auto; padding: 0; color: #111; }
            p, h1, h2 { margin: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
            th, td { padding: 5px 0; vertical-align: top; }
            .ticket-title { text-align: center; font-size: 18px; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; }
            .line { font-size: 16px; font-weight: 700; margin-top: 3px; }
            .sub-line { font-size: 15px; font-weight: 700; margin-top: 3px; }
            .meta-line { font-size: 14px; margin-top: 3px; }
            .head-row th { font-size: 13px; font-weight: 700; border-bottom: 1px solid #000; }
            .item-row td { border-bottom: 1px solid #000; }
            .item-name { width: 70%; padding-right: 6px; }
            .item-unit { width: 10%; text-align: center; }
            .item-qty { width: 20%; text-align: right; font-weight: 700; }
            .tail-space { height: ${tailSpace}mm; }
          </style>
        </head>
        <body>
          <p class="ticket-title">CHẾ BIẾN</p>
          <p class="line">Bàn: ${options.tableLabel}</p>
          <p class="sub-line">Phục vụ: ${options.staffName || "-"}</p>
          <p class="meta-line">${options.jobCode} - ${options.printedAtText}</p>
          <table>
            <thead>
              <tr class="head-row">
                <th style="text-align:left;">Món</th>
                <th style="text-align:center;">ĐVT</th>
                <th style="text-align:right;">SL</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <div class="tail-space"></div>
        </body>
      </html>
    `;
    printHtmlDocument(html);
  };

  useEffect(() => {
    if (!storeId || !canUseKitchenAutoPrint || !isKitchenAutoPrintEnabled) return;

    const printKitchenJob = async (job: KitchenPrintJob) => {
      if (printingKitchenJobsRef.current.has(job.id)) return;
      printingKitchenJobsRef.current.add(job.id);
      appendKitchenPrintLog(
        `Nhan job bếp ${job.id.slice(-6).toUpperCase()} - Ban ${job.tableNumber || job.orderKey}`
      );

      try {
        const mappedItems: CartItem[] = (job.items || [])
          .filter((item) => item.menuId && item.quantity > 0)
          .map((item) => ({
            id: item.menuId,
            name: item.name,
            price: item.price || 0,
            quantity: item.quantity,
            note: item.note || "",
            category: "Khác",
          }));

        if (mappedItems.length === 0) {
          await markKitchenPrintJobPrinted(job.id, kitchenTerminalName);
          appendKitchenPrintLog(
            `Bo qua job ${job.id.slice(-6).toUpperCase()} vi khong co mon hop le`
          );
          return;
        }

        printPrepTicket({
          tableLabel: job.tableNumber || job.orderKey,
          staffName: job.createdByName || "",
          jobCode: formatPrepTicketJobCode(job.id),
          printedAtText: formatPrepTicketDateTime(
            job.createdAt?.seconds
              ? new Date(job.createdAt.seconds * 1000)
              : new Date()
          ),
          items: mappedItems,
          tailSpaceMm: PRINT_TAIL_SPACE_MM,
        });

        await markKitchenPrintJobPrinted(job.id, kitchenTerminalName);
        appendKitchenPrintLog(
          `In xong job ${job.id.slice(-6).toUpperCase()} - ${mappedItems.length} mon`
        );
      } catch (error) {
        console.error("Không in được phiếu món mới", error);
        const errorMessage =
          error instanceof Error ? error.message : "Khong ro nguyen nhan";
        appendKitchenPrintLog(
          `Loi in job ${job.id.slice(-6).toUpperCase()}: ${errorMessage}`
        );
      } finally {
        printingKitchenJobsRef.current.delete(job.id);
      }
    };

    const unsubscribe = subscribePendingKitchenPrintJobs(
      storeId,
      (jobs) => {
        jobs.forEach((job) => {
          void printKitchenJob(job);
        });
      },
      (error) => {
        console.error("Không đồng bộ được phiếu in bếp", error);
        appendKitchenPrintLog("Loi dong bo phieu in bep");
      }
    );

    return () => unsubscribe();
  }, [
    canUseKitchenAutoPrint,
    isKitchenAutoPrintEnabled,
    kitchenTerminalName,
    appendKitchenPrintLog,
    storeId,
  ]);

  const handleSubmitKitchenAddedItems = async () => {
    if (!isRestaurantServer) return;
    if (!storeId) {
      alert("Thiếu thông tin cửa hàng. Vui lòng tải lại trang.");
      return;
    }
    if (!activeOrderKey) {
      alert("Vui lòng chọn bàn trước khi lưu món mới.");
      return;
    }
    if (pendingAddedCount <= 0) {
      alert("Chưa có món mới để lưu.");
      return;
    }

    const pendingMap = pendingAddedItems[activeOrderKey] || {};
    const incrementalItems = Object.entries(pendingMap)
      .map(([itemId, qty]) => {
        const source = cart[itemId];
        if (!source || qty <= 0) return null;
        return {
          ...source,
          quantity: qty,
        } as CartItem;
      })
      .filter((item): item is CartItem => Boolean(item));

    if (incrementalItems.length === 0) {
      setPendingAddedItems((prev) => {
        const next = { ...prev };
        delete next[activeOrderKey];
        return next;
      });
      alert("Không còn món mới để lưu.");
      return;
    }

    const printableItems = incrementalItems.filter((item) =>
      canPrintPreparationItem(item.category)
    );
    const skippedItemCount = incrementalItems.length - printableItems.length;

    try {
      if (printableItems.length > 0) {
        await createKitchenPrintJob({
          storeId,
          orderKey: activeOrderKey,
          tableNumber: activeOrderKey,
          createdById: user?.uid,
          createdByName: cashierName,
          items: printableItems.map((item) => ({
            menuId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            note: item.note || "",
          })),
        });
      }
    } catch (error) {
      console.error("Không tạo được phiếu món mới", error);
      alert(
        "Không tạo được phiếu in món mới. Vui lòng kiểm tra mạng và quyền Firestore."
      );
      return;
    }

    setPendingAddedItems((prev) => {
      const next = { ...prev };
      delete next[activeOrderKey];
      return next;
    });
    if (printableItems.length === 0) {
      alert("Đã lưu món mới. Các danh mục đã chọn không in bill chế biến.");
    } else if (skippedItemCount > 0) {
      alert(
        `Đã lưu món mới và gửi ${printableItems.length} món để in. ${skippedItemCount} món thuộc danh mục không in bill chế biến.`
      );
    } else {
      alert("Đã lưu món mới. Máy bếp chính sẽ tự in.");
    }
  };

  const handlePay = async () => {
    if (isRestaurantServer) {
      alert("Tài khoản phục vụ chỉ được thêm món và lưu món mới.");
      return;
    }
    if (!activeOrderKey) {
      alert("Vui lòng chọn số bàn gọi.");
      return;
    }
    if (cartItems.length === 0) {
      alert("Chưa có món nào trong giỏ.");
      return;
    }
    if (isShiftEnabledForUser && !activeShift) {
      setShowOpenShiftModal(true);
      alert("Vui lòng mở ca làm việc trước khi thanh toán.");
      return;
    }
    openReceiptPreview();
  };

  const openReceiptPreview = () => {
    if (!activeOrderKey) {
      alert("Vui lòng chọn bàn trước khi in.");
      return;
    }
    if (cartItems.length === 0) {
      alert("Chưa có món nào để in.");
      return;
    }

    const pricing = calculateOrderPricing(cartItems, enabledSurcharges);
    checkoutRequestIdRef.current =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date();
    const formattedDate = now.toLocaleString("vi-VN");
    const normalizedCashReceived =
      paymentMethod === "cash" ? Math.max(cashReceived, pricing.total) : 0;
    if (paymentMethod === "cash" && cashReceived < pricing.total) {
      setCashReceivedInput(String(normalizedCashReceived));
    }

    setDiscountType("percent");
    setDiscountInput("");
    setReceiptData({
      table: isFarmStore ? FARM_ORDER_LABEL : tableNumber,
      items: pricing.items,
      subtotal: pricing.subtotal,
      surchargeTotal: pricing.surchargeTotal,
      appliedSurcharges: pricing.surchargeSummaries,
      total: pricing.total,
      time: formattedDate,
      paymentMethod,
      cashReceived: paymentMethod === "cash" ? normalizedCashReceived : undefined,
      changeAmount:
        paymentMethod === "cash"
          ? Math.max(normalizedCashReceived - pricing.total, 0)
          : undefined,
    });
    setShowReceipt(true);
  };

  const handlePrintTemporaryReceipt = () => {
    if (!receiptData) return;
    const isTakeawayOrder =
      receiptData.table === TAKEAWAY_NAME || receiptData.table === FARM_ORDER_LABEL;
    const orderLabel = isTakeawayOrder ? "Mang về" : receiptData.table;

    printPaymentReceipt({
      title: "PHIẾU TẠM TÍNH",
      tableLabel: orderLabel,
      createdAtText: receiptData.time,
      items: receiptData.items,
      total: receiptData.total,
      discountType,
      discountValue: enteredDiscountValue,
      discountAmount: receiptDiscountAmount,
      includePaymentInfo: false,
    });
  };

  const handleConfirmPrint = async () => {
    if (!receiptData || paymentInFlightRef.current) return;
    let paymentCompleted = false;
    const currentCashReceived = parseMoney(cashReceivedInput);
    const currentChangeAmount =
      paymentMethod === "cash"
        ? Math.max(currentCashReceived - receiptPayableTotal, 0)
        : 0;
    if (paymentMethod === "cash" && currentCashReceived < receiptPayableTotal) {
      alert("Tiền khách đưa phải lớn hơn hoặc bằng tổng tiền.");
      return;
    }

    paymentInFlightRef.current = true;
    setIsPaying(true);
    try {
      const checkoutRequestId =
        checkoutRequestIdRef.current ||
        (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      checkoutRequestIdRef.current = checkoutRequestId;
      const billId = await saveBill({
        tableNumber: isFarmStore ? FARM_ORDER_KEY : receiptData.table,
        subtotalBeforeSurcharge: receiptData.subtotal,
        surchargeTotal: receiptData.surchargeTotal,
        appliedSurcharges: receiptData.appliedSurcharges,
        discountType,
        discountValue: enteredDiscountValue,
        discountAmount: receiptDiscountAmount,
        total: receiptPayableTotal,
        storeId,
        paymentMethod,
        cashReceived: paymentMethod === "cash" ? currentCashReceived : undefined,
        changeAmount: paymentMethod === "cash" ? currentChangeAmount : undefined,
        shiftId: activeShift?.id,
        cashierId: user?.uid,
        cashierName,
        checkoutRequestId,
        items: receiptData.items.map((item) => ({
          menuId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          basePrice: item.basePrice,
          surchargePerUnit: item.surchargePerUnit,
          surchargeTotal: item.surchargeTotal,
          note: item.note?.trim() || "",
        })),
      });

      const billCode = billId;
      const isTakeawayOrder =
        receiptData.table === TAKEAWAY_NAME || receiptData.table === FARM_ORDER_LABEL;
      const orderLabel = isTakeawayOrder ? "Mang về" : receiptData.table;
      const finalAmount = receiptPayableTotal;
      const paidAmount = paymentMethod === "cash" ? currentCashReceived : finalAmount;

      // Queue the preparation ticket before any interactive browser printing.
      // Bartender terminals rely exclusively on the LAN print agent so checkout
      // never pauses on the browser print dialog.
      if (storeId === CAFE_STORE_ID) {
        const printableItems = receiptData.items.filter((item) =>
          canPrintPreparationItem(item.category)
        );
        if (printableItems.length > 0) {
          await createBarPrintJob({
            storeId,
            tableNumber: orderLabel,
            sourceBillId: billId,
            createdById: user?.uid,
            createdByName: cashierName,
            items: printableItems.map((item) => ({
              menuId: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              note: item.note?.trim() || "",
            })),
          });
        }
      }

      if (!isBartenderAccount) {
        // Browser printing blocks React from painting pending state updates. Commit
        // the closed modal first so an Enter used in the print dialog cannot submit it again.
        flushSync(() => setShowReceipt(false));
        printPaymentReceipt({
          billCode,
          title: isBakeryStore ? "HÓA ĐƠN BÁN HÀNG" : "PHIẾU TÍNH TIỀN",
          tableLabel: orderLabel,
          createdAtText: receiptData.time,
          items: receiptData.items,
          total: receiptData.total,
          discountType,
          discountValue: enteredDiscountValue,
          discountAmount: receiptDiscountAmount,
          includePaymentInfo: true,
          paidAmount,
          changeAmount: paymentMethod === "cash" ? currentChangeAmount : 0,
        });
      }

      if (activeOrderKey) {
        const pendingSyncTimer = orderSyncTimersRef.current.get(activeOrderKey);
        if (pendingSyncTimer) {
          window.clearTimeout(pendingSyncTimer);
          orderSyncTimersRef.current.delete(activeOrderKey);
        }
        if (storeId) {
          await clearLiveOrder(storeId, activeOrderKey);
        }
        setOrderDrafts((prev) => {
          const next = { ...prev };
          delete next[activeOrderKey];
          return next;
        });
        setPendingAddedItems((prev) => {
          const next = { ...prev };
          delete next[activeOrderKey];
          return next;
        });
      }

      if (showSoldBills) {
        void loadSoldBills(true);
      }
      setCashReceivedInput("");
      setPaymentMethod("cash");
      setShowReceipt(false);
      checkoutRequestIdRef.current = null;
      paymentCompleted = true;
    } catch (error) {
      console.error(error);
      alert("Lỗi khi lưu hoặc in bill. Vui lòng thử lại.");
    } finally {
      setIsPaying(false);
      if (paymentCompleted) {
        window.setTimeout(() => {
          paymentInFlightRef.current = false;
        }, 500);
      } else {
        paymentInFlightRef.current = false;
      }
    }
  };

  const handleSelectTable = (name: string) => {
    setTableNumber(name);
    setActiveTab("menu");
  };

  const handleOpenAddTableModal = () => {
    if (role !== "admin" || isFarmStore) return;
    setShowActionMenu(false);
    setNewTableName("");
    setNewTableArea("");
    setShowAddTableModal(true);
  };

  const handleAddTable = async () => {
    if (role !== "admin") {
      alert("Chỉ quản trị viên được thêm bàn mới.");
      return;
    }
    if (!newTableName.trim()) {
      alert("Nhập tên/số bàn trước khi lưu.");
      return;
    }
    try {
      const id = await addTable(newTableName, newTableArea, storeId);
      if (id) {
        const refreshed = await getTables(storeId);
        setTables(refreshed);
        setTableNumber(newTableName.trim());
        setNewTableName("");
        setNewTableArea("");
        setShowAddTableModal(false);
        setActiveTab("tables");
        alert("Đã thêm bàn mới.");
      }
    } catch (error) {
      console.error(error);
      alert("Không lưu được số bàn, vui lòng thử lại.");
    }
  };

  const handleSeedTables = async () => {
    if (role !== "admin") return;
    if (isSeedingTables) return;
    const seedNames = Array.from(
      { length: 100 },
      (_, i) => `T${String(i + 1).padStart(2, "0")}`
    );
    const existingNames = new Set(tables.map((t) => t.name.toLowerCase()));
    const missing = seedNames.filter(
      (name) => !existingNames.has(name.toLowerCase())
    );

    if (missing.length === 0) {
      alert("Đã có đủ 100 bàn trong hệ thống.");
      return;
    }

    const confirmMsg = `Thêm nhanh ${missing.length} bàn mới (T01...T100). Tiếp tục?`;
    if (!window.confirm(confirmMsg)) return;

    setIsSeedingTables(true);
    try {
      await Promise.all(missing.map((name) => addTable(name, "", storeId)));
      const refreshed = await getTables(storeId);
      setTables(refreshed);
      alert(`Đã thêm ${missing.length} bàn.`);
    } catch (error) {
      console.error(error);
      alert("Lỗi khi thêm bàn nhanh. Vui lòng thử lại.");
    } finally {
      setIsSeedingTables(false);
    }
  };

  const printHtml = (html: string) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      alert("Không thể in, vui lòng kiểm tra trình duyệt.");
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 500);
    };
  };

  const getShiftLabel = (shiftType: ShiftType) => {
    if (shiftType === "shift_1") return "Ca 1";
    if (shiftType === "shift_2") return "Ca 2";
    if (shiftType === "shift_3") return "Ca 3";
    return "Ca chung";
  };

  const getDailyReportShiftLabel = (shiftType: DailyReportShift) =>
    shiftType === "all" ? "Cả ngày" : getShiftLabel(shiftType);

  const handleOpenShift = async () => {
    if (!user || !storeId) return;
    if (!deviceIdentity?.id) {
      alert("Chưa nhận diện được thiết bị. Vui lòng tải lại trang.");
      return;
    }
    const shiftType = resolveShiftType();
    if (usesThreeShiftByAccount && shiftType === "single") {
      alert("Mô hình này yêu cầu đăng nhập bằng tài khoản được gán Ca 1/2/3.");
      return;
    }
    const openingCash = parseMoney(openingCashInput);
    if (openingCashInput.trim() === "" || openingCash <= 0) {
      alert("Vui lòng nhập tiền mặt đầu ca lớn hơn 0.");
      return;
    }

    setIsOpeningShift(true);
    try {
      const result = await openShift({
        storeId,
        cashierUid: user.uid,
        cashierName,
        shiftType,
        openingCash,
        openNote: openingNote,
        deviceId: deviceIdentity.id,
        deviceName: deviceIdentity.name,
      });
      setActiveShift(result.item);
      setShowOpenShiftModal(false);
      setOpeningCashInput("");
      setOpeningNote("");
      if (result.alreadyOpen) {
        setShiftSyncNotice(
          `Ca đã được mở trên ${result.item.openedByDeviceName || "thiết bị khác"}. Máy này đã dùng chung ca hiện tại.`
        );
      } else {
        alert("Mở ca thành công.");
      }
    } catch (error) {
      console.error(error);
      alert("Không thể mở ca. Vui lòng thử lại.");
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handlePrepareCloseShift = async (resetForm = true) => {
    if (!activeShift) {
      alert("Chưa có ca mở để đóng.");
      return;
    }
    setIsPreparingCloseShift(true);
    try {
      const bills = await getBillsByShift(activeShift.id);
      const vouchers = await getCashVouchers({
        storeId,
        shiftId: activeShift.id,
        limitCount: 1000,
      });
      const summary = summarizeBillsForShift(
        bills,
        activeShift.openingCash || 0,
        vouchers
      );
      const itemTotals = bills
        .filter((bill) => bill.status !== "cancelled")
        .reduce(
          (totals, bill) => {
            (bill.items || []).forEach((item) => {
              const kind = getSoldProductKind(item.menuId, item.name || "");
              totals[kind] += Number(item.quantity || 0);
            });
            return totals;
          },
          { drink: 0, bakery: 0 } as Record<SoldProductKind, number>
        );
      setCloseShiftSummary(summary);
      setCloseShiftDrinkItems(itemTotals.drink);
      setCloseShiftBakeryItems(itemTotals.bakery);
      if (resetForm) {
        setClosingCashInput("");
        setClosingNote("");
      }
      setShowCloseShiftModal(true);
      setShowActionMenu(false);
    } catch (error) {
      console.error(error);
      alert("Không thể tải dữ liệu kết ca.");
    } finally {
      setIsPreparingCloseShift(false);
    }
  };

  const handleCloseShiftAndPrint = async () => {
    if (!activeShift || !closeShiftSummary) return;
    if (closingCashInput.trim() === "") {
      alert("Vui lòng nhập tiền mặt cuối ca.");
      return;
    }
    const closingCash = parseMoney(closingCashInput);
    setIsClosingShift(true);
    try {
      const handoverAmount = getShiftHandoverAmount(closeShiftSummary);
      const reconciledClosingCash = (activeShift.openingCash || 0) + handoverAmount;
      let endOfDayHandover: EndOfDayHandover | null = null;
      if (activeShift.shiftType === "shift_3") {
        const shiftDate = activeShift.openedAt?.seconds
          ? new Date(activeShift.openedAt.seconds * 1000)
          : new Date();
        const { start, end } = getLocalDayRange(toLocalDateInput(shiftDate));
        const shiftTypes: Exclude<ShiftType, "single">[] = [
          "shift_1",
          "shift_2",
          "shift_3",
        ];
        const shiftsByType = await Promise.all(
          shiftTypes.map((shiftType) =>
            getShiftsForReport({ storeId, startDate: start, endDate: end, shiftType })
          )
        );
        const dayShifts = shiftsByType.flat();
        const shiftIds = dayShifts.map((shift) => shift.id);
        const [dayBills, dayVouchers] = shiftIds.length
          ? await Promise.all([
              getBills({ storeId, shiftIds, includeCancelled: true, limitCount: 5000 }),
              getCashVouchers({ storeId, shiftIds, limitCount: 5000 }),
            ])
          : [[], []];
        const handoverByShift = shiftTypes.reduce(
          (totals, shiftType) => {
            const ids = new Set(
              dayShifts.filter((shift) => shift.shiftType === shiftType).map((shift) => shift.id)
            );
            const summary = summarizeBillsForShift(
              dayBills.filter((bill) => ids.has(bill.shiftId || "")),
              0,
              dayVouchers.filter((voucher) => ids.has(voucher.shiftId || ""))
            );
            totals[shiftType] = getShiftHandoverAmount(summary);
            return totals;
          },
          { shift_1: 0, shift_2: 0, shift_3: 0 } as Record<
            Exclude<ShiftType, "single">,
            number
          >
        );
        const totalHandover = Object.values(handoverByShift).reduce(
          (total, amount) => total + amount,
          0
        );
        const actualHandoverByShift = dayShifts.reduce(
          (totals, shift) => {
            const shiftClosingCash =
              shift.id === activeShift.id ? closingCash : shift.closingCash;
            if (shiftClosingCash === null || shiftClosingCash === undefined) return totals;
            totals[shift.shiftType as Exclude<ShiftType, "single">] +=
              shiftClosingCash - Number(shift.openingCash || 0);
            return totals;
          },
          { shift_1: 0, shift_2: 0, shift_3: 0 } as Record<
            Exclude<ShiftType, "single">,
            number
          >
        );
        const totalActualCash = Object.values(actualHandoverByShift).reduce(
          (total, amount) => total + amount,
          0
        );
        const daySummary = summarizeBillsForShift(dayBills, 0, dayVouchers);
        endOfDayHandover = {
          shifts: actualHandoverByShift,
          total: totalActualCash,
          expectedTotal: totalHandover,
          difference: totalActualCash - totalHandover,
          totalSales: daySummary.totalSales,
          cashSales: daySummary.cashSales,
          transferSales: daySummary.transferSales,
          incomeVouchers: daySummary.incomeVouchers,
          expenseVouchers: daySummary.expenseVouchers,
        };
      }
      const surplusNote =
        endOfDayHandover && endOfDayHandover.difference > 0
          ? `Dư quỹ cả ngày: ${formatCurrency(endOfDayHandover.difference)} đ`
          : "";
      const finalClosingNote = [closingNote.trim(), surplusNote].filter(Boolean).join(". ");
      await closeShift(activeShift.id, {
        closingCash,
        closeNote: finalClosingNote,
        summary: {
          ...closeShiftSummary,
          expectedClosingCash: reconciledClosingCash,
        },
      });

      const diff = closingCash - reconciledClosingCash;
      const diffInfo = getCashDifferenceInfo(diff);
      const openedAtText = activeShift.openedAt?.seconds
        ? new Date(activeShift.openedAt.seconds * 1000).toLocaleString("vi-VN")
        : new Date().toLocaleString("vi-VN");
      const closedAtText = new Date().toLocaleString("vi-VN");
      const endOfDaySection = endOfDayHandover
        ? `<div class="section">
            <p class="section-title">Kết ngày - Tổng hợp cả ngày</p>
            <table>
              <tr><td>Tổng doanh thu</td><td class="right">${formatCurrency(endOfDayHandover.totalSales)} đ</td></tr>
              <tr><td>Tiền mặt</td><td class="right">${formatCurrency(endOfDayHandover.cashSales)} đ</td></tr>
              <tr><td>Chuyển khoản</td><td class="right">${formatCurrency(endOfDayHandover.transferSales)} đ</td></tr>
              <tr><td>Phiếu thu</td><td class="right">+${formatCurrency(endOfDayHandover.incomeVouchers)} đ</td></tr>
              <tr><td>Phiếu chi</td><td class="right">-${formatCurrency(endOfDayHandover.expenseVouchers)} đ</td></tr>
              <tr class="total"><td>Tiền phải bàn giao</td><td class="right">${formatCurrency(endOfDayHandover.expectedTotal)} đ</td></tr>
            </table>
          </div>
          <div class="section">
            <p class="section-title">Tiền thực tế bàn giao 3 ca</p>
            <table>
              <tr><td>Ca 1</td><td class="right">${formatCurrency(endOfDayHandover.shifts.shift_1)} đ</td></tr>
              <tr><td>Ca 2</td><td class="right">${formatCurrency(endOfDayHandover.shifts.shift_2)} đ</td></tr>
              <tr><td>Ca 3</td><td class="right">${formatCurrency(endOfDayHandover.shifts.shift_3)} đ</td></tr>
              <tr class="total"><td>Tổng thực tế cả ngày</td><td class="right">${formatCurrency(endOfDayHandover.total)} đ</td></tr>
            </table>
          </div>`
        : "";

      const printHtmlContent = `
        <html lang="vi">
          <head>
            <meta charset="UTF-8" />
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
            <title>Phiếu bàn giao ca</title>
            <style>
              @page { size: 80mm auto; margin: 4mm; }
              body { font-family: ${PRINT_FONT_FAMILY}; width: 80mm; margin: 0 auto; padding: 4mm; font-size: 12px; }
              h2, h3, p { margin: 0; }
              h2 { text-align: center; font-size: 18px; }
              .subtitle { margin-top: 2px; text-align: center; }
              .section { margin-top: 8px; border-top: 1px dashed #777; padding-top: 6px; }
              .section-title { margin-bottom: 3px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
              table { width: 100%; border-collapse: collapse; }
              td { padding: 3px 0; vertical-align: top; }
              .right { text-align: right; }
              .total td { border-top: 1px solid #555; padding-top: 5px; font-weight: 700; }
              .strong td { font-weight: 700; }
              .line { border-top: 1px dashed #999; margin: 8px 0; }
              .tail-space { height: ${PRINT_TAIL_SPACE_MM}mm; }
            </style>
          </head>
          <body>
            <h2>Biên bản bàn giao ca</h2>
            <p class="subtitle">${storeId.toUpperCase()} - ${getShiftLabel(activeShift.shiftType)}</p>

            <div class="section">
              <p class="section-title">Thông tin ca</p>
              <table>
                <tr><td>Thu ngân</td><td class="right">${escapeHtml(activeShift.cashierName)}</td></tr>
                <tr><td>Giờ mở ca</td><td class="right">${openedAtText}</td></tr>
                <tr><td>Giờ đóng ca</td><td class="right">${closedAtText}</td></tr>
              </table>
            </div>

            <div class="section">
              <p class="section-title">Doanh thu trong ca</p>
              <table>
              <tr><td>Tiền mặt</td><td class="right">${formatCurrency(
                closeShiftSummary.cashSales
              )} đ</td></tr>
              <tr><td>Chuyển khoản</td><td class="right">${formatCurrency(
                closeShiftSummary.transferSales
              )} đ</td></tr>
              <tr class="total"><td>Tổng doanh thu</td><td class="right">${formatCurrency(
                closeShiftSummary.totalSales
              )} đ</td></tr>
              <tr class="strong"><td>Nước đã bán (ly)</td><td class="right">${formatCurrency(
                closeShiftDrinkItems
              )}</td></tr>
              <tr class="strong"><td>Bánh đã bán (món)</td><td class="right">${formatCurrency(
                closeShiftBakeryItems
              )}</td></tr>
              </table>
            </div>

            <div class="section">
              <p class="section-title">Thu / chi trong ca</p>
              <table>
              <tr><td>Phiếu thu</td><td class="right">${formatCurrency(
                closeShiftSummary.incomeVouchers
              )} đ</td></tr>
              <tr><td>Phiếu chi</td><td class="right">-${formatCurrency(
                closeShiftSummary.expenseVouchers
              )} đ</td></tr>
              </table>
            </div>

            <div class="section">
              <p class="section-title">Bàn giao tiền mặt</p>
              <table>
              <tr><td>Tiền đầu ca</td><td class="right">${formatCurrency(
                activeShift.openingCash || 0
              )} đ</td></tr>
              <tr><td>Doanh thu két</td><td class="right">${formatCurrency(
                reconciledClosingCash
              )} đ</td></tr>
              <tr class="strong"><td>Bàn giao thực tế</td><td class="right">${formatCurrency(
                handoverAmount
              )} đ</td></tr>
              <tr><td>Chênh lệch (${diffInfo.label})</td><td class="right">${formatCurrency(
                diffInfo.amount
              )} đ</td></tr>
              </table>
            </div>
            ${endOfDaySection}
            ${
              finalClosingNote
                ? `<div class="section"><p class="section-title">Ghi chú</p><p>${escapeHtml(finalClosingNote)}</p></div>`
                : ""
            }
            <div class="line"></div>
            <p style="text-align:center">Cảm ơn!</p>
            <div class="tail-space"></div>
          </body>
        </html>
      `;

      printHtml(printHtmlContent);

      setShowCloseShiftModal(false);
      setCloseShiftSummary(null);
      setCloseShiftDrinkItems(0);
      setCloseShiftBakeryItems(0);
      setActiveShift(null);
      setClosingCashInput("");
      setClosingNote("");
      setShowOpenShiftModal(true);
    } catch (error) {
      console.error(error);
      alert("Không thể đóng ca.");
    } finally {
      setIsClosingShift(false);
    }
  };

  const loadDailyReport = async (dateValue: string, shiftType: DailyReportShift) => {
    if (!storeId) return;
    setExpandedDailyBillHours(new Set());
    setExpandedDailyReportBillId(null);
    setDailyReport(null);
    setDailyReportBills([]);
    setDailyReportVouchers([]);
    setDailyReportShifts([]);
    setIsLoadingDailyReport(true);
    try {
      const { start, end } = getLocalDayRange(dateValue);
      let bills: Bill[] = [];
      let vouchers: CashVoucher[] = [];
      let reportShifts: CashierShift[] = [];
      if (shiftType === "all") {
        const [loadedBills, loadedVouchers, ...shiftsByType] = await Promise.all([
          getBills({ storeId, startDate: start, endDate: end, includeCancelled: true, limitCount: 2000 }),
          getCashVouchers({ storeId, startDate: start, endDate: end, limitCount: 2000 }),
          getShiftsForReport({ storeId, startDate: start, endDate: end, shiftType: "shift_1" }),
          getShiftsForReport({ storeId, startDate: start, endDate: end, shiftType: "shift_2" }),
          getShiftsForReport({ storeId, startDate: start, endDate: end, shiftType: "shift_3" }),
        ]);
        bills = loadedBills;
        vouchers = loadedVouchers;
        reportShifts = shiftsByType.flat();
      } else {
        const shifts = await getShiftsForReport({ storeId, startDate: start, endDate: end, shiftType });
        reportShifts = shifts;
        const shiftIds = shifts.map((shift) => shift.id);
        if (shiftIds.length > 0) {
          [bills, vouchers] = await Promise.all([
            getBills({ storeId, shiftIds, includeCancelled: true, limitCount: 2000 }),
            getCashVouchers({ storeId, shiftIds, limitCount: 2000 }),
          ]);
        }
      }
      const summary = summarizeBillsForShift(bills, 0, vouchers);
      setDailyReportBills(bills);
      setDailyReportVouchers(vouchers);
      setDailyReportShifts(reportShifts);
      setDailyReport(summary);
    } catch (error) {
      console.error(error);
      alert("Không thể tải báo cáo cuối ngày.");
    } finally {
      setIsLoadingDailyReport(false);
    }
  };

  const handleOpenDailyReport = async () => {
    if (!storeId) return;
    try {
      setCategories(await getCategories(storeId));
    } catch (error) {
      console.error("Không tải được cấu hình category báo cáo mới nhất", error);
    }
    const activeShiftOpenedAt = activeShift?.openedAt?.seconds
      ? new Date(activeShift.openedAt.seconds * 1000)
      : new Date();
    const currentDate = toLocalDateInput(activeShiftOpenedAt);
    const accountShift = resolveShiftType();
    const currentShift: DailyReportShift = activeShift && activeShift.shiftType !== "single"
      ? activeShift.shiftType
      : accountShift !== "single"
        ? accountShift
        : "shift_1";
    setShowActionMenu(false);
    setShowDailyReport(true);
    setDailyReportTab("overview");
    setDailyReportPaymentFilter("all");
    setDailyReportDate(currentDate);
    setDailyReportShift(currentShift);
    void loadDailyReport(currentDate, currentShift);
  };

  const handlePrintDailyReport = () => {
    if (!dailyReport) return;
    const reportDateText = getLocalDayRange(dailyReportDate).start.toLocaleDateString("vi-VN");
    const buildProductRows = (rows: DailyProductRow[]) =>
      rows.map(
        (item) => `<tr><td>${escapeHtml(item.name)}</td><td class="right">${formatCurrency(
          item.quantity
        )}</td><td class="right">${formatCurrency(item.revenue)} đ</td></tr>`
      )
      .join("");
    const productSummaryRows = dailyReportProductGroups
      .map((group) => `<tr><td>${escapeHtml(group.title)} (${escapeHtml(group.unit)})</td><td class="right">${formatCurrency(group.total)}</td></tr>`)
      .join("");
    const productGroupSections = dailyReportProductGroups
      .map((group) => {
        const rows = buildProductRows(group.rows);
        return `<div class="line"></div>
          <p><strong>${escapeHtml(group.title.toUpperCase())} - ${getDailyReportShiftLabel(dailyReportShift).toUpperCase()} (${formatCurrency(group.total)} ${escapeHtml(group.unit.toUpperCase())})</strong></p>
          <table>
            <thead><tr><td><strong>Món</strong></td><td class="right"><strong>SL</strong></td><td class="right"><strong>Doanh thu</strong></td></tr></thead>
            <tbody>${rows || `<tr><td colspan="3">Chưa có dữ liệu</td></tr>`}</tbody>
          </table>`;
      })
      .join("");
    const html = `
      <html lang="vi">
        <head>
          <meta charset="UTF-8" />
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <title>Báo cáo cuối ngày</title>
          <style>
            @page { size: 80mm auto; margin: 4mm; }
            body { font-family: ${PRINT_FONT_FAMILY}; width: 80mm; margin: 0 auto; padding: 4mm; font-size: 12px; }
            h2, p { margin: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            td { padding: 3px 0; }
            .right { text-align: right; }
            .line { border-top: 1px dashed #999; margin: 8px 0; }
            .tail-space { height: ${PRINT_TAIL_SPACE_MM}mm; }
          </style>
        </head>
        <body>
          <h2>Báo cáo cuối ngày</h2>
          <p>Ngày: ${reportDateText} - ${getDailyReportShiftLabel(dailyReportShift)}</p>
          <div class="line"></div>
          <table>
            <tr><td>Tổng doanh thu</td><td class="right">${formatCurrency(
              dailyReport.totalSales
            )} đ</td></tr>
            <tr><td>Số bill</td><td class="right">${dailyReport.completedBills}</td></tr>
            ${productSummaryRows}
            <tr><td>Phiếu thu</td><td class="right">${formatCurrency(
              dailyReport.incomeVouchers
            )} đ</td></tr>
            <tr><td>Phiếu chi</td><td class="right">-${formatCurrency(
              dailyReport.expenseVouchers
            )} đ</td></tr>
            <tr><td>Tiền mặt</td><td class="right">${formatCurrency(
              dailyReport.cashSales
            )} đ</td></tr>
            <tr><td>Tiền đầu ca</td><td class="right">${formatCurrency(
              dailyOpeningCash
            )} đ</td></tr>
            <tr><td>Doanh thu két</td><td class="right">${formatCurrency(
              dailyTillRevenue
            )} đ</td></tr>
            <tr><td>Tiền dư</td><td class="right">+${formatCurrency(
              dailyCashSurplus
            )} đ</td></tr>
            <tr><td>Tiền bàn giao</td><td class="right"><strong>${formatCurrency(
              getShiftHandoverAmount(dailyReport)
            )} đ</strong></td></tr>
            <tr><td>Chuyển khoản</td><td class="right">${formatCurrency(
              dailyReport.transferSales
            )} đ</td></tr>
            <tr><td>Hóa đơn hủy</td><td class="right">${
              dailyReport.cancelledBills
            }</td></tr>
            <tr><td>Giá trị hủy</td><td class="right">${formatCurrency(
              dailyReport.cancelledAmount
            )} đ</td></tr>
          </table>
          ${productGroupSections}
          <div class="line"></div>
          <p style="text-align:center">Kết thúc báo cáo</p>
          <div class="tail-space"></div>
        </body>
      </html>
    `;
    printHtml(html);
  };

  const handleOpenVoucherModal = (type: CashVoucherType) => {
    if (isShiftEnabledForUser && !activeShift) {
      setShowActionMenu(false);
      setShowOpenShiftModal(true);
      alert("Vui lòng mở ca làm việc trước khi lập phiếu thu/chi.");
      return;
    }
    setShowActionMenu(false);
    resetVoucherForm(type);
  };

  const handleSaveVoucher = async () => {
    if (!showVoucherModal) return;
    const amount = parseMoney(voucherAmountInput);
    if (amount <= 0) {
      alert("Giá trị phiếu phải lớn hơn 0.");
      return;
    }
    if (!voucherCategory.trim()) {
      alert("Vui lòng nhập loại thu/chi.");
      return;
    }
    setIsSavingVoucher(true);
    try {
      await createCashVoucher({
        storeId,
        type: showVoucherModal,
        amount,
        category: voucherCategory,
        personName: voucherPersonName,
        note: voucherNote,
        includeInCashFlow: voucherIncludeInCashFlow,
        happenedAt: voucherDateTime ? new Date(voucherDateTime) : new Date(),
        shiftId: activeShift?.id,
        cashierId: user?.uid,
        cashierName,
      });
      setVoucherCategories(await getCashVoucherCategories(storeId));
      setShowVoucherModal(null);
      alert("Đã lưu phiếu thành công.");
      if (showCloseShiftModal && activeShift) {
        void handlePrepareCloseShift(false);
      }
      if (showDailyReport) {
        void loadDailyReport(dailyReportDate, dailyReportShift);
      }
    } catch (error) {
      console.error(error);
      alert("Không thể lưu phiếu. Vui lòng thử lại.");
    } finally {
      setIsSavingVoucher(false);
    }
  };

  const resetSurchargeForm = () => {
    setEditingSurchargeId(null);
    setSurchargeNameInput("");
    setSurchargeTypeInput("percent");
    setSurchargeValueInput("");
    setSurchargeEnabledInput(true);
  };

  const handleOpenSurchargeModal = () => {
    setShowActionMenu(false);
    resetSurchargeForm();
    setShowSurchargeModal(true);
  };

  const handleEditSurcharge = (surcharge: PosSurcharge) => {
    setEditingSurchargeId(surcharge.id);
    setSurchargeNameInput(surcharge.name);
    setSurchargeTypeInput(surcharge.type);
    setSurchargeValueInput(
      surcharge.type === "fixed"
        ? formatCurrency(Math.max(0, Math.round(surcharge.value)))
        : String(surcharge.value)
    );
    setSurchargeEnabledInput(surcharge.isEnabled);
  };

  const handleSurchargeValueInputChange = (rawValue: string) => {
    if (surchargeTypeInput === "fixed") {
      setSurchargeValueInput(formatMoneyInput(rawValue));
      return;
    }

    const onlyNumberAndDot = rawValue.replace(",", ".").replace(/[^\d.]/g, "");
    const firstDotIndex = onlyNumberAndDot.indexOf(".");
    if (firstDotIndex < 0) {
      setSurchargeValueInput(onlyNumberAndDot);
      return;
    }
    const normalized = `${onlyNumberAndDot.slice(0, firstDotIndex + 1)}${onlyNumberAndDot
      .slice(firstDotIndex + 1)
      .replace(/\./g, "")}`;
    setSurchargeValueInput(normalized);
  };

  const handleSaveSurcharge = async () => {
    if (!storeId) {
      alert("Thiếu thông tin cửa hàng. Vui lòng tải lại trang.");
      return;
    }

    const name = surchargeNameInput.trim();
    if (!name) {
      alert("Vui lòng nhập tên phụ thu.");
      return;
    }

    const parsedValue =
      surchargeTypeInput === "fixed"
        ? parseMoney(surchargeValueInput)
        : Number(surchargeValueInput.replace(",", "."));
    const normalizedValue =
      surchargeTypeInput === "fixed"
        ? Math.max(0, Math.round(parsedValue))
        : Math.round(parsedValue * 100) / 100;

    if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
      alert(
        surchargeTypeInput === "fixed"
          ? "Giá trị phụ thu tiền phải lớn hơn 0."
          : "Giá trị phụ thu % phải lớn hơn 0."
      );
      return;
    }
    if (surchargeTypeInput === "percent" && normalizedValue > 500) {
      alert("Phụ thu phần trăm quá lớn (tối đa 500%).");
      return;
    }

    setIsSavingSurcharge(true);
    try {
      if (editingSurchargeId) {
        await updateSurcharge(editingSurchargeId, {
          name,
          type: surchargeTypeInput,
          value: normalizedValue,
          isEnabled: surchargeEnabledInput,
        });
      } else {
        await createSurcharge({
          storeId,
          name,
          type: surchargeTypeInput,
          value: normalizedValue,
          isEnabled: surchargeEnabledInput,
        });
      }
      await refreshSurcharges();
      resetSurchargeForm();
    } catch (error) {
      console.error(error);
      alert("Không thể lưu phụ thu. Vui lòng thử lại.");
    } finally {
      setIsSavingSurcharge(false);
    }
  };

  const handleToggleSurcharge = async (surcharge: PosSurcharge) => {
    setUpdatingSurchargeId(surcharge.id);
    try {
      await updateSurcharge(surcharge.id, { isEnabled: !surcharge.isEnabled });
      await refreshSurcharges();
    } catch (error) {
      console.error(error);
      alert("Không thể cập nhật trạng thái phụ thu.");
    } finally {
      setUpdatingSurchargeId(null);
    }
  };

  const handleDeleteSurcharge = async (surcharge: PosSurcharge) => {
    if (!window.confirm(`Xóa phụ thu "${surcharge.name}"?`)) return;

    setDeletingSurchargeId(surcharge.id);
    try {
      await deleteSurcharge(surcharge.id);
      await refreshSurcharges();
      if (editingSurchargeId === surcharge.id) {
        resetSurchargeForm();
      }
    } catch (error) {
      console.error(error);
      alert("Không thể xóa phụ thu.");
    } finally {
      setDeletingSurchargeId(null);
    }
  };

  const loadSoldBills = async (
    forceReload = false,
    dateValue = soldBillsDate,
    shiftType = soldBillsShift
  ) => {
    if (!storeId || isLoadingSoldBills) return;
    if (!forceReload && soldBills.length > 0) return;

    setIsLoadingSoldBills(true);
    try {
      const { start, end } = getLocalDayRange(dateValue);
      let data: Bill[] = [];
      if (shiftType === "all") {
        data = await getBills({
          storeId,
          startDate: start,
          endDate: end,
          limitCount: 2000,
        });
      } else {
        const shifts = await getShiftsForReport({
          storeId,
          startDate: start,
          endDate: end,
          shiftType,
        });
        const shiftIds = shifts.map((shift) => shift.id);
        data = shiftIds.length > 0
          ? await getBills({ storeId, shiftIds, limitCount: 2000 })
          : [];
      }
      setSoldBills(data);
    } catch (error) {
      console.error(error);
      alert("Không tải được danh sách đơn đã bán.");
    } finally {
      setIsLoadingSoldBills(false);
    }
  };

  const handleOpenSoldBills = () => {
    const activeShiftOpenedAt = activeShift?.openedAt?.seconds
      ? new Date(activeShift.openedAt.seconds * 1000)
      : new Date();
    const currentDate = toLocalDateInput(activeShiftOpenedAt);
    const accountShift = resolveShiftType();
    const currentShift: DailyReportShift = activeShift && activeShift.shiftType !== "single"
      ? activeShift.shiftType
      : accountShift !== "single"
        ? accountShift
        : "all";
    setShowActionMenu(false);
    setExpandedSoldBillId(null);
    setSoldBillsDate(currentDate);
    setSoldBillsShift(currentShift);
    setShowSoldBills(true);
    void loadSoldBills(true, currentDate, currentShift);
  };

  const handleToggleKitchenAutoPrint = () => {
    if (!canUseKitchenAutoPrint) return;

    if (isKitchenAutoPrintEnabled) {
      setIsKitchenAutoPrintEnabled(false);
      setShowActionMenu(false);
      alert(`Đã tắt tự in món mới cho máy: ${kitchenTerminalName}`);
      return;
    }

    const input = window.prompt(
      "Nhập tên máy bếp chính để nhận biết phiếu in:",
      kitchenTerminalName || "May bep chinh"
    );
    if (input === null) return;
    const normalizedName = input.trim() || "May bep chinh";
    setKitchenTerminalName(normalizedName);
    setIsKitchenAutoPrintEnabled(true);
    setShowActionMenu(false);
    alert(
      `Đã bật tự in món mới cho cửa hàng hiện tại (${storeId}) trên máy: ${normalizedName}`
    );
  };

  const getBillDateText = (bill: Bill) => {
    if (!bill.createdAt?.seconds) return "Chưa có thời gian";
    return new Date(bill.createdAt.seconds * 1000).toLocaleString("vi-VN");
  };

  const handleReprintBill = (bill: Bill) => {
    const isTakeawayOrder =
      !bill.tableNumber ||
      bill.tableNumber === TAKEAWAY_ID ||
      bill.tableNumber === TAKEAWAY_NAME ||
      bill.tableNumber === FARM_ORDER_KEY ||
      bill.tableNumber === FARM_ORDER_LABEL;
    const tableLabel = isTakeawayOrder ? "Mang về" : bill.tableNumber;
    const billPaymentMethod = bill.paymentMethod || "cash";
    const paidAmount =
      billPaymentMethod === "cash" ? bill.cashReceived ?? bill.total : bill.total;

    printPaymentReceipt({
      billCode: bill.id,
      title: isBakeryStore ? "HÓA ĐƠN BÁN HÀNG" : "PHIẾU TÍNH TIỀN",
      tableLabel,
      createdAtText: getBillDateText(bill),
      items: (bill.items || []).map((item) => ({
        id: item.menuId,
        name: item.name,
        category: "",
        quantity: Number(item.quantity || 0),
        note: item.note || "",
        price: Number(item.price || 0),
        basePrice: Number(item.basePrice ?? item.price ?? 0),
        surchargePerUnit: Number(item.surchargePerUnit || 0),
        surchargeTotal: Number(item.surchargeTotal || 0),
        lineTotal: Number(item.lineTotal || item.price * item.quantity || 0),
      })),
      total: bill.total + Number(bill.discountAmount || 0),
      discountType: bill.discountType,
      discountValue: bill.discountValue,
      discountAmount: bill.discountAmount,
      includePaymentInfo: true,
      paidAmount,
      changeAmount: billPaymentMethod === "cash" ? bill.changeAmount || 0 : 0,
      paymentMethod: billPaymentMethod,
      cashierName: bill.cashierName || cashierName,
      isBarOrder: bill.orderSource === "bar",
    });
  };

  const soldBillCounts = useMemo(
    () => ({
      cash: soldBills.filter((bill) => (bill.paymentMethod || "cash") === "cash").length,
      transfer: soldBills.filter((bill) => bill.paymentMethod === "transfer").length,
    }),
    [soldBills]
  );

  const visibleSoldBills = useMemo(() => {
    const keyword = normalizeSearchText(soldBillsSearch.trim());
    const matchedBills = soldBills.filter((bill) => {
      if ((bill.paymentMethod || "cash") !== soldBillsPaymentTab) return false;
      if (!keyword) return true;
      return [
        bill.id,
        bill.tableNumber || "",
        bill.note || "",
        ...(bill.items || []).map((item) => item.name || ""),
      ].some((value) => normalizeSearchText(value).includes(keyword));
    });

    const direction = soldBillsSortDirection === "asc" ? 1 : -1;
    return [...matchedBills].sort((left, right) => {
      let compared = 0;
      if (soldBillsSortKey === "time") {
        compared = (left.createdAt?.seconds || 0) - (right.createdAt?.seconds || 0);
      } else if (soldBillsSortKey === "total") {
        compared = (left.total || 0) - (right.total || 0);
      } else if (soldBillsSortKey === "code") {
        compared = left.id.localeCompare(right.id, "vi", { numeric: true });
      } else {
        compared = (left.tableNumber || "").localeCompare(right.tableNumber || "", "vi", {
          numeric: true,
        });
      }
      return compared * direction;
    });
  }, [soldBills, soldBillsPaymentTab, soldBillsSearch, soldBillsSortDirection, soldBillsSortKey]);

  const completedDailyBills = useMemo(
    () => dailyReportBills.filter((bill) => bill.status !== "cancelled"),
    [dailyReportBills]
  );

  const dailyProductRows = useMemo(() => {
    const productsByKey = new Map<
      string,
      Omit<DailyProductRow, "billCount"> & { billIds: Set<string> }
    >();
    const productsByCode = new Map(products.map((product) => [product.product_code, product]));
    const categoriesById = new Map(categories.map((categoryItem) => [categoryItem.id, categoryItem]));

    completedDailyBills.forEach((bill) => {
      (bill.items || []).forEach((item) => {
        const key = item.menuId || normalizeSearchText(item.name || "mon-khac");
        const product = productsByCode.get(item.menuId);
        const matchedCategory = product?.category
          ? categoriesById.get(product.category)
          : undefined;
        const current = productsByKey.get(key) || {
          key,
          name: item.name || "Món chưa đặt tên",
          categoryId: matchedCategory?.id || null,
          categoryName: matchedCategory?.name || "",
          quantity: 0,
          revenue: 0,
          billIds: new Set<string>(),
        };
        current.quantity += Number(item.quantity || 0);
        current.revenue += Number(item.lineTotal || item.price * item.quantity || 0);
        current.billIds.add(bill.id);
        productsByKey.set(key, current);
      });
    });

    return Array.from(productsByKey.values())
      .map((item) => ({ ...item, billCount: item.billIds.size }))
      .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue);
  }, [categories, completedDailyBills, products]);

  const dailyReportProductGroups = useMemo<DailyProductGroup[]>(() => {
    const selectedIds = new Set(dailyReportSplitCategoryIds);
    const drinkRows = dailyProductRows.filter(
      (item) => !item.categoryId || !selectedIds.has(item.categoryId)
    );
    const groups: DailyProductGroup[] = [{
      key: "drink",
      title: "Nước đã bán",
      unit: "ly",
      rows: drinkRows,
      total: drinkRows.reduce((total, item) => total + item.quantity, 0),
    }];

    dailyReportSplitCategoryIds.forEach((categoryId) => {
      const categoryItem = categories.find((item) => item.id === categoryId);
      if (!categoryItem) return;
      const rows = dailyProductRows.filter((item) => item.categoryId === categoryId);
      groups.push({
        key: categoryId,
        title: `${categoryItem.name} đã bán`,
        unit: "món",
        rows,
        total: rows.reduce((total, item) => total + item.quantity, 0),
      });
    });
    return groups;
  }, [categories, dailyProductRows, dailyReportSplitCategoryIds]);

  const dailyDrinkRows = dailyReportProductGroups[0]?.rows || [];
  const dailyDrinkTotal = dailyReportProductGroups[0]?.total || 0;

  const dailyOpeningCash = useMemo(
    () => dailyReportShifts.reduce((total, shift) => total + Number(shift.openingCash || 0), 0),
    [dailyReportShifts]
  );
  const dailyCashSurplus = useMemo(
    () =>
      dailyReportShifts.reduce((total, shift) => {
        if (shift.closingCash === null || shift.closingCash === undefined) return total;
        const shiftSummary = summarizeBillsForShift(
          dailyReportBills.filter((bill) => bill.shiftId === shift.id),
          Number(shift.openingCash || 0),
          dailyReportVouchers.filter((voucher) => voucher.shiftId === shift.id)
        );
        return total + Math.max(
          0,
          Number(shift.closingCash) - shiftSummary.expectedClosingCash
        );
      }, 0),
    [dailyReportBills, dailyReportShifts, dailyReportVouchers]
  );
  const dailyTillRevenue = dailyReport
    ? dailyOpeningCash + getShiftHandoverAmount(dailyReport)
    : dailyOpeningCash;
  const filteredDailyBills = useMemo(
    () =>
      dailyReportPaymentFilter === "all"
        ? completedDailyBills
        : completedDailyBills.filter(
            (bill) => (bill.paymentMethod || "cash") === dailyReportPaymentFilter
          ),
    [completedDailyBills, dailyReportPaymentFilter]
  );

  const dailyAllBillHourCount = useMemo(
    () =>
      new Set(
        completedDailyBills.map((bill) =>
          bill.createdAt?.seconds ? new Date(bill.createdAt.seconds * 1000).getHours() : -1
        )
      ).size,
    [completedDailyBills]
  );

  const dailyBillHourGroups = useMemo(() => {
    const groups = new Map<number, Bill[]>();
    filteredDailyBills.forEach((bill) => {
      const date = bill.createdAt?.seconds
        ? new Date(bill.createdAt.seconds * 1000)
        : null;
      const hour = date ? date.getHours() : -1;
      groups.set(hour, [...(groups.get(hour) || []), bill]);
    });

    return Array.from(groups.entries())
      .sort(([leftHour], [rightHour]) => leftHour - rightHour)
      .map(([hour, bills]) => ({
        hour,
        label:
          hour < 0
            ? "Chưa có thời gian"
            : `${String(hour).padStart(2, "0")}:00 - ${String(hour).padStart(2, "0")}:59`,
        bills: [...bills].sort(
          (left, right) =>
            (left.createdAt?.seconds || 0) - (right.createdAt?.seconds || 0)
        ),
        revenue: bills.reduce((total, bill) => total + Number(bill.total || 0), 0),
        itemCount: bills.reduce(
          (total, bill) =>
            total +
            (bill.items || []).reduce(
              (billTotal, item) => billTotal + Number(item.quantity || 0),
              0
            ),
          0
        ),
      }));
  }, [filteredDailyBills]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable;
      if (isTyping) return;

      if (paymentInFlightRef.current) {
        e.preventDefault();
        return;
      }

      if (showReceipt && receiptData) {
        e.preventDefault();
        handleConfirmPrint();
        return;
      }

      if (showSoldBills) {
        return;
      }
      if (
        showOpenShiftModal ||
        showCloseShiftModal ||
        showDailyReport ||
        showVoucherModal
      ) {
        return;
      }

      if (cartItems.length > 0 && !isPaying && !isRestaurantServer) {
        e.preventDefault();
        handlePay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    showReceipt,
    receiptData,
    showSoldBills,
    showOpenShiftModal,
    showCloseShiftModal,
    showDailyReport,
    showVoucherModal,
    cartItems.length,
    isPaying,
    isRestaurantServer,
    handlePay,
    handleConfirmPrint,
  ]);

  useEffect(() => {
    if (!showActionMenu) return;

    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!actionMenuRef.current?.contains(target)) {
        setShowActionMenu(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowActionMenu(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [showActionMenu]);

  return (
    <RoleGuard
      allowedRoles={["admin", "user", "server", "bartender"]}
      permission={role === "bartender" ? "bar.checkout" : "bills.access"}
    >
      <main className="min-h-screen bg-slate-50 p-3 sm:p-6">
        <div className="mx-auto max-w-[1400px] overflow-hidden rounded-2xl border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-3">
              {role === "admin" && (
                <Link
                  href="/"
                  className="hidden rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 sm:inline-flex"
                  title="Về trang chủ"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              )}
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-700">
                  <Coffee className="h-4 w-4" />
                  {isBartenderAccount ? "Quầy pha chế" : "Quầy thu ngân"}
                </p>
                <h1 className="text-xl font-bold leading-tight text-slate-900">
                  {posTitle}
                </h1>
              </div>
            </div>
            <div
              ref={actionMenuRef}
              className="relative flex items-center gap-2 text-sm text-slate-500"
            >
              {isShiftEnabledForUser && (
                <span className="hidden rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 md:inline-flex">
                  {activeShift ? "Đang mở ca" : "Chưa mở ca"}
                </span>
              )}
              <CheckCircle2 className="ml-2 hidden h-4 w-4 text-emerald-600 md:inline-flex" />
              {/* <span className="hidden md:inline-flex">
                {tables.length} bàn · {filteredMenu.length} món
              </span> */}
              {enabledSurcharges.length > 0 && (
                <span className="hidden rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 md:inline-flex">
                  Phụ thu: {enabledSurcharges.length}
                </span>
              )}
              {/* {canUseKitchenAutoPrint && (
                <span
                  className={`hidden rounded-full px-2 py-1 text-xs font-semibold md:inline-flex ${
                    isKitchenAutoPrintEnabled
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {isKitchenAutoPrintEnabled
                    ? `Auto in: ${storeId} · ${kitchenTerminalName}`
                    : `Auto in: ${storeId} · tắt`}
                </span>
              )} */}
              {/* {canUseBarAutoPrint && (
                <span
                  className="hidden rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 md:inline-flex"
                  title="Phiếu pha chế được print agent gửi thẳng tới máy in LAN"
                >
                  Pha chế: tự động qua print agent
                </span>
              )} */}
              <button
                onClick={() => setShowActionMenu((prev) => !prev)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Menu className="h-4 w-4" />
                <span className="hidden sm:inline">Menu</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              {showActionMenu && (
                <div className="absolute right-0 top-12 z-[80] max-h-[calc(100vh-5.5rem)] w-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white shadow-2xl">
                  {isBartenderAccount && (
                    <Link
                      href="/bar"
                      className="flex w-full cursor-pointer items-center gap-2 border-b px-4 py-3 text-left text-sm hover:bg-slate-50"
                      onClick={() => setShowActionMenu(false)}
                    >
                      <Coffee className="h-4 w-4 text-amber-700" />
                      Về màn hình pha chế
                    </Link>
                  )}
                  {!isRestaurantServer && !isBartenderAccount && (
                    <>
                      <Link
                        href="/bills"
                        className="flex w-full cursor-pointer items-center gap-2 border-b px-4 py-3 text-left text-sm hover:bg-slate-50"
                        onClick={() => setShowActionMenu(false)}
                      >
                        <ReceiptText className="h-4 w-4 text-sky-700" />
                        Trang hóa đơn
                      </Link>
                      {canUseBarAutoPrint && (
                        <Link
                          href="/bar"
                          className="flex w-full cursor-pointer items-center gap-2 border-b px-4 py-3 text-left text-sm hover:bg-slate-50"
                          onClick={() => setShowActionMenu(false)}
                        >
                          <Coffee className="h-4 w-4 text-amber-700" />
                          Màn hình pha chế
                        </Link>
                      )}
                      <button
                        className="flex w-full cursor-pointer items-center gap-2 border-b px-4 py-3 text-left text-sm hover:bg-slate-50"
                        onClick={() => {
                          setShowActionMenu(false);
                          handleOpenSoldBills();
                        }}
                      >
                        <CalendarClock className="h-4 w-4 text-emerald-700" />
                        Đơn đã bán
                      </button>
                      {role === "admin" && !isFarmStore && (
                        <button
                          className="flex w-full cursor-pointer items-center gap-2 border-b px-4 py-3 text-left text-sm hover:bg-slate-50"
                          onClick={handleOpenAddTableModal}
                        >
                          <LayoutGrid className="h-4 w-4 text-indigo-700" />
                          Thêm bàn
                        </button>
                      )}
                      <button
                        className="flex w-full cursor-pointer items-center gap-2 border-b px-4 py-3 text-left text-sm hover:bg-slate-50"
                        onClick={handleOpenSurchargeModal}
                      >
                        <BadgePercent className="h-4 w-4 text-amber-700" />
                        Cài đặt phụ thu
                      </button>
                      {canUseKitchenAutoPrint && (
                        <button
                          className="flex w-full cursor-pointer items-center gap-2 border-b px-4 py-3 text-left text-sm hover:bg-slate-50"
                          onClick={handleToggleKitchenAutoPrint}
                        >
                          <Printer
                            className={`h-4 w-4 ${
                              isKitchenAutoPrintEnabled
                                ? "text-emerald-700"
                                : "text-slate-500"
                            }`}
                          />
                          {isKitchenAutoPrintEnabled
                            ? `Tắt tự in món mới (${kitchenTerminalName})`
                            : "Bật tự in món mới cho máy này"}
                        </button>
                      )}
                      <button
                        className="flex w-full cursor-pointer items-center gap-2 border-b px-4 py-3 text-left text-sm hover:bg-slate-50"
                        onClick={() => handleOpenVoucherModal("income")}
                      >
                        <HandCoins className="h-4 w-4 text-emerald-700" />
                        Lập phiếu thu
                      </button>
                      <button
                        className="flex w-full cursor-pointer items-center gap-2 border-b px-4 py-3 text-left text-sm hover:bg-slate-50"
                        onClick={() => handleOpenVoucherModal("expense")}
                      >
                        <HandCoins className="h-4 w-4 text-rose-700" />
                        Lập phiếu chi
                      </button>
                      {isShiftEnabledForUser && (
                        <button
                          className="flex w-full cursor-pointer items-center gap-2 border-b px-4 py-3 text-left text-sm hover:bg-slate-50"
                          onClick={() => {
                            if (activeShift) {
                              void handlePrepareCloseShift();
                            } else {
                              setShowOpenShiftModal(true);
                              setShowActionMenu(false);
                            }
                          }}
                        >
                          <BadgeDollarSign className="h-4 w-4 text-amber-700" />
                          {activeShift ? "Đóng ca làm việc" : "Mở ca làm việc"}
                        </button>
                      )}
                      <button
                        className="flex w-full cursor-pointer items-center gap-2 border-b px-4 py-3 text-left text-sm hover:bg-slate-50"
                        onClick={() => void handleOpenDailyReport()}
                      >
                        <CalendarClock className="h-4 w-4 text-indigo-700" />
                        Báo cáo cuối ngày
                      </button>
                    </>
                  )}
                  <button
                    className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-sm text-rose-600 hover:bg-rose-50"
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
          {canUseKitchenAutoPrint && kitchenPrintLogs.length > 0 && (
            <div className="border-b bg-amber-50 px-4 py-2">
              <p className="text-xs font-semibold text-amber-900">
                Log in bếp: {kitchenPrintLogs[0]}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(380px,1fr)]">
            <section className="border-r bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  {!isFarmStore && <button
                    onClick={() => setActiveTab("tables")}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      activeTab === "tables"
                        ? "bg-sky-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Phòng bàn
                  </button>}
                  <button
                    onClick={() => setActiveTab(!isFarmStore && !tableNumber ? "tables" : "menu")}
                    title={!isFarmStore && !tableNumber ? "Vui lòng chọn bàn trước" : "Mở thực đơn"}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      activeTab === "menu"
                        ? "bg-sky-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <NotebookTabs className="h-4 w-4" />
                    Thực đơn
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {activeTab === "tables"
                      ? "Tìm bàn (F3)"
                      : `Tìm món (F4) - ${filteredMenu.length} món`}
                  </span>
                </div>
              </div>

              {!isFarmStore && activeTab === "tables" && (
                <div className="space-y-4 px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-sky-700">
                        <LayoutGrid className="h-4 w-4" />
                        <span className="text-sm font-semibold">
                          {tableOptions.length} bàn
                        </span>
                      </div>
                    </div>
                    <Input
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder="Tìm bàn..."
                      className="w-full max-w-xs"
                    />
                  </div>
                  {/* 
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">
                    Tất cả ({tableOptions.length})
                  </span>
                  <span>Đang dùng ({tableNumber ? 1 : 0})</span>
                  <span>
                    Còn trống (
                    {Math.max(tableOptions.length - (tableNumber ? 1 : 0), 0)})
                  </span>
                </div> */}

                  <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto pb-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                    {paginatedTables.map((table) => {
                      const active = table.name === tableNumber;
                      const pendingItems = tableDraftCounts[table.name] || 0;
                      return (
                        <button
                          key={table.id}
                          onClick={() => handleSelectTable(table.name)}
                          className={`flex h-28 flex-col items-center justify-center rounded-2xl border text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                            active
                              ? "border-sky-600 bg-sky-600 text-white"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-200"
                          }`}
                        >
                          <div className="flex h-10 w-14 items-center justify-center rounded-xl border-2 border-dashed border-white/70 opacity-80" />
                          <span className="mt-2 text-base">{table.name}</span>
                          {active && (
                            <span className="mt-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium">
                              Đang chọn (máy này)
                            </span>
                          )}
                          {!active && (
                            <span className="mt-1 text-[11px] font-medium text-slate-500">
                              Chạm để chọn
                            </span>
                          )}
                          {pendingItems > 0 && (
                            <span className="mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                              {pendingItems} mon tam
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {paginatedTables.length === 0 && (
                      <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                        Không tìm thấy bàn phù hợp.
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-sm text-slate-600">
                    <span>
                      Trang {tablePage}/{totalTablePages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTablePage((p) => Math.max(p - 1, 1))}
                        disabled={tablePage === 1}
                        className="flex items-center gap-1 rounded-full border px-3 py-1 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Trước
                      </button>
                      <button
                        onClick={() =>
                          setTablePage((p) => Math.min(p + 1, totalTablePages))
                        }
                        disabled={tablePage === totalTablePages}
                        className="flex items-center gap-1 rounded-full border px-3 py-1 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Sau
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* {isHotpotStore && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-600">
                          Lưu bàn vào dữ liệu mô hình lẩu
                        </p>
                        <Button
                          variant="outline"
                          className="border-sky-500 text-sky-700 hover:bg-sky-50"
                          onClick={handleSeedTables}
                          disabled={isSeedingTables}
                        >
                          {isSeedingTables
                            ? "Đang thêm bàn..."
                            : "Thêm nhanh 100 bàn (T01 - T100)"}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_2fr_auto]">
                        <Input
                          value={newTableName}
                          onChange={(e) => setNewTableName(e.target.value)}
                          placeholder="Tên/số bàn"
                        />
                        <Input
                          value={newTableArea}
                          onChange={(e) => setNewTableArea(e.target.value)}
                          placeholder="Khu vực (tùy chọn)"
                        />
                        <Button
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={handleAddTable}
                        >
                          Lưu bàn
                        </Button>
                      </div>
                    </div>
                  )} */}

                  {/* <div className="space-y-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3">
                  <button
                    className="text-sm font-semibold text-sky-700 hover:text-sky-800"
                    onClick={() => setShowAddTable((prev) => !prev)}
                  >
                    {showAddTable ? "Ẩn thêm bàn nhanh" : "+ Thêm bàn nhanh"}
                  </button>
                  {!isFarmStore ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      className="border-sky-500 text-sky-700 hover:bg-sky-50"
                      onClick={handleSeedTables}
                      disabled={isSeedingTables}
                    >
                      {isSeedingTables
                        ? "Đang thêm 99 bàn..."
                        : "Thêm 99 bàn (T01 - T99)"}
                    </Button>
                    <span className="text-xs text-slate-500">
                      Bỏ qua tên đã tồn tại, chỉ thêm bàn còn thiếu.
                    </span>
                  </div>
                  ) : (
                    <div className="text-sm font-semibold text-slate-700">
                      Farm mode: khong can chon ban
                    </div>
                  )}
                  {showAddTable && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_2fr_auto]">
                      <Input
                        value={newTableName}
                        onChange={(e) => setNewTableName(e.target.value)}
                        placeholder="Tên/số bàn mới"
                      />
                      <Input
                        value={newTableArea}
                        onChange={(e) => setNewTableArea(e.target.value)}
                        placeholder="Khu vực (tùy chọn)"
                      />
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        variant="outline"
                        onClick={handleAddTable}
                      >
                        Lưu bàn
                      </Button>
                    </div>
                  )}
                </div> */}
                </div>
              )}

              {activeTab === "menu" && (
                <div className="space-y-4 px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-sky-700">
                        <Coffee className="h-4 w-4" />
                        <span className="text-sm font-semibold">Thực đơn</span>
                      </div>
                      <span className="text-sm text-slate-500">
                        {filteredMenu.length} món khả dụng
                      </span>
                      <span className="hidden text-xs text-slate-400 sm:inline">
                        Kéo thả thẻ món để đổi thứ tự
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-slate-400" />
                      <Input
                        value={menuSearch}
                        onChange={(e) => {
                          setMenuSearch(e.target.value);
                          setMenuPage(1);
                        }}
                        placeholder="Tìm món..."
                        className="w-full max-w-xs"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {categoryOptions.map((c) => {
                      const active = c.id === category;
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            setCategory(c.id);
                            setMenuPage(1);
                          }}
                          className={`whitespace-nowrap cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold transition ${
                            active
                              ? "border-sky-500 bg-sky-50 text-sky-700 shadow-sm"
                              : "border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-700"
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                    {paginatedMenu.map((item) => {
                      const inCart = cart[item.id]?.quantity ?? 0;
                      const isDraggingThisItem = draggingMenuItemId === item.id;
                      return (
                        <button
                          key={item.id}
                          draggable
                          onDragStart={(event) =>
                            handleMenuItemDragStart(event, item.id)
                          }
                          onDragOver={handleMenuItemDragOver}
                          onDrop={(event) => handleMenuItemDrop(event, item.id)}
                          onDragEnd={handleMenuItemDragEnd}
                          onClick={() => {
                            if (suppressNextMenuClickRef.current) return;
                            handleAddItem(item);
                          }}
                          className={`group flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-slate-50 p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:rounded-2xl sm:p-3 ${
                            isDraggingThisItem
                              ? "opacity-60 ring-2 ring-sky-300"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500 sm:gap-2 sm:text-xs">
                            <span className="truncate font-semibold text-slate-600">
                              {getCategoryLabel(item.category)}
                            </span>
                            {inCart > 0 && (
                              <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 text-[10px] font-semibold text-emerald-700 sm:px-2 sm:text-[11px]">
                                {inCart}x
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-col gap-2 sm:mt-3 sm:gap-3">
                            <div className="flex h-7 items-center justify-center rounded-lg bg-sky-50 sm:h-8 sm:rounded-xl">
                              <Coffee className="h-5 w-5 opacity-70 sm:h-8 sm:w-8" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[11px] font-bold text-sky-700 sm:text-xs">
                                {formatCurrency(item.price)} đ
                              </p>
                              <p className="text-xs font-semibold leading-snug text-slate-900 sm:text-sm sm:leading-tight">
                                {item.name}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {filteredMenu.length === 0 && (
                      <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                        Không tìm thấy món phù hợp.
                      </div>
                    )}
                  </div>

                  {filteredMenu.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 text-sm text-slate-600">
                      <span>
                        Trang {menuPage}/{totalMenuPages} · Hiển thị{" "}
                        {(menuPage - 1) * MENU_ITEMS_PER_PAGE + 1}–
                        {Math.min(menuPage * MENU_ITEMS_PER_PAGE, filteredMenu.length)} trong{" "}
                        {filteredMenu.length} món
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setMenuPage((page) => Math.max(1, page - 1))}
                          disabled={menuPage === 1}
                          className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Trước
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMenuPage((page) => Math.min(totalMenuPages, page + 1))
                          }
                          disabled={menuPage === totalMenuPages}
                          className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Sau
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="flex h-full flex-col bg-slate-50">
              <div className="border-b bg-white px-4 py-3 space-y-2">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  {!isFarmStore ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Bàn
                    </span>
                    <Input
                      list="table-options"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder="Chọn hoặc nhập bàn"
                      className="w-full sm:w-[200px]"
                    />
                    <datalist id="table-options">
                      {tables.map((table) => (
                        <option key={table.id} value={table.name} />
                      ))}
                    </datalist>
                  </div>
                  ) : (
                    <div className="text-sm font-semibold text-slate-700">
                      Farm mode: khong can chon ban
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <ShoppingCart className="h-4 w-4" />
                    <span>{totalItems} món trong giỏ</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-slate-900">
                      Đơn hiện tại
                    </h2>
                  </div>
                  {isShiftEnabledForUser && activeShift && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      {getShiftLabel(activeShift.shiftType)} · {cashierName}
                    </span>
                  )}
                </div>

                <div className="flex-1 max-h-[50vh] space-y-3 overflow-y-auto px-4 pb-4">
                  {cartItems.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white/80 p-4 text-sm text-slate-500">
                      Chưa có món nào. Chọn món từ danh sách bên trái.
                    </div>
                  )}

                  {cartItems.map((item) => {
                    const canDecreaseForCurrentRole =
                      !isRestaurantServer ||
                      (activePendingAddedItems[item.id] || 0) > 0;
                    const pricedItem = cartPricingById[item.id];

                    return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-semibold text-slate-900">
                          {item.name}
                        </p>
                        <input
                          value={item.note || ""}
                          onChange={(e) =>
                            handleItemNoteChange(item.id, e.target.value)
                          }
                          placeholder="Ghi chú..."
                          className="block h-8 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs leading-5 text-slate-700 focus:border-sky-400 focus:outline-none"
                        />
                        <div className="space-y-0.5">
                          <p className="text-sm text-slate-500">
                            {formatCurrency(pricedItem?.price ?? item.price)} đ
                          </p>
                          {(pricedItem?.surchargePerUnit || 0) > 0 && (
                            <p className="text-[11px] text-amber-700">
                              Gốc {formatCurrency(pricedItem?.basePrice || item.price)} + phụ thu{" "}
                              {formatCurrency(pricedItem?.surchargePerUnit || 0)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleChangeQty(item.id, -1)}
                            disabled={!canDecreaseForCurrentRole}
                            className="rounded-full cursor-pointer border-slate-200"
                            title={
                              !canDecreaseForCurrentRole && isRestaurantServer
                                ? "Phục vụ chỉ giảm được số lượng vừa thêm"
                                : undefined
                            }
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-semibold text-black">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleChangeQty(item.id, 1)}
                            className="rounded-full cursor-pointer border-slate-200"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="min-w-[90px] text-right text-base font-semibold text-slate-900">
                          {formatCurrency(pricedItem?.lineTotal || item.price * item.quantity)} đ
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>

                <div className="space-y-3 border-t bg-white px-4 py-4">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Số món</span>
                    <span className="font-semibold text-slate-900">
                      {totalItems}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Tiền hàng</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(subtotalPrice)} đ
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Phụ thu</span>
                      <span
                        className={`font-semibold ${
                          totalSurchargeAmount > 0 ? "text-amber-700" : "text-slate-500"
                        }`}
                      >
                        {formatCurrency(totalSurchargeAmount)} đ
                      </span>
                    </div>
                    {appliedSurchargeSummaries.map((surcharge) => (
                      <div
                        key={surcharge.id}
                        className="flex items-center justify-between text-xs text-slate-500"
                      >
                        <span>
                          + {surcharge.name} ({formatSurchargeValue(surcharge)})
                        </span>
                        <span>{formatCurrency(surcharge.amount)} đ</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-slate-500">Tổng thanh toán</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatCurrency(totalPrice)} đ
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      {isRestaurantServer ? (
                        <Button
                          className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
                          onClick={() => void handleSubmitKitchenAddedItems()}
                          disabled={pendingAddedCount === 0}
                        >
                          <Printer className="h-4 w-4" />
                          Lưu món mới ({pendingAddedCount})
                        </Button>
                      ) : (
                        <Button
                          className="w-full gap-2 bg-sky-600 hover:bg-sky-700 sm:w-auto"
                          onClick={handlePay}
                          disabled={cartItems.length === 0 || isPaying}
                          isLoading={isPaying}
                        >
                          <CreditCard className="h-4 w-4" />
                          Thanh toán
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {showReceipt && receiptData && (
        <div className="fixed inset-0 z-50 bg-black/60 p-0 sm:flex sm:items-center sm:justify-center sm:p-3">
          <div className="h-full max-h-[100dvh] w-full overflow-y-auto bg-white shadow-2xl sm:h-auto sm:max-h-[94vh] sm:max-w-[1300px] sm:overflow-hidden sm:rounded-2xl">
            <div className="grid grid-cols-1 lg:min-h-[82vh] lg:grid-cols-[minmax(0,1fr)_430px]">
              <div className="flex flex-col">
                <div className="flex items-start justify-between border-b px-4 py-4 sm:px-6 sm:py-5">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 sm:text-3xl">
                      Thanh toán · {receiptData.table}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">{receiptData.time}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReceipt(false)}
                    disabled={isPaying}
                    className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Đóng"
                  >
                    <span className="text-2xl leading-none">×</span>
                  </button>
                </div>

                <div className="px-4 py-3 sm:px-6 sm:py-4 lg:flex-1 lg:overflow-auto">
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <div className="grid grid-cols-[minmax(0,1fr)_70px_120px_130px] bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <span>Đồ uống</span>
                      <span className="text-center">SL</span>
                      <span className="text-right">Đơn giá</span>
                      <span className="text-right">Thành tiền</span>
                    </div>
                    <div className="divide-y">
                      {receiptData.items.map((item, idx) => (
                        <div
                          key={`${item.id}-${idx}`}
                          className="grid grid-cols-[minmax(0,1fr)_70px_120px_130px] px-4 py-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">
                              {idx + 1}. {item.name}
                            </p>
                            {item.note?.trim() && (
                              <p className="mt-1 text-[13px] font-bold leading-snug text-slate-700">
                                {item.note.trim()}
                              </p>
                            )}
                          </div>
                          <p className="text-center text-slate-700">{item.quantity}</p>
                          <p className="text-right text-slate-700">
                            {formatCurrency(item.price)}
                          </p>
                          <p className="text-right font-semibold text-slate-900">
                            {formatCurrency(item.lineTotal)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-3 sm:px-6 sm:py-4">
                  <div className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                    <span>Tổng thanh toán</span>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-sky-100 px-2 text-sm font-bold text-sky-700">
                      {receiptItemCount}
                    </span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 sm:text-3xl">
                    {formatCurrency(receiptPayableTotal)} đ
                  </p>
                </div>
              </div>

              <div className="flex flex-col border-t border-slate-200 bg-white lg:border-l lg:border-t-0">
                <div className="flex items-center justify-between border-b px-4 py-4 sm:px-5">
                  <h4 className="text-xl font-bold text-slate-900 sm:text-2xl">
                    Chi tiết giao dịch
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowReceipt(false)}
                    disabled={isPaying}
                    className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Đóng"
                  >
                    <span className="text-2xl leading-none">×</span>
                  </button>
                </div>

                <div className="space-y-4 px-4 py-3 text-sm sm:px-5 sm:py-4 lg:flex-1 lg:overflow-auto">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Tổng tiền hàng</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(receiptGrossTotal)}
                    </span>
                  </div>
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="font-semibold text-slate-700" htmlFor="receipt-discount">
                        Giảm giá
                      </label>
                      <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() => {
                            setDiscountType("percent");
                            setDiscountInput("");
                          }}
                          className={`px-3 py-2 text-sm font-semibold ${discountType === "percent" ? "bg-sky-600 text-white" : "text-slate-600"}`}
                        >
                          Theo %
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDiscountType("fixed");
                            setDiscountInput("");
                          }}
                          className={`px-3 py-2 text-sm font-semibold ${discountType === "fixed" ? "bg-sky-600 text-white" : "text-slate-600"}`}
                        >
                          Theo giá
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <Input
                        id="receipt-discount"
                        inputMode={discountType === "percent" ? "decimal" : "numeric"}
                        value={discountType === "fixed" ? formatMoneyInput(discountInput) : discountInput}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (discountType === "percent") {
                            const numericValue = Number(value.replace(",", "."));
                            if (
                              /^\d{0,3}([.,]\d{0,2})?$/.test(value) &&
                              (value === "" || numericValue <= 100)
                            ) {
                              setDiscountInput(value);
                            }
                          } else {
                            setDiscountInput(value.replace(/\D/g, ""));
                          }
                        }}
                        placeholder={discountType === "percent" ? "Nhập % giảm" : "Nhập số tiền giảm"}
                        className="h-11 pr-12 text-right text-lg font-semibold"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-semibold text-slate-500">
                        {discountType === "percent" ? "%" : "đ"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Số tiền được giảm</span>
                      <span className="font-bold text-emerald-700">-{formatCurrency(receiptDiscountAmount)} đ</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-base font-semibold text-slate-700">Khách cần trả</span>
                    <span className="text-2xl font-bold text-sky-700">
                      {formatCurrency(receiptPayableTotal)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-700">Khách thanh toán</p>
                    <Input
                      value={
                        paymentMethod === "cash"
                          ? formatMoneyInput(cashReceivedInput)
                          : formatCurrency(receiptPayableTotal)
                      }
                      onChange={(e) => setCashReceivedInput(e.target.value)}
                      disabled={paymentMethod !== "cash"}
                      className={
                        paymentMethod === "cash"
                          ? "h-11 border-slate-200 text-right text-xl font-bold text-sky-700"
                          : "h-11 border-slate-200 bg-slate-50 text-right text-xl font-bold text-slate-500"
                      }
                    />
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("cash")}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                          paymentMethod === "cash"
                            ? "border-sky-500 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        <Wallet className="h-4 w-4" />
                        Tiền mặt
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("transfer")}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                          paymentMethod === "transfer"
                            ? "border-sky-500 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        <Landmark className="h-4 w-4" />
                        Chuyển khoản
                      </button>
                    </div>

                    {paymentMethod === "cash" && (
                      <div className="flex flex-wrap gap-2">
                        {quickCashValues.map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setCashReceivedInput(String(amount))}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-sky-300 hover:text-sky-700"
                          >
                            {formatCurrency(amount)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-base">
                    <span className="text-slate-700">Tiền thừa trả khách</span>
                    <span className="font-semibold text-slate-900">
                      {paymentMethod === "cash"
                        ? formatCurrency(
                            Math.max(parseMoney(cashReceivedInput) - receiptPayableTotal, 0)
                          )
                        : "0"}{" "}
                      đ
                    </span>
                  </div>
                </div>

                <div className="sticky bottom-0 border-t bg-slate-50 p-3 sm:p-4">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[170px_minmax(0,1fr)]">
                    <Button
                      variant="outline"
                      onClick={handlePrintTemporaryReceipt}
                      className="h-12 w-full border-sky-600 text-lg font-semibold text-sky-700 hover:bg-sky-50"
                    >
                      In tạm tính
                    </Button>
                    <Button
                      onClick={handleConfirmPrint}
                      disabled={isPaying}
                      isLoading={isPaying}
                      className="h-12 w-full bg-sky-600 text-lg font-semibold hover:bg-sky-700"
                    >
                      Thanh toán
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {role === "admin" && showAddTableModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Thêm bàn mới</h3>
                <p className="text-sm text-slate-500">
                  Tạo bàn để sử dụng ngay tại quầy hiện tại
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowAddTableModal(false)}
              >
                Đóng
              </Button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <Input
                label="Tên / số bàn *"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="Ví dụ: T12 hoặc Bàn VIP 1"
              />
              <Input
                label="Khu vực (tuỳ chọn)"
                value={newTableArea}
                onChange={(e) => setNewTableArea(e.target.value)}
                placeholder="Ví dụ: Tầng 2"
              />
              {isHotpotStore && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                  <p className="text-xs text-slate-600">
                    Có thể thêm nhanh danh sách bàn chuẩn cho quán lẩu.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-2 border-sky-500 text-sky-700 hover:bg-sky-50"
                    onClick={handleSeedTables}
                    disabled={isSeedingTables}
                  >
                    {isSeedingTables
                      ? "Đang thêm bàn..."
                      : "Thêm nhanh 100 bàn (T01 - T100)"}
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t bg-slate-50 px-5 py-4">
              <Button
                variant="outline"
                onClick={() => setShowAddTableModal(false)}
              >
                Huỷ
              </Button>
              <Button
                className="bg-sky-600 hover:bg-sky-700"
                onClick={handleAddTable}
              >
                Lưu bàn
              </Button>
            </div>
          </div>
        </div>
      )}

      {showSoldBills && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-lg">
            <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Đơn đã bán
                </h3>
                <p className="text-xs text-slate-500">
                  Danh sách đơn theo ngày và ca làm việc
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/bills">
                  <Button variant="outline" size="sm" className="gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Trang hóa đơn
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void loadSoldBills(true)}
                  isLoading={isLoadingSoldBills}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Tải lại
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSoldBills(false)}
                >
                  Đóng
                </Button>
              </div>
            </div>

            <div className="space-y-3 border-b bg-slate-50 px-4 py-3">
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="mb-1 block text-xs font-semibold text-slate-500">
                    Ngày bán
                  </span>
                  <input
                    type="date"
                    value={soldBillsDate}
                    disabled={isLoadingSoldBills}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) return;
                      setSoldBillsDate(value);
                      setExpandedSoldBillId(null);
                      setSoldBills([]);
                      void loadSoldBills(true, value, soldBillsShift);
                    }}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold text-slate-500">
                    Phạm vi
                  </span>
                  <select
                    value={soldBillsShift}
                    disabled={isLoadingSoldBills}
                    onChange={(event) => {
                      const value = event.target.value as DailyReportShift;
                      setSoldBillsShift(value);
                      setExpandedSoldBillId(null);
                      setSoldBills([]);
                      void loadSoldBills(true, soldBillsDate, value);
                    }}
                    className="h-9 w-full cursor-pointer rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="all">Cả ngày</option>
                    <option value="shift_1">Ca 1</option>
                    <option value="shift_2">Ca 2</option>
                    <option value="shift_3">Ca 3</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-200 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setSoldBillsPaymentTab("cash");
                    setExpandedSoldBillId(null);
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                    soldBillsPaymentTab === "cash"
                      ? "bg-white text-sky-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Tiền mặt ({soldBillCounts.cash})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSoldBillsPaymentTab("transfer");
                    setExpandedSoldBillId(null);
                  }}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                    soldBillsPaymentTab === "transfer"
                      ? "bg-white text-sky-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Chuyển khoản ({soldBillCounts.transfer})
                </button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    value={soldBillsSearch}
                    onChange={(event) => setSoldBillsSearch(event.target.value)}
                    placeholder="Tìm mã bill, bàn, ghi chú hoặc tên món"
                    className="h-9 bg-white pl-9"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={soldBillsSortKey}
                    onChange={(event) =>
                      setSoldBillsSortKey(event.target.value as SoldBillsSortKey)
                    }
                    className="h-9 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 sm:w-36"
                    aria-label="Sắp xếp đơn đã bán"
                  >
                    <option value="time">Thời gian</option>
                    <option value="total">Tổng tiền</option>
                    <option value="code">Mã bill</option>
                    <option value="table">Bàn</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 whitespace-nowrap"
                    onClick={() =>
                      setSoldBillsSortDirection((current) =>
                        current === "asc" ? "desc" : "asc"
                      )
                    }
                  >
                    {soldBillsSortDirection === "asc" ? "Tăng dần" : "Giảm dần"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="max-h-[62vh] space-y-2 overflow-y-auto px-4 py-3">
              {!isLoadingSoldBills && visibleSoldBills.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Không tìm thấy đơn phù hợp trong tab này.
                </div>
              )}

              {visibleSoldBills.map((bill) => {
                const isExpanded = expandedSoldBillId === bill.id;
                return (
                <div
                  key={bill.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedSoldBillId(isExpanded ? null : bill.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50"
                  >
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {bill.tableNumber || "Không rõ bàn"}
                        </span>
                        <span className="truncate font-mono text-xs text-slate-500">
                          {bill.id}
                        </span>
                        {bill.orderSource === "bar" ? (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            Pha chế tạo
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        {getBillDateText(bill)}
                      </p>
                    </div>
                    <p className="shrink-0 text-base font-bold text-slate-900">
                      {formatCurrency(bill.total)} đ
                    </p>
                  </button>

                  {isExpanded && (
                  <div className="border-t bg-slate-50 px-3 py-3">
                    {bill.note && (
                      <p className="mb-2 rounded-md bg-white px-2 py-1 text-xs text-slate-600">
                        Ghi chú: {bill.note}
                      </p>
                    )}
                    <div className="divide-y overflow-hidden rounded-lg border bg-white">
                    {bill.items?.length ? (
                      bill.items.map((item, idx) => (
                        <div
                          key={`${bill.id}-${item.menuId}-${idx}`}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">
                              {item.name}
                            </p>
                            {item.note?.trim() && (
                              <p className="text-[11px] text-slate-500">
                                {item.note.trim()}
                              </p>
                            )}
                            <p className="text-xs text-slate-500">
                              {item.quantity} x {formatCurrency(item.price)} đ
                            </p>
                          </div>
                          <p className="text-right font-semibold text-slate-900">
                            {formatCurrency(
                              item.lineTotal || item.price * item.quantity
                            )}{" "}
                            đ
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-xs text-slate-500">
                        Không có chi tiết món.
                      </p>
                    )}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2 border-sky-300 bg-white text-sky-700 hover:bg-sky-50"
                        onClick={() => handleReprintBill(bill)}
                      >
                        <Printer className="h-4 w-4" />
                        In lại
                      </Button>
                    </div>
                  </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {shiftSyncNotice && (
        <div className="fixed right-4 top-4 z-[90] max-w-md rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg">
          {shiftSyncNotice}
        </div>
      )}

      {isShiftEnabledForUser && showOpenShiftModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="border-b px-5 py-4">
              <h3 className="text-xl font-bold text-slate-900">Mở ca làm việc</h3>
              <p className="mt-1 text-sm text-slate-500">
                Vui lòng mở ca trước khi thao tác bán hàng.
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                <p className="text-sm font-semibold text-slate-700">Nhân viên ca</p>
                <p className="text-sm text-slate-900">{cashierName}</p>
              </div>
              <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                <p className="text-sm font-semibold text-slate-700">Thiết bị</p>
                <p className="text-sm text-slate-900">
                  {deviceIdentity?.name || "Đang nhận diện..."}
                </p>
              </div>
              <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                <p className="text-sm font-semibold text-slate-700">Giờ bắt đầu</p>
                <p className="text-sm text-slate-900">
                  {new Date().toLocaleString("vi-VN")}
                </p>
              </div>
              {usesThreeShiftByAccount && (
                <div className="grid grid-cols-[140px_1fr] items-center gap-2">
                  <p className="text-sm font-semibold text-slate-700">Loại ca</p>
                  <p className="text-sm text-slate-900">
                    {getShiftLabel(resolveShiftType())}
                  </p>
                </div>
              )}
              <Input
                label="Tiền mặt đầu ca *"
                value={formatMoneyInput(openingCashInput)}
                onChange={(e) => setOpeningCashInput(e.target.value)}
                placeholder="Nhập tiền đầu ca"
                inputMode="numeric"
              />
              <Input
                label="Ghi chú"
                value={openingNote}
                onChange={(e) => setOpeningNote(e.target.value)}
                placeholder="Ghi chú (tùy chọn)"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t bg-slate-50 px-5 py-4">
              <Button
                variant="outline"
                className="gap-2"
                onClick={logout}
                disabled={isOpeningShift}
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </Button>
              <Button
                className="bg-sky-600 hover:bg-sky-700"
                onClick={handleOpenShift}
                isLoading={isOpeningShift || isLoadingShift}
                disabled={!deviceIdentity?.id || parseMoney(openingCashInput) <= 0}
              >
                Mở ca
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCloseShiftModal && closeShiftSummary && activeShift && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Phiếu bàn giao ca</h3>
                <p className="text-sm text-slate-500">
                  {getShiftLabel(activeShift.shiftType)} · {activeShift.cashierName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void handlePrepareCloseShift(false)}
                  isLoading={isPreparingCloseShift}
                  disabled={isClosingShift}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reload nhanh
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCloseShiftModal(false)}
                  disabled={isClosingShift || isPreparingCloseShift}
                >
                  Đóng
                </Button>
              </div>
            </div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-slate-500">Tiền mặt đầu ca</p>
                  <p className="text-xl font-bold text-slate-900">
                    {formatCurrency(activeShift.openingCash || 0)} đ
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-slate-500">Doanh thu trong ca</p>
                  <p className="text-xl font-bold text-slate-900">
                    {formatCurrency(closeShiftSummary.totalSales)} đ
                  </p>
                </div>
              </div>

              <div className="rounded-xl border p-3">
                <div className="flex items-center justify-between py-1">
                  <span>Tiền mặt</span>
                  <span className="font-semibold">
                    {formatCurrency(closeShiftSummary.cashSales)} đ
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span>Chuyển khoản</span>
                  <span className="font-semibold">
                    {formatCurrency(closeShiftSummary.transferSales)} đ
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span>Nước đã bán (ly)</span>
                  <span className="font-semibold">{formatCurrency(closeShiftDrinkItems)}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span>Bánh đã bán (món)</span>
                  <span className="font-semibold">{formatCurrency(closeShiftBakeryItems)}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span>Phiếu thu</span>
                  <span className="font-semibold">
                    {formatCurrency(closeShiftSummary.incomeVouchers)} đ
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span>Phiếu chi</span>
                  <span className="font-semibold">
                    -{formatCurrency(closeShiftSummary.expenseVouchers)} đ
                  </span>
                </div>
                <div className="mt-2 border-t pt-2">
                  <div className="flex items-center justify-between py-1">
                    <span>Doanh thu két</span>
                    <span className="font-semibold">
                      {formatCurrency(
                        (activeShift.openingCash || 0) +
                          getShiftHandoverAmount(closeShiftSummary)
                      )} đ
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Bàn giao thực tế</span>
                    <span className="text-lg font-bold text-slate-900">
                      {formatCurrency(getShiftHandoverAmount(closeShiftSummary))} đ
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Tiền mặt + Phiếu thu − Phiếu chi
                  </p>
                </div>
              </div>

              <Input
                label="Tiền cuối ca"
                value={formatMoneyInput(closingCashInput)}
                onChange={(e) => setClosingCashInput(e.target.value)}
                placeholder="Nhập tiền mặt thực tế"
              />
              {(() => {
                if (closingCashInput.trim() === "") {
                  return (
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <span>Chênh lệch</span>
                      <span className="font-bold">Chưa nhập</span>
                    </div>
                  );
                }

                const difference = getCashDifferenceInfo(
                  parseMoney(closingCashInput) -
                    ((activeShift.openingCash || 0) + getShiftHandoverAmount(closeShiftSummary))
                );
                const differenceStyle =
                  difference.label === "Dư"
                    ? "bg-emerald-50 text-emerald-700"
                    : difference.label === "Thiếu"
                      ? "bg-red-50 text-red-700"
                      : "bg-slate-50 text-slate-700";

                return (
                  <div
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${differenceStyle}`}
                  >
                    <span>
                      Chênh lệch: <strong>{difference.label}</strong>
                    </span>
                    <span className="font-bold">{formatCurrency(difference.amount)} đ</span>
                  </div>
                );
              })()}
              <Input
                label="Ghi chú cuối ca"
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                placeholder="Ghi chú (tùy chọn)"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t bg-slate-50 px-5 py-4">
              <Button
                className="bg-sky-600 hover:bg-sky-700"
                onClick={handleCloseShiftAndPrint}
                isLoading={isClosingShift || isPreparingCloseShift}
              >
                Đóng ca và in phiếu bàn giao
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDailyReport && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:h-[90vh]">
            <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between sm:px-5 sm:py-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Báo cáo cuối ngày</h3>
                <p className="text-sm text-slate-500">
                  {RECEIPT_STORE_INFO[storeId]?.title || storeId}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-[150px] flex-1 lg:flex-none">
                  <span className="mb-1 block text-xs font-semibold text-slate-500">Ngày báo cáo</span>
                  <input
                    type="date"
                    value={dailyReportDate}
                    disabled={isLoadingDailyReport}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) return;
                      setDailyReportDate(value);
                      void loadDailyReport(value, dailyReportShift);
                    }}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
                  />
                </label>
                <label className="min-w-[130px] flex-1 lg:flex-none">
                  <span className="mb-1 block text-xs font-semibold text-slate-500">Phạm vi báo cáo</span>
                  <select
                    value={dailyReportShift}
                    disabled={isLoadingDailyReport}
                    onChange={(event) => {
                      const value = event.target.value as DailyReportShift;
                      setDailyReportShift(value);
                      void loadDailyReport(dailyReportDate, value);
                    }}
                    className="h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="all">Cả ngày</option>
                    <option value="shift_1">Ca 1</option>
                    <option value="shift_2">Ca 2</option>
                    <option value="shift_3">Ca 3</option>
                  </select>
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => void loadDailyReport(dailyReportDate, dailyReportShift)}
                  isLoading={isLoadingDailyReport}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Tải lại
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDailyReport(false)}
                >
                  Đóng
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1 border-b bg-slate-100 p-1.5 sm:gap-2 sm:px-5 sm:py-3">
              {([
                ["overview", "Tổng quan"],
                ["bills", `Bill theo giờ (${dailyReport?.completedBills || 0})`],
                ["products", `Hàng đã bán ${getDailyReportShiftLabel(dailyReportShift)} (${dailyProductRows.length})`],
              ] as [DailyReportTab, string][]).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDailyReportTab(tab)}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                    dailyReportTab === tab
                      ? "bg-white text-sky-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-3 py-4 sm:px-5">
              {isLoadingDailyReport && !dailyReport ? (
                <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">
                  Đang tải báo cáo cuối ngày...
                </div>
              ) : !dailyReport ? (
                <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">
                  Chưa có dữ liệu báo cáo.
                </div>
              ) : dailyReportTab === "overview" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doanh thu</p>
                      <p className="mt-1 text-xl font-bold text-sky-700 sm:text-2xl">
                        {formatCurrency(dailyReport.totalSales)} đ
                      </p>
                    </div>
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bill đã bán</p>
                      <p className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                        {dailyReport.completedBills}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nước đã bán (ly)</p>
                      <p className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                        {formatCurrency(dailyDrinkTotal)}
                      </p>
                    </div>
                    {dailyReportProductGroups.slice(1).map((group) => (
                      <div key={group.key} className="rounded-xl border bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.title} ({group.unit})</p>
                        <p className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{formatCurrency(group.total)}</p>
                      </div>
                    ))}
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trung bình / bill</p>
                      <p className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
                        {formatCurrency(
                          dailyReport.completedBills > 0
                            ? dailyReport.totalSales / dailyReport.completedBills
                            : 0
                        )} đ
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                      <h4 className="mb-3 font-bold text-slate-900">Thanh toán và dòng tiền</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Tiền mặt</span><strong>{formatCurrency(dailyReport.cashSales)} đ</strong></div>
                        <div className="flex justify-between"><span>Chuyển khoản</span><strong>{formatCurrency(dailyReport.transferSales)} đ</strong></div>
                        <div className="border-t pt-2 flex justify-between"><span>Tiền đầu ca</span><strong>{formatCurrency(dailyOpeningCash)} đ</strong></div>
                        <div className="flex justify-between"><span>Doanh thu két</span><strong>{formatCurrency(dailyTillRevenue)} đ</strong></div>
                        <div className="flex justify-between"><span>Tiền dư</span><strong className="text-emerald-700">+{formatCurrency(dailyCashSurplus)} đ</strong></div>
                        <div className="flex justify-between border-t pt-2"><span>Tiền bàn giao</span><strong className="text-sky-700">{formatCurrency(getShiftHandoverAmount(dailyReport))} đ</strong></div>
                        <div className="border-t pt-2 flex justify-between"><span>Phiếu thu ({dailyReportVouchers.filter((voucher) => !voucher.isCancelled && voucher.type === "income").length})</span><strong className="text-emerald-700">+{formatCurrency(dailyReport.incomeVouchers)} đ</strong></div>
                        <div className="flex justify-between"><span>Phiếu chi ({dailyReportVouchers.filter((voucher) => !voucher.isCancelled && voucher.type === "expense").length})</span><strong className="text-rose-700">-{formatCurrency(dailyReport.expenseVouchers)} đ</strong></div>
                      </div>
                    </div>
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                      <h4 className="mb-3 font-bold text-slate-900">Kiểm soát bill</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span>Bill hợp lệ</span><strong>{dailyReport.completedBills}</strong></div>
                        <div className="flex justify-between"><span>Bill đã hủy</span><strong className="text-rose-700">{dailyReport.cancelledBills}</strong></div>
                        <div className="flex justify-between"><span>Giá trị bill hủy</span><strong className="text-rose-700">{formatCurrency(dailyReport.cancelledAmount)} đ</strong></div>
                        <div className="border-t pt-2 flex justify-between"><span>Khung giờ có bán hàng</span><strong>{dailyAllBillHourCount}</strong></div>
                        <div className="flex justify-between"><span>Mặt hàng nước</span><strong>{dailyDrinkRows.length}</strong></div>
                        {dailyReportProductGroups.slice(1).map((group) => (
                          <div key={group.key} className="flex justify-between"><span>Mặt hàng {group.title.replace(" đã bán", "")}</span><strong>{group.rows.length}</strong></div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : dailyReportTab === "bills" ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 shadow-sm">
                    <span className="mr-1 text-sm font-semibold text-slate-600">Lọc thanh toán:</span>
                    {([
                      ["all", "Tất cả", completedDailyBills.length],
                      ["cash", "Tiền mặt", completedDailyBills.filter((bill) => (bill.paymentMethod || "cash") === "cash").length],
                      ["transfer", "Chuyển khoản", completedDailyBills.filter((bill) => bill.paymentMethod === "transfer").length],
                    ] as [DailyReportPaymentFilter, string, number][]).map(([value, label, count]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setDailyReportPaymentFilter(value);
                          setExpandedDailyBillHours(new Set());
                          setExpandedDailyReportBillId(null);
                        }}
                        className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                          dailyReportPaymentFilter === value
                            ? "border-sky-600 bg-sky-600 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50"
                        }`}
                      >
                        {label} ({count})
                      </button>
                    ))}
                  </div>
                  {dailyBillHourGroups.length === 0 && (
                    <div className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-slate-500">Không có bill phù hợp với phương thức thanh toán đã chọn.</div>
                  )}
                  {dailyBillHourGroups.map((group) => (
                    <section key={group.hour} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                      <button
                        type="button"
                        aria-expanded={expandedDailyBillHours.has(group.hour)}
                        onClick={() => {
                          setExpandedDailyBillHours((current) => {
                            const next = new Set(current);
                            if (next.has(group.hour)) next.delete(group.hour);
                            else next.add(group.hour);
                            return next;
                          });
                        }}
                        className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 bg-slate-100 px-4 py-3 text-left transition hover:bg-slate-200"
                      >
                        <span className="flex items-center gap-2">
                          <ChevronDown
                            className={`h-4 w-4 text-slate-500 transition-transform ${
                              expandedDailyBillHours.has(group.hour) ? "rotate-180" : ""
                            }`}
                          />
                          <span className="font-bold text-slate-900">{group.label}</span>
                        </span>
                        <span className="text-xs text-slate-600 sm:text-sm">
                          {group.bills.length} bill · {formatCurrency(group.itemCount)} món · <strong>{formatCurrency(group.revenue)} đ</strong>
                        </span>
                      </button>
                      {expandedDailyBillHours.has(group.hour) && (
                        <div className="overflow-x-auto border-t">
                          <table className="w-full min-w-[680px] text-sm">
                            <thead className="border-b bg-white text-left text-xs uppercase text-slate-500">
                              <tr><th className="px-4 py-2">Thời gian</th><th className="px-4 py-2">Mã bill</th><th className="px-4 py-2">Bàn</th><th className="px-4 py-2">Hàng hóa</th><th className="px-4 py-2">Thanh toán</th><th className="px-4 py-2 text-right">Tổng tiền</th></tr>
                            </thead>
                            <tbody className="divide-y">
                              {group.bills.map((bill) => {
                                const isBillExpanded = expandedDailyReportBillId === bill.id;
                                return (
                                  <Fragment key={bill.id}>
                                    <tr
                                      role="button"
                                      tabIndex={0}
                                      aria-expanded={isBillExpanded}
                                      onClick={() =>
                                        setExpandedDailyReportBillId(isBillExpanded ? null : bill.id)
                                      }
                                      onKeyDown={(event) => {
                                        if (event.key !== "Enter" && event.key !== " ") return;
                                        event.preventDefault();
                                        setExpandedDailyReportBillId(isBillExpanded ? null : bill.id);
                                      }}
                                      className="cursor-pointer align-top transition hover:bg-sky-50"
                                    >
                                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                                        <span className="flex items-center gap-2">
                                          <ChevronDown
                                            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                                              isBillExpanded ? "rotate-180" : ""
                                            }`}
                                          />
                                          {bill.createdAt?.seconds ? new Date(bill.createdAt.seconds * 1000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "-"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{bill.id}</td>
                                      <td className="px-4 py-3">{bill.tableNumber || "Mang về"}</td>
                                      <td className="max-w-xs px-4 py-3 text-xs text-slate-600">{(bill.items || []).map((item) => `${formatCurrency(item.quantity)}× ${item.name}`).join(", ") || "-"}</td>
                                      <td className="px-4 py-3">{bill.paymentMethod === "transfer" ? "Chuyển khoản" : "Tiền mặt"}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold">{formatCurrency(bill.total)} đ</td>
                                    </tr>
                                    {isBillExpanded && (
                                      <tr>
                                        <td colSpan={6} className="bg-slate-50 px-4 py-3">
                                          <div className="rounded-lg border bg-white p-3">
                                            {bill.note?.trim() && (
                                              <p className="mb-2 text-xs text-slate-600">
                                                Ghi chú: {bill.note.trim()}
                                              </p>
                                            )}
                                            <div className="divide-y">
                                              {(bill.items || []).map((item, index) => (
                                                <div
                                                  key={`${bill.id}-detail-${item.menuId}-${index}`}
                                                  className="flex items-start justify-between gap-4 py-2 first:pt-0 last:pb-0"
                                                >
                                                  <div>
                                                    <p className="font-semibold text-slate-900">{item.name}</p>
                                                    <p className="text-xs text-slate-500">
                                                      {formatCurrency(item.quantity)} × {formatCurrency(item.price)} đ
                                                      {item.note?.trim() ? ` · ${item.note.trim()}` : ""}
                                                    </p>
                                                  </div>
                                                  <p className="whitespace-nowrap font-semibold text-slate-900">
                                                    {formatCurrency(item.lineTotal || item.price * item.quantity)} đ
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                            <div className="mt-3 flex items-center justify-between border-t pt-3">
                                              <p className="font-bold text-slate-900">
                                                Tổng: {formatCurrency(bill.total)} đ
                                              </p>
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="gap-2 border-sky-300 text-sky-700 hover:bg-sky-50"
                                                onClick={() => handleReprintBill(bill)}
                                              >
                                                <Printer className="h-4 w-4" />
                                                In lại
                                              </Button>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {role === "admin" && (
                  <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
                    <h4 className="font-bold text-slate-900">Chọn category cần tách riêng</h4>
                    <p className="mt-1 text-xs text-slate-600">
                      Cấu hình này áp dụng cho thu ngân của cửa hàng. Thu ngân chỉ thấy các bảng kết quả đã được chọn bên dưới.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {categories.map((categoryItem) => {
                        const checked = dailyReportSplitCategoryIds.includes(categoryItem.id);
                        return (
                          <button
                            type="button"
                            key={categoryItem.id}
                            disabled={updatingDailyReportCategoryId !== null}
                            onClick={() => void handleToggleDailyReportSplitCategory(categoryItem)}
                            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${checked ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-sky-400"}`}
                          >
                            {categoryItem.name}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                  )}
                  {dailyReportProductGroups.map((group) => (
                    <section key={group.key} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-100 px-4 py-3">
                        <h4 className="font-bold text-slate-900">
                          {group.title} · {getDailyReportShiftLabel(dailyReportShift)}
                        </h4>
                        <p className="text-sm text-slate-600">
                          {group.rows.length} mặt hàng · {formatCurrency(group.total)} {group.unit}
                        </p>
                      </div>
                      {group.rows.length === 0 ? (
                        <div className="p-6 text-center text-sm text-slate-500">
                          Chưa có dữ liệu trong {getDailyReportShiftLabel(dailyReportShift)}.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[620px] text-sm">
                            <thead className="border-b bg-white text-left text-xs uppercase text-slate-500">
                              <tr><th className="w-14 px-4 py-3 text-center">#</th><th className="px-4 py-3">Tên hàng hóa</th><th className="px-4 py-3 text-right">Số lượng bán</th><th className="px-4 py-3 text-right">Số bill</th><th className="px-4 py-3 text-right">Doanh thu</th></tr>
                            </thead>
                            <tbody className="divide-y">
                              {group.rows.map((item, index) => (
                                <tr key={item.key} className="hover:bg-slate-50">
                                  <td className="px-4 py-3 text-center text-slate-400">{index + 1}</td>
                                  <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                                  <td className="px-4 py-3 text-right text-base font-bold text-sky-700">{formatCurrency(item.quantity)}</td>
                                  <td className="px-4 py-3 text-right">{item.billCount}</td>
                                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.revenue)} đ</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t bg-white px-4 py-3 sm:px-5">
              <p className="hidden text-xs text-slate-500 sm:block">
                Đang xem {getDailyReportShiftLabel(dailyReportShift)} ngày {getLocalDayRange(dailyReportDate).start.toLocaleDateString("vi-VN")}.
              </p>
            </div>
          </div>
        </div>
      )}

      {showSurchargeModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Cài đặt phụ thu</h3>
                <p className="text-sm text-slate-500">
                  Áp dụng cho toàn bộ quầy của cửa hàng hiện tại ({storeId})
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowSurchargeModal(false)}
                disabled={isSavingSurcharge}
              >
                Đóng
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-semibold text-slate-800">
                  {editingSurchargeId ? "Chỉnh sửa phụ thu" : "Tạo phụ thu mới"}
                </h4>
                <Input
                  label="Tên phụ thu *"
                  value={surchargeNameInput}
                  onChange={(e) => setSurchargeNameInput(e.target.value)}
                  placeholder="Ví dụ: Phụ thu lễ"
                />

                <div className="space-y-1">
                  <label className="text-sm font-medium leading-none">Loại phụ thu</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSurchargeTypeInput("percent");
                        setSurchargeValueInput("");
                      }}
                      className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                        surchargeTypeInput === "percent"
                          ? "border-sky-500 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Theo %
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSurchargeTypeInput("fixed");
                        setSurchargeValueInput("");
                      }}
                      className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                        surchargeTypeInput === "fixed"
                          ? "border-sky-500 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Theo tiền
                    </button>
                  </div>
                </div>

                <Input
                  label={surchargeTypeInput === "percent" ? "Giá trị (%) *" : "Giá trị (đ/món) *"}
                  value={surchargeValueInput}
                  onChange={(e) => handleSurchargeValueInputChange(e.target.value)}
                  placeholder={surchargeTypeInput === "percent" ? "Ví dụ: 20" : "Ví dụ: 3000"}
                />

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    checked={surchargeEnabledInput}
                    onChange={(e) => setSurchargeEnabledInput(e.target.checked)}
                  />
                  Bật phụ thu ngay sau khi lưu
                </label>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    onClick={resetSurchargeForm}
                    disabled={isSavingSurcharge}
                  >
                    Làm mới
                  </Button>
                  <Button
                    className="bg-sky-600 hover:bg-sky-700"
                    onClick={handleSaveSurcharge}
                    isLoading={isSavingSurcharge}
                  >
                    {editingSurchargeId ? "Cập nhật phụ thu" : "Tạo phụ thu"}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">
                    Phụ thu đang áp dụng khi tính tiền
                  </p>
                  {appliedSurchargeSummaries.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Chưa có phụ thu nào đang bật.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1">
                      {appliedSurchargeSummaries.map((surcharge) => (
                        <p
                          key={`active-${surcharge.id}`}
                          className="text-xs text-amber-700"
                        >
                          + {surcharge.name} ({formatSurchargeValue(surcharge)})
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="max-h-[380px] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3">
                  {surcharges.length === 0 && (
                    <p className="rounded-lg border border-dashed p-3 text-sm text-slate-500">
                      Chưa có khoản phụ thu nào.
                    </p>
                  )}

                  {surcharges.map((surcharge) => (
                    <div
                      key={surcharge.id}
                      className="rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {surcharge.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatSurchargeValue(surcharge)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                            surcharge.isEnabled
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {surcharge.isEnabled ? "Đang bật" : "Đang tắt"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleSurcharge(surcharge)}
                          disabled={updatingSurchargeId === surcharge.id}
                          className="inline-flex items-center rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {surcharge.isEnabled ? "Tắt" : "Bật"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditSurcharge(surcharge)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteSurcharge(surcharge)}
                          disabled={deletingSurchargeId === surcharge.id}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showVoucherModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {showVoucherModal === "income"
                    ? "Lập phiếu thu (tiền mặt)"
                    : "Lập phiếu chi (tiền mặt)"}
                </h3>
                <p className="text-sm text-slate-500">
                  Mã phiếu tự động tạo sau khi lưu
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowVoucherModal(null)}
                disabled={isSavingVoucher}
              >
                Đóng
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
              <Input
                type="datetime-local"
                label="Thời gian"
                value={voucherDateTime}
                onChange={(e) => setVoucherDateTime(e.target.value)}
              />
              <Input
                label={showVoucherModal === "income" ? "Loại thu *" : "Loại chi *"}
                list={`pos-voucher-category-${showVoucherModal}`}
                value={voucherCategory}
                onChange={(e) => setVoucherCategory(e.target.value)}
                placeholder={
                  showVoucherModal === "income"
                    ? "Ví dụ: Thu tiền khách trả"
                    : "Ví dụ: Chi mua nguyên liệu"
                }
              />
              <datalist id={`pos-voucher-category-${showVoucherModal}`}>
                {voucherCategories
                  .filter((category) => category.type === showVoucherModal)
                  .map((category) => (
                    <option key={category.id} value={category.name} />
                  ))}
              </datalist>
              <Input
                label="Giá trị *"
                value={formatMoneyInput(voucherAmountInput)}
                onChange={(e) => setVoucherAmountInput(e.target.value)}
                placeholder="Nhập số tiền"
              />
            </div>
            <div className="space-y-3 px-5 pb-4">
              <Input
                label={
                  showVoucherModal === "income" ? "Tên người nộp" : "Tên người nhận"
                }
                value={voucherPersonName}
                onChange={(e) => setVoucherPersonName(e.target.value)}
                placeholder={
                  showVoucherModal === "income"
                    ? "Ví dụ: Khách lẻ"
                    : "Ví dụ: Nhà cung cấp A"
                }
              />
              <div className="space-y-1">
                <label className="text-sm font-medium leading-none">Ghi chú</label>
                <textarea
                  value={voucherNote}
                  onChange={(e) => setVoucherNote(e.target.value)}
                  placeholder="Ghi chú thêm nếu cần"
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={voucherIncludeInCashFlow}
                  onChange={(e) => setVoucherIncludeInCashFlow(e.target.checked)}
                />
                Hạch toán vào dòng tiền trong ngày
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t bg-slate-50 px-5 py-4">
              <Button
                variant="outline"
                onClick={() => setShowVoucherModal(null)}
                disabled={isSavingVoucher}
              >
                Bỏ qua
              </Button>
              <Button
                className="bg-sky-600 hover:bg-sky-700"
                onClick={handleSaveVoucher}
                isLoading={isSavingVoucher}
              >
                Lưu phiếu
              </Button>
            </div>
          </div>
        </div>
      )}
    </RoleGuard>
  );
}
