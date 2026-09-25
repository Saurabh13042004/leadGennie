"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Series = { name: string; color: string; values: number[] };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

/** Grouped bar chart. `bare` drops the card chrome so it can live inside another card. */
export default function BarChartCard({ title, labels, series, bare, className }: { title?: string; labels: string[]; series: Series[]; bare?: boolean; className?: string }) {
  const [hover, setHover] = useState<{ group: number; s: number } | null>(null);

  const width = 640;
  const height = 220;
  const padding = { top: 12, right: 8, bottom: 24, left: 28 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const groupW = innerW / labels.length;
  const inner = Math.min(groupW * 0.62, 18 * series.length + 4 * (series.length - 1));
  const barGap = 4;
  const barW = (inner - barGap * (series.length - 1)) / series.length;
  const toY = (v: number) => padding.top + innerH - (v / max) * innerH;

  const legend = (
    <div className="flex flex-wrap items-center gap-3">
      {series.map((s) => (
        <div key={s.name} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
          <span className="text-xs text-neutral-500">{s.name}</span>
        </div>
      ))}
    </div>
  );

  const chart = (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padding.left} x2={width - padding.right} y1={padding.top + innerH * (1 - f)} y2={padding.top + innerH * (1 - f)} stroke="#eeeeec" strokeDasharray={f === 0 ? undefined : "3 3"} />
            <text x={padding.left - 8} y={padding.top + innerH * (1 - f) + 3} textAnchor="end" fontSize={10} fill="#a3a3a0">
              {Math.round(max * f)}
            </text>
          </g>
        ))}

        {labels.map((label, gi) => {
          const start = padding.left + gi * groupW + (groupW - inner) / 2;
          return (
            <g key={label}>
              {series.map((s, si) => {
                const v = s.values[gi];
                const x = start + si * (barW + barGap);
                const y = toY(v);
                const isHover = hover?.group === gi && hover.s === si;
                return (
                  <rect
                    key={s.name}
                    x={x}
                    y={v > 0 ? y : padding.top + innerH - 2}
                    width={barW}
                    height={v > 0 ? Math.max((v / max) * innerH, 2) : 2}
                    rx={3}
                    fill={s.color}
                    opacity={v > 0 ? (hover && !isHover ? 0.45 : 1) : 0.18}
                    onMouseEnter={() => setHover({ group: gi, s: si })}
                  />
                );
              })}
            </g>
          );
        })}

        {labels.map((label, gi) => (
          <text key={label} x={padding.left + gi * groupW + groupW / 2} y={height - 6} textAnchor="middle" fontSize={10} fill="#a3a3a0">
            {label}
          </text>
        ))}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 -translate-y-full rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{ left: `${((padding.left + hover.group * groupW + groupW / 2) / width) * 100}%` }}
        >
          <p className="mb-0.5 text-neutral-400">{labels[hover.group]}</p>
          <p className="tabular-nums">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: series[hover.s].color }} />
            {series[hover.s].name}: <span className="font-semibold">{series[hover.s].values[hover.group]}</span>
          </p>
        </div>
      )}
    </div>
  );

  if (bare) {
    return (
      <div className={className}>
        <div className="mb-3 flex justify-end">{legend}</div>
        {chart}
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-neutral-200/80 bg-white p-5", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-neutral-900">{title}</h3>
        {legend}
      </div>
      {chart}
    </div>
  );
}
