"use client";

import { motion } from "framer-motion";
import { Bot, Mail, Filter, RefreshCw, BarChart3, Sliders, Layers } from "lucide-react";

const FEATURES = [
  {
    icon: <Bot className="w-5 h-5 text-neutral-300" />,
    title: "Automated Workflows",
    tag: "[+] Approval-gated",
    desc: "Automated sequences run on a schedule — and nothing sends until an owner or admin approves it.",
    colSpan: "md:col-span-2",
    bgImage: "/ai_sdr_agent.png",
  },
  {
    icon: <Filter className="w-5 h-5 text-neutral-300" />,
    title: "Smart Lead Filtering",
    tag: "[+] Natural-language filters",
    desc: "Describe your ideal customer in plain English and get a saved, reusable audience of the leads you already have.",
    colSpan: "md:col-span-1",
    bgImage: "/ai_filters.png",
  },
  {
    icon: <Mail className="w-5 h-5 text-neutral-300" />,
    title: "Personalized Outreach",
    tag: "[+] Grounded in your pitch",
    desc: "Draft emails around your actual offer and audience, then review every message before it goes out.",
    colSpan: "md:col-span-1",
    bgImage: "/ai_personalisation.png",
  },
  {
    icon: <Layers className="w-5 h-5 text-neutral-300" />,
    title: "Multi-channel Sequences",
    tag: "[+] Email + LinkedIn",
    desc: "Build multi-step sequences across email and LinkedIn with wait times between touches.",
    colSpan: "md:col-span-2",
    bgImage: "/ready_to_launch_campagin.png",
  },
  {
    icon: <RefreshCw className="w-5 h-5 text-neutral-300" />,
    title: "CRM Sync",
    tag: "[+] HubSpot connection",
    desc: "Connect HubSpot securely today. More CRM connectors are on the roadmap.",
    colSpan: "md:col-span-1",
    bgImage: "/integrations.png",
  },
  {
    icon: <BarChart3 className="w-5 h-5 text-neutral-300" />,
    title: "Live Analytics",
    tag: "[+] Real campaign metrics",
    desc: "See sends, replies, and suppressions counted from what actually happened — never estimated.",
    colSpan: "md:col-span-1",
    bgImage: "/dashboard.png",
  },
  {
    icon: <Sliders className="w-5 h-5 text-neutral-300" />,
    title: "Automated Scale",
    tag: "[+] Deliverability controls",
    desc: "Verified sending domains, per-mailbox daily limits, and automatic suppression of bounces and complaints.",
    colSpan: "md:col-span-1",
    bgImage: "/quick_ai_actions.png",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-32 relative bg-black border-y border-white/5">
      <div className="max-w-6xl mx-auto px-4 relative z-10">
        <div className="mb-16 md:mb-24">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-mono tracking-[0.15em] uppercase text-neutral-500 mb-6"
          >
            [ Outbound Autopilot ]
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4"
          >
            Everything you need to <br className="hidden md:block" />
            run outbound on autopilot.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="text-sm font-mono text-neutral-500 mt-4 italic text-left md:text-left"
          >
            “Run outbound with a team of one. AI does the repetitive work. Humans close deals.”
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map((feat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={`p-8 md:p-10 rounded-xl bg-[#0A0A0A] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between relative overflow-hidden group min-h-[340px] md:min-h-[380px] ${feat.colSpan}`}
            >
              {feat.bgImage && (
                <>
                  <img
                    src={feat.bgImage}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover object-left-top opacity-25 group-hover:opacity-40 group-hover:scale-[1.04] transition-all duration-700 pointer-events-none z-0"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/85 to-transparent z-10 pointer-events-none" />
                </>
              )}

              <div className="flex items-center justify-between gap-4 mb-8 relative z-20">
                <div className="text-neutral-400">
                  {feat.icon}
                </div>
                {feat.tag && (
                  <span className="text-[10px] font-mono text-neutral-450 uppercase border border-white/10 bg-white/5 px-2 py-0.5 rounded-sm">
                    {feat.tag}
                  </span>
                )}
              </div>
              <div className="relative z-20">
                <h3 className="text-xl font-bold text-white mb-3">{feat.title}</h3>
                <p className="text-neutral-400 leading-relaxed font-medium text-xs md:text-sm">
                  {feat.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
