"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Calendar, Mail } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";

const activities = [
  "Filtering fintech CTOs matching ICP...",
  "AI generated 42 personalized email copy variants",
  "Sending multi-channel LinkedIn + Email sequences",
  "Analyzing Stripe engineering hiring signals...",
  "Inbox reputation warming optimized"
];

const events = [
  { text: "Meeting booked with Acme Corp", icon: <Calendar className="w-4 h-4 text-green-400" /> },
  { text: "3 replies received (24.6% Avg Reply Rate)", icon: <Mail className="w-4 h-4 text-blue-400" /> },
  { text: "Lead scored 98/100 matching ICP", icon: <CheckCircle2 className="w-4 h-4 text-purple-400" /> }
];

export default function Hero() {
  const [activityIdx, setActivityIdx] = useState(0);
  const [eventIdx, setEventIdx] = useState(0);

  useEffect(() => {
    const activityInterval = setInterval(() => {
      setActivityIdx((prev) => (prev + 1) % activities.length);
    }, 3000);

    const eventInterval = setInterval(() => {
      setEventIdx((prev) => (prev + 1) % events.length);
    }, 4500);

    return () => {
      clearInterval(activityInterval);
      clearInterval(eventInterval);
    };
  }, []);

  return (
    <section className="relative pt-32 pb-20 md:pt-36 md:pb-32 overflow-hidden flex flex-col items-center text-center px-4">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-dot-matrix opacity-20 pointer-events-none z-0" />
      
      {/* Main Heading */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative z-10 text-5xl md:text-7xl font-bold text-white tracking-tight leading-[1.1] max-w-4xl mb-6"
      >
        Your AI SDR team — <br className="hidden md:block" />
        <span className="text-neutral-500">in one platform.</span>
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative z-10 text-lg md:text-xl text-neutral-400 max-w-3xl mb-10 leading-relaxed font-medium"
      >
        Turn spreadsheets into booked meetings. Import leads from anywhere, describe your ICP in plain English, and let AI launch personalized outbound campaigns across email and LinkedIn automatically.
      </motion.p>

      {/* CTA Buttons */}
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
        <Link href="#waitlist">
          <button className="bg-transparent border border-white/10 text-white font-medium text-base px-8 py-3.5 rounded-md hover:bg-white/5 hover:border-white/20 transition-all">
            Watch Demo
          </button>
        </Link>
      </motion.div>

      {/* Trust Indicators */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="relative z-10 flex items-center gap-6 text-sm text-neutral-500 mb-20"
      >
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> No credit card
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> Early access
        </div>
        <div className="flex items-center gap-1.5 hidden sm:flex">
          <CheckCircle2 className="w-4 h-4" /> Built for modern GTM teams
        </div>
      </motion.div>

      {/* Dashboard Mockup */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.5 }}
        className="relative w-full max-w-6xl mx-auto"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 to-transparent blur-3xl rounded-3xl" />
        <div className="relative glow-border rounded-2xl bg-black/50 p-2 glass overflow-hidden shadow-2xl">
          {/* Mock Window Header */}
          <div className="h-10 border-b border-white/10 flex items-center px-4 gap-2">
            <div className="w-3 h-3 rounded-full bg-neutral-700" />
            <div className="w-3 h-3 rounded-full bg-neutral-700" />
            <div className="w-3 h-3 rounded-full bg-neutral-700" />
            <div className="mx-auto text-xs text-neutral-500 font-mono">leadgennie.ai/dashboard</div>
          </div>
          
          {/* Dashboard Image Visual with Overlays */}
          <div className="w-full relative overflow-hidden rounded-b-xl mt-2 group">
            <img 
              src="/dashboard.png" 
              alt="LeadGennie Dashboard Preview" 
              className="w-full h-auto object-cover object-top opacity-95 pointer-events-none rounded-b-xl border-t border-white/5"
            />
            
            {/* Overlay 1: Live Activity Tracker (Bottom-Left) */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2 }}
              className="absolute bottom-6 left-6 z-20 glass p-4 rounded-lg flex items-center gap-3 border border-white/10 shadow-2xl max-w-xs text-left hidden sm:flex"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping shrink-0" />
              <div>
                <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">AI SDR Activity</div>
                <motion.p 
                  key={activityIdx}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-xs text-white font-medium mt-0.5"
                >
                  {activities[activityIdx]}
                </motion.p>
              </div>
            </motion.div>

            {/* Overlay 2: Event Notification Card (Bottom-Right) */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.5 }}
              className="absolute bottom-6 right-6 z-20 glass p-4 rounded-lg flex items-center gap-3 border border-white/10 shadow-2xl max-w-xs text-left hidden sm:flex"
            >
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                {events[eventIdx].icon}
              </div>
              <div>
                <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">Outbound Event</div>
                <motion.p 
                  key={eventIdx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xs text-white font-semibold mt-0.5"
                >
                  {events[eventIdx].text}
                </motion.p>
              </div>
            </motion.div>

            {/* Overlay 3: Inbox Deliverability Health (Top-Right) */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8 }}
              className="absolute top-6 right-6 z-20 glass px-3.5 py-2 rounded-lg flex items-center gap-2 border border-white/10 shadow-2xl hidden sm:flex"
            >
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <div className="text-right">
                <span className="text-[10px] text-neutral-400 font-mono">INBOX STATUS: </span>
                <span className="text-[10px] text-white font-mono font-bold">99.4% DELIVERABILITY</span>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
