"use client";

import { useState } from "react";
import Link from "next/link";
import { LinkedinLogo, XLogo } from "@phosphor-icons/react/ssr";
import BookDemoModal from "@/components/BookDemoModal";
import { Container, Wordmark } from "./LandingPrimitives";

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

const LINK = "text-[14px] text-neutral-500 transition-colors hover:text-neutral-950";
const HEAD = "mb-4 text-[11px] font-medium uppercase tracking-wider text-neutral-400";

export default function LandingFooter() {
  const [isAccessOpen, setIsAccessOpen] = useState(false);

  return (
    <>
      <footer className="border-t border-neutral-200/80 bg-white pb-10 pt-14 md:pt-16">
        <Container>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.6fr_repeat(4,1fr)]">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="inline-flex rounded-lg" aria-label="LeadGennie home">
                <Wordmark />
              </Link>
              <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-neutral-500">
                AI-led GTM for SMB outbound: built around enrichment, intent, personalization and multi-channel workflows.
              </p>
            </div>

            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className={HEAD}>{col.title}</p>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={LINK}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div>
              <p className={HEAD}>Get access</p>
              <ul className="space-y-2.5">
                <li>
                  <button type="button" onClick={() => setIsAccessOpen(true)} className={LINK}>
                    Early access
                  </button>
                </li>
                <li>
                  <Link href="/login" className={LINK}>
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-14 flex flex-col-reverse items-start justify-between gap-4 border-t border-neutral-200/80 pt-6 text-[12px] text-neutral-400 sm:flex-row sm:items-center">
            <span>
              © {new Date().getFullYear()} LeadGennie. Beta product. Product capabilities and channel availability are subject
              to change.
            </span>
            <div className="flex items-center gap-1">
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="LeadGennie on LinkedIn"
              >
                <LinkedinLogo className="h-4 w-4" weight="fill" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="LeadGennie on X"
              >
                <XLogo className="h-4 w-4" weight="bold" />
              </a>
            </div>
          </div>
        </Container>
      </footer>

      <BookDemoModal isOpen={isAccessOpen} onClose={() => setIsAccessOpen(false)} />
    </>
  );
}
