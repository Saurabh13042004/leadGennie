import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE, type Tone } from "./Badge";

type IconType = ComponentType<{ className?: string; weight?: "duotone" | "fill" | "regular" | "bold" }>;

/** Tiny trend line. Values are drawn as-is; an all-zero series renders flat on purpose. */
export function Sparkline({ values, className, stroke = "#6366f1" }: { values: number[]; className?: string; stroke?: string }) {
  if (values.length < 2) return null;
  const w = 96;
  const h = 28;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - (v / max) * (h - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const id = `spark-${stroke.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-7 w-24", className)} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** KPI tile. Everything shown is passed in — this component never invents a delta or trend. */
export default function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone = "indigo",
  trend,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: IconType;
  tone?: Tone;
  trend?: number[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]", className)}>
      <div className="flex items-center gap-2">
        {Icon && (
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", TONE[tone].soft, TONE[tone].text)}>
            <Icon className="h-4 w-4" weight="duotone" />
          </span>
        )}
        <span className="truncate text-[13px] font-medium text-neutral-500">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[26px] font-semibold leading-8 tracking-tight text-neutral-900 tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-neutral-400">{sub}</p>}
        </div>
        {trend && trend.some((v) => v > 0) && <Sparkline values={trend} />}
      </div>
    </div>
  );
}
