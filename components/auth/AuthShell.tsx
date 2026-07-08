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
    <div className="relative min-h-screen w-full bg-background bg-grid overflow-hidden flex items-center justify-center px-4 py-16">
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-purple-600/10 blur-3xl animate-blob-1" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl animate-blob-2" />

      <div className="relative w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 group">
          <div className="w-8 h-8 bg-white flex items-center justify-center rounded-sm group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">LeadGennie</span>
        </Link>

        <div className="glass rounded-2xl p-8 shadow-2xl">
          <h1 className="text-2xl font-semibold text-white text-center">{title}</h1>
          <p className="text-sm text-neutral-400 text-center mt-2 mb-8">{subtitle}</p>
          {children}
        </div>

        <p className="text-center text-sm text-neutral-500 mt-6">{footer}</p>
      </div>
    </div>
  );
}
