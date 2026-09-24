const PLACEHOLDER_TEAMS = ["Fernbridge", "Nova Robotics", "Solace Analytics", "Brightline", "Anchorpoint", "Meridian Cloud"];

export default function LogoStrip() {
  return (
    <section className="border-y border-neutral-200 bg-neutral-50/60 py-10">
      <div className="mx-auto max-w-6xl px-5">
        <p className="mb-6 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">
          Built for modern go-to-market teams
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 grayscale">
          {PLACEHOLDER_TEAMS.map((name) => (
            <span key={name} className="text-[15px] font-bold tracking-tight text-neutral-400">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
