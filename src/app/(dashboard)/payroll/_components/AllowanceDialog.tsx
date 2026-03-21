"use client";

import InputMoney from "@/components/InputMoney";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, Trash2, X } from "lucide-react";

export default function AllowanceDialog({
  allowances,
  employeeName,
  onAdd,
  onAmountChange,
  onClose,
  onNameChange,
  onRemove,
  onSave,
}: {
  allowances: { name: string; amount: number }[];
  employeeName: string;
  onAdd: () => void;
  onAmountChange: (index: number, value: number) => void;
  onClose: () => void;
  onNameChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Quản lý phụ cấp</h3>
            <p className="mt-1 text-sm text-slate-500">{employeeName}</p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-2xl" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-5">
          {allowances.map((item, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr,180px,44px]"
            >
              <Input
                value={item.name}
                onChange={(event) => onNameChange(index, event.target.value)}
                placeholder="Tên khoản phụ cấp"
                className="h-11 rounded-2xl bg-white"
              />
              <InputMoney
                value={item.amount}
                set={(value) => onAmountChange(index, value)}
                className="h-11 rounded-2xl bg-white"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-2xl text-rose-500 hover:bg-rose-50"
                onClick={() => onRemove(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button
            variant="outline"
            className="w-full gap-2 rounded-2xl border-dashed"
            onClick={onAdd}
          >
            <Plus className="h-4 w-4" />
            Thêm khoản phụ cấp
          </Button>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-5">
          <Button variant="outline" className="rounded-2xl" onClick={onClose}>
            Hủy
          </Button>
          <Button className="rounded-2xl" onClick={onSave}>
            Lưu phụ cấp
          </Button>
        </div>
      </div>
    </div>
  );
}
