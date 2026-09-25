import type { ReactNode } from "react";
import { Info } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

/** Bulleted list for legal prose. */
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("list-disc space-y-2 pl-5 marker:text-neutral-300", className)}>{children}</ul>;
}

/** A labelled list item: "<strong>Label:</strong> text". */
export function Item({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <li className="pl-1">
      {label && <strong className="font-medium text-neutral-900">{label}:</strong>} {children}
    </li>
  );
}

/** Highlighted note (e.g. a restriction or review requirement). */
export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl bg-indigo-50/60 p-4 ring-1 ring-inset ring-indigo-200/70">
      <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-indigo-600" weight="duotone" />
      <div className="space-y-1 text-[14px] leading-relaxed text-neutral-700">
        <p className="font-semibold text-neutral-900">{title}</p>
        {children}
      </div>
    </div>
  );
}

/** Bordered group of sub-sections (h3 + content). */
export function Panel({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">{children}</div>;
}

export function PanelBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="p-5">
      <h3 className="mb-2 text-[14px] font-semibold text-neutral-900">{title}</h3>
      <div className="text-[14px] leading-relaxed text-neutral-600">{children}</div>
    </div>
  );
}

export function MailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="font-medium text-indigo-600 underline decoration-indigo-200 underline-offset-2 hover:decoration-indigo-500">
      {email}
    </a>
  );
}
