import type { ReactNode } from "react";
import { EnvelopeSimple, FileCsv, LinkedinLogo, Plus, Table } from "@phosphor-icons/react/ssr";
import { Container, Eyebrow } from "./LandingPrimitives";

/** Brands without a Phosphor glyph get a monochrome letter mark in the same tile, so the row stays uniform. */
function Letter({ children }: { children: ReactNode }) {
  return <span className="text-[12px] font-semibold">{children}</span>;
}

const INTEGRATIONS: { label: string; mark: ReactNode; comingSoon?: boolean }[] = [
  { label: "HubSpot", mark: <Letter>H</Letter> },
  { label: "CSV import", mark: <FileCsv className="h-4 w-4" weight="duotone" /> },
  { label: "Email", mark: <EnvelopeSimple className="h-4 w-4" weight="duotone" /> },
  { label: "LinkedIn", mark: <LinkedinLogo className="h-4 w-4" weight="duotone" />, comingSoon: true },
  { label: "Salesforce", mark: <Letter>S</Letter>, comingSoon: true },
  { label: "Google Sheets", mark: <Table className="h-4 w-4" weight="duotone" />, comingSoon: true },
  { label: "Pipedrive", mark: <Letter>P</Letter>, comingSoon: true },
  { label: "More tools", mark: <Plus className="h-4 w-4" weight="bold" /> },
];

export default function IntegrationsStrip() {
  return (
    <section id="integrations" className="scroll-mt-20 border-y border-neutral-200/80 bg-neutral-50/60 py-14 md:py-16">
      <Container>
        <Eyebrow className="mb-6 text-center">Connect the tools you already use</Eyebrow>
        <ul className="mx-auto grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl bg-neutral-200/80 ring-1 ring-neutral-200/80 md:grid-cols-4">
          {INTEGRATIONS.map((item) => (
            <li key={item.label} className="flex min-h-[64px] items-center gap-3 bg-white px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-50 text-neutral-600 ring-1 ring-inset ring-neutral-200/80">
                {item.mark}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-neutral-900">{item.label}</span>
                {item.comingSoon && <span className="block text-[11px] text-neutral-400">Coming soon</span>}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
