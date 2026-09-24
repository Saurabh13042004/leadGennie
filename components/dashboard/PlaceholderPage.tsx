import type { LucideIcon } from "lucide-react";
import Link from "next/link";

/**
 * An honest empty state for a primary destination whose real feature lands in
 * a later phase. It says what will live here and where to go meanwhile — it
 * never shows sample or invented data.
 */
export default function PlaceholderPage({
  title,
  description,
  icon: Icon,
  heading,
  body,
  links,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  heading: string;
  body: string;
  links?: { label: string; href: string }[];
}) {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-start gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">{title}</h1>
          <p className="text-sm text-neutral-500">{description}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 flex flex-col items-center text-center py-20 px-6">
        <p className="text-neutral-900 font-semibold">{heading}</p>
        <p className="text-sm text-neutral-500 mt-1 max-w-md">{body}</p>
        {links && links.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-neutral-700 hover:text-neutral-900 bg-white border border-neutral-200 rounded-lg px-3 py-2 transition-colors hover:border-neutral-300"
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
