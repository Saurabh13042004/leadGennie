import { CaretUpDown, ChartLineUp, GearSix, MagnifyingGlass, Megaphone, Sparkle, SquaresFour, Tray, UsersThree } from "@phosphor-icons/react/ssr";
import Avatar from "@/components/ui/Avatar";
import { Kbd } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { AiChip, LogoMark } from "./LandingPrimitives";

const NAV = [
  { icon: SquaresFour, label: "Command Center" },
  { icon: UsersThree, label: "Leads", active: true },
  { icon: Megaphone, label: "Campaigns" },
  { icon: Tray, label: "Inbox" },
  { icon: ChartLineUp, label: "Analytics" },
];

/** Static miniature of the dashboard sidebar (components/dashboard/Sidebar.tsx). Decorative only. */
export default function MockupSidebar() {
  return (
    <div className="flex h-full w-[212px] shrink-0 flex-col gap-3 px-2.5 py-3">
      <div className="flex items-center gap-2.5 px-1.5 py-1">
        <LogoMark />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-neutral-900">LeadGennie</span>
          <span className="block text-[11px] text-neutral-400">Owner</span>
        </span>
        <CaretUpDown className="h-3.5 w-3.5 text-neutral-400" weight="bold" />
      </div>

      <div className="flex h-8 items-center gap-2 rounded-lg bg-white/60 px-2 text-[13px] text-neutral-400 ring-1 ring-inset ring-neutral-200/80">
        <MagnifyingGlass className="h-4 w-4" weight="bold" />
        <span className="flex-1">Search</span>
        <Kbd>⌘K</Kbd>
      </div>

      <div className="space-y-0.5">
        <div className="flex h-9 items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium text-neutral-700">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_2px_6px_-1px_rgba(124,58,237,0.5)]">
            <Sparkle className="h-3.5 w-3.5" weight="fill" />
          </span>
          <span className="flex-1">Ask Gennie</span>
          <AiChip />
        </div>
        {NAV.map(({ icon: Icon, label, active }) => (
          <div
            key={label}
            className={cn(
              "flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium",
              active ? "bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-neutral-200/80" : "text-neutral-600",
            )}
          >
            <Icon className={cn("h-[18px] w-[18px]", active ? "text-indigo-600" : "text-neutral-400")} weight={active ? "fill" : "duotone"} />
            {label}
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-2">
        <div className="flex h-8 items-center gap-2.5 px-2 text-[13px] font-medium text-neutral-600">
          <GearSix className="h-[18px] w-[18px] text-neutral-400" weight="duotone" />
          Settings
        </div>
        <div className="flex items-center gap-2.5 border-t border-neutral-200/80 px-1.5 pt-3">
          <Avatar name="Maya Collins" size="md" />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-neutral-900">Maya Collins</span>
            <span className="block truncate text-[11px] text-neutral-400">maya@northwind.io</span>
          </span>
        </div>
      </div>
    </div>
  );
}
