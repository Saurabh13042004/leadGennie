"use client";

import { useState } from "react";

type Series = { name: string; color: string; values: number[] };

export default function LineChartCard({
  title,
  labels,
  series,
}: {
  title: string;
  labels: string[];
  series: Series[];
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 640;
  const height = 220;
  const padding = { top: 12, right: 12, bottom: 24, left: 12 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(...series.flatMap((s) => s.values)) * 1.15;
  const stepX = innerW / (labels.length - 1);

  const toX = (i: number) => padding.left + i * stepX;
  const toY = (v: number) => padding.top + innerH - (v / max) * innerH;

  const linePath = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ");

  return (
    <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <div className="flex items-center gap-4">
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-neutral-400">{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          onMouseLeave={() => setHoverIdx(null)}
        >
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

          {series.map((s) => (
            <path
              key={s.name}
              d={linePath(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {hoverIdx !== null && (
            <line
              x1={toX(hoverIdx)}
              x2={toX(hoverIdx)}
              y1={padding.top}
              y2={padding.top + innerH}
              stroke="#898781"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {series.map((s) =>
            hoverIdx !== null ? (
              <circle
                key={s.name}
                cx={toX(hoverIdx)}
                cy={toY(s.values[hoverIdx])}
                r={4}
                fill={s.color}
                stroke="#1a1a19"
                strokeWidth={2}
              />
            ) : null
          )}

          {labels.map((label, i) => (
            <rect
              key={label}
              x={toX(i) - stepX / 2}
              y={padding.top}
              width={stepX}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
          ))}

          {labels.map((label, i) => (
            <text
              key={label}
              x={toX(i)}
              y={height - 6}
              textAnchor="middle"
              fontSize={10}
              fill="#898781"
            >
              {label}
            </text>
          ))}
        </svg>

        {hoverIdx !== null && (
          <div
            className="absolute top-0 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-[#1a1a19] px-3 py-2 text-xs shadow-xl pointer-events-none"
            style={{ left: `${(toX(hoverIdx) / width) * 100}%` }}
          >
            <p className="text-neutral-400 mb-1">{labels[hoverIdx]}</p>
            {series.map((s) => (
              <p key={s.name} className="text-white tabular-nums">
                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: s.color }} />
                {s.name}: {s.values[hoverIdx]}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
