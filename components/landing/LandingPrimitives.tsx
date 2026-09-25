import type { ComponentType, ReactNode } from "react";
import { Sparkle } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

/** Shared building blocks for the marketing site — the dashboard's component language at marketing scale. */

type IconType = ComponentType<{ className?: string; weight?: "duotone" | "fill" | "bold" | "regular" }>;

const SPARKLE_PATH =
  "M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z";

/** Same black tile + sparkle as the dashboard's workspace logo. */
export function LogoMark({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-neutral-800 to-neutral-950 shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]",
        size === "sm" ? "h-6 w-6" : "h-7 w-7",
        className,
      )}
    >
      <svg className={size === "sm" ? "h-3 w-3 text-white" : "h-3.5 w-3.5 text-white"} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d={SPARKLE_PATH} />
      </svg>
    </span>
  );
}

export function Wordmark({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className={cn("text-[15px] font-semibold tracking-tight", dark ? "text-white" : "text-neutral-950")}>LeadGennie</span>
    </span>
  );
}

/** Gradient Gennie tile (AI moments only). */
export function GennieMark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const s = { sm: "h-5 w-5 rounded-md [&>svg]:h-3 [&>svg]:w-3", md: "h-6 w-6 rounded-md [&>svg]:h-3.5 [&>svg]:w-3.5", lg: "h-8 w-8 rounded-lg [&>svg]:h-4 [&>svg]:w-4" }[size];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_2px_6px_-1px_rgba(124,58,237,0.5)]",
        s,
        className,
      )}
    >
      <Sparkle weight="fill" />
    </span>
  );
}

/** The "AI" chip from the dashboard sidebar. */
export function AiChip({ className, children = "AI" }: { className?: string; children?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded bg-gradient-to-r from-indigo-500/10 to-fuchsia-500/10 px-1.5 py-px text-[10px] font-semibold text-violet-600 ring-1 ring-inset ring-violet-500/15", className)}>
      {children}
    </span>
  );
}

export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 md:px-6", className)}>{children}</div>;
}

export function Eyebrow({ children, dark, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return <p className={cn("text-[11px] font-medium uppercase tracking-wider", dark ? "text-neutral-400" : "text-neutral-500", className)}>{children}</p>;
}

/** Consistent section heading: eyebrow, h2, one-line lead. `split` puts the lead on the right at md+. */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  layout = "split",
  dark,
  className,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  layout?: "split" | "stack" | "center";
  dark?: boolean;
  className?: string;
}) {
  const h2 = cn(
    "text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[40px] md:text-[44px]",
    dark ? "text-white" : "text-neutral-950",
  );
  const p = cn("text-[16px] leading-relaxed md:text-[17px]", dark ? "text-neutral-400" : "text-neutral-600");

  if (layout === "split") {
    return (
      <div className={cn("mb-12 grid gap-5 md:mb-16 md:grid-cols-[1.25fr_1fr] md:items-end md:gap-12", className)}>
        <div>
          <Eyebrow dark={dark} className="mb-3">{eyebrow}</Eyebrow>
          <h2 className={cn(h2, "max-w-xl")}>{title}</h2>
        </div>
        {lead && <p className={cn(p, "max-w-md md:justify-self-end md:pb-1")}>{lead}</p>}
      </div>
    );
  }
  return (
    <div className={cn("mb-12 md:mb-16", layout === "center" && "mx-auto max-w-2xl text-center", className)}>
      <Eyebrow dark={dark} className="mb-3">{eyebrow}</Eyebrow>
      <h2 className={cn(h2, layout === "center" ? "mx-auto" : "max-w-xl")}>{title}</h2>
      {lead && <p className={cn(p, "mt-4 max-w-xl", layout === "center" && "mx-auto")}>{lead}</p>}
    </div>
  );
}

/** Icon tile: hairline square with a duotone icon — the dashboard's feature/shortcut tile. */
export function IconTile({ icon: Icon, dark, size = "md", className }: { icon: IconType; dark?: boolean; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center ring-1 ring-inset",
        size === "sm" ? "h-7 w-7 rounded-md" : "h-9 w-9 rounded-lg",
        dark ? "bg-white/[0.06] text-indigo-300 ring-white/10" : "bg-white text-indigo-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-neutral-200/80",
        className,
      )}
    >
      <Icon className={size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]"} weight="duotone" />
    </span>
  );
}
