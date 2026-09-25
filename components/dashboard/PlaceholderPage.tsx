import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import type { NavIcon } from "@/lib/nav-config";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";

/**
 * An honest empty state for a primary destination whose real feature lands in
 * a later phase. It says what will live here and where to go meanwhile — it
 * never shows sample or invented data.
 */
export default function PlaceholderPage({
  title,
  description,
  icon,
  heading,
  body,
  links,
  preview,
}: {
  title: string;
  description: string;
  icon: NavIcon;
  heading: string;
  body: string;
  links?: { label: string; href: string }[];
  /** Optional list of what's coming — plain capability names, never numbers. */
  preview?: string[];
}) {
  return (
    <>
      <PageHeader title={title} icon={icon} description={description} />
      <div className="mx-auto max-w-3xl px-6">
        <EmptyState
          icon={icon}
          title={heading}
          description={body}
          actions={links?.map((l, i) => (
            <Link key={l.href} href={l.href} className={buttonClasses({ variant: i === 0 ? "primary" : "secondary" })}>
              {l.label}
              {i === 0 && <ArrowRight className="h-3.5 w-3.5" weight="bold" />}
            </Link>
          ))}
        >
          {preview && preview.length > 0 && (
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
          )}
        </EmptyState>
      </div>
    </>
  );
}
