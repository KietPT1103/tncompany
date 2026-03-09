"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  CashVoucherType,
  createCashVoucher,
  getCashVouchers,
  updateCashVoucherBasic,
} from "@/services/cashVoucherService";
import { getOpenShiftByCashier } from "@/services/shiftService";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarRange,
  Clock3,
  Edit3,
  Filter,
  HandCoins,
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
  personGroup: string;
  personName: string;
  note: string;
  includeInCashFlow: boolean;
};

type VoucherEditFormState = {
  category: string;
  amount: string;
};

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

export default function BillsPage() {
  const { role, user } = useAuth();
  const { storeId } = useStore();

  const isFarmStore = storeId === "farm";
  const canEditBill = role === "admin" || role === "user";
  const canCancelBill = role === "admin" || (role === "user" && isFarmStore);
  const useSoftCancel = !isFarmStore;

  const todayInput = formatDateInput(new Date());

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
  const [showVoucherModal, setShowVoucherModal] = useState<CashVoucherType | null>(
    null
  );
  const [voucherForm, setVoucherForm] = useState<VoucherFormState>({
    happenedAt: formatDateTimeInput(new Date()),
    category: "",
    amount: "",
    personGroup: "Khác",
    personName: "",
    note: "",
    includeInCashFlow: true,
  });
  const [savingVoucher, setSavingVoucher] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<CashVoucher | null>(null);
  const [voucherEditForm, setVoucherEditForm] = useState<VoucherEditFormState>({
    category: "",
    amount: "",
  });
  const [savingVoucherEdit, setSavingVoucherEdit] = useState(false);

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
      personGroup: "Khác",
      personName: "",
      note: "",
      includeInCashFlow: true,
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { start, end } = getRange();
      const [billData, voucherData] = await Promise.all([
        getBills({
          startDate: start,
          endDate: end,
          storeId,
          includeCancelled: true,
          limitCount: 2000,
        }),
        getCashVouchers({
          startDate: start,
          endDate: end,
          storeId,
          limitCount: 2000,
        }),
      ]);
      setBills(billData);
      setVouchers(voucherData);
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
  }, [startDate, endDate, storeId]);

  const filteredBills = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return bills;
    return bills.filter((bill) => {
      const tableMatch = bill.tableNumber?.toLowerCase().includes(keyword);
      const idMatch = bill.id.toLowerCase().includes(keyword);
      const noteMatch = bill.note?.toLowerCase().includes(keyword);
      return tableMatch || idMatch || noteMatch;
    });
  }, [bills, search]);

  const activeBills = useMemo(
    () => filteredBills.filter((bill) => bill.status !== "cancelled"),
    [filteredBills]
  );

  const totalAmount = activeBills.reduce((sum, bill) => sum + bill.total, 0);
  const filteredVouchers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return vouchers;
    return vouchers.filter((voucher) => {
      const codeMatch = voucher.code?.toLowerCase().includes(keyword);
      const categoryMatch = voucher.category?.toLowerCase().includes(keyword);
      const personMatch = voucher.personName?.toLowerCase().includes(keyword);
      const noteMatch = voucher.note?.toLowerCase().includes(keyword);
      return codeMatch || categoryMatch || personMatch || noteMatch;
    });
  }, [vouchers, search]);

  const totalIncomeVouchers = filteredVouchers
    .filter((voucher) => voucher.includeInCashFlow !== false && voucher.type === "income")
    .reduce((sum, voucher) => sum + (voucher.amount || 0), 0);
  const totalExpenseVouchers = filteredVouchers
    .filter((voucher) => voucher.includeInCashFlow !== false && voucher.type === "expense")
    .reduce((sum, voucher) => sum + (voucher.amount || 0), 0);
  const netDailyCashFlow = totalAmount + totalIncomeVouchers - totalExpenseVouchers;

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
        personGroup: voucherForm.personGroup,
        personName: voucherForm.personName,
        note: voucherForm.note,
        includeInCashFlow: voucherForm.includeInCashFlow,
        happenedAt: voucherForm.happenedAt
          ? new Date(voucherForm.happenedAt)
          : new Date(),
        shiftId: maybeShift?.id,
        cashierId: user?.uid,
        cashierName: defaultCashierName,
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
    setEditingVoucher(voucher);
    setVoucherEditForm({
      category: voucher.category || "",
      amount: String(voucher.amount || 0),
    });
  };

  const handleSaveEditVoucher = async () => {
    if (!editingVoucher) return;
    const amount = parseMoney(voucherEditForm.amount);
    const category = voucherEditForm.category.trim();

    if (!category) {
      alert("Vui lòng nhập tên phiếu.");
      return;
    }
    if (amount <= 0) {
      alert("Giá trị phiếu phải lớn hơn 0.");
      return;
    }

    setSavingVoucherEdit(true);
    try {
      await updateCashVoucherBasic(editingVoucher.id, {
        category,
        amount,
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

  const resetToday = () => {
    const today = formatDateInput(new Date());
    setStartDate(today);
    setEndDate(today);
  };

  return (
    <RoleGuard allowedRoles={["admin", "user"]}>
      <main className="min-h-screen bg-slate-50 p-6 md:p-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-100"
                title="Trang chủ"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-700">
                  <ReceiptText className="h-4 w-4" />
                  Quản lý hóa đơn
                </p>
                <h1 className="text-2xl font-bold text-slate-900">Danh sách hóa đơn</h1>
                <p className="text-sm text-slate-500">
                  Mặc định lọc trong ngày để xem tổng thu nhanh.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => resetVoucherForm("income")}
              >
                <Plus className="h-4 w-4" />
                Lập phiếu thu
              </Button>
              <Button
                className="gap-2 bg-rose-600 hover:bg-rose-700"
                onClick={() => resetVoucherForm("expense")}
              >
                <Plus className="h-4 w-4" />
                Lập phiếu chi
              </Button>
              <Button variant="outline" className="gap-2" onClick={resetToday}>
                <CalendarRange className="h-4 w-4" />
                Hôm nay
              </Button>
              <Button className="gap-2" onClick={loadData} isLoading={loading}>
                <RefreshCcw className="h-4 w-4" />
                Tải lại
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                    <Filter className="h-5 w-5 text-sky-600" />
                    Lọc
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Tìm theo bàn / mã
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Nhập mã bill, bàn hoặc ghi chú"
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <Input
                      type="date"
                      label="Từ ngày"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <Input
                      type="date"
                      label="Đến ngày"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Tổng quan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-emerald-700">
                        Tổng thu (không tính bill hủy)
                      </p>
                      <p className="text-xl font-bold text-emerald-800">
                        {formatCurrency(totalAmount)} VND
                      </p>
                    </div>
                    <ReceiptText className="h-6 w-6 text-emerald-600" />
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
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-600">
                    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500">Số bill hợp lệ</p>
                      <p className="text-lg font-bold text-slate-900">{activeBills.length}</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500">Bill đã hủy</p>
                      <p className="text-lg font-bold text-rose-700">
                        {filteredBills.filter((bill) => bill.status === "cancelled").length}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500">Phiếu thu/chi</p>
                      <p className="text-lg font-bold text-slate-900">{filteredVouchers.length}</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm">
                      <p className="text-xs font-semibold text-slate-500">Tính vào dòng tiền</p>
                      <p className="text-lg font-bold text-slate-900">
                        {
                          filteredVouchers.filter(
                            (voucher) => voucher.includeInCashFlow !== false
                          ).length
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ReceiptText className="h-5 w-5 text-sky-700" />
                    Danh sách hóa đơn ({filteredBills.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Mã</th>
                          <th className="px-4 py-3 text-left font-semibold">Thời gian</th>
                          <th className="px-4 py-3 text-left font-semibold">Bàn</th>
                          <th className="px-4 py-3 text-left font-semibold">Thanh toán</th>
                          <th className="px-4 py-3 text-right font-semibold">Tổng tiền</th>
                          <th className="px-4 py-3 text-center font-semibold">Trạng thái</th>
                          {(canEditBill || canCancelBill) && (
                            <th className="px-4 py-3 text-center font-semibold">Hành động</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {loading ? (
                          <tr>
                            <td
                              colSpan={(canEditBill || canCancelBill) ? 7 : 6}
                              className="px-4 py-8 text-center"
                            >
                              Đang tải danh sách...
                            </td>
                          </tr>
                        ) : filteredBills.length === 0 ? (
                          <tr>
                            <td
                              colSpan={(canEditBill || canCancelBill) ? 7 : 6}
                              className="px-4 py-8 text-center text-slate-500"
                            >
                              Không có hóa đơn nào trong khoảng này.
                            </td>
                          </tr>
                        ) : (
                          filteredBills.map((bill) => {
                            const created = getTimestampDate(bill);
                            const isCancelled = bill.status === "cancelled";

                            return (
                              <tr
                                key={bill.id}
                                className={
                                  isCancelled
                                    ? "bg-rose-50/30 text-slate-500"
                                    : "hover:bg-slate-50"
                                }
                              >
                                <td className="px-4 py-3 font-mono text-xs">{bill.id}</td>
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
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      {canEditBill && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="gap-1"
                                          onClick={() => openEdit(bill)}
                                        >
                                          <Edit3 className="h-4 w-4" />
                                          Sửa
                                        </Button>
                                      )}
                                      {canCancelBill && !isCancelled && (
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          className="gap-1"
                                          onClick={() => handleCancelBill(bill)}
                                          isLoading={deletingId === bill.id}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          {useSoftCancel ? "Hủy" : "Xóa"}
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <HandCoins className="h-5 w-5 text-emerald-700" />
                    Phiếu thu/chi ({filteredVouchers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 text-slate-600">
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
                              <tr key={voucher.id} className="hover:bg-slate-50">
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
                                  {voucher.note ? (
                                    <p className="text-xs text-slate-500">{voucher.note}</p>
                                  ) : null}
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  <p>{voucher.personName || "Khách lẻ"}</p>
                                  <p className="text-xs text-slate-500">
                                    {voucher.personGroup || "Khác"}
                                  </p>
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
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1"
                                    onClick={() => openEditVoucher(voucher)}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                    Sửa
                                  </Button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
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

        {showVoucherModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
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
                <Input
                  label="Giá trị *"
                  value={formatMoneyInput(voucherForm.amount)}
                  onChange={(e) =>
                    setVoucherForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  placeholder="Nhập số tiền"
                />
                <div className="space-y-1">
                  <label className="text-sm font-medium leading-none">Nhóm người</label>
                  <select
                    value={voucherForm.personGroup}
                    onChange={(e) =>
                      setVoucherForm((prev) => ({ ...prev, personGroup: e.target.value }))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="Khách hàng">Khách hàng</option>
                    <option value="Nhân viên">Nhân viên</option>
                    <option value="Nhà cung cấp">Nhà cung cấp</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
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
            <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
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
                <Input
                  label="Giá trị (VND)"
                  value={formatMoneyInput(voucherEditForm.amount)}
                  onChange={(e) =>
                    setVoucherEditForm((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  placeholder="Nhập giá trị"
                />
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
