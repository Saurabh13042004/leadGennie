"use client";

import { motion } from "framer-motion";
import { Terminal, Send, Command, Activity, Cpu, Calendar, ShieldCheck, Users } from "lucide-react";
import { useState, useEffect } from "react";

const CHAT_STEPS = [
  {
    type: "user",
    content: "Find funded SaaS founders in the US."
  },
  {
    type: "thinking",
    logs: [
      "⎿ Querying LeadGennie company graph...",
      "⎿ Filtering by: Sector = SaaS, Location = US, Funding >= $1M",
      "⎿ Isolated 2,450 matching founders."
    ]
  },
  {
    type: "ai",
    content: "Scanning databases... Found 2,450 matching SaaS founders. Filtering by funding rounds (>=$1M) and US location."
  },
  {
    type: "user",
    content: "Target fintech CTOs hiring engineers."
  },
  {
    type: "thinking",
    logs: [
      "⎿ Searching active hiring boards...",
      "⎿ Scanning career page HTML listings...",
      "⎿ Matching CTO contacts at active-hiring fintechs.",
      "⎿ Refined to 412 qualified accounts."
    ]
  },
  {
    type: "ai",
    content: "Refining search: Role = CTO, Industry = Fintech, hiring engineering roles. Isolated 412 high-intent profiles."
  },
  {
    type: "user",
    content: "Launch a 4-step outbound campaign."
  },
  {
    type: "thinking",
    logs: [
      "⎿ Generating copy personalized to hiring logs & funding news...",
      "⎿ Configuring sequence: 2 Emails + 2 LinkedIn touchpoints...",
      "⎿ Performing deliverability routing check...",
      "⎿ Campaign activated."
    ]
  },
  {
    type: "ai",
    content: "Generated sequence: 2 emails + 2 LinkedIn touchpoints. Outreach initiated. 3 replies received. Meeting booked with Acme Corp! CRM updated."
  }
];

function TypingText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let index = 0;
    setDisplayedText("");
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(index));
      index++;
      if (index >= text.length) {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, 15);
    return () => clearInterval(interval);
  }, [text]);

  return <span>{displayedText}</span>;
}

function ThinkingLogs({ logs, onComplete }: { logs: string[]; onComplete?: () => void }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
  }, [logs]);

  useEffect(() => {
    if (visibleCount < logs.length) {
      const timeout = setTimeout(() => {
        setVisibleCount((prev) => prev + 1);
      }, 800);
      return () => clearTimeout(timeout);
    } else {
      if (onComplete) {
        const timeout = setTimeout(onComplete, 500);
        return () => clearTimeout(timeout);
      }
    }
  }, [visibleCount, logs, onComplete]);

  return (
    <div className="flex flex-col gap-1.5 font-mono text-[11px] text-neutral-500 pl-4 border-l border-white/10 my-2 text-left">
      {logs.slice(0, visibleCount).map((log, i) => (
        <div key={i} className="flex items-center gap-2">
          {i === visibleCount - 1 && visibleCount < logs.length ? (
            <span className="w-2 h-2 rounded-full border-2 border-neutral-600 border-t-neutral-400 animate-spin shrink-0" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
          )}
          <span>{log}</span>
        </div>
      ))}
    </div>
  );
}

