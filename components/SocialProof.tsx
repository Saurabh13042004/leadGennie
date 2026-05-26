"use client";

import { motion } from "framer-motion";

const LOGO_DEV_KEY = process.env.NEXT_PUBLIC_LOGO_DEV_KEY || "pk_JjnhOWGpTn6ebgzkcOylJg";

const LOGOS = [
  { name: "Linear", domain: "linear.app" },
  { name: "Vercel", domain: "vercel.com" },
  { name: "Stripe", domain: "stripe.com" },
  { name: "Mercury", domain: "mercury.com" },
  { name: "Retool", domain: "retool.com" },
  { name: "Clay", domain: "clay.com" },
  { name: "Attio", domain: "attio.com" },
  { name: "Arc", domain: "arc.net" }
];

export default function SocialProof() {
  return (
    <section className="py-16 border-y border-white/5 bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">
            Designed for modern GTM teams.
          </h2>
        </div>

        {/* Logo Marquee */}
        <div className="relative flex overflow-hidden mask-image-fade">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 30, ease: "linear", repeat: Infinity }}
            className="flex flex-none gap-20 pr-20 items-center"
          >
            {[...LOGOS, ...LOGOS, ...LOGOS].map((logo, i) => (
              <div key={i} className="group flex items-center gap-3 h-10 select-none">
                <img
                  src={`https://img.logo.dev/${logo.domain}?token=${LOGO_DEV_KEY}`}
                  alt={`${logo.name} logo`}
                  className="h-6 w-auto object-contain grayscale opacity-50 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-300"
                  loading="lazy"
                />
                <span className="text-xl font-extrabold tracking-tight text-neutral-600 group-hover:text-white transition-colors duration-300">
                  {logo.name}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .mask-image-fade {
          mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
        }
      `}} />
    </section>
  );
}
