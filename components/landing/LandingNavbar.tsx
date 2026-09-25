"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowRight, List, X } from "@phosphor-icons/react/ssr";
import BookDemoModal from "@/components/BookDemoModal";
import Button, { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Wordmark } from "./LandingPrimitives";

const NAV_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how", label: "How it works" },
  { href: "/#solutions", label: "Solutions" },
  { href: "/#integrations", label: "Integrations" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#security", label: "Security" },
];

function subscribeScroll(cb: () => void) {
  window.addEventListener("scroll", cb, { passive: true });
  return () => window.removeEventListener("scroll", cb);
}

export default function LandingNavbar() {
  const [isAccessOpen, setIsAccessOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = useSyncExternalStore(subscribeScroll, () => window.scrollY > 4, () => false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const solid = scrolled || menuOpen;

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-200",
          solid ? "border-neutral-200/80 bg-white/85 backdrop-blur-xl backdrop-saturate-150" : "border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto] items-center gap-4 px-4 md:px-6 lg:grid-cols-[1fr_auto_1fr]">
          <Link href="/" className="justify-self-start rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40" aria-label="LeadGennie home">
            <Wordmark />
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-1.5 text-[13px] font-medium text-neutral-600 transition-colors hover:bg-neutral-100/80 hover:text-neutral-950"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center justify-self-end gap-1.5">
            <Link href="/login" className={buttonClasses({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}>
              Sign in
            </Link>
            <Button variant="primary" size="sm" onClick={() => setIsAccessOpen(true)}>
              Get Early Access
              <ArrowRight className="h-3.5 w-3.5" weight="bold" />
            </Button>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-700 ring-1 ring-inset ring-neutral-200 transition-colors hover:bg-neutral-50 lg:hidden"
            >
              {menuOpen ? <X className="h-[18px] w-[18px]" weight="bold" /> : <List className="h-[18px] w-[18px]" weight="bold" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div id="landing-mobile-menu" className="border-t border-neutral-200/80 bg-white lg:hidden">
            <nav className="mx-auto flex max-w-6xl flex-col px-4 py-3 md:px-6" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex h-11 items-center border-b border-neutral-100 text-[15px] font-medium text-neutral-800 last:border-0"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-2 px-4 pb-5 md:px-6">
              <Link href="/login" onClick={() => setMenuOpen(false)} className={buttonClasses({ variant: "secondary", size: "md", className: "h-10" })}>
                Sign in
              </Link>
              <Button
                variant="primary"
                size="md"
                className="h-10"
                onClick={() => {
                  setMenuOpen(false);
                  setIsAccessOpen(true);
                }}
              >
                Get Early Access
              </Button>
            </div>
          </div>
        )}
      </header>

      {menuOpen && <div className="fixed inset-0 z-40 bg-neutral-950/20 backdrop-blur-[2px] lg:hidden" onClick={() => setMenuOpen(false)} aria-hidden />}

      <BookDemoModal isOpen={isAccessOpen} onClose={() => setIsAccessOpen(false)} />
    </>
  );
}