export default function AiTerminal() {
  const [visibleSteps, setVisibleSteps] = useState<any[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  useEffect(() => {
    if (currentStepIdx < CHAT_STEPS.length) {
      const step = CHAT_STEPS[currentStepIdx];
      
      // For user prompt, add immediately and let it type
      if (step.type === "user") {
        setVisibleSteps((prev) => [...prev, step]);
      } else if (step.type === "thinking") {
        setVisibleSteps((prev) => [...prev, step]);
      } else if (step.type === "ai") {
        setVisibleSteps((prev) => [...prev, step]);
      }
    } else {
      // Loop sequence: reset after a delay
      const timeout = setTimeout(() => {
        setVisibleSteps([]);
        setCurrentStepIdx(0);
      }, 6000);
      return () => clearTimeout(timeout);
    }
  }, [currentStepIdx]);

  const handleNext = () => {
    setCurrentStepIdx((prev) => prev + 1);
  };

  return (
    <section id="ai-sdr" className="py-32 relative overflow-hidden bg-[#050505] border-t border-white/5">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6"
          >
            Meet your automated engine.
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-neutral-400 font-medium max-w-2xl mx-auto"
          >
            Upload leads or describe your target audience — LeadGennie handles research, filtering, copywriting, sequencing, and outreach automatically.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-6xl mx-auto items-stretch">
          
          {/* Left Column - Terminal Window */}
          <div className="lg:col-span-3">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden shadow-2xl h-full flex flex-col justify-between"
            >
              {/* Header */}
              <div className="h-12 border-b border-white/5 flex items-center px-4 justify-between bg-[#111111]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-neutral-700" />
                  <div className="w-3 h-3 rounded-full bg-neutral-700" />
                  <div className="w-3 h-3 rounded-full bg-neutral-700" />
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
                  <Terminal className="w-3 h-3" />
                  LeadGennie_SDR_Agent_v1.0.0
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-green-500 font-mono">
                    <Activity className="w-3 h-3" /> [ONLINE]
                  </div>
                </div>
              </div>

              {/* Chat Area */}
              <div className="p-6 min-h-[380px] max-h-[440px] overflow-y-auto flex flex-col gap-4 relative">
                {visibleSteps.map((step, i) => {
                  const isCurrent = i === visibleSteps.length - 1;

                  if (step.type === "user") {
                    return (
                      <div key={i} className="flex justify-end">
                        <div className="max-w-[85%] rounded-md px-4 py-2.5 text-sm font-mono bg-white text-black text-left shadow-lg">
                          {isCurrent ? (
                            <TypingText text={step.content} onComplete={handleNext} />
                          ) : (
                            <span>{step.content}</span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  if (step.type === "thinking") {
                    return (
                      <div key={i} className="flex justify-start">
                        <ThinkingLogs logs={step.logs} onComplete={handleNext} />
                      </div>
                    );
                  }

                  if (step.type === "ai") {
                    return (
                      <div key={i} className="flex justify-start">
                        <div className="max-w-[85%] rounded-md px-4 py-3 text-sm font-mono bg-[#111111] text-neutral-350 border border-white/5 text-left">
                          <div className="flex items-center gap-2 mb-2 text-[10px] text-blue-400 font-medium tracking-wider uppercase">
                            <Cpu className="w-3 h-3" /> System Output
                          </div>
                          {isCurrent ? (
                            <TypingText text={step.content} onComplete={handleNext} />
                          ) : (
                            <span>{step.content}</span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
                
                {/* Blinking cursor if idle between sequences */}
                {visibleSteps.length === 0 && (
                  <div className="flex justify-start">
                    <div className="bg-[#111111] border border-white/5 rounded-md px-4 py-2 flex items-center gap-2">
                       <span className="w-2 h-2 bg-neutral-500 animate-pulse" />
                       <span className="text-xs font-mono text-neutral-500">Initializing agent...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-white/5 bg-[#111111]">
                <div className="relative flex items-center">
                  <Command className="absolute left-4 w-5 h-5 text-neutral-500" />
                  <input 
                    type="text" 
                    readOnly
                    placeholder="Describe your ICP (e.g., 'Target fintech CTOs in the US')..." 
                    className="w-full bg-[#050505] border border-white/10 rounded-md h-12 pl-12 pr-12 text-sm text-white font-mono focus:outline-none cursor-default"
                  />
                  <button className="absolute right-2 w-8 h-8 rounded-sm bg-white text-black flex items-center justify-center transition-colors">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column - Metrics Cards */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {/* Metric 1 */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-[#0A0A0A] border border-white/10 rounded-xl p-5 flex flex-col justify-between flex-1 shadow-lg text-left"
            >
              <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> [+] Deliverability
              </div>
              <div className="my-2">
                <div className="text-3xl font-extrabold text-white tracking-tight">92%</div>
                <div className="text-xs font-semibold text-neutral-400 mt-0.5">Inbox Placement</div>
              </div>
              <div className="text-[9px] font-mono text-neutral-600">High placement rate</div>
            </motion.div>

            {/* Metric 2 */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="bg-[#0A0A0A] border border-white/10 rounded-xl p-5 flex flex-col justify-between flex-1 shadow-lg text-left"
            >
              <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" /> [+] ICP Coverage
              </div>
              <div className="my-2">
                <div className="text-3xl font-extrabold text-white tracking-tight">412</div>
                <div className="text-xs font-semibold text-neutral-400 mt-0.5">Qualified Leads</div>
              </div>
              <div className="text-[9px] font-mono text-neutral-600">High match accuracy</div>
            </motion.div>

            {/* Metric 3 */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-[#0A0A0A] border border-white/10 rounded-xl p-5 flex flex-col justify-between flex-1 shadow-lg text-left"
            >
              <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-green-400" /> [+] Meeting Bookings
              </div>
              <div className="my-2">
                <div className="text-3xl font-extrabold text-white tracking-tight">14</div>
                <div className="text-xs font-semibold text-neutral-400 mt-0.5">Booked This Week</div>
              </div>
              <div className="text-[9px] font-mono text-neutral-600">Autopilot synchronization</div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
