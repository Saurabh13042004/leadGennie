import {
  CheckCircle,
  MagnifyingGlass,
  Sparkle,
  SortDescending,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import Avatar from "@/components/ui/Avatar";

const STEPS = [
  {
    icon: UsersThree,
    label: "Find researched fintech leads",
    note: "Selected 18 of 64",
  },
  {
    icon: MagnifyingGlass,
    label: "Check hiring and funding signals",
    note: "Verified sources only",
  },
  { icon: SortDescending, label: "Rank by ICP fit", note: "Top 5 ready" },
];

const ROWS = [
  { name: "Aarav Mehta", title: "Head of Growth", score: 91 },
  { name: "Sneha Pillai", title: "Head of Sales", score: 88 },
  { name: "Priya Nair", title: "Head of RevOps", score: 84 },
];

/** Right-hand panel on the auth pages: an illustration of an Ask Gennie run, built from the app's own components. */
export default function AuthPreview() {
  return (
    <div className="relative hidden h-full flex-col justify-between overflow-hidden bg-[#f4f4f3] p-10 lg:flex xl:p-14">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-10 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl" />

      <div className="relative">
        <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          Ask Gennie
        </p>
        <h2 className="mt-2 max-w-md text-[28px] font-semibold leading-tight tracking-[-0.02em] text-neutral-900">
          Describe the outcome. Gennie plans it, you approve, it runs.
        </h2>
      </div>

      <div className="relative mx-auto w-full max-w-md space-y-3">
        <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-white px-4 py-2.5 text-[13px] text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-neutral-200/80">
          Which fintech leads should I contact first this week?
        </div>

        <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_-16px_rgba(30,30,60,0.18)] ring-1 ring-neutral-200/80">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white">
              <Sparkle className="h-3.5 w-3.5" weight="fill" />
            </span>
            <span className="text-[13px] font-medium text-neutral-900">
              Gennie
            </span>
            <span className="ml-auto inline-flex h-5 items-center gap-1.5 rounded-md bg-emerald-50 px-1.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Completed
            </span>
          </div>
          <ul className="space-y-2.5 px-4 py-3">
            {STEPS.map(({ icon: I, label, note }) => (
              <li key={label} className="flex items-center gap-2.5 text-[13px]">
                <CheckCircle
                  className="h-4 w-4 shrink-0 text-emerald-500"
                  weight="fill"
                />
                <I
                  className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                  weight="duotone"
                />
                <span className="flex-1 truncate text-neutral-800">
                  {label}
                </span>
                <span className="shrink-0 text-xs text-neutral-400">
                  {note}
                </span>
              </li>
            ))}
          </ul>
          <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
            {ROWS.map((r) => (
              <li
                key={r.name}
                className="flex items-center gap-2.5 px-4 py-2.5"
              >
                <Avatar name={r.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-neutral-900">
                    {r.name}
                  </span>
                  <span className="block truncate text-[11px] text-neutral-500">
                    {r.title}
                  </span>
                </span>
                <span className="w-6 text-right text-[13px] font-semibold tabular-nums text-emerald-700">
                  {r.score}
                </span>
                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-neutral-100">
                  <span
                    className="block h-full rounded-full bg-emerald-500"
                    style={{ width: `${r.score}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="relative text-xs text-neutral-500">
        Plans first. Nothing runs until you approve, and Gennie never sends
        email on its own.
      </p>
    </div>
  );
}
