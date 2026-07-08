import {
  Handshake,
  BarChart3,
  Target,
  Link2,
  Reply,
  Users,
  CheckSquare,
  Zap,
  Hourglass,
  Mail,
  Building2,
  Briefcase,
  DollarSign,
  Trophy,
  Shield,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  handshake: Handshake,
  "bar-chart-3": BarChart3,
  target: Target,
  "link-2": Link2,
  reply: Reply,
  users: Users,
  "check-square": CheckSquare,
  zap: Zap,
  hourglass: Hourglass,
  mail: Mail,
  "building-2": Building2,
  briefcase: Briefcase,
  "dollar-sign": DollarSign,
  trophy: Trophy,
  shield: Shield,
  "refresh-cw": RefreshCw,
};

export default function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: keyof typeof iconMap;
}) {
  const Icon = iconMap[icon];

  return (
    <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          {label}
        </span>
        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
          <Icon className="w-4 h-4 text-neutral-300" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-semibold text-white tabular-nums">{value}</p>
        <p className="text-xs text-neutral-500 mt-1">{sub}</p>
      </div>
    </div>
  );
}
