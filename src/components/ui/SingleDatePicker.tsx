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
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { cn } from "@/lib/utils";

type SingleDatePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  hideLabel?: boolean;
  compact?: boolean;
  iconTooltip?: string;
};

type PickerPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  placement: "top" | "bottom";
};

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const parseDateValue = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue) - 1;
  const day = Number(dayValue);
  const date = new Date(year, month, day, 12, 0, 0, 0);

  return date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day
    ? date
    : null;
};

const formatDateValue = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const formatDisplayDate = (date: Date | null) =>
  date
    ? date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Chọn ngày";

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

const getToday = () => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today;
};

export function SingleDatePicker({
  label,
  value,
  onChange,
  disabled = false,
  className,
  triggerClassName,
  hideLabel = false,
  compact = false,
  iconTooltip,
}: SingleDatePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const valueId = `${generatedId}-value`;
  const tooltipId = `${generatedId}-tooltip`;
  const selectedDate = parseDateValue(value);
  const today = getToday();
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const initialDate = selectedDate ?? today;
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1, 12);
  });
  const [position, setPosition] = useState<PickerPosition>({
    top: 0,
    left: 8,
    width: 336,
    placement: "bottom",
  });
  const days = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);

  useEffect(() => {
    if (!selectedDate) return;
    setViewMonth(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1, 12),
    );
  }, [value]);

  useEffect(() => {
    if (!disabled) return;
    setOpen(false);
  }, [disabled]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;

    const viewportPadding = 8;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(336, window.innerWidth - viewportPadding * 2);

    if (window.innerWidth < 640) {
      setPosition({
        bottom: viewportPadding,
        left: (window.innerWidth - width) / 2,
        width,
        placement: "bottom",
      });
      return;
    }

    const estimatedHeight = 410;
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

    const focusFrame = window.requestAnimationFrame(() => {
      const preferredDay =
        popoverRef.current?.querySelector<HTMLButtonElement>(
          '[aria-pressed="true"]',
        ) ??
        popoverRef.current?.querySelector<HTMLButtonElement>(
          '[data-today="true"]',
        );
      preferredDay?.focus();
    });
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  const selectDate = (date: Date) => {
    onChange(formatDateValue(date));
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const popover = open ? (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Chọn ${label.toLocaleLowerCase("vi")}`}
      className="fixed z-[120] max-h-[calc(100vh-1rem)] overflow-y-auto rounded-[2px] border border-slate-200 bg-white text-slate-900 shadow-[0_4px_8px_rgba(15,23,42,0.16)] animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
      style={{
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        width: position.width,
        transformOrigin:
          position.placement === "top" ? "bottom left" : "top left",
      }}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
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
          aria-label="Tháng trước"
          title="Tháng trước"
          className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 transition-[background-color,color,transform] duration-150 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:h-10 sm:w-10"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <h3 className="text-sm font-semibold text-slate-950">
          Tháng {viewMonth.getMonth() + 1}, {viewMonth.getFullYear()}
        </h3>

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
          aria-label="Tháng sau"
          title="Tháng sau"
          className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 transition-[background-color,color,transform] duration-150 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:h-10 sm:w-10"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-7 text-center">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="pb-2 text-xs font-semibold text-slate-500"
            >
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center">
          {days.map((day) => {
            const selected = isSameDay(day, selectedDate);
            const currentDay = isSameDay(day, today);
            const outsideMonth = day.getMonth() !== viewMonth.getMonth();

            return (
              <button
                key={formatDateValue(day)}
                type="button"
                onClick={() => selectDate(day)}
                aria-label={day.toLocaleDateString("vi-VN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                aria-pressed={selected}
                data-today={currentDay ? "true" : undefined}
                className={cn(
                  "flex h-11 items-center justify-center rounded-md text-sm font-medium tabular-nums transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:h-10",
                  selected
                    ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
                  outsideMonth && !selected && "text-slate-400",
                  currentDay &&
                    !selected &&
                    "text-emerald-700 ring-1 ring-inset ring-emerald-300",
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-14 items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-sm font-medium text-slate-600 tabular-nums">
          {formatDisplayDate(selectedDate)}
        </span>
        <button
          type="button"
          onClick={() => selectDate(today)}
          className="h-10 rounded-md px-3 text-sm font-semibold text-emerald-700 transition-[background-color,color,transform] duration-150 hover:bg-emerald-100 hover:text-emerald-800 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          Hôm nay
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className={cn("w-full", !hideLabel && "space-y-1", className)}>
      <span
        id={labelId}
        className={cn(
          "text-sm font-medium leading-none",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </span>
      <button
        ref={triggerRef}
        id={generatedId}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open) {
            const initialDate = selectedDate ?? today;
            setViewMonth(
              new Date(
                initialDate.getFullYear(),
                initialDate.getMonth(),
                1,
                12,
              ),
            );
          }
          setOpen((current) => !current);
        }}
        aria-labelledby={`${labelId} ${valueId}`}
        aria-describedby={iconTooltip ? tooltipId : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "group/date-picker flex h-11 w-full min-w-0 items-center gap-2.5 rounded-[5px] border border-emerald-600 bg-white px-3 text-left text-sm font-medium text-slate-800 transition-[border-color,box-shadow,background-color] duration-150 hover:border-emerald-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10",
          open && "border-emerald-500 ring-2 ring-emerald-100",
          triggerClassName,
        )}
      >
        {!compact ? (
          <CalendarDays className="h-4 w-4 shrink-0 text-emerald-700" />
        ) : null}
        <span id={valueId} className="min-w-0 flex-1 truncate tabular-nums">
          {formatDisplayDate(selectedDate)}
        </span>
        {compact ? (
          <span className="group/calendar relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-emerald-700 transition-[background-color,color] duration-150 group-hover/date-picker:bg-emerald-50 group-hover/date-picker:text-emerald-800">
            <CalendarDays className="h-4 w-4" />
            {iconTooltip ? (
              <span
                id={tooltipId}
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-40 -translate-x-1/2 translate-y-1 rounded-md bg-slate-950 px-2 py-1.5 text-center text-xs font-medium leading-4 text-white opacity-0 shadow-[0_2px_6px_rgba(15,23,42,0.22)] transition-[opacity,transform] duration-150 ease-out group-hover/calendar:translate-y-0 group-hover/calendar:opacity-100 group-focus-visible/date-picker:translate-y-0 group-focus-visible/date-picker:opacity-100 motion-reduce:transition-none"
              >
                {iconTooltip}
              </span>
            ) : null}
          </span>
        ) : (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        )}
      </button>

      {typeof document !== "undefined" && popover
        ? createPortal(popover, document.body)
        : null}
    </div>
  );
}
