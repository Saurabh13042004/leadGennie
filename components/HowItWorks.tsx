"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    num: "01",
    title: "Import leads",
    tag: "[+] 1-click CSV or CRM import",
    desc: "Upload CSVs, sync Sheets, or connect CRM."
  },
  {
    num: "02",
    title: "Describe your ICP",
    tag: "[+] Plain English ICP filters",
    desc: "Use plain English to define your target audience."
  },
  {
    num: "03",
    title: "Launch AI outreach",
    tag: "[+] Multi-channel sequences",
    desc: "Generate personalized email + LinkedIn campaigns instantly."
  },
  {
    num: "04",
    title: "Book more meetings",
    tag: "[+] Automated CRM syncing",
    desc: "Track replies and sync everything back to CRM."
  }
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-32 relative bg-[#050505]">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-16 items-start">
          
          {/* Sticky Left Content */}
          <div className="md:w-1/3 md:sticky md:top-32 md:h-fit">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-[1.1] mb-6"
            >
              How it works.
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-neutral-400 text-lg font-medium"
            >
              From spreadsheets to booked meetings on autopilot. No manual SDR busywork, just qualified pipeline.
            </motion.p>
          </div>

          {/* Scrolling Cards Right Content */}
          <div className="md:w-2/3 flex flex-col gap-4">
            {STEPS.map((step, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.4 }}
                key={i}
                className="bg-[#0A0A0A] border border-white/5 hover:border-white/20 transition-colors p-8 md:p-10 flex flex-col gap-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
                  {/* Title & Tag */}
                  <div className="flex flex-col gap-1 text-left">
                    <h3 className="text-xl md:text-2xl font-bold text-white">
                      {step.title}
                    </h3>
                    {step.tag && (
                      <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                        {step.tag}
                      </span>
                    )}
                  </div>
                  
                  {/* Number Badge */}
                  <div className="px-3 py-1 bg-white/10 text-white font-mono text-xs rounded-sm shrink-0 self-start sm:self-auto">
                    STEP {step.num}
                  </div>
                </div>

                {/* Description */}
                <p className="text-neutral-400 leading-relaxed max-w-xl font-medium mt-2">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}

