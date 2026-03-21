"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createPayroll,
  deletePayroll,
  getPayrolls,
  Payroll,
  updatePayroll,
} from "@/services/payrolls.firebase";
import { getEmployees } from "@/services/employees.firebase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  CheckCircle2,
  Edit2,
  ExternalLink,
  FileSpreadsheet,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { formatTimestampDate } from "./payrollShared";

export default function PayrollManager({
  storeId,
  onSelectPayroll,
}: {
  storeId: string;
  onSelectPayroll: (payrollId: string) => void;
}) {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [newPayrollName, setNewPayrollName] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadPayrolls();
  }, [storeId]);

  async function loadPayrolls() {
    if (!storeId) return;
    setPayrolls(await getPayrolls(storeId));
  }

  async function handleCreate() {
    if (!newPayrollName.trim()) {
      alert("Vui lòng nhập tên bảng lương.");
      return;
    }

    setLoading(true);
    try {
      const employees = await getEmployees(storeId);
      if (employees.length === 0) {
        alert("Chưa có nhân viên nào để tạo bảng lương.");
        return;
      }

      const payrollId = await createPayroll(storeId, newPayrollName.trim(), employees);
      setNewPayrollName("");
      await loadPayrolls();
      onSelectPayroll(payrollId);
    } catch (error) {
      console.error(error);
      alert("Không thể tạo bảng lương.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bạn có chắc muốn xóa bảng lương này?")) return;
    try {
      await deletePayroll(id);
      await loadPayrolls();
    } catch (error) {
      console.error(error);
      alert("Không thể xóa bảng lương.");
    }
  }

  async function handleUpdateName(id: string) {
    if (!editName.trim()) return;
    try {
      await updatePayroll(id, { name: editName.trim() });
      setEditingId(null);
      await loadPayrolls();
    } catch (error) {
      console.error(error);
      alert("Không thể cập nhật tên bảng lương.");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Tạo bảng lương</h2>
            <p className="mt-1 text-sm text-slate-500">
              Mỗi kỳ lương sẽ lấy danh sách nhân sự hiện có để bạn chỉnh riêng.
            </p>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Input
              placeholder="Ví dụ: Tháng 3 - Đợt 2"
              value={newPayrollName}
              onChange={(event) => setNewPayrollName(event.target.value)}
              className="h-11 rounded-2xl border-slate-200 px-4"
            />
            <Button
              onClick={handleCreate}
              isLoading={loading}
              className="h-11 gap-2 rounded-2xl px-5 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              Tạo bảng lương
            </Button>
            <Button
              variant="outline"
              className="h-11 gap-2 rounded-2xl whitespace-nowrap"
              onClick={() => router.push("/timesheet")}
            >
              <ExternalLink className="h-4 w-4" />
              Import chấm công
            </Button>
          </div>
        </div>
      </section>

      {payrolls.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <h4 className="mt-5 text-lg font-semibold text-slate-900">Chưa có bảng lương nào</h4>
          <p className="mt-2 text-sm text-slate-500">
            Tạo kỳ lương đầu tiên để bắt đầu quản lý chấm công và lương nhân sự.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {payrolls.map((payroll) => {
            const isEditing = editingId === payroll.id;
            const isLocked = payroll.status === "locked";

            return (
              <article
                key={payroll.id}
                className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "rounded-2xl p-3",
                        isLocked
                          ? "bg-slate-100 text-slate-600"
                          : "bg-emerald-50 text-emerald-600"
                      )}
                    >
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            className="h-10 flex-1 rounded-2xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                            autoFocus
                          />
                          <Button
                            size="icon"
                            className="h-10 w-10 rounded-2xl"
                            onClick={() => handleUpdateName(payroll.id!)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-2xl"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <h4 className="truncate text-lg font-semibold text-slate-900">
                            {payroll.name}
                          </h4>
                          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                            <CalendarDays className="h-4 w-4" />
                            {formatTimestampDate(payroll.createdAt)}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {!isEditing ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        onClick={() => {
                          setEditingId(payroll.id || null);
                          setEditName(payroll.name);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-2xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => handleDelete(payroll.id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>

                {!isEditing ? (
                  <>
                    <div className="mt-4 flex items-center justify-between">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                          isLocked
                            ? "bg-slate-100 text-slate-600"
                            : "bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {isLocked ? "Đã chốt" : "Đang mở"}
                      </span>
                    </div>

                    <button
                      onClick={() => payroll.id && onSelectPayroll(payroll.id)}
                      className="mt-4 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      Mở chi tiết
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
