import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkle } from "@phosphor-icons/react/ssr";
import AuthPreview from "./AuthPreview";

/** Split-screen auth layout: the form on the left, a product preview on large screens. */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen w-full bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-screen flex-col px-6 py-6 sm:px-10">
        <Link href="/" className="group flex w-fit items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform group-hover:scale-105">
            <Sparkle className="h-4 w-4" weight="fill" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-neutral-900">
            LeadGennie
          </span>
        </Link>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-neutral-900">
              {title}
            </h1>
            <p className="mb-8 mt-1.5 text-sm text-neutral-500">{subtitle}</p>
            {children}
            <p className="mt-8 text-sm text-neutral-500">{footer}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
          <span>© {new Date().getFullYear()} LeadGennie</span>
          <Link href="/privacy" className="hover:text-neutral-700">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-neutral-700">
            Terms
          </Link>
          <Link href="/security" className="hover:text-neutral-700">
            Security
          </Link>
        </div>
      </div>
      <AuthPreview />
    </div>
  );
}
