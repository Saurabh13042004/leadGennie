import { cn } from "@/lib/utils";

/**
 * Inert layout outlines for "coming soon" pages. Shapes only — never text, names or numbers — so a
 * future page can be previewed without inventing data.
 */
export function Bar({ className }: { className?: string }) {
  return <span className={cn("block h-2 rounded-full bg-neutral-200/70", className)} />;
}

export function Dot({ className }: { className?: string }) {
  return <span className={cn("block h-8 w-8 shrink-0 rounded-full bg-neutral-200/60", className)} />;
}

export function Block({ className }: { className?: string }) {
  return <span className={cn("block rounded-lg bg-neutral-100", className)} />;
}
