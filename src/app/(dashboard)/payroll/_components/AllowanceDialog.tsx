"use client";

import InputMoney from "@/components/InputMoney";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, Trash2, X } from "lucide-react";

export default function AllowanceDialog({
  allowances,
  attendanceBonusAmount,
  attendanceBonusDays,
  attendanceBonusEnabled,
  computedAttendanceBonus,
  employeeName,
  onAdd,
  onAmountChange,
  onAttendanceBonusAmountChange,
  onAttendanceBonusDaysChange,
  onAttendanceBonusEnabledChange,
  onClose,
  onNameChange,
  onRemove,
  onSave,
  workingDays,
  absentDays,
}: {
  allowances: { name: string; amount: number }[];
  attendanceBonusAmount: number;
  attendanceBonusDays: number;
  attendanceBonusEnabled: boolean;
  computedAttendanceBonus: number;
  employeeName: string;
  onAdd: () => void;
  onAmountChange: (index: number, value: number) => void;
  onAttendanceBonusAmountChange: (value: number) => void;
  onAttendanceBonusDaysChange: (value: number) => void;
  onAttendanceBonusEnabledChange: (value: boolean) => void;
  onClose: () => void;
  onNameChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  workingDays: number;
  absentDays: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-t-lg border border-slate-200 bg-white shadow-2xl sm:rounded-lg">
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Quản lý phụ cấp</h3>
            <p className="mt-1 text-sm text-slate-500">{employeeName}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-md" onClick={onClose} aria-label="Đóng">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[72vh] space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <label className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <div className="font-semibold text-slate-900">Chuyên cần</div>
              <p className="mt-1 text-sm text-slate-500">Tự cộng hoặc trừ theo số ngày nghỉ thực tế trong kỳ lương.</p>
            </div>
            <input type="checkbox" checked={attendanceBonusEnabled} onChange={(event) => onAttendanceBonusEnabledChange(event.target.checked)} className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
          </label>

          {attendanceBonusEnabled ? (
            <div className="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50/60 p-3 md:grid-cols-[1fr_180px_180px]">
              <Input type="number" label="Mốc trừ chuyên cần (ngày nghỉ)" value={attendanceBonusDays || ""} onChange={(event) => onAttendanceBonusDaysChange(Number(event.target.value) || 0)} className="h-10 rounded-md bg-white text-right" />
              <InputMoney label="Thưởng chuyên cần" value={attendanceBonusAmount} set={onAttendanceBonusAmountChange} className="h-10 rounded-md bg-white" />
              <div className="border-l-2 border-emerald-300 bg-white/70 px-3 py-2 text-sm">
                <div className="text-slate-500">Đang tính</div>
                <div className="mt-2 text-lg font-semibold text-emerald-700">{computedAttendanceBonus.toLocaleString("vi-VN")} đ</div>
                <div className="mt-2 text-xs text-slate-500">Đi làm {workingDays} ngày, nghỉ {absentDays} ngày.</div>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {allowances.map((item, index) => (
              <div key={index} className="grid gap-3 border-b border-slate-200 py-3 md:grid-cols-[1fr,180px,44px]">
                <Input value={item.name} onChange={(event) => onNameChange(index, event.target.value)} placeholder="Tên khoản phụ cấp" className="h-10 rounded-md bg-white" />
                <InputMoney value={item.amount} set={(value) => onAmountChange(index, value)} className="h-10 rounded-md bg-white" />
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-md text-rose-500 hover:bg-rose-50" onClick={() => onRemove(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" className="w-full gap-2 rounded-md border-dashed" onClick={onAdd}>
              <Plus className="h-4 w-4" />
              Thêm khoản phụ cấp
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-4 py-4 sm:px-5">
          <Button variant="outline" className="h-9 w-9 rounded-md" onClick={onClose} aria-label="Đóng">Hủy</Button>
          <Button className="rounded-md" onClick={onSave}>Lưu phụ cấp</Button>
        </div>
      </div>
    </div>
  );
}
