import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import type { NavIcon } from "@/lib/nav-config";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";

export type PlaceholderFeature = { icon: NavIcon; title: string; description: string };

/**
 * An honest empty state for a primary destination whose real feature lands in
 * a later phase. It says what will live here and where to go meanwhile — it
 * never shows sample or invented data. `skeleton` draws the page's future
 * layout as neutral outlines behind the message (shapes only: no names, no
 * numbers, no fake content).
 */
export default function PlaceholderPage({
  title,
  description,
  icon,
  heading,
  body,
  links,
  preview,
  features,
  skeleton,
}: {
  title: string;
  description: string;
  icon: NavIcon;
  heading: string;
  body: string;
  links?: { label: string; href: string }[];
  /** Optional list of what's coming — plain capability names, never numbers. */
  preview?: string[];
  /** Richer version of `preview`: capability + one line on what it does. */
  features?: PlaceholderFeature[];
  /** Layout outline drawn (inert, decorative) behind the message. */
  skeleton?: ReactNode;
}) {
  const actions = links?.map((l, i) => (
    <Link key={l.href} href={l.href} className={buttonClasses({ variant: i === 0 ? "primary" : "secondary" })}>
      {l.label}
      {i === 0 && <ArrowRight className="h-3.5 w-3.5" weight="bold" />}
    </Link>
  ));

  const featureList = features && features.length > 0 && (
    <ul className="mt-6 w-full space-y-1 border-t border-neutral-100 pt-5 text-left">
      {features.map(({ icon: Icon, title: t, description: d }) => (
        <li key={t} className="flex items-start gap-3 rounded-lg px-2 py-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-50 ring-1 ring-inset ring-neutral-200/70">
            <Icon className="h-4 w-4 text-neutral-600" weight="duotone" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-neutral-900">{t}</span>
            <span className="block text-[12px] leading-relaxed text-neutral-500">{d}</span>
          </span>
        </li>
      ))}
    </ul>
  );

  const previewList = preview && preview.length > 0 && (
    <div className="mt-10 w-full max-w-md rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 p-4 text-left">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400">Coming here</p>
      <ul className="space-y-1.5">
        {preview.map((p) => (
          <li key={p} className="flex items-center gap-2 text-[13px] text-neutral-600">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );

  if (!skeleton) {
    return (
      <>
        <PageHeader title={title} icon={icon} description={description} />
        <div className="mx-auto max-w-3xl px-6">
          <EmptyState icon={icon} title={heading} description={body} actions={actions}>
            {featureList && <div className="w-full max-w-md">{featureList}</div>}
            {previewList}
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={title} icon={icon} description={description} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 select-none [mask-image:linear-gradient(to_bottom,black_30%,transparent_95%)]"
        >
          {skeleton}
        </div>
        <div className="relative z-10 flex h-full justify-center overflow-y-auto px-4 py-8 md:items-center md:py-10">
          <div className="h-fit w-full max-w-[440px] rounded-2xl bg-white/95 shadow-[0_24px_48px_-16px_rgba(15,23,42,0.18),0_2px_6px_rgba(15,23,42,0.05)] ring-1 ring-neutral-200/80 backdrop-blur-sm">
            <EmptyState icon={icon} title={heading} description={body} className="px-6 pb-6 pt-8" compact>
              {featureList}
              {previewList}
              {actions && actions.length > 0 && (
                <div className="mt-5 flex w-full flex-wrap justify-center gap-2 border-t border-neutral-100 pt-5">{actions}</div>
              )}
            </EmptyState>
          </div>
        </div>
      </div>
    </div>
  );
}
