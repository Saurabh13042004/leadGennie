import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-violet-500 to-fuchsia-500",
  "from-teal-500 to-cyan-500",
  "from-orange-500 to-rose-500",
];

const TILES = [
  "bg-indigo-50 text-indigo-700 ring-indigo-100",
  "bg-sky-50 text-sky-700 ring-sky-100",
  "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "bg-amber-50 text-amber-700 ring-amber-100",
  "bg-rose-50 text-rose-700 ring-rose-100",
  "bg-violet-50 text-violet-700 ring-violet-100",
  "bg-teal-50 text-teal-700 ring-teal-100",
  "bg-orange-50 text-orange-700 ring-orange-100",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const SIZE = { xs: "h-5 w-5 text-[9px]", sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm", xl: "h-14 w-14 text-lg" };

/** Person avatar: initials on a deterministic gradient (same name → same colour). */
export default function Avatar({ name, size = "sm", className }: { name: string | null | undefined; size?: keyof typeof SIZE; className?: string }) {
  const g = GRADIENTS[hash(name ?? "") % GRADIENTS.length];
  return (
    <span className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white", g, SIZE[size], className)}>
      {initials(name)}
    </span>
  );
}

/** Company mark: first letter on a soft deterministic tile (square-ish, to read differently from people). */
export function CompanyMark({ name, size = "sm", className }: { name: string | null | undefined; size?: keyof typeof SIZE; className?: string }) {
  const t = TILES[hash((name ?? "").toLowerCase()) % TILES.length];
  const letter = (name ?? "").trim()[0]?.toUpperCase() ?? "·";
  return (
    <span className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-md font-semibold ring-1 ring-inset", t, SIZE[size], className)}>
      {letter}
    </span>
  );
}
