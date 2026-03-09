"use client";

import { useState, useEffect } from "react";
import {
  getPayrolls,
  createPayroll,
  Payroll,
  deletePayroll,
  updatePayroll,
} from "@/services/payrolls.firebase";
import { getEmployees } from "@/services/employees.firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Plus,
  Table2,
  CalendarDays,
  ExternalLink,
  Trash2,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

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
    const data = await getPayrolls(storeId);
    setPayrolls(data);
  }

  async function handleCreate() {
    if (!newPayrollName) {
      alert("Vui lòng nhập tên bảng lương (Ví dụ: Tháng 1 - Đợt 1)");
      return;
    }
    setLoading(true);
    try {
      const employees = await getEmployees(storeId);
      if (employees.length === 0) {
        alert("Chưa có nhân viên nào để tạo bảng lương.");
        return;
      }
      const payrollId = await createPayroll(storeId, newPayrollName, employees);
      setNewPayrollName("");
      await loadPayrolls();
      onSelectPayroll(payrollId); // Switch to detail view immediately
    } catch (error) {
      console.error(error);
      alert("Lỗi khi tạo bảng lương");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bạn có chắc muốn xóa bảng lương này?")) return;
    try {
      await deletePayroll(id);
      await loadPayrolls();
    } catch (e) {
      console.error(e);
      alert("Lỗi khi xóa");
    }
  }

  async function handleUpdateName(id: string) {
    if (!editName.trim()) return;
    try {
      await updatePayroll(id, { name: editName });
      await loadPayrolls();
      setEditingId(null);
    } catch (error) {
      console.error(error);
      alert("Lỗi khi đổi tên");
    }
  }

  function startEditing(p: Payroll) {
    setEditingId(p.id!);
    setEditName(p.name);
  }

  function handleImport() {
    router.push("/timesheet");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-end bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex-1 w-full space-y-2">
          <label className="text-sm font-medium text-slate-700">
            Tạo bảng lương mới
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="Ví dụ: Tháng 1 - Đợt 1"
              value={newPayrollName}
              onChange={(e) => setNewPayrollName(e.target.value)}
            />
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tạo mới
            </Button>
            <Button
              variant="outline"
              onClick={handleImport}
              className="gap-2 shrink-0 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            >
              <ExternalLink className="w-4 h-4" />
              Import Chấm Công
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {payrolls.map((p) => (
          <Card
            key={p.id}
            className="hover:shadow-md transition-shadow cursor-pointer group relative"
            onClick={() => p.id && onSelectPayroll(p.id)}
          >
            <CardContent className="p-5 flex items-start gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                <Table2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                {editingId === p.id ? (
                  <div
                    className="flex items-center gap-2 mb-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => handleUpdateName(p.id!)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors pr-8">
                    {p.name}
                  </h3>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {p.createdAt?.toDate
                    ? p.createdAt.toDate().toLocaleDateString("vi-VN")
                    : "Vừa xong"}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      p.status === "locked"
                        ? "bg-slate-100 border-slate-200 text-slate-600"
                        : "bg-emerald-50 border-emerald-100 text-emerald-600"
                    }`}
                  >
                    {p.status === "locked" ? "Đã chốt" : "Đang làm"}
                  </span>
                  <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                </div>
              </div>
              <div className="absolute top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(p);
                  }}
                  className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (p.id) handleDelete(p.id);
                  }}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
        {payrolls.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-50 rounded-lg border border-dashed">
            Chưa có bảng lương nào. Hãy tạo bảng lương đầu tiên!
          </div>
        )}
      </div>
    </div>
  );
}
