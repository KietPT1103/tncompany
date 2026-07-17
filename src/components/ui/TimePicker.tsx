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
import { Check, Clock3 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  formatTimeValue,
  getMinuteOptions,
  normalizeTimeValue,
  setTimePart,
} from "@/components/ui/timePickerUtils";

type TimePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
};

type PickerPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
};

const hours = Array.from({ length: 24 }, (_, index) => index);
const padTimePart = (value: number) => String(value).padStart(2, "0");

export function TimePicker({
  label,
  value,
  onChange,
  disabled = false,
  className,
  triggerClassName,
}: TimePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const normalizedValue = normalizeTimeValue(value) || "";
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [draftValue, setDraftValue] = useState(normalizedValue);
  const [position, setPosition] = useState<PickerPosition>({
    top: 0,
    left: 8,
    width: 312,
  });
  const [selectedHour, selectedMinute] = (normalizedValue || "00:00")
    .split(":")
    .map(Number);
  const minuteOptions = useMemo(
    () => getMinuteOptions(normalizedValue),
    [normalizedValue],
  );

  useEffect(() => {
    setDraftValue(normalizedValue);
  }, [normalizedValue]);

  useEffect(() => {
    if (!disabled) return;
    setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = window.setTimeout(() => setRendered(false), 150);
    return () => window.clearTimeout(timer);
  }, [open]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;

    const padding = 8;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(312, window.innerWidth - padding * 2);

    if (window.innerWidth < 640) {
      setPosition({
        bottom: padding,
        left: (window.innerWidth - width) / 2,
        width,
      });
      return;
    }

    const height = 380;
    const placeAbove = window.innerHeight - rect.bottom < height && rect.top > height;
    const top = placeAbove
      ? Math.max(padding, rect.top - height - 6)
      : Math.min(rect.bottom + 6, window.innerHeight - height - padding);
    const left = Math.min(
      Math.max(padding, rect.right - width),
      window.innerWidth - width - padding,
    );
    setPosition({ top, left, width });
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
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open]);

  function selectPart(part: "hour" | "minute", nextValue: number) {
    const nextTime = setTimePart(normalizedValue, part, nextValue);
    onChange(nextTime);
    setDraftValue(nextTime);
    if (part === "minute") {
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  function commitDraft() {
    const nextTime = normalizeTimeValue(draftValue);
    if (!nextTime) {
      setDraftValue(normalizedValue);
      return;
    }
    onChange(nextTime);
    setDraftValue(nextTime);
  }

  function chooseNow() {
    const nextTime = formatTimeValue(new Date());
    onChange(nextTime);
    setDraftValue(nextTime);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className={cn("w-full", className)}>
      <span id={labelId} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-labelledby={labelId}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[background-color,border-color,box-shadow,transform] duration-150 hover:border-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/20 active:scale-[0.96] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 motion-reduce:transition-none",
          triggerClassName,
        )}
      >
        <span className="tabular-nums">{normalizedValue || "Chọn giờ"}</span>
        <Clock3 className="h-4 w-4 shrink-0 text-emerald-700" />
      </button>

      {rendered && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Chọn giờ publish"
              className={cn(
                "fixed z-[140] overflow-hidden rounded-lg bg-white shadow-[0_4px_8px_rgba(15,23,42,0.2)] ring-1 ring-slate-200 transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none",
                visible
                  ? "translate-y-0 opacity-100"
                  : "translate-y-2 opacity-0",
              )}
              style={position}
            >
              <div className="flex items-end gap-2 border-b border-slate-200 p-3">
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Giờ chính xác
                  </span>
                  <input
                    value={draftValue}
                    inputMode="numeric"
                    placeholder="HH:mm"
                    maxLength={5}
                    onChange={(event) => setDraftValue(event.target.value)}
                    onBlur={commitDraft}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitDraft();
                        setOpen(false);
                        triggerRef.current?.focus();
                      }
                    }}
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-900 outline-none tabular-nums transition-[border-color,box-shadow] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                  />
                </label>
                <button
                  type="button"
                  onClick={chooseNow}
                  className="h-10 shrink-0 rounded-md border border-emerald-600 px-3 text-sm font-semibold text-emerald-800 transition-[background-color,color,transform] duration-150 hover:bg-emerald-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:scale-[0.96] motion-reduce:transition-none"
                >
                  Bây giờ
                </button>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-200">
                <TimeColumn
                  label="Giờ"
                  values={hours}
                  selectedValue={selectedHour}
                  onSelect={(nextHour) => selectPart("hour", nextHour)}
                />
                <TimeColumn
                  label="Phút"
                  values={minuteOptions}
                  selectedValue={selectedMinute}
                  onSelect={(nextMinute) => selectPart("minute", nextMinute)}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function TimeColumn({
  label,
  values,
  selectedValue,
  onSelect,
}: {
  label: string;
  values: number[];
  selectedValue: number;
  onSelect: (value: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-selected="true"]')
      ?.scrollIntoView({ block: "center" });
  }, [selectedValue]);

  return (
    <div>
      <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
        {label}
      </div>
      <div ref={listRef} className="max-h-56 overflow-y-auto p-1.5">
        {values.map((value) => {
          const selected = value === selectedValue;
          return (
            <button
              key={value}
              data-selected={selected ? "true" : undefined}
              type="button"
              onClick={() => onSelect(value)}
              className={cn(
                "flex h-10 w-full items-center justify-between rounded-md px-3 text-sm font-medium tabular-nums transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 motion-reduce:transition-none",
                selected
                  ? "bg-emerald-700 text-white"
                  : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-900",
              )}
            >
              <span>{padTimePart(value)}</span>
              {selected ? <Check className="h-4 w-4" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
