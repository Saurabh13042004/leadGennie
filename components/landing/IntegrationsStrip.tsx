const INTEGRATIONS = [
  { label: "HubSpot", icon: "H" },
  { label: "CSV import", icon: "CSV" },
  { label: "Email", icon: "✉" },
  { label: "LinkedIn", icon: "in", comingSoon: true },
  { label: "Salesforce", icon: "SF", comingSoon: true },
  { label: "Google Sheets", icon: "G", comingSoon: true },
  { label: "Pipedrive", icon: "P", comingSoon: true },
  { label: "More tools", icon: "+" },
];

export default function IntegrationsStrip() {
  return (
    <section id="integrations" className="border-y border-neutral-200 bg-neutral-50/60 py-12">
      <div className="mx-auto max-w-6xl px-5">
        <p className="mb-6 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">
          Connect the tools you already use
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {INTEGRATIONS.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-3"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-[10px] font-bold text-neutral-500">
                {item.icon}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-neutral-800">{item.label}</div>
                {item.comingSoon && <div className="text-[9px] text-neutral-400">Coming soon</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
