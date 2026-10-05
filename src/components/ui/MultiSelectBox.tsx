"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SelectBoxOption } from "./SelectBox";

type MultiSelectBoxProps<T extends string> = {
  values: readonly T[];
  options: readonly SelectBoxOption<T>[];
  onValuesChange: (values: T[]) => void;
  ariaLabel: string;
  placeholder?: string;
  searchThreshold?: number;
  searchPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
};

const normalizeSearchText = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");

export function MultiSelectBox<T extends string>({
  values,
  options,
  onValuesChange,
  ariaLabel,
  placeholder = "Chọn vai trò",
  searchThreshold = 7,
  searchPlaceholder = "Tìm vai trò...",
  className,
  triggerClassName,
}: MultiSelectBoxProps<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const selectedValues = useMemo(() => new Set(values), [values]);
  const searchEnabled = options.length >= searchThreshold;
  const visibleOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query.trim());
    return options.filter(
      (option) =>
        !normalizedQuery || normalizeSearchText(option.label).includes(normalizedQuery),
    );
  }, [options, query]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const padding = 8;
    const width = Math.min(Math.max(rect.width, 240), window.innerWidth - padding * 2);
    const estimatedHeight = Math.min(options.length * 42 + (searchEnabled ? 58 : 8), 330);
    const placeAbove = window.innerHeight - rect.bottom < 220 && rect.top > 220;
    setPosition({
      left: Math.min(Math.max(padding, rect.left), window.innerWidth - width - padding),
      top: placeAbove
        ? Math.max(padding, rect.top - estimatedHeight - 4)
        : Math.min(rect.bottom + 4, window.innerHeight - estimatedHeight - padding),
      width,
    });
  }, [options.length, searchEnabled]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
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
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    if (searchEnabled) window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, open, searchEnabled]);

  const toggleValue = (value: T) => {
    if (selectedValues.has(value)) {
      onValuesChange(values.filter((item) => item !== value));
    } else {
      onValuesChange([...values, value]);
    }
  };

  const selectedLabels = options
    .filter((option) => selectedValues.has(option.value))
    .map((option) => option.label);
  const triggerLabel = selectedLabels.length === 0
    ? placeholder
    : selectedLabels.length <= 2
      ? selectedLabels.join(", ")
      : `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`;

  const menu = open ? (
    <div
      ref={menuRef}
      id={listboxId}
      role="listbox"
      aria-label={ariaLabel}
      aria-multiselectable="true"
      className="fixed z-[90] overflow-hidden rounded-lg bg-white shadow-[0_12px_32px_rgba(15,23,42,0.2)] ring-1 ring-black/5"
      style={position}
    >
      {searchEnabled ? (
        <div className="border-b border-slate-100 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>
      ) : null}
      <div className="admin-list-scrollbar max-h-64 overflow-y-auto p-1">
        {visibleOptions.map((option) => {
          const selected = selectedValues.has(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={option.disabled}
              onClick={() => toggleValue(option.value)}
              className={cn(
                "flex min-h-10 w-full items-center gap-3 rounded-sm px-2.5 py-2 text-left text-sm font-medium transition-colors",
                selected ? "bg-emerald-50 text-emerald-900" : "text-slate-800 hover:bg-slate-50",
                option.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                selected ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white",
              )}>
                {selected ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
            </button>
          );
        })}
        {visibleOptions.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-slate-500">Không tìm thấy vai trò.</div>
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        <span>Đã chọn {values.length} vai trò</span>
        <button type="button" onClick={close} className="font-semibold text-emerald-700 hover:text-emerald-900">Xong</button>
      </div>
    </div>
  ) : null;

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm outline-none transition hover:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-500",
          triggerClassName,
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", selectedLabels.length === 0 && "text-slate-400")}>{triggerLabel}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")} />
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
