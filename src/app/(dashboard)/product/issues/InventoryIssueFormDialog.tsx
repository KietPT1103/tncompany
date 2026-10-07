import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
export function InventoryIssueFormDialog({ children, title, busy, onClose }: { children: ReactNode; title: string; busy: boolean; onClose: () => void }) {
  const container = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose), busyRef = useRef(busy);
  closeRef.current = onClose; busyRef.current = busy;
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden"; container.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (!container.current?.contains(document.activeElement)) return;
      if (event.key === "Escape" && !busyRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const elements = container.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === container.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === container.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.documentElement.style.overflow = overflow; document.removeEventListener("keydown", handleKey); previousFocus?.focus(); };
  }, []);
  return createPortal(<div className="warehouse-ui fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={container} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="issue-form-title" className="max-h-[92dvh] w-full max-w-[1500px] overflow-y-auto rounded-xl bg-white shadow-xl outline-none">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white px-4 py-3"><h2 id="issue-form-title" className="text-xl font-bold text-emerald-950">{title}</h2><button type="button" aria-label="Đóng form xuất kho" disabled={busy} onClick={onClose} className="rounded-md p-2 hover:bg-slate-100 disabled:opacity-40"><X className="h-5 w-5"/></button></header>
      {children}
    </section>
  </div>, document.body);
}
