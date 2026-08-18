"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DATE_RANGE_WEEKDAYS,
  addMonths,
  buildCalendarDays,
  formatDateValue,
  formatDisplayDate,
  getMonthStart,
  getToday,
  isSameDay,
  parseDateValue,
} from "@/components/ui/dateRangePickerUtils";

type DateRangePickerProps = {
  label: string;
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
};

type PickerPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  placement: "top" | "bottom";
};

export function DateRangePicker({
  label,
  startDate,
  endDate,
  onChange,
  disabled = false,
  className,
  triggerClassName,
}: DateRangePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const valueId = `${generatedId}-value`;
  const [open, setOpen] = useState(false);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [viewMonth, setViewMonth] = useState(() =>
    getMonthStart(parseDateValue(startDate) ?? getToday()),
  );
  const [position, setPosition] = useState<PickerPosition>({
    top: 0,
    left: 8,
    width: 664,
    placement: "bottom",
  });

  useEffect(() => {
    if (open) return;
    setDraftStart(startDate);
    setDraftEnd(endDate);
  }, [endDate, open, startDate]);

  useEffect(() => {
    if (!disabled) return;
    setOpen(false);
  }, [disabled]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;

    const viewportPadding = 8;
    const rect = trigger.getBoundingClientRect();
    const mobile = window.innerWidth < 640;
    const width = mobile
      ? window.innerWidth - viewportPadding * 2
      : Math.min(664, window.innerWidth - viewportPadding * 2);

    if (mobile) {
      setPosition({
        bottom: viewportPadding,
        left: viewportPadding,
        width,
        placement: "bottom",
      });
      return;
    }

    const estimatedHeight = 430;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
    const availableAbove = rect.top - viewportPadding;
    const placement =
      availableBelow < estimatedHeight && availableAbove > availableBelow
        ? "top"
        : "bottom";
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - width - viewportPadding,
    );
    const top =
      placement === "top"
        ? Math.max(viewportPadding, rect.top - estimatedHeight - 6)
        : Math.min(
            rect.bottom + 6,
            window.innerHeight - estimatedHeight - viewportPadding,
          );

    setPosition({ top, left, width, placement });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
        setSelectingEnd(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      setSelectingEnd(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  const selectDate = (date: Date) => {
    const value = formatDateValue(date);
    const currentStart = parseDateValue(draftStart);

    if (!selectingEnd || !currentStart) {
      setDraftStart(value);
      setDraftEnd("");
      setSelectingEnd(true);
      return;
    }

    if (date < currentStart) {
      setDraftStart(value);
      setDraftEnd(formatDateValue(currentStart));
    } else {
      setDraftEnd(value);
    }
    setSelectingEnd(false);
  };

  const openPicker = () => {
    if (!open) {
      setDraftStart(startDate);
      setDraftEnd(endDate);
      setSelectingEnd(false);
      setViewMonth(getMonthStart(parseDateValue(startDate) ?? getToday()));
    }
    setOpen((current) => !current);
  };

  const closePicker = () => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setSelectingEnd(false);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const applyRange = () => {
    if (!draftStart || !draftEnd) return;
    onChange(draftStart, draftEnd);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const chooseToday = () => {
    const today = getToday();
    const value = formatDateValue(today);
    setDraftStart(value);
    setDraftEnd(value);
    setSelectingEnd(false);
    setViewMonth(getMonthStart(today));
  };

  const popover = open ? (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Chọn ${label.toLocaleLowerCase("vi")}`}
      className="fixed z-[120] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-lg bg-white text-slate-950 shadow-[0_6px_18px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
      style={{
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        width: position.width,
        transformOrigin:
          position.placement === "top" ? "bottom left" : "top left",
      }}
    >
      <div className="flex min-h-14 flex-wrap items-center gap-x-2 gap-y-1 border-b border-slate-200 px-4 py-3 text-sm">
        <span className="text-slate-500">Từ</span>
        <strong className="tabular-nums">{formatDisplayDate(draftStart)}</strong>
        <span aria-hidden="true" className="text-slate-300">·</span>
        <span className="text-slate-500">Đến</span>
        <strong className="tabular-nums">{formatDisplayDate(draftEnd)}</strong>
      </div>

      <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-slate-200">
        <CalendarMonth
          month={viewMonth}
          rangeStart={draftStart}
          rangeEnd={draftEnd}
          onSelect={selectDate}
          onPrevious={() => setViewMonth((current) => addMonths(current, -1))}
          onNext={() => setViewMonth((current) => addMonths(current, 1))}
          nextButtonClassName="sm:hidden"
        />
        <CalendarMonth
          month={addMonths(viewMonth, 1)}
          rangeStart={draftStart}
          rangeEnd={draftEnd}
          onSelect={selectDate}
          onNext={() => setViewMonth((current) => addMonths(current, 1))}
          className="hidden sm:block"
        />
      </div>

      <div className="flex min-h-14 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={chooseToday}
          className="h-10 rounded-md px-3 text-sm font-semibold text-emerald-700 transition-[background-color,color] duration-150 hover:bg-emerald-100 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          Hôm nay
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={closePicker}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-[background-color,border-color,color] duration-150 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            Bỏ qua
          </button>
          <button
            type="button"
            onClick={applyRange}
            disabled={!draftStart || !draftEnd}
            className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white shadow-[0_2px_5px_rgba(6,78,59,0.22)] transition-[background-color,box-shadow,transform] duration-150 hover:bg-emerald-800 hover:shadow-[0_3px_8px_rgba(6,78,59,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none motion-reduce:transition-none"
          >
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className={cn("w-full space-y-1", className)}>
      <span id={labelId} className="text-sm font-medium leading-none text-slate-700">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={openPicker}
        aria-labelledby={`${labelId} ${valueId}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex h-11 w-full min-w-0 items-center gap-2.5 rounded-md border border-slate-300 bg-slate-50 px-3 text-left text-sm transition-[background-color,border-color,box-shadow] duration-150 hover:border-emerald-500 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10",
          open && "border-emerald-600 bg-white ring-2 ring-emerald-600/15",
          triggerClassName,
        )}
      >
        <span id={valueId} className="min-w-0 flex-1 truncate tabular-nums">
          <span className="text-slate-500">Từ </span>
          <strong className="font-semibold text-slate-950">
            {formatDisplayDate(startDate)}
          </strong>
          <span aria-hidden="true" className="mx-1.5 text-slate-300">·</span>
          <span className="text-slate-500">Đến </span>
          <strong className="font-semibold text-slate-950">
            {formatDisplayDate(endDate)}
          </strong>
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
      </button>
      {typeof document !== "undefined" && popover
        ? createPortal(popover, document.body)
        : null}
    </div>
  );
}

function CalendarMonth({
  month,
  rangeStart,
  rangeEnd,
  onSelect,
  onPrevious,
  onNext,
  nextButtonClassName,
  className,
}: {
  month: Date;
  rangeStart: string;
  rangeEnd: string;
  onSelect: (date: Date) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  nextButtonClassName?: string;
  className?: string;
}) {
  const days = useMemo(() => buildCalendarDays(month), [month]);
  const start = parseDateValue(rangeStart);
  const end = parseDateValue(rangeEnd);

  return (
    <section className={cn("min-w-0 p-3 sm:p-4", className)}>
      <div className="mb-3 grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center">
        {onPrevious ? (
          <MonthNavigationButton label="Tháng trước" onClick={onPrevious}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </MonthNavigationButton>
        ) : <span aria-hidden="true" />}
        <h3 className="text-center text-sm font-semibold text-slate-900">
          Tháng {month.getMonth() + 1} {month.getFullYear()}
        </h3>
        {onNext ? (
          <MonthNavigationButton
            label="Tháng sau"
            onClick={onNext}
            className={nextButtonClassName}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </MonthNavigationButton>
        ) : <span aria-hidden="true" />}
      </div>

      <div className="grid grid-cols-7 text-center">
        {DATE_RANGE_WEEKDAYS.map((weekday) => (
          <span key={weekday} className="pb-2 text-xs font-medium text-slate-500">
            {weekday}
          </span>
        ))}
        {days.map((day) => {
          const value = formatDateValue(day);
          const outsideMonth = day.getMonth() !== month.getMonth();
          if (outsideMonth) {
            return <span key={value} aria-hidden="true" className="h-10" />;
          }

          const selectedStart = isSameDay(day, start);
          const selectedEnd = isSameDay(day, end);
          const insideRange = Boolean(start && end && day > start && day < end);
          const selected = selectedStart || selectedEnd;

          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(day)}
              aria-label={day.toLocaleDateString("vi-VN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              aria-pressed={selected}
              className={cn(
                "relative flex h-10 items-center justify-center text-sm font-medium tabular-nums transition-[background-color,color,transform] duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.96] motion-reduce:transition-none",
                insideRange && "bg-emerald-50 text-emerald-950",
                selectedStart && end && "rounded-l-md bg-emerald-50",
                selectedEnd && start && "rounded-r-md bg-emerald-50",
                selectedStart && selectedEnd && "rounded-md",
                !insideRange && !selected && "hover:rounded-md hover:bg-slate-100",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  selected && "bg-emerald-700 text-white shadow-sm",
                )}
              >
                {day.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MonthNavigationButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-emerald-800 transition-[background-color,border-color,color,transform] duration-150 hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.96] motion-reduce:transition-none",
        className,
      )}
    >
      {children}
    </button>
  );
}
