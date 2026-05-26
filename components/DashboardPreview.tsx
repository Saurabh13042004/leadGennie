"use client";

import { motion } from "framer-motion";
import { PieChart, Send, Bot, RefreshCw, Activity } from "lucide-react";

export default function DashboardPreview() {
  return (
    <section className="py-32 relative overflow-hidden bg-black border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Complete GTM observability.</h2>
          <p className="text-neutral-400 font-medium">Monitor email health, active campaigns, and meeting bookings in real-time.</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative rounded-xl border border-white/10 bg-[#0A0A0A] p-2 md:p-6 shadow-2xl mx-auto"
        >
          {/* Main Dashboard Layout */}
          <div className="rounded-lg border border-white/5 bg-[#050505] overflow-hidden flex flex-col md:flex-row h-[600px]">
            
            {/* Sidebar Mock */}
            <div className="w-64 border-r border-white/5 p-4 hidden md:flex flex-col gap-6 bg-[#0A0A0A]">
              <div className="flex items-center gap-2 px-2">
                <div className="w-6 h-6 bg-white flex items-center justify-center rounded-sm">
                  <svg className="w-3.5 h-3.5 text-black" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z" />
                  </svg>
                </div>
                <span className="text-white font-bold text-sm tracking-tight">LeadGennie</span>
              </div>
              
              <div className="space-y-1">
                {[
                  { icon: <PieChart className="w-4 h-4" />, label: "Overview", active: true },
                  { icon: <Send className="w-4 h-4" />, label: "Campaign Sequences" },
                  { icon: <Bot className="w-4 h-4" />, label: "AI SDR Agent" },
                  { icon: <RefreshCw className="w-4 h-4" />, label: "CRM Sync" },
                  { icon: <Activity className="w-4 h-4" />, label: "Inbox Health" }
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${item.active ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}>
                    {item.icon} {item.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Main Content Mock */}
            <div className="flex-1 p-6 overflow-hidden flex flex-col gap-6">
              {/* Header */}
              <div className="flex justify-between items-center">
                <div className="text-xl font-bold text-white">Overview</div>
                <div className="flex gap-2">
                  <div className="h-8 w-24 rounded-sm bg-[#111111] border border-white/5 animate-pulse" />
                  <div className="h-8 w-8 rounded-sm bg-[#111111] border border-white/5 animate-pulse" />
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 rounded-md bg-[#0A0A0A] border border-white/5 p-4 flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                    <div className="w-16 h-3 rounded-sm bg-white/10" />
                    <div className="w-24 h-6 rounded-sm bg-white/20" />
                  </div>
                ))}
              </div>

              {/* Main Chart Area */}
              <div className="flex-1 rounded-md bg-[#0A0A0A] border border-white/5 p-6 flex flex-col relative overflow-hidden">
                <div className="w-32 h-4 rounded-sm bg-white/10 mb-8" />
                <div className="flex-1 flex items-end gap-2">
                  {[...Array(20)].map((_, i) => (
                    <motion.div 
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${Math.random() * 60 + 20}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: i * 0.05 }}
                      className="flex-1 bg-white/10 hover:bg-white/20 transition-colors rounded-t-sm"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </section>
  );
}
