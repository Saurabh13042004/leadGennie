import { Bar, Block } from "./Skeleton";

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-neutral-200/80 bg-white p-4 ${className}`}>{children}</div>;
}

/** KPI row, a chart frame (gridlines only, no series) and two breakdown tables — outlines, no data. */
export default function AnalyticsSkeleton() {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Block className="h-8 w-40" />
        <Block className="h-8 w-28" />
        <Block className="ml-auto h-8 w-24" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Panel key={i}>
            <Bar className="w-20" />
            <Block className="mt-3 h-6 w-16 bg-neutral-200/60" />
            <Bar className="mt-3 w-28 bg-neutral-100" />
          </Panel>
        ))}
      </div>

      <Panel className="p-5">
        <div className="mb-5 flex items-center justify-between">
          <Bar className="w-36" />
          <Block className="h-7 w-32" />
        </div>
        <div className="relative h-56">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="absolute inset-x-0 border-t border-dashed border-neutral-200" style={{ top: `${i * 25}%` }} />
          ))}
        </div>
        <div className="mt-3 flex justify-between">
          {Array.from({ length: 7 }, (_, i) => (
            <Bar key={i} className="w-8 bg-neutral-100" />
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((p) => (
          <Panel key={p} className="p-0">
            <div className="border-b border-neutral-100 px-4 py-3">
              <Bar className="w-32" />
            </div>
            {["w-40", "w-32", "w-44", "w-28"].map((w, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3 last:border-0">
                <Bar className={w} />
                <Bar className="ml-auto w-10 bg-neutral-100" />
                <Bar className="w-10 bg-neutral-100" />
              </div>
            ))}
          </Panel>
        ))}
      </div>
    </div>
  );
}
