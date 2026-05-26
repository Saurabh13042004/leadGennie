"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#050505] py-16 relative z-10">
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-10">
        
        {/* Column 1: Brand Info */}
        <div className="flex flex-col gap-4">
          <Link href="/" className="flex items-center gap-2 cursor-pointer w-fit">
            <div className="w-6 h-6 rounded-sm bg-white flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-black" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z" />
              </svg>
            </div>
            <span className="text-white font-bold tracking-tight">LeadGennie</span>
          </Link>
          <p className="text-neutral-400 text-sm font-medium max-w-xs leading-relaxed">
            Outbound on autopilot. Turn spreadsheets into booked meetings with autonomous AI SDR systems.
          </p>
          <div className="text-xs text-neutral-600 mt-2 font-mono">
            A product by <a href="/about" className="hover:text-neutral-400 underline transition-colors">DICE Solutions</a>
            <br />
            © {new Date().getFullYear()} LeadGennie. All rights reserved.
          </div>
        </div>

        {/* Column 2: Comparisons */}
        <div className="flex flex-col gap-3">
          <span className="text-white text-xs font-mono tracking-wider uppercase text-neutral-400">Comparisons</span>
          <div className="flex flex-col gap-2.5 text-sm font-medium">
            <Link href="/compare/clay" className="text-neutral-500 hover:text-white transition-colors">LeadGennie vs Clay</Link>
            <Link href="/compare/apollo" className="text-neutral-500 hover:text-white transition-colors">LeadGennie vs Apollo</Link>
            <Link href="/compare/instantly" className="text-neutral-500 hover:text-white transition-colors">LeadGennie vs Instantly</Link>
            <Link href="/compare/hubspot" className="text-neutral-500 hover:text-white transition-colors">LeadGennie vs HubSpot</Link>
          </div>
        </div>

        {/* Column 3: Trust & Legal */}
        <div className="flex flex-col gap-3">
          <span className="text-white text-xs font-mono tracking-wider uppercase text-neutral-400">Company & Trust</span>
          <div className="flex flex-col gap-2.5 text-sm font-medium">
            <Link href="/about" className="text-neutral-500 hover:text-white transition-colors">About Us</Link>
            <Link href="/security" className="text-neutral-500 hover:text-white transition-colors">Security Overview</Link>
            <Link href="/privacy" className="text-neutral-500 hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-neutral-500 hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>

        {/* Column 4: Contact & Social */}
        <div className="flex flex-col gap-3">
          <span className="text-white text-xs font-mono tracking-wider uppercase text-neutral-400">Connect</span>
          <div className="flex flex-col gap-2.5 text-sm font-medium">
            <a href="mailto:support@leadgennie.ai" className="text-neutral-500 hover:text-white transition-colors font-mono text-xs">support@leadgennie.ai</a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-white transition-colors">Twitter / X</a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-white transition-colors">LinkedIn</a>
          </div>
        </div>
        
      </div>
    </footer>
  );
}
