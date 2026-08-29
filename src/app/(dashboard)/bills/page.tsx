"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bill,
  cancelBill,
  deleteBill,
  getBills,
  PaymentMethod,
  updateBill,
} from "@/services/billService";
import {
  CashVoucher,
  CashVoucherCategory,
  CashVoucherType,
  VoucherEvidenceOption,
  cancelCashVoucher,
  createCashVoucher,
  getCashVoucherCategories,
  getCashVouchers,
  getVoucherEvidenceOptions,
  updateCashVoucherBasic,
} from "@/services/cashVoucherService";
import { getOpenShiftByCashier } from "@/services/shiftService";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { SelectBox, type SelectBoxOption } from "@/components/ui/SelectBox";
import { Tooltip } from "@/components/ui/Tooltip";
import PrivateApiImage from "@/components/PrivateApiImage";
import {
  ArrowDownLeft,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Edit3,
  Filter,
  HandCoins,
  Images,
  Loader2,
  Plus,
  RefreshCcw,
  ReceiptText,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { hasPermission } from "@/lib/permissions";
import {
  BillDatePreset,
  getBillDatePresetRange,
} from "./billDatePresets";
import { paginateItems } from "./billPagination";
import {
  getBillActionVisibility,
  shouldActivateBillRow,
} from "./billRowInteraction";
import {
  buildBillExportWorkbook,
  buildVoucherExportWorkbook,
  downloadExcelWorkbook,
} from "./billExcelExport";

type EditFormState = {
  tableNumber: string;
  note: string;
  total: string;
  date: string;
  time: string;
  paymentMethod: PaymentMethod;
};

type VoucherFormState = {
  happenedAt: string;
  category: string;
  amount: string;
  personName: string;
  note: string;
  includeInCashFlow: boolean;
  inventoryReceiptId: string;
};

type VoucherEditFormState = {
  category: string;
  amount: string;
  inventoryReceiptId: string;
};

type SortDirection = "asc" | "desc";
type BillSortKey = "time" | "code" | "table" | "total" | "status";
type BillVisibilityFilter = "active" | "cancelled";
type VoucherVisibilityFilter = "active" | "cancelled";
type VoucherSortKey = "time" | "code" | "type" | "category" | "person" | "amount";

const BILL_PAGE_SIZES = [10, 20, 50] as const;
const BILL_DATE_PRESET_OPTIONS: readonly SelectBoxOption<
  BillDatePreset | "custom"
>[] = [
  { value: "today", label: "Hôm nay" },
  { value: "yesterday", label: "Hôm qua" },
  { value: "last7Days", label: "7 ngày qua" },
  { value: "thisMonth", label: "Tháng này" },
  { value: "previousMonth", label: "Tháng trước" },
];

const BILL_SORT_OPTIONS: readonly SelectBoxOption<BillSortKey>[] = [
  { value: "time", label: "Thời gian" },
  { value: "code", label: "Mã hóa đơn" },
  { value: "table", label: "Bàn" },
  { value: "total", label: "Tổng tiền" },
  { value: "status", label: "Trạng thái" },
];

const VOUCHER_SORT_OPTIONS: readonly SelectBoxOption<VoucherSortKey>[] = [
  { value: "time", label: "Thời gian" },
  { value: "code", label: "Mã phiếu" },
  { value: "type", label: "Loại phiếu" },
  { value: "category", label: "Nội dung" },
  { value: "person", label: "Người nộp/nhận" },
  { value: "amount", label: "Giá trị" },
];

const BILL_VISIBILITY_OPTIONS: readonly SelectBoxOption<BillVisibilityFilter>[] = [
  { value: "active", label: "Hóa đơn hợp lệ" },
  { value: "cancelled", label: "Hóa đơn đã hủy" },
];

const VOUCHER_VISIBILITY_OPTIONS: readonly SelectBoxOption<VoucherVisibilityFilter>[] = [
  { value: "active", label: "Phiếu hợp lệ" },
  { value: "cancelled", label: "Phiếu đã hủy" },
];

const SORT_TRIGGER_CLASS =
  "h-10 min-w-36 border-slate-300 bg-white font-semibold text-emerald-900 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 focus-visible:ring-emerald-600 sm:h-9 [&>svg]:text-emerald-700";

const SORT_DIRECTION_CLASS =
  "h-10 gap-1.5 border-slate-300 bg-white px-3 text-sm font-semibold text-emerald-900 shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-[0_2px_5px_rgba(6,78,59,0.12)] focus-visible:ring-emerald-600 active:scale-[0.98] sm:h-9 motion-reduce:transition-none";

const formatCurrency = (value: number) =>
  value.toLocaleString("vi-VN", { minimumFractionDigits: 0 });

const formatDateInput = (date: Date) => {
  const local = new Date(date.getTime());
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().split("T")[0];
};

const formatDateTimeInput = (date: Date) => {
  const local = new Date(date.getTime());
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
};

const parseMoney = (value: string) => {
  const amount = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
};

const formatMoneyInput = (value: string) => {
  const amount = parseMoney(value);
  return amount > 0 ? formatCurrency(amount) : "";
};

const getTimestampDate = (bill: Bill) =>
  bill.createdAt?.seconds ? new Date(bill.createdAt.seconds * 1000) : undefined;

const getVoucherDate = (voucher: CashVoucher) =>
  voucher.happenedAt?.seconds
    ? new Date(voucher.happenedAt.seconds * 1000)
    : voucher.createdAt?.seconds
    ? new Date(voucher.createdAt.seconds * 1000)
    : undefined;

const getPaymentMethodLabel = (bill: Bill) =>
  bill.paymentMethod === "transfer" ? "Chuyển khoản" : "Tiền mặt";

const compareText = (left: string, right: string) =>
  left.localeCompare(right, "vi", { numeric: true, sensitivity: "base" });

function BillActionButtons({
  bill,
  canEdit,
  canCancel,
  useSoftCancel,
  deletingId,
  onEdit,
  onCancel,
}: {
  bill: Bill;
  canEdit: boolean;
  canCancel: boolean;
  useSoftCancel: boolean;
  deletingId: string | null;
  onEdit: (bill: Bill) => void;
  onCancel: (bill: Bill) => void;
}) {
  const isCancelled = bill.status === "cancelled";
  const isDeleting = deletingId === bill.id;
  const cancelLabel = useSoftCancel ? "Hủy" : "Xóa";
  const { showEdit, showCancel, showColumn } = getBillActionVisibility(
    canEdit,
    canCancel,
    isCancelled,
  );

  if (!showColumn) return null;

  return (
    <div className="flex items-center justify-center gap-2">
      {showEdit && (
        <Button
          variant="outline"
          size="icon"
          className="relative z-20 h-11 w-11 border-blue-200 bg-white text-blue-700 shadow-none transition-[background-color,border-color,color,transform] duration-150 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 focus-visible:ring-blue-500 active:bg-blue-100 xl:h-9 xl:w-9"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(bill);
          }}
          title={`Sửa hóa đơn ${bill.id}`}
          aria-label={`Sửa hóa đơn ${bill.id}`}
        >
          <Edit3 className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
      {showCancel && (
        <Button
          variant="outline"
          size="icon"
          className="relative z-20 h-11 w-11 border-blue-200 bg-white text-blue-700 shadow-none transition-[background-color,border-color,color,transform] duration-150 hover:border-red-500 hover:bg-red-500 hover:text-white focus-visible:ring-red-500 active:bg-red-600 xl:h-9 xl:w-9"
          onClick={(event) => {
            event.stopPropagation();
            onCancel(bill);
          }}
          disabled={isDeleting}
          title={`${cancelLabel} hóa đơn ${bill.id}`}
          aria-label={`${cancelLabel} hóa đơn ${bill.id}`}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      )}
    </div>
  );
}

export default function BillsPage() {
  const { role, user } = useAuth();
  const { storeId: selectedStoreId } = useStore();
  const assignedStoreId =
    user?.storeId === "cafe" ||
    user?.storeId === "restaurant" ||
    user?.storeId === "bakery" ||
    user?.storeId === "farm"
      ? user.storeId
      : null;
  const storeId =
    (role === "user" || role === "server") && assignedStoreId
      ? assignedStoreId
      : selectedStoreId;

  const isFarmStore = storeId === "farm";
  const canUseBills = hasPermission(user, "bills.access");
  const canEditBill = canUseBills && (role === "admin" || role === "user");
  const canEditBillDetails = role === "admin";
  const canCancelBill = canUseBills && role === "admin";
  const canViewCancelledBills = hasPermission(user, "bills.cancelled.view");
  const canEditVoucherAmount = role !== "user";
  const canCancelVoucher = hasPermission(user, "cash_vouchers.cancel");
  const canViewCancelledVouchers = hasPermission(user, "cash_vouchers.cancelled.view");
  const useSoftCancel = !isFarmStore;

  const todayInput = formatDateInput(new Date());

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"bills" | "vouchers" | null>(null);
  const [billSearch, setBillSearch] = useState("");
  const [voucherSearch, setVoucherSearch] = useState("");
  const [billSortKey, setBillSortKey] = useState<BillSortKey>("time");
  const [billSortDirection, setBillSortDirection] = useState<SortDirection>("desc");
  const [billPage, setBillPage] = useState(1);
  const [billPageSize, setBillPageSize] = useState(10);
  const [billVisibility, setBillVisibility] = useState<BillVisibilityFilter>("active");
  const [voucherVisibility, setVoucherVisibility] = useState<VoucherVisibilityFilter>("active");
  const [voucherSortKey, setVoucherSortKey] = useState<VoucherSortKey>("time");
  const [voucherSortDirection, setVoucherSortDirection] =
    useState<SortDirection>("desc");
  const [datePreset, setDatePreset] = useState<BillDatePreset | "custom">("today");
  const [startDate, setStartDate] = useState(todayInput);
  const [endDate, setEndDate] = useState(todayInput);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    tableNumber: "",
    note: "",
    total: "",
    date: todayInput,
    time: "00:00",
    paymentMethod: "cash",
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [vouchers, setVouchers] = useState<CashVoucher[]>([]);
  const [voucherCategories, setVoucherCategories] = useState<CashVoucherCategory[]>([]);
  const [showVoucherModal, setShowVoucherModal] = useState<CashVoucherType | null>(
    null
  );
  const [voucherForm, setVoucherForm] = useState<VoucherFormState>({
    happenedAt: formatDateTimeInput(new Date()),
    category: "",
    amount: "",
    personName: "",
    note: "",
    includeInCashFlow: true,
    inventoryReceiptId: "",
  });
  const [voucherEvidenceOptions, setVoucherEvidenceOptions] = useState<VoucherEvidenceOption[]>([]);
  const [loadingVoucherEvidences, setLoadingVoucherEvidences] = useState(false);
  const showVoucherEvidencePicker = false;
  const [previewingVoucher, setPreviewingVoucher] = useState<CashVoucher | null>(null);
  const selectedVoucherEvidence = voucherEvidenceOptions.find(
    (item) => item.receiptId === voucherForm.inventoryReceiptId,
  );
  const [savingVoucher, setSavingVoucher] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<CashVoucher | null>(null);
  const [voucherEditForm, setVoucherEditForm] = useState<VoucherEditFormState>({
    category: "",
    amount: "",
    inventoryReceiptId: "",
  });
  const [savingVoucherEdit, setSavingVoucherEdit] = useState(false);
  const [cancellingVoucherId, setCancellingVoucherId] = useState<string | null>(null);

  const getRange = () => {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const resetVoucherForm = (type: CashVoucherType) => {
    setShowVoucherModal(type);
    setVoucherForm({
      happenedAt: formatDateTimeInput(new Date()),
      category: "",
      amount: "",
      personName: "",
      note: "",
      includeInCashFlow: true,
      inventoryReceiptId: "",
    });
  };

  useEffect(() => {
    const creatingExpense = showVoucherEvidencePicker && showVoucherModal === "expense";
    const editingExpense = editingVoucher?.type === "expense";
    if (!creatingExpense && !editingExpense) {
      setVoucherEvidenceOptions([]);
      return;
    }
    let active = true;
    setLoadingVoucherEvidences(true);
    getVoucherEvidenceOptions(storeId, 50)
      .then((items) => {
        if (!active) return;
        const current = editingVoucher?.evidence;
        if (current && !items.some((item) => item.receiptId === current.receiptId)) {
          setVoucherEvidenceOptions([{
            ...current,
            status: "linked",
            createdAt: "",
            imageCount: current.images.length,
          }, ...items]);
        } else {
          setVoucherEvidenceOptions(items);
        }
      })
      .catch(() => { if (active) setVoucherEvidenceOptions([]); })
      .finally(() => { if (active) setLoadingVoucherEvidences(false); });
    return () => { active = false; };
  }, [showVoucherModal, storeId, editingVoucher]);

  const selectVoucherEvidence = (receiptId: string) => {
    const selected = voucherEvidenceOptions.find((item) => item.receiptId === receiptId);
    setVoucherForm((current) => ({
      ...current,
      inventoryReceiptId: receiptId,
      amount: selected && !parseMoney(current.amount) && selected.totalAmount > 0
        ? String(selected.totalAmount)
        : current.amount,
      personName: selected?.supplierName && !current.personName.trim()
        ? selected.supplierName
        : current.personName,
      category: selected && !current.category.trim() ? "Chi mua nguyên liệu" : current.category,
    }));
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { start, end } = getRange();
      const [billData, voucherData, voucherCategoryData] = await Promise.all([
        getBills({
          startDate: start,
          endDate: end,
          storeId,
          status: billVisibility,
          limitCount: 2000,
        }),
        getCashVouchers({
          startDate: start,
          endDate: end,
          storeId,
          status: voucherVisibility,
          limitCount: 2000,
        }),
        getCashVoucherCategories(storeId),
      ]);
      setBills(billData);
      setVouchers(voucherData);
      setVoucherCategories(voucherCategoryData);
    } catch (error) {
      console.error(error);
      alert("Không thể tải dữ liệu hóa đơn và phiếu thu/chi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, storeId, billVisibility, voucherVisibility]);

  useEffect(() => {
    if (!canViewCancelledBills && billVisibility === "cancelled") {
      setBillVisibility("active");
    }
  }, [billVisibility, canViewCancelledBills]);

  useEffect(() => {
    if (!canViewCancelledVouchers && voucherVisibility === "cancelled") {
      setVoucherVisibility("active");
    }
  }, [canViewCancelledVouchers, voucherVisibility]);

  const filteredBills = useMemo(() => {
    const visibilityMatchedBills = bills.filter((bill) =>
      billVisibility === "cancelled"
        ? canViewCancelledBills && bill.status === "cancelled"
        : bill.status !== "cancelled",
    );
    const keyword = billSearch.trim().toLowerCase();
    const matchedBills = keyword ? visibilityMatchedBills.filter((bill) => {
      const tableMatch = bill.tableNumber?.toLowerCase().includes(keyword);
      const idMatch = bill.id.toLowerCase().includes(keyword);
      const noteMatch = bill.note?.toLowerCase().includes(keyword);
      return tableMatch || idMatch || noteMatch;
    }) : visibilityMatchedBills;

    const direction = billSortDirection === "asc" ? 1 : -1;
    return [...matchedBills].sort((left, right) => {
      let compared = 0;
      if (billSortKey === "time") {
        compared = (getTimestampDate(left)?.getTime() || 0) - (getTimestampDate(right)?.getTime() || 0);
      } else if (billSortKey === "code") {
        compared = compareText(left.id, right.id);
      } else if (billSortKey === "table") {
        compared = compareText(left.tableNumber || "", right.tableNumber || "");
      } else if (billSortKey === "total") {
        compared = (left.total || 0) - (right.total || 0);
      } else {
        compared = compareText(left.status || "", right.status || "");
      }
      return compared * direction;
    });
  }, [billSearch, billSortDirection, billSortKey, billVisibility, bills, canViewCancelledBills]);

  const billPagination = useMemo(
    () => paginateItems(filteredBills, billPage, billPageSize),
    [billPage, billPageSize, filteredBills],
  );

  useEffect(() => {
    setBillPage(1);
  }, [billPageSize, billSearch, billSortDirection, billSortKey, billVisibility, endDate, startDate, storeId]);

  useEffect(() => {
    if (billPage !== billPagination.page) {
      setBillPage(billPagination.page);
    }
  }, [billPage, billPagination.page]);

  const activeBills = useMemo(
    () => filteredBills.filter((bill) => bill.status !== "cancelled"),
    [filteredBills]
  );

  const totalAmount = activeBills.reduce((sum, bill) => sum + bill.total, 0);
  const filteredVouchers = useMemo(() => {
    const visibilityMatchedVouchers = vouchers.filter((voucher) =>
      voucherVisibility === "cancelled"
        ? canViewCancelledVouchers && voucher.isCancelled === true
        : voucher.isCancelled !== true,
    );
    const keyword = voucherSearch.trim().toLowerCase();
    const matchedVouchers = keyword ? visibilityMatchedVouchers.filter((voucher) => {
      const codeMatch = voucher.code?.toLowerCase().includes(keyword);
      const categoryMatch = voucher.category?.toLowerCase().includes(keyword);
      const personMatch = voucher.personName?.toLowerCase().includes(keyword);
      const noteMatch = voucher.note?.toLowerCase().includes(keyword);
      return codeMatch || categoryMatch || personMatch || noteMatch;
    }) : visibilityMatchedVouchers;

    const direction = voucherSortDirection === "asc" ? 1 : -1;
    return [...matchedVouchers].sort((left, right) => {
      let compared = 0;
      if (voucherSortKey === "time") {
        compared = (getVoucherDate(left)?.getTime() || 0) - (getVoucherDate(right)?.getTime() || 0);
      } else if (voucherSortKey === "code") {
        compared = compareText(left.code || left.id, right.code || right.id);
      } else if (voucherSortKey === "type") {
        compared = compareText(left.type, right.type);
      } else if (voucherSortKey === "category") {
        compared = compareText(left.category || "", right.category || "");
      } else if (voucherSortKey === "person") {
        compared = compareText(left.personName || "", right.personName || "");
      } else {
        compared = (left.amount || 0) - (right.amount || 0);
      }
      return compared * direction;
    });
  }, [canViewCancelledVouchers, voucherSearch, voucherSortDirection, voucherSortKey, voucherVisibility, vouchers]);

  const totalIncomeVouchers = filteredVouchers
    .filter((voucher) => !voucher.isCancelled && voucher.includeInCashFlow !== false && voucher.type === "income")
    .reduce((sum, voucher) => sum + (voucher.amount || 0), 0);
  const totalExpenseVouchers = filteredVouchers
    .filter((voucher) => !voucher.isCancelled && voucher.includeInCashFlow !== false && voucher.type === "expense")
    .reduce((sum, voucher) => sum + (voucher.amount || 0), 0);
  const netDailyCashFlow = totalAmount + totalIncomeVouchers - totalExpenseVouchers;

  const handleExportBills = async () => {
    setExporting("bills");
    try {
      await downloadExcelWorkbook(
        buildBillExportWorkbook(filteredBills, { startDate, endDate }),
        `danh-sach-hoa-don_${startDate}_${endDate}.xlsx`,
      );
    } catch (error) {
      console.error(error);
      alert("Không thể tạo file Excel danh sách hóa đơn.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportVouchers = async () => {
    setExporting("vouchers");
    try {
      await downloadExcelWorkbook(
        buildVoucherExportWorkbook(filteredVouchers, { startDate, endDate }),
        `phieu-thu-chi_${startDate}_${endDate}.xlsx`,
      );
    } catch (error) {
      console.error(error);
      alert("Không thể tạo file Excel phiếu thu/chi.");
    } finally {
      setExporting(null);
    }
  };

  const openEdit = (bill: Bill) => {
    if (!canEditBill) return;
    const created = getTimestampDate(bill) || new Date();
    const hours = String(created.getHours()).padStart(2, "0");
    const minutes = String(created.getMinutes()).padStart(2, "0");

    setEditing(bill);
    setEditForm({
      tableNumber: bill.tableNumber || "",
      note: bill.note || "",
      total: String(bill.total ?? 0),
      date: formatDateInput(created),
      time: `${hours}:${minutes}`,
      paymentMethod: bill.paymentMethod || "cash",
    });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!canEditBillDetails) {
      setSaving(true);
      try {
        await updateBill(editing.id, {
          paymentMethod: editForm.paymentMethod,
        });
        await loadData();
        setEditing(null);
      } catch (error) {
        console.error(error);
        alert("Không thể cập nhật phương thức thanh toán.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const parsedTotal = Number(editForm.total);
    if (Number.isNaN(parsedTotal) || parsedTotal < 0) {
      alert("Tổng tiền không hợp lệ.");
      return;
    }

    const payloadDate =
      editForm.date && !Number.isNaN(new Date(editForm.date).getTime())
        ? new Date(editForm.date)
        : undefined;
    if (payloadDate) {
      const [h, m] = editForm.time.split(":").map(Number);
      payloadDate.setHours(h || 0, m || 0, 0, 0);
    }

    const tableNumber = editForm.tableNumber.trim() || editing.tableNumber;

    setSaving(true);
    try {
      await updateBill(editing.id, {
        tableNumber,
        note: editForm.note,
        total: parsedTotal,
        createdAt: payloadDate,
        paymentMethod: editForm.paymentMethod,
      });
      await loadData();
      setEditing(null);
    } catch (error) {
      console.error(error);
      alert("Không thể cập nhật hóa đơn.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelBill = async (bill: Bill) => {
    if (!canCancelBill) return;

    const actionLabel = useSoftCancel ? "hủy" : "xóa";
    if (
      !confirm(
        `Bạn có chắc muốn ${actionLabel} hóa đơn ${bill.id} của bàn ${bill.tableNumber}?`
      )
    ) {
      return;
    }

    setDeletingId(bill.id);
    try {
      if (useSoftCancel) {
        await cancelBill(bill.id, user?.email || user?.uid || undefined, bill.note);
      } else {
        await deleteBill(bill.id);
      }
      await loadData();
    } catch (error) {
      console.error(error);
      alert(`Không thể ${actionLabel} hóa đơn.`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveVoucher = async () => {
    if (!showVoucherModal) return;

    const amount = parseMoney(voucherForm.amount);
    if (amount <= 0) {
      alert("Giá trị phiếu phải lớn hơn 0.");
      return;
    }
    if (!voucherForm.category.trim()) {
      alert("Vui lòng nhập loại thu/chi.");
      return;
    }

    setSavingVoucher(true);
    try {
      const maybeShift = user
        ? await getOpenShiftByCashier(storeId, user.uid)
        : null;
      const defaultCashierName =
        user?.displayName || user?.email?.split("@")[0] || "Thu ngân";

      await createCashVoucher({
        storeId,
        type: showVoucherModal,
        amount,
        category: voucherForm.category,
        personName: voucherForm.personName,
        note: voucherForm.note,
        includeInCashFlow: voucherForm.includeInCashFlow,
        happenedAt: voucherForm.happenedAt
          ? new Date(voucherForm.happenedAt)
          : new Date(),
        shiftId: maybeShift?.id,
        cashierId: user?.uid,
        cashierName: defaultCashierName,
        inventoryReceiptId: showVoucherModal === "expense"
          ? voucherForm.inventoryReceiptId || null
          : null,
      });

      setShowVoucherModal(null);
      await loadData();
      alert("Đã lưu phiếu thành công.");
    } catch (error) {
      console.error(error);
      alert("Không thể lưu phiếu thu/chi.");
    } finally {
      setSavingVoucher(false);
    }
  };

  const openEditVoucher = (voucher: CashVoucher) => {
    if (voucher.isCancelled) return;
    setEditingVoucher(voucher);
    setVoucherEditForm({
      category: voucher.category || "",
      amount: String(voucher.amount || 0),
      inventoryReceiptId: voucher.inventoryReceiptId || "",
    });
  };

  const handleSaveEditVoucher = async () => {
    if (!editingVoucher) return;
    const amount = canEditVoucherAmount ? parseMoney(voucherEditForm.amount) : editingVoucher.amount;
    const category = voucherEditForm.category.trim();

    if (!category) {
      alert("Vui lòng nhập tên phiếu.");
      return;
    }
    if (canEditVoucherAmount && amount <= 0) {
      alert("Giá trị phiếu phải lớn hơn 0.");
      return;
    }

    setSavingVoucherEdit(true);
    try {
      await updateCashVoucherBasic(editingVoucher.id, {
        category,
        ...(canEditVoucherAmount ? { amount } : {}),
        ...(editingVoucher.type === "expense" ? {
          inventoryReceiptId: voucherEditForm.inventoryReceiptId || null,
        } : {}),
      });
      setEditingVoucher(null);
      await loadData();
      alert("Đã cập nhật phiếu thành công.");
    } catch (error) {
      console.error(error);
      alert("Không thể cập nhật phiếu thu/chi.");
    } finally {
      setSavingVoucherEdit(false);
    }
  };

  const handleCancelVoucher = async (voucher: CashVoucher) => {
    if (!canCancelVoucher || voucher.isCancelled) return;
    const reason = window.prompt(`Nhập lý do hủy phiếu ${voucher.code || voucher.id}:`)?.trim();
    if (!reason) return;
    if (!window.confirm("Phiếu sẽ được đánh dấu đã hủy và loại khỏi mọi phép tính dòng tiền. Tiếp tục?")) return;

    setCancellingVoucherId(voucher.id);
    try {
      await cancelCashVoucher(voucher.id, reason);
      await loadData();
      alert("Đã hủy phiếu và lưu đầy đủ dấu vết.");
    } catch (error) {
      console.error(error);
      alert("Không thể hủy phiếu thu/chi.");
    } finally {
      setCancellingVoucherId(null);
    }
  };

  const applyDatePreset = (preset: BillDatePreset) => {
    const range = getBillDatePresetRange(preset);
    setDatePreset(preset);
    setStartDate(formatDateInput(range.start));
    setEndDate(formatDateInput(range.end));
  };

  return (
    <RoleGuard permission="bills.access">
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1600px] space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-700">
                  <ReceiptText className="h-4 w-4" />
                  Quản lý hóa đơn
                </p>
                <h1 className="text-2xl font-bold text-slate-900">
                  {billVisibility === "cancelled" ? "Hóa đơn đã hủy" : "Danh sách hóa đơn"}
                </h1>
                <p className="text-sm text-slate-500">
                  Mặc định lọc trong ngày để xem tổng thu nhanh.
                </p>
              </div>
            </div>
            <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[auto_auto] xl:flex xl:items-center">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  className="h-10 w-full gap-1.5 bg-emerald-800 px-3 text-sm font-semibold text-white shadow-[0_2px_5px_rgba(6,78,59,0.22)] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-emerald-700 hover:shadow-[0_3px_8px_rgba(6,78,59,0.28)] focus-visible:ring-emerald-700 active:scale-[0.98] sm:h-9 motion-reduce:transition-none"
                  onClick={() => resetVoucherForm("income")}
                >
                  <Plus className="h-4 w-4 text-[#F6C85F]" aria-hidden="true" />
                  Lập phiếu thu
                </Button>
                <Button
                  size="sm"
                  className="h-10 w-full gap-1.5 bg-red-600 px-3 text-sm font-semibold text-white shadow-[0_2px_5px_rgba(185,28,28,0.22)] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-red-700 hover:shadow-[0_3px_8px_rgba(185,28,28,0.28)] focus-visible:ring-red-600 active:scale-[0.98] sm:h-9 motion-reduce:transition-none"
                  onClick={() => resetVoucherForm("expense")}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Lập phiếu chi
                </Button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-2 sm:grid-cols-[auto_2.25rem]">
                <SelectBox<BillDatePreset | "custom">
                  value={datePreset}
                  options={BILL_DATE_PRESET_OPTIONS}
                  onValueChange={(preset) => {
                    if (preset !== "custom") applyDatePreset(preset);
                  }}
                  ariaLabel="Lọc hóa đơn theo thời gian"
                  placeholder="Tùy chỉnh"
                  className="w-full sm:w-32"
                  triggerClassName="h-10 min-w-32 border-emerald-700 bg-white text-emerald-900 shadow-[0_2px_5px_rgba(6,78,59,0.12)] hover:border-emerald-800 hover:bg-emerald-50 hover:text-emerald-950 focus-visible:ring-emerald-600 sm:h-9 [&>svg]:text-emerald-700"
                />
                <Tooltip content="Tải lại dữ liệu" side="bottom" className="h-10 w-10 sm:h-9 sm:w-9">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 border-slate-200 bg-white text-emerald-800 shadow-none transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-emerald-300 hover:bg-emerald-50 focus-visible:ring-emerald-600 active:scale-[0.96] sm:h-9 sm:w-9 motion-reduce:transition-none"
                    onClick={loadData}
                    disabled={loading}
                    aria-label="Tải lại dữ liệu"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Tổng quan</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="relative flex items-center justify-between overflow-hidden rounded-lg border border-blue-100 bg-gradient-to-b from-blue-100 via-blue-50 to-white px-5 py-4">
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-4 left-0 w-1.5 rounded-r-full bg-blue-600"
                    />
                    <div className="min-w-0 pl-1">
                      <p className="text-xs font-semibold uppercase text-blue-700">
                        Tổng thu (không tính bill hủy)
                      </p>
                      <p className="mt-2 text-2xl font-extrabold tabular-nums text-blue-900">
                        {formatCurrency(totalAmount)} VND
                      </p>
                    </div>
                    <ReceiptText className="h-6 w-6 shrink-0 text-blue-600" />
                  </div>
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex items-center justify-between text-emerald-700">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <ArrowUpRight className="h-4 w-4" />
                        Phiếu thu
                      </span>
                      <span className="font-bold">{formatCurrency(totalIncomeVouchers)} VND</span>
                    </div>
                    <div className="flex items-center justify-between text-rose-700">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <ArrowDownLeft className="h-4 w-4" />
                        Phiếu chi
                      </span>
                      <span className="font-bold">-{formatCurrency(totalExpenseVouchers)} VND</span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2 text-slate-900">
                      <span className="font-semibold">Dòng tiền trong ngày</span>
                      <span className="text-base font-bold">{formatCurrency(netDailyCashFlow)} VND</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-600 sm:col-span-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500">Số bill hợp lệ</p>
                      <p className="text-lg font-bold text-slate-900">{activeBills.length}</p>
                    </div>
                    {canViewCancelledBills ? <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500">Bill đã hủy</p>
                      <p className="text-lg font-bold text-rose-700">
                        {filteredBills.filter((bill) => bill.status === "cancelled").length}
                      </p>
                    </div> : null}
                    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500">Phiếu thu/chi</p>
                      <p className="text-lg font-bold text-slate-900">{filteredVouchers.length}</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500">Tính vào dòng tiền</p>
                      <p className="text-lg font-bold text-slate-900">
                        {
                          filteredVouchers.filter(
                            (voucher) => !voucher.isCancelled && voucher.includeInCashFlow !== false
                          ).length
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                    <Filter className="h-5 w-5 text-sky-600" />
                    Lọc
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {canViewCancelledBills ? <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Trạng thái hóa đơn
                    </label>
                    <SelectBox<BillVisibilityFilter>
                      value={billVisibility}
                      options={BILL_VISIBILITY_OPTIONS}
                      onValueChange={setBillVisibility}
                      ariaLabel="Lọc theo trạng thái hóa đơn"
                      className="w-full"
                      triggerClassName={billVisibility === "cancelled" ? "border-rose-300 bg-rose-50 text-rose-800" : "border-emerald-300 bg-emerald-50 text-emerald-900"}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Hóa đơn đã hủy được lưu riêng và không xuất hiện trong danh sách mặc định.
                    </p>
                  </div> : null}
                  {canViewCancelledVouchers ? <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Trạng thái phiếu thu/chi
                    </label>
                    <SelectBox<VoucherVisibilityFilter>
                      value={voucherVisibility}
                      options={VOUCHER_VISIBILITY_OPTIONS}
                      onValueChange={setVoucherVisibility}
                      ariaLabel="Lọc theo trạng thái phiếu thu chi"
                      className="w-full"
                      triggerClassName={voucherVisibility === "cancelled" ? "border-rose-300 bg-rose-50 text-rose-800" : "border-emerald-300 bg-emerald-50 text-emerald-900"}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Phiếu đã hủy được lưu riêng và không xuất hiện trong danh sách mặc định.
                    </p>
                  </div> : null}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Tìm theo bàn / mã
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Nhập mã bill, bàn hoặc ghi chú"
                        className="pl-9"
                        value={billSearch}
                        onChange={(e) => setBillSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <DateRangePicker
                    label="Khoảng thời gian"
                    startDate={startDate}
                    endDate={endDate}
                    onChange={(nextStartDate, nextEndDate) => {
                      setDatePreset("custom");
                      setStartDate(nextStartDate);
                      setEndDate(nextEndDate);
                    }}
                  />
                </CardContent>
              </Card>

            </div>

            <div className="space-y-5">
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ReceiptText className="h-5 w-5 text-sky-700" />
                    {billVisibility === "cancelled" ? "Hóa đơn đã hủy" : "Danh sách hóa đơn"} ({filteredBills.length})
                  </CardTitle>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className={SORT_DIRECTION_CLASS}
                      onClick={handleExportBills}
                      disabled={loading || exporting !== null || filteredBills.length === 0}
                      title="Xuất toàn bộ hóa đơn đang lọc ra Excel"
                    >
                      {exporting === "bills" ? <Loader2 className="h-4 w-4 animate-spin text-emerald-700" aria-hidden="true" /> : <Download className="h-4 w-4 text-emerald-700" aria-hidden="true" />}
                      {exporting === "bills" ? "Đang xuất..." : "Xuất Excel"}
                    </Button>
                    <SelectBox<BillSortKey>
                      value={billSortKey}
                      options={BILL_SORT_OPTIONS}
                      onValueChange={setBillSortKey}
                      ariaLabel="Sắp xếp hóa đơn theo"
                      className="min-w-0 flex-1 sm:w-40 sm:flex-none"
                      triggerClassName={SORT_TRIGGER_CLASS}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className={SORT_DIRECTION_CLASS}
                      onClick={() =>
                        setBillSortDirection((current) => current === "asc" ? "desc" : "asc")
                      }
                      title={billSortDirection === "asc" ? "Tăng dần" : "Giảm dần"}
                    >
                      {billSortDirection === "asc" ? (
                        <ArrowUp className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                      ) : (
                        <ArrowDown className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                      )}
                      {billSortDirection === "asc" ? "Tăng" : "Giảm"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div
                    key={`bill-table-${billPagination.page}`}
                    className="admin-list-scrollbar hidden max-h-[min(74vh,880px)] overflow-auto xl:block"
                  >
                    <table className="w-full min-w-[960px] text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 shadow-sm">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Mã</th>
                          <th className="px-4 py-3 text-left font-semibold">Thời gian</th>
                          <th className="px-4 py-3 text-left font-semibold">Bàn</th>
                          <th className="px-4 py-3 text-left font-semibold">Thanh toán</th>
                          <th className="px-4 py-3 text-right font-semibold">Tổng tiền</th>
                          <th className="px-4 py-3 text-center font-semibold">Trạng thái</th>
                          {(canEditBill || canCancelBill) && (
                            <th className="sticky right-0 z-20 w-28 min-w-28 border-l border-slate-200 bg-slate-100 px-3 py-3 text-center font-semibold shadow-[-8px_0_14px_-14px_rgba(15,23,42,0.45)]">
                              Hành động
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {loading ? (
                          <tr>
                            <td
                              colSpan={canEditBill || canCancelBill ? 7 : 6}
                              className="px-4 py-8 text-center"
                            >
                              Đang tải danh sách...
                            </td>
                          </tr>
                        ) : filteredBills.length === 0 ? (
                          <tr>
                            <td
                              colSpan={canEditBill || canCancelBill ? 7 : 6}
                              className="px-4 py-8 text-center text-slate-500"
                            >
                              Không có hóa đơn nào trong khoảng này.
                            </td>
                          </tr>
                        ) : (
                          billPagination.items.map((bill) => {
                            const created = getTimestampDate(bill);
                            const isCancelled = bill.status === "cancelled";

                            return (
                              <tr
                                key={bill.id}
                                className={`group ${
                                  isCancelled ? "bg-rose-50/30 text-rose-950" : ""
                                } ${
                                  canEditBill && !isCancelled
                                    ? "cursor-pointer transition-colors hover:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                                    : !isCancelled
                                      ? "hover:bg-slate-50"
                                      : ""
                                }`}
                                onClick={canEditBill && !isCancelled ? () => openEdit(bill) : undefined}
                                onKeyDown={canEditBill && !isCancelled ? (event) => {
                                  if (
                                    shouldActivateBillRow(
                                      event.key,
                                      event.target === event.currentTarget,
                                    )
                                  ) {
                                    event.preventDefault();
                                    openEdit(bill);
                                  }
                                } : undefined}
                                tabIndex={canEditBill && !isCancelled ? 0 : undefined}
                                aria-label={canEditBill && !isCancelled ? `Chỉnh sửa hóa đơn ${bill.id}` : undefined}
                              >
                                <td className="px-4 py-3 font-mono text-xs">
                                  <div>{bill.id}</div>
                                  {bill.orderSource === "bar" ? (
                                    <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 font-sans text-[11px] font-bold text-amber-800">
                                      Pha chế tạo
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  {created ? created.toLocaleString("vi-VN") : "Chưa có"}
                                </td>
                                <td className="px-4 py-3 font-semibold text-slate-900">
                                  {bill.tableNumber || "Không rõ"}
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  {getPaymentMethodLabel(bill)}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                  {formatCurrency(bill.total)} VND
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {isCancelled ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                                      <XCircle className="h-3.5 w-3.5" /> Đã hủy
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                                      Hợp lệ
                                    </span>
                                  )}
                                </td>

                                {(canEditBill || canCancelBill) && (
                                  <td
                                    className={`sticky right-0 z-[5] w-28 min-w-28 border-l px-3 py-3 text-center shadow-[-8px_0_14px_-14px_rgba(15,23,42,0.35)] transition-colors ${
                                      isCancelled
                                        ? "border-rose-100 bg-rose-50 group-hover:bg-rose-50"
                                        : "border-slate-100 bg-white group-hover:bg-emerald-50"
                                    }`}
                                  >
                                    <BillActionButtons
                                      bill={bill}
                                      canEdit={canEditBill}
                                      canCancel={canCancelBill}
                                      useSoftCancel={useSoftCancel}
                                      deletingId={deletingId}
                                      onEdit={openEdit}
                                      onCancel={handleCancelBill}
                                    />
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div
                    key={`bill-cards-${billPagination.page}`}
                    className="admin-list-scrollbar max-h-[min(74vh,880px)] space-y-3 overflow-y-auto p-3 xl:hidden"
                  >
                    {loading ? (
                      <p className="py-8 text-center text-sm text-slate-500">Đang tải danh sách...</p>
                    ) : filteredBills.length === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-500">
                        Không có hóa đơn nào trong khoảng này.
                      </p>
                    ) : (
                      billPagination.items.map((bill) => {
                        const created = getTimestampDate(bill);
                        const isCancelled = bill.status === "cancelled";

                        return (
                          <article
                            key={bill.id}
                            className={`group relative rounded-md border-b px-3 py-3 transition-colors last:border-b-0 ${
                              isCancelled
                                ? "border-rose-100 hover:bg-rose-50/60"
                                : canEditBill
                                  ? "border-slate-200 hover:bg-emerald-50/60"
                                  : "border-slate-200"
                            }`}
                          >
                            {canEditBill && !isCancelled && (
                              <button
                                type="button"
                                className="absolute inset-0 z-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                                onClick={() => openEdit(bill)}
                                aria-label={`Chỉnh sửa hóa đơn ${bill.id}`}
                              />
                            )}
                            <div className="pointer-events-none relative z-10 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-mono text-xs font-semibold text-slate-900">
                                  {bill.id}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {created ? created.toLocaleString("vi-VN") : "Chưa có"}
                                </p>
                              </div>
                              {isCancelled ? (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                  Đã hủy
                                </span>
                              ) : (
                                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                                  Hợp lệ
                                </span>
                              )}
                            </div>
                            {bill.orderSource === "bar" ? (
                              <span className="pointer-events-none relative z-10 mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                Pha chế tạo
                              </span>
                            ) : null}
                            <dl className="pointer-events-none relative z-10 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                              <div>
                                <dt className="text-xs text-slate-500">Bàn</dt>
                                <dd className="mt-0.5 font-semibold text-slate-900">
                                  {bill.tableNumber || "Không rõ"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs text-slate-500">Thanh toán</dt>
                                <dd className="mt-0.5 text-slate-700">{getPaymentMethodLabel(bill)}</dd>
                              </div>
                            </dl>
                            <div className="pointer-events-none relative z-10 mt-3 flex items-center justify-between gap-3">
                              <p className="text-base font-bold tabular-nums text-slate-900">
                                {formatCurrency(bill.total)} VND
                              </p>
                              <div className="pointer-events-auto">
                                <BillActionButtons
                                  bill={bill}
                                  canEdit={canEditBill}
                                  canCancel={canCancelBill}
                                  useSoftCancel={useSoftCancel}
                                  deletingId={deletingId}
                                  onEdit={openEdit}
                                  onCancel={handleCancelBill}
                                />
                              </div>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                  <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                      <span aria-live="polite">
                        {filteredBills.length > 0
                          ? `Hiển thị ${billPagination.from}-${billPagination.to} trên ${filteredBills.length} hóa đơn`
                          : "Không có hóa đơn"}
                      </span>
                      <label className="inline-flex items-center gap-2">
                        <span>Số dòng</span>
                        <select
                          value={billPageSize}
                          onChange={(event) => setBillPageSize(Number(event.target.value))}
                          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
                          aria-label="Số hóa đơn mỗi trang"
                        >
                          {BILL_PAGE_SIZES.map((pageSize) => (
                            <option key={pageSize} value={pageSize}>
                              {pageSize}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <nav
                      aria-label="Phân trang danh sách hóa đơn"
                      className="flex items-center justify-between gap-2 sm:justify-end"
                    >
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 sm:h-9 sm:w-9"
                        onClick={() => setBillPage(billPagination.page - 1)}
                        disabled={billPagination.page <= 1}
                        title="Trang trước"
                        aria-label="Trang hóa đơn trước"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <span className="min-w-24 text-center text-sm font-medium tabular-nums text-slate-700">
                        Trang {billPagination.page}/{billPagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 sm:h-9 sm:w-9"
                        onClick={() => setBillPage(billPagination.page + 1)}
                        disabled={billPagination.page >= billPagination.totalPages}
                        title="Trang sau"
                        aria-label="Trang hóa đơn sau"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </nav>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="flex flex-col gap-3 space-y-0 xl:flex-row xl:items-center xl:justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <HandCoins className="h-5 w-5 text-emerald-700" />
                    {voucherVisibility === "cancelled" ? "Phiếu thu/chi đã hủy" : "Phiếu thu/chi"} ({filteredVouchers.length})
                  </CardTitle>
                  <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
                    <div className="relative min-w-0 sm:w-64">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        value={voucherSearch}
                        onChange={(event) => setVoucherSearch(event.target.value)}
                        placeholder="Tìm mã phiếu, nội dung, người"
                        className="h-9 pl-9"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                      <Button
                        variant="outline"
                        size="sm"
                        className={SORT_DIRECTION_CLASS}
                        onClick={handleExportVouchers}
                        disabled={loading || exporting !== null || filteredVouchers.length === 0}
                        title="Xuất toàn bộ phiếu thu chi đang lọc ra Excel"
                      >
                        {exporting === "vouchers" ? <Loader2 className="h-4 w-4 animate-spin text-emerald-700" aria-hidden="true" /> : <Download className="h-4 w-4 text-emerald-700" aria-hidden="true" />}
                        {exporting === "vouchers" ? "Đang xuất..." : "Xuất Excel"}
                      </Button>
                      <SelectBox<VoucherSortKey>
                        value={voucherSortKey}
                        options={VOUCHER_SORT_OPTIONS}
                        onValueChange={setVoucherSortKey}
                        ariaLabel="Sắp xếp phiếu thu chi theo"
                        className="min-w-0 flex-1 sm:w-40 sm:flex-none"
                        triggerClassName={SORT_TRIGGER_CLASS}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className={SORT_DIRECTION_CLASS}
                        onClick={() =>
                          setVoucherSortDirection((current) =>
                            current === "asc" ? "desc" : "asc"
                          )
                        }
                        title={voucherSortDirection === "asc" ? "Tăng dần" : "Giảm dần"}
                      >
                        {voucherSortDirection === "asc" ? (
                          <ArrowUp className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                        )}
                        {voucherSortDirection === "asc" ? "Tăng" : "Giảm"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="admin-list-scrollbar hidden max-h-[min(74vh,880px)] overflow-auto xl:block">
                    <table className="min-w-[1080px] w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 shadow-sm">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Mã phiếu</th>
                          <th className="px-4 py-3 text-left font-semibold">Thời gian</th>
                          <th className="px-4 py-3 text-left font-semibold">Loại</th>
                          <th className="px-4 py-3 text-left font-semibold">Nội dung</th>
                          <th className="px-4 py-3 text-left font-semibold">Người nộp/nhận</th>
                          <th className="px-4 py-3 text-center font-semibold">Dòng tiền</th>
                          <th className="px-4 py-3 text-right font-semibold">Giá trị</th>
                          <th className="px-4 py-3 text-center font-semibold">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {loading ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center">
                              Đang tải danh sách phiếu...
                            </td>
                          </tr>
                        ) : filteredVouchers.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                              Chưa có phiếu thu/chi trong khoảng này.
                            </td>
                          </tr>
                        ) : (
                          filteredVouchers.map((voucher) => {
                            const happenedAt = getVoucherDate(voucher);
                            const isIncome = voucher.type === "income";
                            return (
                              <tr key={voucher.id} className={voucher.isCancelled ? "bg-slate-50 text-slate-400" : "hover:bg-slate-50"}>
                                <td className="px-4 py-3 font-mono text-xs">
                                  {voucher.code || voucher.id}
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  {happenedAt
                                    ? happenedAt.toLocaleString("vi-VN")
                                    : "Chưa có"}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                                      isIncome
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-rose-100 text-rose-700"
                                    }`}
                                  >
                                    {isIncome ? (
                                      <ArrowUpRight className="h-3.5 w-3.5" />
                                    ) : (
                                      <ArrowDownLeft className="h-3.5 w-3.5" />
                                    )}
                                    {isIncome ? "Phiếu thu" : "Phiếu chi"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  <p className="font-semibold text-slate-900">
                                    {voucher.category || "Không rõ"}
                                  </p>
                                  {voucher.isCancelled ? (
                                    <p className="mt-1 text-xs font-semibold text-rose-700" title={voucher.cancellationReason}>
                                      Đã hủy · {voucher.cancellationReason || "Không có lý do"}
                                    </p>
                                  ) : null}
                                  {voucher.note ? (
                                    <p className="text-xs text-slate-500">{voucher.note}</p>
                                  ) : null}
                                  {voucher.evidence ? <button type="button" onClick={() => setPreviewingVoucher(voucher)} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900"><Images className="h-3.5 w-3.5" /> Minh chứng {voucher.evidence.receiptCode} · {voucher.evidence.images.length} ảnh</button> : null}
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  <p>{voucher.personName || "Khách lẻ"}</p>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {voucher.includeInCashFlow !== false ? (
                                    <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">
                                      Có
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                      Không
                                    </span>
                                  )}
                                </td>
                                <td
                                  className={`px-4 py-3 text-right font-semibold ${
                                    isIncome ? "text-emerald-700" : "text-rose-700"
                                  }`}
                                >
                                  {isIncome ? "+" : "-"}
                                  {formatCurrency(voucher.amount || 0)} VND
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {!voucher.isCancelled ? <div className="flex items-center justify-center gap-2">
                                    <Button variant="outline" size="icon" className="h-9 w-9 text-sky-800 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700" onClick={() => openEditVoucher(voucher)} title={`Sửa phiếu ${voucher.code || voucher.id}`} aria-label={`Sửa phiếu ${voucher.code || voucher.id}`}>
                                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                                    </Button>
                                    {canCancelVoucher ? <Button variant="outline" size="icon" className="h-9 w-9 text-rose-700 hover:border-rose-400 hover:bg-rose-50" onClick={() => void handleCancelVoucher(voucher)} disabled={cancellingVoucherId === voucher.id} title={`Hủy phiếu ${voucher.code || voucher.id}`} aria-label={`Hủy phiếu ${voucher.code || voucher.id}`}>
                                      {cancellingVoucherId === voucher.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </Button> : null}
                                  </div> : <span className="text-xs font-semibold text-rose-700">Đã hủy</span>}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="admin-list-scrollbar max-h-[min(74vh,880px)] space-y-3 overflow-y-auto p-3 xl:hidden">
                    {loading ? (
                      <p className="py-8 text-center text-sm text-slate-500">
                        Đang tải danh sách phiếu...
                      </p>
                    ) : filteredVouchers.length === 0 ? (
                      <p className="py-8 text-center text-sm text-slate-500">
                        Chưa có phiếu thu/chi trong khoảng này.
                      </p>
                    ) : (
                      filteredVouchers.map((voucher) => {
                        const happenedAt = getVoucherDate(voucher);
                        const isIncome = voucher.type === "income";

                        return (
                          <article key={voucher.id} className="border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-mono text-xs font-semibold text-slate-900">
                                  {voucher.code || voucher.id}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {happenedAt ? happenedAt.toLocaleString("vi-VN") : "Chưa có"}
                                </p>
                              </div>
                              <span
                                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                                  isIncome
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {isIncome ? (
                                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                                ) : (
                                  <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                                {isIncome ? "Phiếu thu" : "Phiếu chi"}
                              </span>
                            </div>
                            <dl className="mt-3 space-y-2 text-sm">
                              <div className="flex items-start justify-between gap-3">
                                <dt className="text-slate-500">Nội dung</dt>
                                <dd className="max-w-[65%] text-right font-semibold text-slate-900">
                                  {voucher.category || "Không rõ"}
                                  {voucher.isCancelled ? (
                                    <span className="mt-1 block text-xs font-semibold text-rose-700">Đã hủy · {voucher.cancellationReason || "Không có lý do"}</span>
                                  ) : null}
                                  {voucher.note ? (
                                    <span className="mt-0.5 block text-xs font-normal text-slate-500">
                                      {voucher.note}
                                    </span>
                                  ) : null}
                                  {voucher.evidence ? <button type="button" onClick={() => setPreviewingVoucher(voucher)} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Images className="h-3.5 w-3.5" /> Minh chứng {voucher.evidence.receiptCode}</button> : null}
                                </dd>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <dt className="text-slate-500">Người nộp/nhận</dt>
                                <dd className="text-right text-slate-700">{voucher.personName || "Khách lẻ"}</dd>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <dt className="text-slate-500">Dòng tiền</dt>
                                <dd>
                                  {voucher.includeInCashFlow !== false ? (
                                    <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">
                                      Có
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                      Không
                                    </span>
                                  )}
                                </dd>
                              </div>
                            </dl>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <p className={`text-base font-bold tabular-nums ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>
                                {isIncome ? "+" : "-"}
                                {formatCurrency(voucher.amount || 0)} VND
                              </p>
                              {!voucher.isCancelled ? <div className="flex gap-2">
                                <Button variant="outline" size="icon" className="h-11 w-11 text-sky-800 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700" onClick={() => openEditVoucher(voucher)} title={`Sửa phiếu ${voucher.code || voucher.id}`} aria-label={`Sửa phiếu ${voucher.code || voucher.id}`}>
                                  <Edit3 className="h-4 w-4" aria-hidden="true" />
                                </Button>
                                {canCancelVoucher ? <Button variant="outline" size="icon" className="h-11 w-11 text-rose-700 hover:border-rose-400 hover:bg-rose-50" onClick={() => void handleCancelVoucher(voucher)} disabled={cancellingVoucherId === voucher.id} title={`Hủy phiếu ${voucher.code || voucher.id}`} aria-label={`Hủy phiếu ${voucher.code || voucher.id}`}>
                                  {cancellingVoucherId === voucher.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button> : null}
                              </div> : null}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {canEditBill && editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <p className="text-sm text-slate-500">Cập nhật hóa đơn</p>
                  <h3 className="text-lg font-semibold text-slate-900">{editing.id}</h3>
                </div>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Đóng
                </Button>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div className="grid grid-cols-1 gap-3">
                  {!canEditBillDetails && (
                    <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                      Thu ngân chỉ được thay đổi phương thức thanh toán của hóa đơn.
                    </div>
                  )}
                  {canEditBillDetails && (
                    <>
                  <Input
                    label="Bàn"
                    value={editForm.tableNumber}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        tableNumber: e.target.value,
                      }))
                    }
                    placeholder="Số bàn hoặc takeaway"
                  />
                  <Input
                    label="Tổng tiền (VND)"
                    type="number"
                    value={editForm.total}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        total: e.target.value,
                      }))
                    }
                  />
                  <Input
                    label="Ghi chú"
                    value={editForm.note}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, note: e.target.value }))
                    }
                    placeholder="Thêm ghi chú nếu cần"
                  />
                    </>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Phương thức thanh toán
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((prev) => ({ ...prev, paymentMethod: "cash" }))
                        }
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                          editForm.paymentMethod === "cash"
                            ? "border-sky-500 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-sky-200"
                        }`}
                      >
                        Tiền mặt
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditForm((prev) => ({
                            ...prev,
                            paymentMethod: "transfer",
                          }))
                        }
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                          editForm.paymentMethod === "transfer"
                            ? "border-sky-500 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-sky-200"
                        }`}
                      >
                        Chuyển khoản
                      </button>
                    </div>
                  </div>
                </div>

                {canEditBillDetails && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Ngày tạo"
                    type="date"
                    value={editForm.date}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, date: e.target.value }))
                    }
                  />
                  <Input
                    label="Giờ"
                    type="time"
                    value={editForm.time}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, time: e.target.value }))
                    }
                  />
                </div>
                )}

                {editing.items?.length ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-slate-600">
                      <Clock3 className="h-4 w-4" />
                      Món trong bill ({editing.items.length})
                    </div>
                    <div className="max-h-40 space-y-2 overflow-auto text-sm text-slate-700">
                      {editing.items.map((item, idx) => (
                        <div
                          key={`${item.menuId}-${idx}`}
                          className="flex justify-between gap-2 rounded-md bg-white px-3 py-2 shadow-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{item.name}</p>
                            {item.note?.trim() ? (
                              <p className="text-[11px] text-slate-500">{item.note.trim()}</p>
                            ) : null}
                            <p className="text-xs text-slate-500">
                              {item.quantity} x {formatCurrency(item.price)} VND
                            </p>
                          </div>
                          <div className="text-right font-semibold text-slate-900">
                            {formatCurrency(item.lineTotal || item.price * item.quantity)} VND
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Hủy
                </Button>
                <Button
                  className="gap-2 bg-sky-600 hover:bg-sky-700"
                  onClick={handleSaveEdit}
                  isLoading={saving}
                >
                  <Edit3 className="h-4 w-4" />
                  Lưu thay đổi
                </Button>
              </div>
            </div>
          </div>
        )}

        {previewingVoucher?.evidence && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
                <div><p className="text-sm text-slate-500">Minh chứng của {previewingVoucher.code}</p><h3 className="text-lg font-bold text-slate-900">{previewingVoucher.evidence.receiptCode} · {previewingVoucher.evidence.images.length} ảnh</h3></div>
                <Button variant="ghost" onClick={() => setPreviewingVoucher(null)}>Đóng</Button>
              </div>
              <div className="grid gap-3 border-b bg-slate-50 px-5 py-3 text-sm sm:grid-cols-3"><div><span className="text-slate-500">Ngày nhập</span><strong className="block">{previewingVoucher.evidence.receiptDate ? new Date(`${previewingVoucher.evidence.receiptDate}T12:00:00`).toLocaleDateString("vi-VN") : "—"}</strong></div><div><span className="text-slate-500">Nhà cung cấp</span><strong className="block">{previewingVoucher.evidence.supplierName || "Chưa nhập"}</strong></div><div><span className="text-slate-500">Giá trị phiếu nhập</span><strong className="block text-emerald-800">{formatCurrency(previewingVoucher.evidence.totalAmount)} VND</strong></div></div>
              <div className="grid gap-4 p-5 sm:grid-cols-2">{previewingVoucher.evidence.images.map((image) => <figure key={image.id} className="overflow-hidden rounded-lg border bg-slate-50"><PrivateApiImage src={image.url} alt={`Minh chứng ${previewingVoucher.evidence?.receiptCode}`} className="max-h-[560px] w-full object-contain" />{(image.capturedAt || image.locationAddress) && <figcaption className="border-t p-3 text-xs text-slate-600">{image.capturedAt ? new Date(image.capturedAt).toLocaleString("vi-VN") : ""}{image.locationAddress ? ` · ${image.locationAddress}` : ""}</figcaption>}</figure>)}</div>
            </div>
          </div>
        )}

        {showVoucherModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <p className="text-sm text-slate-500">Phiếu tiền mặt</p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {showVoucherModal === "income"
                      ? "Lập phiếu thu (tiền mặt)"
                      : "Lập phiếu chi (tiền mặt)"}
                  </h3>
                </div>
                <Button variant="ghost" onClick={() => setShowVoucherModal(null)}>
                  Đóng
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
                <Input
                  type="datetime-local"
                  label="Thời gian"
                  value={voucherForm.happenedAt}
                  onChange={(e) =>
                    setVoucherForm((prev) => ({ ...prev, happenedAt: e.target.value }))
                  }
                />
                <Input
                  label={showVoucherModal === "income" ? "Loại thu *" : "Loại chi *"}
                  list={`voucher-category-${showVoucherModal}`}
                  value={voucherForm.category}
                  onChange={(e) =>
                    setVoucherForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                  placeholder={
                    showVoucherModal === "income"
                      ? "Ví dụ: Thu tiền khách trả"
                      : "Ví dụ: Chi mua nguyên liệu"
                  }
                />
                <datalist id={`voucher-category-${showVoucherModal}`}>
                  {voucherCategories
                    .filter((category) => category.type === showVoucherModal)
                    .map((category) => (
                      <option key={category.id} value={category.name} />
                    ))}
                </datalist>
                <Input
                  label="Giá trị *"
                  value={formatMoneyInput(voucherForm.amount)}
                  onChange={(e) =>
                    setVoucherForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  placeholder="Nhập số tiền"
                />
                <Input
                  label={showVoucherModal === "income" ? "Tên người nộp" : "Tên người nhận"}
                  value={voucherForm.personName}
                  onChange={(e) =>
                    setVoucherForm((prev) => ({ ...prev, personName: e.target.value }))
                  }
                  placeholder={
                    showVoucherModal === "income"
                      ? "Ví dụ: Khách lẻ"
                      : "Ví dụ: Nhà cung cấp A"
                  }
                />
                <div className="space-y-1">
                  <label className="text-sm font-medium leading-none">Ghi chú</label>
                  <textarea
                    value={voucherForm.note}
                    onChange={(e) =>
                      setVoucherForm((prev) => ({ ...prev, note: e.target.value }))
                    }
                    rows={2}
                    placeholder="Ghi chú thêm nếu cần"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                {showVoucherEvidencePicker && showVoucherModal === "expense" && <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-semibold text-slate-800">Minh chứng nhập hàng</label>
                    <span className="text-xs text-slate-500">Chọn bộ ảnh nhân viên vừa chụp</span>
                  </div>
                  {loadingVoucherEvidences ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">Đang tải ảnh nhập hàng...</div> : voucherEvidenceOptions.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">Không có bộ ảnh nhập hàng chưa liên kết.</div> : <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <button type="button" onClick={() => selectVoucherEvidence("")} className={`w-full rounded-md border p-3 text-left text-sm ${voucherForm.inventoryReceiptId === "" ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-900" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"}`}>Không gắn minh chứng</button>
                    {voucherEvidenceOptions.map((evidence) => <button key={evidence.receiptId} type="button" onClick={() => selectVoucherEvidence(evidence.receiptId)} className={`grid w-full grid-cols-[64px_1fr_auto] items-center gap-3 rounded-md border p-2 text-left transition-colors ${voucherForm.inventoryReceiptId === evidence.receiptId ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
                      <div className="h-14 w-16 overflow-hidden rounded-md bg-slate-200">{evidence.images[0] ? <PrivateApiImage src={evidence.images[0].thumbnailUrl} alt="Ảnh nhập hàng" className="h-full w-full object-cover" /> : <Images className="m-4 h-6 w-6 text-slate-400" />}</div>
                      <div className="min-w-0"><p className="font-bold text-slate-900">{evidence.receiptCode}</p><p className="truncate text-xs text-slate-600">{evidence.supplierName || "Chưa nhập nhà cung cấp"} · {evidence.imageCount} ảnh</p><p className="text-xs font-medium text-amber-700">{evidence.status === "pending_explanation" ? "Chưa giải trình" : "Đã nhập thông tin"}{evidence.storeName ? ` · ${evidence.storeName}` : ""}</p><p className="text-xs text-slate-500">{new Date(`${evidence.receiptDate}T12:00:00`).toLocaleDateString("vi-VN")}</p></div>
                      <strong className="text-right text-sm text-emerald-800">{formatCurrency(evidence.totalAmount)} VND</strong>
                    </button>)}
                  </div>}
                  {selectedVoucherEvidence && <div className="flex gap-2 overflow-x-auto rounded-lg border border-emerald-200 bg-emerald-50 p-2">{selectedVoucherEvidence.images.map((image) => <PrivateApiImage key={image.id} src={image.thumbnailUrl} alt="Minh chứng nhập hàng đã chọn" className="h-16 w-20 shrink-0 rounded-md object-cover" />)}</div>}
                </div>}
              </div>

              <div className="px-5 pb-4">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    checked={voucherForm.includeInCashFlow}
                    onChange={(e) =>
                      setVoucherForm((prev) => ({
                        ...prev,
                        includeInCashFlow: e.target.checked,
                      }))
                    }
                  />
                  Hạch toán vào dòng tiền trong ngày
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
                <Button variant="outline" onClick={() => setShowVoucherModal(null)}>
                  Bỏ qua
                </Button>
                <Button
                  className={`gap-2 ${
                    showVoucherModal === "income"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                  onClick={handleSaveVoucher}
                  isLoading={savingVoucher}
                >
                  <HandCoins className="h-4 w-4" />
                  Lưu phiếu
                </Button>
              </div>
            </div>
          </div>
        )}

        {editingVoucher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <p className="text-sm text-slate-500">Cập nhật phiếu thu/chi</p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {editingVoucher.code || editingVoucher.id}
                  </h3>
                </div>
                <Button variant="ghost" onClick={() => setEditingVoucher(null)}>
                  Đóng
                </Button>
              </div>

              <div className="space-y-4 px-5 py-4">
                <Input
                  label="Tên phiếu"
                  value={voucherEditForm.category}
                  onChange={(e) =>
                    setVoucherEditForm((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  placeholder="Nhập tên phiếu"
                />
                {canEditVoucherAmount ? <Input
                  label="Giá trị (VND)"
                  value={formatMoneyInput(voucherEditForm.amount)}
                  onChange={(e) =>
                    setVoucherEditForm((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  placeholder="Nhập giá trị"
                /> : <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Giá trị phiếu được khóa đối với thu ngân: <strong>{formatCurrency(editingVoucher.amount)} VND</strong>
                </div>}
                {editingVoucher.type === "expense" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-semibold text-slate-800">Minh chứng nhập hàng</label>
                      <span className="text-xs text-slate-500">Gắn hoặc thay bộ ảnh</span>
                    </div>
                    {loadingVoucherEvidences ? (
                      <div className="rounded-lg border bg-slate-50 p-4 text-center text-sm text-slate-500">Đang tải ảnh nhập hàng...</div>
                    ) : voucherEvidenceOptions.length === 0 ? (
                      <div className="rounded-lg border border-dashed bg-slate-50 p-4 text-center text-sm text-slate-500">Không có bộ ảnh nhập hàng chưa liên kết.</div>
                    ) : (
                      <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border bg-slate-50 p-2">
                        <button type="button" onClick={() => setVoucherEditForm((current) => ({ ...current, inventoryReceiptId: "" }))} className={`w-full rounded-md border p-3 text-left text-sm ${voucherEditForm.inventoryReceiptId === "" ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-900" : "border-slate-200 bg-white text-slate-600"}`}>Không gắn minh chứng</button>
                        {voucherEvidenceOptions.map((evidence) => (
                          <button key={evidence.receiptId} type="button" onClick={() => setVoucherEditForm((current) => ({ ...current, inventoryReceiptId: evidence.receiptId }))} className={`grid w-full grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border p-2 text-left ${voucherEditForm.inventoryReceiptId === evidence.receiptId ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
                            <div className="h-14 w-16 overflow-hidden rounded bg-slate-200">{evidence.images[0] ? <PrivateApiImage src={evidence.images[0].thumbnailUrl} alt="Ảnh nhập hàng" className="h-full w-full object-cover" /> : <Images className="m-4 h-6 w-6 text-slate-400" />}</div>
                            <div className="min-w-0"><p className="font-bold text-slate-900">{evidence.receiptCode}</p><p className="truncate text-xs text-slate-600">{evidence.supplierName || "Chưa nhập nhà cung cấp"} · {evidence.imageCount} ảnh</p><p className="text-xs font-medium text-amber-700">{evidence.status === "pending_explanation" ? "Chưa giải trình" : "Đã nhập thông tin"}{evidence.storeName ? ` · ${evidence.storeName}` : ""}</p><p className="text-xs text-slate-500">{evidence.receiptDate ? new Date(`${evidence.receiptDate}T12:00:00`).toLocaleDateString("vi-VN") : ""}</p></div>
                            <strong className="text-right text-sm text-emerald-800">{formatCurrency(evidence.totalAmount)} VND</strong>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
                <Button variant="outline" onClick={() => setEditingVoucher(null)}>
                  Hủy
                </Button>
                <Button
                  className="gap-2 bg-sky-600 hover:bg-sky-700"
                  onClick={handleSaveEditVoucher}
                  isLoading={savingVoucherEdit}
                >
                  <Edit3 className="h-4 w-4" />
                  Lưu thay đổi
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </RoleGuard>
  );
}
