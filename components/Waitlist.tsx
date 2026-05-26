"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Waitlist() {
  return (
    <section id="waitlist" className="py-32 relative overflow-hidden bg-[#050505]">
      <div className="absolute inset-0 bg-dot-matrix opacity-20 pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#111111] border border-white/10 text-sm text-neutral-400 font-mono mb-8"
        >
          <Sparkles className="w-4 h-4 text-white" /> Early Access
        </motion.div>

        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6"
        >
          Your future SDR team <br />
          is almost ready.
        </motion.h2>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-lg text-neutral-400 mb-10 max-w-2xl mx-auto font-medium"
        >
          Outbound is becoming autonomous. Join ambitious founders and revenue teams getting early access to LeadGennie.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="max-w-md mx-auto"
        >
          <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
            <input 
              type="email" 
              placeholder="name@company.com" 
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-sm h-12 px-4 text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/30 transition-colors font-mono text-sm"
            />
            <button className="w-full h-12 rounded-sm bg-white text-black font-semibold flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors mt-2">
              Join Waitlist <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-sm text-neutral-500 font-mono">
            <span>[+] Early access</span>
            <span>[+] Priority onboarding</span>
            <span>[+] Founder community</span>
            <span>[+] Onboarding credits</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
