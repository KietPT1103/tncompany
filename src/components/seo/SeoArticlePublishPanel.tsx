"use client";

import { CalendarClock, LayoutPanelTop } from "lucide-react";

import { SelectBox, type SelectBoxOption } from "@/components/ui/SelectBox";
import { SingleDatePicker } from "@/components/ui/SingleDatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import type { SeoArticleTargetStore } from "@/services/seoArticleService";

const targetStoreOptions: readonly SelectBoxOption<SeoArticleTargetStore>[] = [
  { value: "company", label: "Toàn hệ sinh thái" },
  { value: "cafe", label: "Tiệm cà phê Ông Quan" },
  { value: "hotpot", label: "Tiệm lẩu Ông Quan" },
  { value: "farm", label: "Ông Quan Farm" },
];

type SeoArticlePublishPanelProps = {
  isPublished: boolean;
  publishedAt: string | null;
  targetStore: SeoArticleTargetStore;
  onToggle: () => void;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  onTargetStoreChange: (value: SeoArticleTargetStore) => void;
};

export function SeoArticlePublishPanel({
  isPublished,
  publishedAt,
  targetStore,
  onToggle,
  onDateChange,
  onTimeChange,
  onTargetStoreChange,
}: SeoArticlePublishPanelProps) {
  return (
    <section className="order-1 rounded-lg border border-slate-200 bg-white p-4 shadow-[6px_8px_14px_rgba(6,78,59,0.15)] sm:p-5">
      <div className="flex items-center gap-2 text-slate-900">
        <LayoutPanelTop className="h-5 w-5 text-emerald-700" />
        <h2 className="text-base font-semibold">Xuất bản</h2>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            {isPublished ? "Published" : "Draft"}
          </div>
          <p className="mt-0.5 text-xs leading-5 text-slate-600">
            {isPublished
              ? "Bài sẽ hiển thị công khai sau khi lưu."
              : "Bài chỉ được lưu nội bộ."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isPublished}
          aria-label={
            isPublished
              ? "Chuyển bài viết về Draft"
              : "Publish bài viết sau khi lưu"
          }
          onClick={onToggle}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 motion-reduce:transition-none ${
            isPublished ? "bg-emerald-700" : "bg-slate-300"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out motion-reduce:transition-none ${
              isPublished ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Nhóm SEO
          </label>
          <SelectBox
            value={targetStore}
            options={targetStoreOptions}
            onValueChange={onTargetStoreChange}
            ariaLabel="Chọn nhóm SEO"
            className="w-full"
            triggerClassName="h-10 rounded-md border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-none hover:border-emerald-500 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/20"
          />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2.5">
          <SingleDatePicker
            label="Ngày publish"
            value={publishedAt?.slice(0, 10) || ""}
            onChange={onDateChange}
            disabled={!isPublished}
            iconTooltip="Chọn ngày publish"
            triggerClassName="h-10 rounded-md border-slate-300 bg-white text-sm shadow-none hover:border-emerald-500 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/20 disabled:bg-slate-100"
          />
          <TimePicker
            label="Giờ"
            value={publishedAt?.slice(11, 16) || ""}
            onChange={onTimeChange}
            disabled={!isPublished}
            triggerClassName="h-10 rounded-md border-slate-300 bg-white px-2 text-sm shadow-none tabular-nums focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20 disabled:bg-slate-100"
          />
        </div>
      </div>

      <div
        className={`mt-4 rounded-md px-3 py-3 text-sm ring-1 ring-inset ${
          isPublished
            ? "bg-[#F6C85F] text-[#063B2E] ring-[#D4AF37]/50"
            : "bg-slate-50 text-slate-700 ring-slate-200"
        }`}
      >
        <div className="flex items-center gap-2 font-semibold text-slate-700">
          <CalendarClock className="h-4 w-4" />
          {isPublished ? "Đã sẵn sàng publish" : "Đang ở dạng Draft"}
        </div>
      </div>
    </section>
  );
}
