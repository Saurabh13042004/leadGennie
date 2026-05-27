"use client";

import { motion } from "framer-motion";
import { X, Check } from "lucide-react";

export default function Problem() {
  return (
    <section className="py-32 relative bg-black border-y border-white/5">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-6"
          >
            Outbound is broken.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-neutral-400 font-medium max-w-2xl mx-auto"
          >
            Outbound teams are drowning in fragmented tools and repetitive workflows. LeadGennie replaces manual SDR execution with one unified outbound system.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* The Old Way */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-xl border border-white/10 bg-[#0A0A0A] p-8 md:p-10 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50" />
            <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
              <span className="font-mono text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded-sm">
                [LEGACY]
              </span>
              The Old Way
            </h3>
            
            <ul className="space-y-5 font-mono text-sm">
              {[
                "Manual spreadsheet cleanup",
                "Generic cold emails",
                "SDR busywork",
                "Fragmented tools",
                "No personalization at scale",
                "CRM chaos"
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-4 text-neutral-500">
                  <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* The LeadGennie Way */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-xl border border-white/20 bg-[#111111] p-8 md:p-10 relative overflow-hidden shadow-2xl"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-white" />
            <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
              <span className="font-mono text-xs text-black bg-white px-2 py-1 rounded-sm">
                [NEW]
              </span>
              LeadGennie
            </h3>
            
            <ul className="space-y-5 font-mono text-sm">
              {[
                "Smart intelligence filtering (High Accuracy)",
                "Personalized outreach (Scale outbound without scaling headcount)",
                "Multi-channel campaigns (Launch campaigns in minutes, not weeks)",
                "Automated lead qualification",
                "Automated outbound workflows (Run outbound with a team of one)",
                "Unified outbound system replacing fragmented tools"
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-4 text-neutral-300">
                  <Check className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
