"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastProps = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
  onDismiss: () => void;
  className?: string;
};

const variantStyles: Record<
  ToastVariant,
  { icon: LucideIcon; iconClassName: string }
> = {
  success: {
    icon: CheckCircle2,
    iconClassName: "bg-emerald-50 text-emerald-700",
  },
  error: {
    icon: AlertCircle,
    iconClassName: "bg-rose-50 text-rose-700",
  },
  warning: {
    icon: TriangleAlert,
    iconClassName: "bg-amber-50 text-amber-700",
  },
  info: {
    icon: Info,
    iconClassName: "bg-sky-50 text-sky-700",
  },
};

export function Toast({
  open,
  title,
  description,
  variant = "info",
  duration = 3750,
  onDismiss,
  className,
}: ToastProps) {
  const [rendered, setRendered] = React.useState(open);
  const [visible, setVisible] = React.useState(false);
  const onDismissRef = React.useRef(onDismiss);

  React.useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  React.useEffect(() => {
    if (open) {
      setRendered(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    const exitTimer = window.setTimeout(() => setRendered(false), 150);
    return () => window.clearTimeout(exitTimer);
  }, [open]);

  React.useEffect(() => {
    if (!open || duration <= 0) return;
    const dismissTimer = window.setTimeout(
      () => onDismissRef.current(),
      duration,
    );
    return () => window.clearTimeout(dismissTimer);
  }, [duration, open]);

  if (!rendered || typeof document === "undefined") return null;

  const { icon: Icon, iconClassName } = variantStyles[variant];
  const isAssertive = variant === "error" || variant === "warning";

  return createPortal(
    <div
      role={isAssertive ? "alert" : "status"}
      aria-live={isAssertive ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        "fixed left-3 right-3 top-3 z-[120] flex items-start gap-3 rounded-lg bg-white p-3 text-slate-900 shadow-[0_4px_8px_rgba(15,23,42,0.18)] transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none sm:left-auto sm:w-[360px]",
        visible ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
          iconClassName,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>

      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-sm font-semibold">{title}</p>
        {description ? (
          <div className="mt-0.5 text-sm leading-5 text-slate-600">
            {description}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onDismissRef.current()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Đóng thông báo"
      >
        <X className="h-4 w-4" />
      </button>
    </div>,
    document.body,
  );
}
