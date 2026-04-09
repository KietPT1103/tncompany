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
import {
  CalendarRange,
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
  const [loadError, setLoadError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadPayrolls();
  }, [storeId]);

  async function loadPayrolls() {
    if (!storeId) return;
    try {
      setLoadError("");
      setPayrolls(await getPayrolls(storeId));
    } catch (error) {
      console.error(error);
      setPayrolls([]);
      setLoadError(error instanceof Error ? error.message : "Không tải được danh sách bảng lương.");
    }
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
      setLoadError("");
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

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <Input
              placeholder="Ví dụ: Tháng 3 - Đợt 2"
              value={newPayrollName}
              onChange={(event) => setNewPayrollName(event.target.value)}
              className="h-11 rounded-2xl border-slate-200 px-4"
            />
            <Button onClick={handleCreate} isLoading={loading} className="h-11 gap-2 rounded-2xl px-5 whitespace-nowrap">
              <Plus className="h-4 w-4" />
              Tạo bảng lương
            </Button>
            <Button variant="outline" className="h-11 gap-2 rounded-2xl whitespace-nowrap" onClick={() => router.push("/timesheet")}>
              <ExternalLink className="h-4 w-4" />
              Import chấm công
            </Button>
            <Button variant="outline" className="h-11 gap-2 rounded-2xl whitespace-nowrap" onClick={() => router.push("/payroll-estimate")}>
              <CalendarRange className="h-4 w-4" />
              Ước lượng theo lịch
            </Button>
          </div>
        </div>
      </section>

      {loadError ? <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div> : null}

      {payrolls.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <h4 className="mt-5 text-lg font-semibold text-slate-900">Chưa có bảng lương nào</h4>
          <p className="mt-2 text-sm text-slate-500">Tạo kỳ lương đầu tiên để bắt đầu quản lý chấm công và lương nhân sự.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payrolls.map((payroll) => {
            const isEditing = editingId === payroll.id;

            return (
              <article key={payroll.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input value={editName} onChange={(event) => setEditName(event.target.value)} className="h-10 min-w-[280px] flex-1 rounded-2xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" autoFocus />
                          <Button size="icon" className="h-10 w-10 rounded-2xl" onClick={() => handleUpdateName(payroll.id!)}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <button type="button" onClick={() => payroll.id && onSelectPayroll(payroll.id)} className="min-w-0 text-left text-xl font-semibold text-slate-900 transition hover:text-emerald-700">
                            <span className="block truncate">{payroll.name}</span>
                          </button>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-2">
                              <CalendarDays className="h-4 w-4" />
                              {formatTimestampDate(payroll.createdAt)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {!isEditing ? (
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Button variant="outline" className="gap-2 rounded-2xl" onClick={() => payroll.id && onSelectPayroll(payroll.id)}>
                        <ExternalLink className="h-4 w-4" />
                        Mở chi tiết
                      </Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => { setEditingId(payroll.id || null); setEditName(payroll.name); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => handleDelete(payroll.id!)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
