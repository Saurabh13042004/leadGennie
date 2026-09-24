"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Calendar } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import BookDemoModal from "./BookDemoModal";

// Deliberately contains no metrics, customer names, or product screenshots:
// nothing here is measured. The landing page is rebuilt with real product
// visuals in Phase 11 (see docs/phases/phase-11-billing-beta.md).
export default function Hero() {
  const [isBookDemoOpen, setIsBookDemoOpen] = useState(false);

  return (
    <>
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden flex flex-col items-center text-center px-4">
        <div className="absolute inset-0 bg-dot-matrix opacity-20 pointer-events-none z-0" />

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative z-10 text-5xl md:text-7xl font-bold text-white tracking-tight leading-[1.1] max-w-4xl mb-6"
        >
          Outbound that actually <br className="hidden md:block" />
          <span className="text-neutral-500">books meetings.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative z-10 text-lg md:text-xl text-neutral-400 max-w-3xl mb-10 leading-relaxed font-medium"
        >
          Upload leads, launch personalized campaigns, track inbox health, and manage outbound performance — all in one
          platform.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative z-10 flex flex-col sm:flex-row items-center gap-4 mb-10"
        >
          <Link href="#waitlist">
            <button className="bg-white text-black font-semibold text-base px-8 py-3.5 rounded-md hover:bg-neutral-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              Join Waitlist
            </button>
          </Link>
          <button
            onClick={() => setIsBookDemoOpen(true)}
            className="bg-transparent border border-white/10 text-white font-medium text-base px-8 py-3.5 rounded-md hover:bg-white/5 hover:border-white/20 transition-all flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Book Demo
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative z-10 flex items-center gap-6 text-sm text-neutral-500"
        >
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> No credit card
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Early access
          </div>
          <div className="items-center gap-1.5 hidden sm:flex">
            <CheckCircle2 className="w-4 h-4" /> Built for modern GTM teams
          </div>
        </motion.div>
      </section>

      <BookDemoModal isOpen={isBookDemoOpen} onClose={() => setIsBookDemoOpen(false)} />
    </>
  );
}
