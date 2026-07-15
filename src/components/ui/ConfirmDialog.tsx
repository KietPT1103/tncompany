"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  CircleAlert,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  icon?: LucideIcon | null;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  variant = "default",
  icon: Icon = CircleAlert,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [rendered, setRendered] = React.useState(open);
  const [visible, setVisible] = React.useState(false);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const cancelButtonRef = React.useRef<HTMLButtonElement>(null);
  const onCancelRef = React.useRef(onCancel);
  const isLoadingRef = React.useRef(isLoading);
  const titleId = React.useId();
  const descriptionId = React.useId();

  React.useEffect(() => {
    onCancelRef.current = onCancel;
    isLoadingRef.current = isLoading;
  }, [isLoading, onCancel]);

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
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      cancelButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoadingRef.current) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!rendered || typeof document === "undefined") return null;

  const destructive = variant === "destructive";

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/45 p-4 transition-opacity duration-150 ease-out motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0",
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onCancelRef.current();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          "w-full max-w-sm rounded-lg bg-white p-5 shadow-[0_4px_8px_rgba(15,23,42,0.2)] transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none",
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
        )}
      >
        {Icon ? (
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md",
              destructive
                ? "bg-rose-50 text-rose-700"
                : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        ) : null}

        <h2
          id={titleId}
          className={cn("text-base font-semibold text-slate-950", Icon && "mt-4")}
        >
          {title}
        </h2>
        <div
          id={descriptionId}
          className="mt-1.5 text-sm leading-6 text-slate-600"
        >
          {description}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="outline"
            onClick={() => onCancelRef.current()}
            disabled={isLoading}
            className="h-auto min-h-10 min-w-0 whitespace-normal py-2 shadow-none"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            isLoading={isLoading}
            className="h-auto min-h-10 min-w-0 whitespace-normal py-2 shadow-none"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
