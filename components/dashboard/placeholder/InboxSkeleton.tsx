import { Bar, Block, Dot } from "./Skeleton";

/** Widths for the placeholder rows — fixed so the outline is stable between renders. */
const ROWS = [
  ["w-24", "w-40", "w-56"],
  ["w-32", "w-28", "w-48"],
  ["w-20", "w-44", "w-52"],
  ["w-28", "w-36", "w-40"],
  ["w-24", "w-32", "w-56"],
  ["w-36", "w-40", "w-44"],
  ["w-20", "w-28", "w-52"],
  ["w-28", "w-44", "w-40"],
];

/** Three-pane mail layout (folders · conversations · reading pane), outlines only. */
export default function InboxSkeleton() {
  return (
    <div className="flex h-full">
      <div className="hidden w-52 shrink-0 space-y-2 border-r border-neutral-200/80 bg-neutral-50/40 p-4 xl:block">
        <Block className="mb-4 h-7 w-full" />
        {["w-24", "w-28", "w-20", "w-32", "w-24", "w-16"].map((w, i) => (
          <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
            <span className="h-3.5 w-3.5 rounded bg-neutral-200/70" />
            <Bar className={w} />
          </div>
        ))}
      </div>

      <div className="w-full shrink-0 border-r border-neutral-200/80 md:w-[340px]">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
          <Block className="h-8 flex-1" />
          <Block className="h-8 w-8" />
        </div>
        {ROWS.map(([a, b, c], i) => (
          <div key={i} className="flex gap-3 border-b border-neutral-100 px-4 py-3.5">
            <Dot />
            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
              <div className="flex items-center justify-between">
                <Bar className={a} />
                <Bar className="w-8 bg-neutral-100" />
              </div>
              <Bar className={b} />
              <Bar className={`${c} max-w-full bg-neutral-100`} />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden min-w-0 flex-1 flex-col md:flex">
        <div className="flex items-center gap-3 border-b border-neutral-100 px-6 py-4">
          <Dot className="h-9 w-9" />
          <div className="flex-1 space-y-2">
            <Bar className="w-48" />
            <Bar className="w-32 bg-neutral-100" />
          </div>
          <Block className="h-7 w-20" />
          <Block className="h-7 w-7" />
        </div>
        <div className="flex-1 space-y-8 px-6 py-6">
          {[0, 1].map((i) => (
            <div key={i} className="max-w-2xl space-y-2.5">
              <Bar className="w-40" />
              <Bar className="w-full bg-neutral-100" />
              <Bar className="w-11/12 bg-neutral-100" />
              <Bar className="w-4/5 bg-neutral-100" />
              <Bar className="w-2/3 bg-neutral-100" />
            </div>
          ))}
          <div className="max-w-2xl rounded-xl border border-dashed border-neutral-200 p-4">
            <Bar className="mb-3 w-32" />
            <div className="space-y-2">
              <Bar className="w-full bg-neutral-100" />
              <Bar className="w-5/6 bg-neutral-100" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Block className="h-7 w-16" />
              <Block className="h-7 w-24 bg-neutral-200/70" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
