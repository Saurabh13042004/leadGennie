"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react/ssr";
import type { NavIcon } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

const WIDTH = { md: "max-w-md", lg: "max-w-lg", xl: "max-w-2xl", "2xl": "max-w-3xl" } as const;

/**
 * Modal shell used by the lead/inbound dialogs: blurred backdrop, rounded-2xl white panel, header with title + close,
 * optional sub-header (e.g. a stepper), scrollable body and a right-aligned footer. Escape closes unless `closeDisabled`.
 */
export default function Modal({
  title,
  description,
  icon: Icon,
  leading,
  onClose,
  closeDisabled,
  size = "lg",
  subheader,
  footer,
  children,
  label,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: NavIcon;
  /** Rendered before the title (e.g. a back button). */
  leading?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  size?: keyof typeof WIDTH;
  subheader?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  label?: string;
}) {
  const close = useRef(onClose);
  const disabled = useRef(closeDisabled);
  useEffect(() => {
    close.current = onClose;
    disabled.current = closeDisabled;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disabled.current) close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Portal out of the sticky PageHeader (its backdrop-filter would become the containing block for `fixed` and clip
  // the dialog to the header). <main> has no filter/transform and sits inside the dashboard font scope.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/20 backdrop-blur-[2px]" onClick={closeDisabled ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (typeof title === "string" ? title : undefined)}
        className={cn("relative flex max-h-[88vh] w-full flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-black/5", WIDTH[size])}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-neutral-100 px-5 py-4">
          {leading}
          {Icon && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-200/70">
              <Icon className="h-4 w-4" weight="duotone" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-neutral-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30"
            aria-label="Close"
          >
            <X className="h-4 w-4" weight="bold" />
          </button>
        </div>
        {subheader && <div className="shrink-0 border-b border-neutral-100">{subheader}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 rounded-b-2xl border-t border-neutral-100 bg-neutral-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.querySelector("main") ?? document.body,
  );
}
