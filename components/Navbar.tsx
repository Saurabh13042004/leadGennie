"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import BookDemoModal from "./BookDemoModal";

export default function Navbar() {
  const [isBookDemoOpen, setIsBookDemoOpen] = useState(false);
  return (
    <>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pt-6 px-4"
      >
        <div className="bg-[#0A0A0A]/90 backdrop-blur-md px-6 py-3 rounded-xl flex items-center justify-between w-full max-w-6xl border border-white/10 shadow-2xl">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 bg-white flex items-center justify-center rounded-sm group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5 text-black animate-pulse" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-tight">LeadGennie</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link href="/#features" className="text-neutral-400 hover:text-white transition-colors">Platform</Link>
          <Link href="/#how-it-works" className="text-neutral-400 hover:text-white transition-colors">How it works</Link>
          <Link href="/about" className="text-neutral-400 hover:text-white transition-colors">Company</Link>
          
          <div className="group relative">
            <span className="text-neutral-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1">
              Compare
              <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
            <div className="absolute top-full left-0 pt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none group-hover:pointer-events-auto">
              <div className="bg-[#0A0A0A] border border-white/10 rounded-lg shadow-xl p-2 flex flex-col">
                <Link href="/compare/apollo" className="px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">vs Apollo</Link>
                <Link href="/compare/clay" className="px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">vs Clay</Link>
                <Link href="/compare/instantly" className="px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">vs Instantly</Link>
                <Link href="/compare/hubspot" className="px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-white/5 rounded-md transition-colors">vs HubSpot</Link>
              </div>
            </div>
          </div>
        </nav>

        <div className="flex items-center gap-5">
          <button 
            onClick={() => setIsBookDemoOpen(true)}
            className="text-neutral-400 hover:text-white text-sm hidden sm:inline-block transition-colors"
          >
            Book Demo
          </button>
          <Link href="/#waitlist">
            <button className="bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors">
              Get Started
            </button>
          </Link>
        </div>
      </div>
    </motion.header>

    <BookDemoModal isOpen={isBookDemoOpen} onClose={() => setIsBookDemoOpen(false)} />
  </>
  );
}
