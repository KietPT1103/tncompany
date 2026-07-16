"use client";

import {
  Children,
  cloneElement,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export type TooltipSide = "top" | "bottom";

type TooltipChildProps = {
  "aria-describedby"?: string;
};

export type TooltipProps = {
  content: ReactNode;
  children: ReactElement<TooltipChildProps>;
  side?: TooltipSide;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
};

type TooltipPosition = {
  top: number;
  left: number;
  placement: TooltipSide;
};

export function Tooltip({
  content,
  children,
  side = "top",
  className,
  contentClassName,
  disabled = false,
}: TooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip || typeof window === "undefined") return;

    const viewportPadding = 8;
    const gap = 8;
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const availableAbove = triggerRect.top - viewportPadding;
    const availableBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
    const placement =
      side === "top" && availableAbove < tooltipRect.height + gap && availableBelow > availableAbove
        ? "bottom"
        : side === "bottom" &&
            availableBelow < tooltipRect.height + gap &&
            availableAbove > availableBelow
          ? "top"
          : side;
    const left = Math.min(
      Math.max(
        viewportPadding,
        triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
      ),
      window.innerWidth - tooltipRect.width - viewportPadding,
    );
    const top =
      placement === "top"
        ? triggerRect.top - tooltipRect.height - gap
        : triggerRect.bottom + gap;

    setPosition({ top, left, placement });
  }, [side]);

  useLayoutEffect(() => {
    if (!open || disabled) return;

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [disabled, open, updatePosition]);

  const child = Children.only(children);
  const describedBy = [
    child.props["aria-describedby"],
    disabled ? undefined : tooltipId,
  ]
    .filter(Boolean)
    .join(" ");
  const trigger = cloneElement(child, {
    "aria-describedby": describedBy || undefined,
  });
  const placement = position?.placement ?? side;
  const visible = open && !disabled && Boolean(position);

  const tooltip = (
    <span
      ref={tooltipRef}
      id={tooltipId}
      role="tooltip"
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none fixed z-[140] w-max max-w-56 rounded-md bg-slate-950 px-2 py-1.5 text-center text-xs font-medium leading-4 text-white shadow-[0_2px_6px_rgba(15,23,42,0.22)] transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "opacity-0",
        !visible && placement === "top" && "translate-y-1",
        !visible && placement === "bottom" && "-translate-y-1",
        contentClassName,
      )}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
      }}
    >
      {content}
    </span>
  );

  return (
    <span
      ref={triggerRef}
      className={cn("inline-flex", className)}
      onPointerEnter={() => {
        if (!disabled) setOpen(true);
      }}
      onPointerLeave={() => setOpen(false)}
      onFocusCapture={() => {
        if (!disabled) setOpen(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
        }
      }}
    >
      {trigger}
      {typeof document !== "undefined"
        ? createPortal(tooltip, document.body)
        : null}
    </span>
  );
}
