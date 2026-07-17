"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DateRangePickerProps = {
  startDate: string;
  endDate: string;
  mode: "month" | "custom";
  selectedMonth: string;
  selectedPeriod: 1 | 2;
  onSelectPeriod: (month: string, period: 1 | 2) => void;
  onSelectRange: (startDate: string, endDate: string) => void;
  onClear: () => void;
};

type PickerPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  placement: "top" | "bottom";
};

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const parseDate = (value: string) => {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
};

const formatDateValue = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const formatMonthValue = (date: Date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0")].join("-");

const formatDisplayDate = (value: string) => {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";
};

const addDays = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};

const isSameDay = (left: Date, right: Date | null) =>
  Boolean(
    right &&
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate(),
  );

const buildCalendarDays = (month: Date) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = addDays(firstDay, -mondayOffset);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
};

export default function DateRangePicker({
  startDate,
  endDate,
  mode,
  selectedMonth,
  selectedPeriod,
  onSelectPeriod,
  onSelectRange,
  onClear,
}: DateRangePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [draftStart, setDraftStart] = useState(startDate);
  const [draftEnd, setDraftEnd] = useState(endDate);
  const [viewMonth, setViewMonth] = useState(() => {
    const initial = parseDate(startDate);
    return initial
      ? new Date(initial.getFullYear(), initial.getMonth(), 1, 12)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
  });
  const [position, setPosition] = useState<PickerPosition>({
    top: 0,
    left: 8,
    width: 640,
    placement: "bottom",
  });

  useEffect(() => {
    setDraftStart(startDate);
    setDraftEnd(endDate);
    const nextView = parseDate(startDate);
    if (nextView) {
      setViewMonth(
        new Date(nextView.getFullYear(), nextView.getMonth(), 1, 12),
      );
    }
  }, [endDate, startDate]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;

    const viewportPadding = 8;
    const rect = trigger.getBoundingClientRect();
    const mobile = window.innerWidth < 640;
    if (mobile) {
      setPosition({
        bottom: viewportPadding,
        left: viewportPadding,
        width: window.innerWidth - viewportPadding * 2,
        placement: "bottom",
      });
      return;
    }

    const width = Math.min(640, window.innerWidth - viewportPadding * 2);
    const estimatedHeight = 400;
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
        ? Math.max(viewportPadding, rect.top - estimatedHeight - 4)
        : Math.min(
            rect.bottom + 4,
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
      if (event.key === "Escape") {
        setOpen(false);
        setSelectingEnd(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const applyRange = (rangeStart: Date, rangeEnd: Date) => {
    const nextStart = formatDateValue(rangeStart);
    const nextEnd = formatDateValue(rangeEnd);
    setDraftStart(nextStart);
    setDraftEnd(nextEnd);
    setSelectingEnd(false);
    onSelectRange(nextStart, nextEnd);
    setOpen(false);
  };

  const applyRelativeRange = (days: number) => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    applyRange(addDays(today, -(days - 1)), today);
  };

  const handleDayClick = (date: Date) => {
    const value = formatDateValue(date);
    if (!selectingEnd) {
      setDraftStart(value);
      setDraftEnd("");
      setSelectingEnd(true);
      return;
    }

    const currentStart = parseDate(draftStart) || date;
    if (date < currentStart) {
      applyRange(date, currentStart);
    } else {
      applyRange(currentStart, date);
    }
  };

  const start = parseDate(draftStart);
  const end = parseDate(draftEnd);
  const days = buildCalendarDays(viewMonth);
  const triggerLabel =
    startDate && endDate
      ? formatDisplayDate(startDate) + " - " + formatDisplayDate(endDate)
      : "Chọn khoảng ngày";

  const shortcuts = [
    {
      label: "Đợt 1",
      active:
        mode === "month" &&
        selectedMonth === formatMonthValue(viewMonth) &&
        selectedPeriod === 1,
      action: () => {
        onSelectPeriod(formatMonthValue(viewMonth), 1);
        setOpen(false);
      },
    },
    {
      label: "Đợt 2",
      active:
        mode === "month" &&
        selectedMonth === formatMonthValue(viewMonth) &&
        selectedPeriod === 2,
      action: () => {
        onSelectPeriod(formatMonthValue(viewMonth), 2);
        setOpen(false);
      },
    },
    {
      label: "Hôm nay",
      active: false,
      action: () => applyRelativeRange(1),
    },
    {
      label: "Hôm qua",
      active: false,
      action: () => {
        const yesterday = addDays(new Date(), -1);
        yesterday.setHours(12, 0, 0, 0);
        applyRange(yesterday, yesterday);
      },
    },
    {
      label: "7 ngày qua",
      active: false,
      action: () => applyRelativeRange(7),
    },
    {
      label: "30 ngày qua",
      active: false,
      action: () => applyRelativeRange(30),
    },
  ];

  const popover = open ? (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Chọn khoảng ngày chấm công"
      className="fixed z-[80] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-lg border border-slate-200 bg-white text-slate-900 shadow-[0_4px_8px_rgba(15,23,42,0.16)] animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
      style={{
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        width: position.width,
        transformOrigin:
          position.placement === "top" ? "bottom left" : "top left",
      }}
    >
      <div className="grid sm:grid-cols-[148px_minmax(0,1fr)]">
        <div className="border-b border-slate-200 p-3 sm:border-b-0 sm:border-r">
          <div className="flex gap-1 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0">
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.label}
                type="button"
                onClick={shortcut.action}
                className={cn(
                  "h-10 shrink-0 rounded-md px-3 text-left text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-full",
                  shortcut.active
                    ? "bg-primary/10 text-primary"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                {shortcut.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              onClear();
              setDraftStart("");
              setDraftEnd("");
              setSelectingEnd(false);
            }}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-sky-700 transition-colors duration-150 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:mt-4 sm:w-full"
          >
            <RotateCcw className="h-4 w-4" />
            Đặt lại
          </button>
        </div>

        <div className="min-w-0 p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">
              Tháng {viewMonth.getMonth() + 1} {viewMonth.getFullYear()}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setViewMonth(
                    new Date(
                      viewMonth.getFullYear(),
                      viewMonth.getMonth() - 1,
                      1,
                      12,
                    ),
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-md text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Tháng trước"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setViewMonth(
                    new Date(
                      viewMonth.getFullYear(),
                      viewMonth.getMonth() + 1,
                      1,
                      12,
                    ),
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-md text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Tháng sau"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center">
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="pb-2 text-xs font-semibold text-slate-500"
              >
                {weekday}
              </div>
            ))}
            {days.map((day) => {
              const selectedStart = isSameDay(day, start);
              const selectedEnd = isSameDay(day, end);
              const insideRange = Boolean(
                start && end && day > start && day < end,
              );
              const outsideMonth = day.getMonth() !== viewMonth.getMonth();
              return (
                <button
                  key={formatDateValue(day)}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "relative flex h-10 items-center justify-center text-sm font-medium transition-colors duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    insideRange && "bg-emerald-800/15 text-emerald-950",
                    selectedStart &&
                      end &&
                      !selectedEnd &&
                      "rounded-l-md bg-emerald-800/15",
                    selectedEnd &&
                      start &&
                      !selectedStart &&
                      "rounded-r-md bg-emerald-800/15",
                    outsideMonth && "text-slate-300",
                    !insideRange &&
                      !selectedStart &&
                      !selectedEnd &&
                      "hover:rounded-md hover:bg-slate-100",
                  )}
                  aria-label={day.toLocaleDateString("vi-VN")}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      (selectedStart || selectedEnd) &&
                        "bg-emerald-800 text-white shadow-sm",
                    )}
                  >
                    {day.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex min-h-9 items-center rounded-md bg-slate-50 px-3 text-sm text-slate-600">
            {selectingEnd
              ? "Chọn ngày kết thúc"
              : draftStart && draftEnd
                ? formatDisplayDate(draftStart) +
                  " - " +
                  formatDisplayDate(draftEnd)
                : "Chọn ngày bắt đầu và ngày kết thúc"}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open) {
            setDraftStart(startDate);
            setDraftEnd(endDate);
          }
          setSelectingEnd(false);
          setOpen((current) => !current);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex h-11 w-full min-w-0 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-left text-sm font-medium text-emerald-800 shadow-sm transition-[border-color,box-shadow,background-color] duration-150 hover:border-emerald-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:h-10",
          open && "border-primary ring-2 ring-primary/15",
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-emerald-700" />
        <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {typeof document !== "undefined" && popover
        ? createPortal(popover, document.body)
        : null}
    </div>
  );
}
