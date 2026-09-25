import type { ReactNode } from "react";
import EarlyAccessButton from "./EarlyAccessButton";

/** Closing call-to-action card (dark contrast band) that opens the early-access dialog. */
export default function CtaBand({ title, lead, children }: { title: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  return (
    <section className="px-4 pb-20 md:px-6 md:pb-28">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl bg-neutral-950 px-6 py-12 text-center sm:px-12 md:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_60%_80%_at_50%_100%,black,transparent)]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="relative">
          <h2 className="mx-auto max-w-xl text-[26px] font-semibold leading-tight tracking-[-0.025em] text-white md:text-[32px]">{title}</h2>
          {lead && <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-neutral-400">{lead}</p>}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <EarlyAccessButton variant="secondary" className="ring-0" />
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
