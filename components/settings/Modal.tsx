"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

/**
 * Centered dialog used by settings pages: white rounded-2xl panel, title + close button header,
 * body, and a right-aligned footer. Escape and backdrop click both close it.
 */
export default function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[12vh]">
      <div className="fixed inset-0 bg-neutral-900/20 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" className={cn("relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5", className)}>
        <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">{title}</h2>
            {description && <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X className="h-4 w-4" weight="bold" />
          </button>
        </div>
        {children}
        {footer && <div className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-neutral-100 bg-neutral-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
