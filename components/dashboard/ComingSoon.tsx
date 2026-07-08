import type { LucideIcon } from "lucide-react";

export default function ComingSoon({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          <p className="text-sm text-neutral-500">{description}</p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-24 px-6">
        <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-neutral-500" />
        </div>
        <p className="text-white font-medium">This module is coming soon</p>
        <p className="text-sm text-neutral-500 mt-1 max-w-sm">
          {title} is on the roadmap. Check back soon or reach out to the team for early access.
        </p>
      </div>
    </div>
  );
}
