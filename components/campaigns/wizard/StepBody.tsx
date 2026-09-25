import type { ReactNode } from "react";

/** Scrollable content column of a builder step: title block + stacked sections, centred at a reading width. */
export default function StepBody({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h2 className="text-base font-semibold tracking-tight text-neutral-900">{title}</h2>
          <p className="mt-1 text-[13px] text-neutral-500">{description}</p>
        </div>
        <div className="space-y-5">{children}</div>
      </div>
    </div>
  );
}
