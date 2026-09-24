import Link from "next/link";
import type { ReactNode } from "react";

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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-white px-4 py-16">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-fuchsia-200/30 blur-3xl" />

      <div className="relative w-full max-w-md">
        <Link href="/" className="group mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-900 transition-transform group-hover:scale-105">
            <svg className="h-4.5 w-4.5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z" />
            </svg>
          </div>
          <span className="text-xl font-extrabold tracking-tight text-neutral-900">LeadGennie</span>
        </Link>

        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-[0_24px_70px_rgba(20,25,30,0.08)]">
          <h1 className="text-center text-2xl font-bold text-neutral-900">{title}</h1>
          <p className="mb-8 mt-2 text-center text-sm text-neutral-500">{subtitle}</p>
          {children}
        </div>

        <p className="mt-6 text-center text-sm text-neutral-500">{footer}</p>
      </div>
    </div>
  );
}
