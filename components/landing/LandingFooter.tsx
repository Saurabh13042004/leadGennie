"use client";

import { useState } from "react";
import Link from "next/link";
import BookDemoModal from "@/components/BookDemoModal";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#product", label: "Overview" },
      { href: "/#how", label: "How it works" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/compare/apollo", label: "Compare" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/#resources", label: "FAQ" },
      { href: "/#integrations", label: "Integrations" },
      { href: "/#security", label: "Security" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export default function LandingFooter() {
  const [isAccessOpen, setIsAccessOpen] = useState(false);

  return (
    <>
      <footer className="border-t border-neutral-200 bg-white py-14">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.9fr_0.9fr_0.9fr_0.9fr]">
            <div>
              <Link href="/" className="mb-4 flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900">
                  <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z" />
                  </svg>
                </div>
                <span className="text-[15px] font-extrabold tracking-tight text-neutral-900">LeadGennie</span>
              </Link>
              <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
                AI-led GTM for SMB outbound: built around enrichment, intent, personalization and multi-channel
                workflows.
              </p>
            </div>

            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-400">{col.title}</p>
                <div className="flex flex-col gap-2.5">
                  {col.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-400">Get access</p>
              <div className="flex flex-col items-start gap-2.5">
                <button
                  onClick={() => setIsAccessOpen(true)}
                  className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
                >
                  Early access
                </button>
                <Link href="/login" className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">
                  Sign in
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-neutral-200 pt-6 text-xs text-neutral-400 sm:flex-row sm:items-center">
            <span>
              © {new Date().getFullYear()} LeadGennie. Beta product. Product capabilities and channel availability
              are subject to change.
            </span>
            <div className="flex items-center gap-4">
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 transition-colors hover:text-neutral-700"
                aria-label="LeadGennie on LinkedIn"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.28 2.38 4.28 5.47v6.27zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
                </svg>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 transition-colors hover:text-neutral-700"
                aria-label="LeadGennie on X"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.24 2.5h3.3l-7.2 8.23 8.47 11.27h-6.63l-5.2-6.8-5.94 6.8H1.75l7.7-8.8L1.4 2.5h6.79l4.7 6.22 5.35-6.22zm-1.16 17.6h1.83L7.02 4.3H5.06l12.02 15.8z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      <BookDemoModal isOpen={isAccessOpen} onClose={() => setIsAccessOpen(false)} />
    </>
  );
}
