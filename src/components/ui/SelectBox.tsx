"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectBoxOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  group?: string;
  inset?: boolean;
};

type SelectBoxProps<T extends string> = {
  value: T;
  options: readonly SelectBoxOption<T>[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  openTriggerClassName?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  placement: "top" | "bottom";
};

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi");

export function SelectBox<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  placeholder = "Chọn giá trị",
  disabled = false,
  className,
  triggerClassName,
  openTriggerClassName,
}: SelectBoxProps<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({
    top: 0,
    left: 0,
    width: 0,
    placement: "bottom",
  });

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const groupCount = new Set(
    options.map((option) => option.group).filter(Boolean)
  ).size;

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const estimatedHeight = Math.min(
      options.length * 44 + groupCount * 28 + 8,
      264
    );
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
    const availableAbove = rect.top - viewportPadding;
    const placement =
      availableBelow < Math.min(estimatedHeight, 220) && availableAbove > availableBelow
        ? "top"
        : "bottom";
    const width = Math.min(
      Math.max(rect.width, 180),
      window.innerWidth - viewportPadding * 2
    );
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - width - viewportPadding
    );
    const top =
      placement === "top"
        ? Math.max(viewportPadding, rect.top - estimatedHeight - 4)
        : Math.max(
            viewportPadding,
            Math.min(
              rect.bottom + 4,
              window.innerHeight - estimatedHeight - viewportPadding
            )
          );

    setMenuPosition({ top, left, width, placement });
  }, [groupCount, options.length]);

  const findEnabledIndex = useCallback(
    (preference: "selected" | "first" | "last" = "selected") => {
      if (
        preference === "selected" &&
        selectedIndex >= 0 &&
        !options[selectedIndex]?.disabled
      ) {
        return selectedIndex;
      }
      if (preference === "last") {
        for (let index = options.length - 1; index >= 0; index -= 1) {
          if (!options[index].disabled) return index;
        }
        return -1;
      }
      return options.findIndex((option) => !option.disabled);
    },
    [options, selectedIndex]
  );

  const openMenu = useCallback(
    (preference: "selected" | "first" | "last" = "selected") => {
      if (disabled) return;
      setActiveIndex(findEnabledIndex(preference));
      setOpen(true);
    },
    [disabled, findEnabledIndex]
  );

  const closeMenu = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  const selectIndex = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      onValueChange(option.value);
      closeMenu(true);
    },
    [closeMenu, onValueChange, options]
  );

  const moveActiveIndex = useCallback(
    (direction: 1 | -1) => {
      if (options.length === 0) return;
      let nextIndex = activeIndex;
      for (let attempts = 0; attempts < options.length; attempts += 1) {
        nextIndex =
          nextIndex < 0
            ? direction === 1
              ? 0
              : options.length - 1
            : (nextIndex + direction + options.length) % options.length;
        if (!options[nextIndex].disabled) {
          setActiveIndex(nextIndex);
          return;
        }
      }
    },
    [activeIndex, options]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu(event.key === "ArrowDown" ? "first" : "last");
      } else {
        moveActiveIndex(event.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!open) openMenu(event.key === "Home" ? "first" : "last");
      setActiveIndex(findEnabledIndex(event.key === "Home" ? "first" : "last"));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open && activeIndex >= 0) {
        selectIndex(activeIndex);
      } else {
        openMenu();
      }
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      typeaheadRef.current += normalizeSearchText(event.key);
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = setTimeout(() => {
        typeaheadRef.current = "";
      }, 600);
      const matchIndex = options.findIndex(
        (option) =>
          !option.disabled &&
          normalizeSearchText(option.label).startsWith(typeaheadRef.current)
      );
      if (matchIndex >= 0) {
        event.preventDefault();
        setActiveIndex(matchIndex);
        setOpen(true);
      }
    }
  };

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !listRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  useEffect(
    () => () => {
      if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    },
    []
  );

  const SelectedIcon = selectedOption?.icon;
  const menu = open ? (
    <div
      ref={listRef}
      id={listboxId}
      role="listbox"
      aria-label={ariaLabel}
      className="fixed z-[70] max-h-64 overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground shadow-[0_4px_8px_rgba(15,23,42,0.16)] ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-150 ease-out motion-reduce:animate-none"
      style={{
        top: menuPosition.top,
        left: menuPosition.left,
        width: menuPosition.width,
        transformOrigin:
          menuPosition.placement === "top" ? "bottom center" : "top center",
      }}
    >
      {options.map((option, index) => {
        const OptionIcon = option.icon;
        const selected = option.value === value;
        const active = index === activeIndex;
        const showGroup = Boolean(
          option.group && option.group !== options[index - 1]?.group
        );
        return (
          <Fragment key={option.value}>
            {showGroup ? (
              <div
                role="presentation"
                className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase text-muted-foreground"
              >
                {option.group}
              </div>
            ) : null}
            <button
              id={`${listboxId}-option-${index}`}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={option.disabled}
              tabIndex={-1}
              data-option-index={index}
              onPointerMove={() => !option.disabled && setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectIndex(index)}
              className={cn(
                "flex min-h-11 w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm font-medium transition-[background-color,color] duration-150 ease-out sm:min-h-10 motion-reduce:transition-none",
                option.inset && "pl-5",
                selected
                  ? "bg-emerald-800 text-white"
                  : active
                    ? "bg-accent text-accent-foreground"
                    : "text-popover-foreground",
                option.disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {OptionIcon ? <OptionIcon aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <Check
                aria-hidden="true"
                className={cn(
                  "h-4 w-4 shrink-0 transition-[opacity,transform,filter] duration-150 ease-out motion-reduce:transition-none",
                  selected
                    ? "scale-100 opacity-100 blur-0"
                    : "scale-[0.25] opacity-0 blur-[4px]"
                )}
              />
            </button>
          </Fragment>
        );
      })}
    </div>
  ) : null;

  return (
    <div className={cn("relative inline-flex min-w-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-10 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-background pl-3 pr-2 text-left text-sm font-medium text-foreground shadow-sm transition-[background-color,border-color,box-shadow,color] duration-150 ease-out hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-70 motion-reduce:transition-none",
          open && "border-primary ring-2 ring-primary/15",
          triggerClassName,
          open && openTriggerClassName,
        )}
      >
        {SelectedIcon ? <SelectedIcon aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            !selectedOption && "text-muted-foreground"
          )}
        >
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
