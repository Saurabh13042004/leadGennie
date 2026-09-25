import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-medium uppercase tracking-wider text-neutral-500", className)}>{children}</p>;
}

/** The site's section heading block: eyebrow, h2, one-line lead. */
export default function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <h2 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] text-neutral-950 md:text-[36px]">{title}</h2>
      {lead && <p className="mt-3 text-[15px] leading-relaxed text-neutral-600 md:text-base">{lead}</p>}
    </div>
  );
}

/** Soft dotted backdrop used behind page heroes. */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.07)_1px,transparent_0)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
      <div className="absolute -top-40 left-1/2 h-80 w-[720px] -translate-x-1/2 rounded-full bg-indigo-200/25 blur-3xl" />
    </div>
  );
}
