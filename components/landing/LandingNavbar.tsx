"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import BookDemoModal from "@/components/BookDemoModal";

const NAV_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how", label: "How it works" },
  { href: "/#solutions", label: "Solutions" },
  { href: "/#integrations", label: "Integrations" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#security", label: "Security" },
];

export default function LandingNavbar() {
  const [isAccessOpen, setIsAccessOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-[74px] max-w-6xl items-center justify-between gap-6 px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-900">
              <svg className="h-4.5 w-4.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z" />
              </svg>
            </div>
            <span className="text-[17px] font-extrabold tracking-tight text-neutral-900">LeadGennie</span>
          </Link>

          <nav className="hidden items-center gap-6 text-[13px] font-medium text-neutral-600 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-neutral-900">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-[13px] font-medium text-neutral-600 transition-colors hover:text-neutral-900 sm:inline-block"
            >
              Sign in
            </Link>
            <button
              onClick={() => setIsAccessOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2.5 text-[13px] font-semibold text-white transition-transform hover:-translate-y-px hover:bg-neutral-800"
            >
              Get Early Access
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <BookDemoModal isOpen={isAccessOpen} onClose={() => setIsAccessOpen(false)} />
    </>
  );
}
