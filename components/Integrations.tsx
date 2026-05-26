"use client";

import { motion } from "framer-motion";

const LOGO_DEV_KEY = process.env.NEXT_PUBLIC_LOGO_DEV_KEY || "pk_JjnhOWGpTn6ebgzkcOylJg";

const INTEGRATIONS = [
  { name: "Salesforce", domain: "salesforce.com" },
  { name: "HubSpot", domain: "hubspot.com" },
  { name: "Pipedrive", domain: "pipedrive.com" },
  { name: "Google Sheets", domain: "sheets.google.com" },
  { name: "Gmail", domain: "gmail.com" },
  { name: "Outlook", domain: "outlook.com" },
  { name: "LinkedIn", domain: "linkedin.com" },
  { name: "Zapier", domain: "zapier.com" },
  { name: "WhatsApp", domain: "whatsapp.com" },
];

export default function Integrations() {
  return (
    <section id="integrations" className="py-32 border-y border-white/5 bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-dot-matrix opacity-20 pointer-events-none" />
      
      <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-xs font-mono tracking-[0.15em] uppercase text-neutral-500 mb-6"
        >
          {/* Ecosystem */}
          [ Ecosystem ]
        </motion.div>
        
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight"
        >
          Plugs into the tools your team already uses
        </motion.h2>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-neutral-400 text-lg mb-16 max-w-xl mx-auto font-medium"
        >
          LeadGennie syncs natively with your CRM, email providers, and sales tools in minutes.
        </motion.p>

        {/* Marquee Container */}
        <div className="relative w-full overflow-hidden border-y border-white/10 bg-[#050505] py-10 flex">
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
          
          <div className="flex w-max min-w-full animate-[marquee_20s_linear_infinite] gap-8 px-4">
            {[...INTEGRATIONS, ...INTEGRATIONS].map((int, i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center gap-3 w-32 select-none"
              >
                <div className="w-10 h-10 flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity">
                  <img 
                    src={`https://img.logo.dev/${int.domain}?token=${LOGO_DEV_KEY}`} 
                    alt={`${int.name} logo`} 
                    className="w-full h-full object-contain grayscale hover:grayscale-0 transition-all duration-300"
                    loading="lazy"
                  />
                </div>
                <span className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
                  {int.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}} />
    </section>
  );
}
