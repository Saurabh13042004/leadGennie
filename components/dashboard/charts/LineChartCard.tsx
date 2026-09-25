"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Series = { name: string; color: string; values: number[] };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

/** Line/area chart. `bare` drops the card chrome so it can live inside another card. */
export default function LineChartCard({ title, labels, series, bare, className }: { title?: string; labels: string[]; series: Series[]; bare?: boolean; className?: string }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 640;
  const height = 220;
  const padding = { top: 12, right: 8, bottom: 24, left: 28 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const stepX = innerW / Math.max(1, labels.length - 1);
  const toX = (i: number) => padding.left + i * stepX;
  const toY = (v: number) => padding.top + innerH - (v / max) * innerH;
  const linePath = (values: number[]) => values.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ");
  const areaPath = (values: number[]) => `${linePath(values)} L ${toX(values.length - 1)} ${padding.top + innerH} L ${toX(0)} ${padding.top + innerH} Z`;

  const legend = (
    <div className="flex items-center gap-4">
      {series.map((s) => (
        <div key={s.name} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
          <span className="text-xs text-neutral-500">{s.name}</span>
        </div>
      ))}
    </div>
  );

  const chart = (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" onMouseLeave={() => setHoverIdx(null)}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.name} id={`lc-fill-${i}-${s.color.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.16" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padding.left} x2={width - padding.right} y1={padding.top + innerH * (1 - f)} y2={padding.top + innerH * (1 - f)} stroke="#eeeeec" strokeDasharray={f === 0 ? undefined : "3 3"} />
            <text x={padding.left - 8} y={padding.top + innerH * (1 - f) + 3} textAnchor="end" fontSize={10} fill="#a3a3a0">
              {Math.round(max * f)}
            </text>
          </g>
        ))}

        {series.map((s, i) => (
          <path key={`a-${s.name}`} d={areaPath(s.values)} fill={`url(#lc-fill-${i}-${s.color.replace("#", "")})`} />
        ))}
        {series.map((s) => (
          <path key={s.name} d={linePath(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {hoverIdx !== null && <line x1={toX(hoverIdx)} x2={toX(hoverIdx)} y1={padding.top} y2={padding.top + innerH} stroke="#d4d4d0" strokeWidth={1} />}
        {hoverIdx !== null &&
          series.map((s) => <circle key={s.name} cx={toX(hoverIdx)} cy={toY(s.values[hoverIdx])} r={4} fill={s.color} stroke="#ffffff" strokeWidth={2} />)}

        {labels.map((label, i) => (
          <rect key={label} x={toX(i) - stepX / 2} y={padding.top} width={stepX} height={innerH} fill="transparent" onMouseEnter={() => setHoverIdx(i)} />
        ))}
        {labels.map((label, i) => (
          <text key={label} x={toX(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="#a3a3a0">
            {label}
          </text>
        ))}
      </svg>

      {hoverIdx !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 -translate-y-full rounded-lg bg-neutral-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{ left: `${(toX(hoverIdx) / width) * 100}%` }}
        >
          <p className="mb-0.5 text-neutral-400">{labels[hoverIdx]}</p>
          {series.map((s) => (
            <p key={s.name} className="tabular-nums">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}: <span className="font-semibold">{s.values[hoverIdx]}</span>
            </p>
          ))}
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
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-neutral-900">{title}</h3>
        {legend}
      </div>
      {chart}
    </div>
  );
}
