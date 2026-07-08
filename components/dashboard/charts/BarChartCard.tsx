"use client";

import { useState } from "react";

type Series = { name: string; color: string; values: number[] };

export default function BarChartCard({
  title,
  labels,
  series,
}: {
  title: string;
  labels: string[];
  series: Series[];
}) {
  const [hover, setHover] = useState<{ group: number; s: number } | null>(null);

  const width = 640;
  const height = 220;
  const padding = { top: 12, right: 12, bottom: 24, left: 12 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(...series.flatMap((s) => s.values)) * 1.15;
  const groupW = innerW / labels.length;
  const barGap = 2;
  const barW = (groupW - barGap * (series.length + 1)) / series.length;

  const toY = (v: number) => padding.top + innerH - (v / max) * innerH;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <div className="flex items-center gap-3 flex-wrap">
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-neutral-400">{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" onMouseLeave={() => setHover(null)}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={padding.left}
              x2={width - padding.right}
              y1={padding.top + innerH * (1 - f)}
              y2={padding.top + innerH * (1 - f)}
              stroke="#2c2c2a"
              strokeWidth={1}
            />
          ))}

          {labels.map((label, gi) => {
            const groupX = padding.left + gi * groupW;
            return (
              <g key={label}>
                {series.map((s, si) => {
                  const v = s.values[gi];
                  const barH = (v / max) * innerH;
                  const x = groupX + barGap + si * (barW + barGap);
                  const y = toY(v);
                  const isHover = hover?.group === gi && hover.s === si;
                  return (
                    <rect
                      key={s.name}
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(barH, 2)}
                      rx={3}
                      fill={s.color}
                      opacity={isHover ? 1 : 0.9}
                      onMouseEnter={() => setHover({ group: gi, s: si })}
                    />
                  );
                })}
              </g>
            );
          })}

          {labels.map((label, gi) => (
            <text
              key={label}
              x={padding.left + gi * groupW + groupW / 2}
              y={height - 6}
              textAnchor="middle"
              fontSize={10}
              fill="#898781"
            >
              {label}
            </text>
          ))}
        </svg>

        {hover && (
          <div
            className="absolute top-0 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-[#1a1a19] px-3 py-2 text-xs shadow-xl pointer-events-none"
            style={{
              left: `${((padding.left + hover.group * groupW + groupW / 2) / width) * 100}%`,
            }}
          >
            <p className="text-neutral-400 mb-1">{labels[hover.group]}</p>
            <p className="text-white tabular-nums">
              <span
                className="inline-block w-2 h-2 rounded-sm mr-1.5"
                style={{ backgroundColor: series[hover.s].color }}
              />
              {series[hover.s].name}: {series[hover.s].values[hover.group]}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
