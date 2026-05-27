"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Calendar, Mail, PieChart, Send, Bot, RefreshCw, Activity } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import BookDemoModal from "./BookDemoModal";

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

const menuNotifications = {
  Overview: [
    { type: 'success', title: 'Meeting Booked', description: 'Sarah Chen - Acme Corp', time: '2 min ago', color: 'green' },
    { type: 'info', title: 'Reply Received', description: 'Michael Park - TechFlow', time: '5 min ago', color: 'blue' },
    { type: 'success', title: 'Campaign Deployed', description: '356 emails scheduled', time: '12 min ago', color: 'purple' },
    { type: 'warning', title: 'Inbox Health Alert', description: 'Monitoring deliverability', time: '18 min ago', color: 'orange' }
  ],
  'Campaign Sequences': [
    { type: 'info', title: 'Campaign Updated', description: 'Fintech CTOs - Q2 2024', time: '3 min ago', color: 'blue' },
    { type: 'success', title: 'Auto-Sequence Active', description: 'Email → LinkedIn → Follow-up', time: '8 min ago', color: 'green' },
    { type: 'info', title: 'A/B Test Results', description: 'Variant B: 42% higher CTR', time: '15 min ago', color: 'purple' },
    { type: 'success', title: 'Sequence Step Executed', description: '512 emails sent in sequence', time: '22 min ago', color: 'green' }
  ],
  'Outbound Workflows': [
    { type: 'success', title: 'Workflow Thinking', description: 'Analyzing lead intent signals', time: '1 min ago', color: 'green' },
    { type: 'info', title: 'Personalization Generated', description: '128 custom email variants', time: '4 min ago', color: 'blue' },
    { type: 'success', title: 'Lead Scoring Complete', description: '245 leads scored 90+/100', time: '9 min ago', color: 'green' },
    { type: 'warning', title: 'Workflow Status', description: 'Processing: 89% utilization', time: '11 min ago', color: 'orange' }
  ],
  'CRM Sync': [
    { type: 'success', title: 'Sync Complete', description: 'Updated 1,248 contacts', time: '1 min ago', color: 'green' },
    { type: 'info', title: 'Hubspot Integration', description: 'Deals synced successfully', time: '6 min ago', color: 'blue' },
    { type: 'success', title: 'Data Reconciled', description: 'No conflicts detected', time: '14 min ago', color: 'green' },
    { type: 'info', title: 'CRM Field Mapped', description: '42 custom fields updated', time: '21 min ago', color: 'blue' }
  ],
  'Inbox Health': [
    { type: 'success', title: 'Deliverability Up', description: 'Consistent inbox placement', time: '2 min ago', color: 'green' },
    { type: 'warning', title: 'Warming Campaign', description: 'Reputation score: 8.9/10', time: '7 min ago', color: 'orange' },
    { type: 'info', title: 'Domain Health Check', description: 'SPF, DKIM, DMARC: All Pass', time: '13 min ago', color: 'blue' },
    { type: 'success', title: 'Spam Alert Cleared', description: 'Zero complaints detected', time: '19 min ago', color: 'green' }
  ]
};

export default function Hero() {
  const [activityIdx, setActivityIdx] = useState(0);
  const [eventIdx, setEventIdx] = useState(0);
  const [activeMenu, setActiveMenu] = useState<keyof typeof menuNotifications>('Overview');
  const [isBookDemoOpen, setIsBookDemoOpen] = useState(false);

  useEffect(() => {
    const activityInterval = setInterval(() => {
      setActivityIdx((prev) => (prev + 1) % activities.length);
    }, 3000);

    const eventInterval = setInterval(() => {
      setEventIdx((prev) => (prev + 1) % (menuNotifications[activeMenu]?.length || 4));
    }, 4500);

    return () => {
      clearInterval(activityInterval);
      clearInterval(eventInterval);
    };
  }, [activeMenu]);

  return (
    <>
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
        Outbound that actually <br className="hidden md:block" />
        <span className="text-neutral-500">books meetings.</span>
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative z-10 text-lg md:text-xl text-neutral-400 max-w-3xl mb-10 leading-relaxed font-medium"
      >
        Upload leads, launch personalized campaigns, track inbox health, and manage outbound performance — all in one platform.
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
        <button 
          onClick={() => setIsBookDemoOpen(true)}
          className="bg-transparent border border-white/10 text-white font-medium text-base px-8 py-3.5 rounded-md hover:bg-white/5 hover:border-white/20 transition-all flex items-center gap-2"
        >
          <Calendar className="w-4 h-4" />
          Book Demo
        </button>
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
          {/* Dashboard Layout */}
          <div className="rounded-lg border border-white/5 bg-[#050505] overflow-hidden flex flex-col md:flex-row h-[700px]">
            
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
                  { icon: <PieChart className="w-4 h-4" />, label: "Overview" },
                  { icon: <Send className="w-4 h-4" />, label: "Campaign Sequences" },
                  { icon: <Bot className="w-4 h-4" />, label: "Outbound Workflows" },
                  { icon: <RefreshCw className="w-4 h-4" />, label: "CRM Sync" },
                  { icon: <Activity className="w-4 h-4" />, label: "Inbox Health" }
                ].map((item, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveMenu(item.label as keyof typeof menuNotifications)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${activeMenu === item.label ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}>
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content Mock */}
            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
              {/* Header with Status */}
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-xl font-bold text-white">
                    {activeMenu === 'Overview' && 'Overview'}
                    {activeMenu === 'Campaign Sequences' && 'Campaigns'}
                    {activeMenu === 'Outbound Workflows' && 'Outbound Workflows'}
                    {activeMenu === 'CRM Sync' && 'CRM Sync'}
                    {activeMenu === 'Inbox Health' && 'Inbox Health'}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-green-400">Live</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-8 px-3 rounded-sm bg-white/10 border border-white/10 text-xs text-white flex items-center font-medium">This week</div>
                </div>
              </div>

              {/* Overview Content */}
              {activeMenu === 'Overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-3">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 }}
                      className="h-20 rounded-md bg-[#0A0A0A] border border-white/10 p-3 flex flex-col justify-between relative overflow-hidden group hover:border-white/20 transition-colors"
                    >
                      <div className="text-xs text-neutral-400 font-medium">Total Leads</div>
                      <div className="text-xl font-bold text-blue-400">12,840</div>
                      <div className="text-[10px] text-green-400">+8.4%</div>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.25 }}
                      className="h-20 rounded-md bg-[#0A0A0A] border border-white/10 p-3 flex flex-col justify-between relative overflow-hidden group hover:border-white/20 transition-colors"
                    >
                      <div className="text-xs text-neutral-400 font-medium">Emails Sent</div>
                      <div className="text-xl font-bold text-blue-400">48,210</div>
                      <div className="text-[10px] text-green-400">+12.6%</div>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 }}
                      className="h-20 rounded-md bg-[#0A0A0A] border border-white/10 p-3 flex flex-col justify-between relative overflow-hidden group hover:border-white/20 transition-colors"
                    >
                      <div className="text-xs text-neutral-400 font-medium">Reply Rate</div>
                      <div className="text-xl font-bold text-purple-400">24.6%</div>
                      <div className="text-[10px] text-green-400">+3.1%</div>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.35 }}
                      className="h-20 rounded-md bg-[#0A0A0A] border border-white/10 p-3 flex flex-col justify-between relative overflow-hidden group hover:border-white/20 transition-colors"
                    >
                      <div className="text-xs text-neutral-400 font-medium">Meetings Booked</div>
                      <div className="text-xl font-bold text-green-400">318</div>
                      <div className="text-[10px] text-red-400">-2.4%</div>
                    </motion.div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {/* Chart */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.4 }}
                      className="col-span-2 rounded-md bg-[#0A0A0A] border border-white/10 p-4"
                    >
                      <div className="text-sm font-semibold text-white mb-4">Outreach Performance</div>
                      <div className="flex items-end gap-1 h-20">
                        {[120, 98, 156, 110, 176, 144, 190, 130, 168, 142, 198, 160, 180, 140].map((value, i) => (
                          <motion.div 
                            key={i}
                            initial={{ height: 0 }}
                            whileInView={{ height: `${(value/200)*100}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: i * 0.05 }}
                            className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-sm text-[8px] text-white text-center leading-none flex items-end justify-center pb-0.5 opacity-70 hover:opacity-100 transition-opacity"
                          />
                        ))}
                      </div>
                    </motion.div>

                    {/* Channel Mix */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.45 }}
                      className="rounded-md bg-[#0A0A0A] border border-white/10 p-4"
                    >
                      <div className="text-sm font-semibold text-white mb-3">Channel Mix</div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-neutral-400">Email</span>
                            <span className="text-white font-semibold">64%</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              whileInView={{ width: '64%' }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.8, delay: 0.5 }}
                              className="h-full bg-blue-500 rounded-full"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-neutral-400">LinkedIn</span>
                            <span className="text-white font-semibold">28%</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              whileInView={{ width: '28%' }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.8, delay: 0.6 }}
                              className="h-full bg-purple-500 rounded-full"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-neutral-400">WhatsApp</span>
                            <span className="text-white font-semibold">8%</span>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              whileInView={{ width: '8%' }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.8, delay: 0.7 }}
                              className="h-full bg-green-500 rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Conversion Funnel */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.5 }}
                      className="rounded-md bg-[#0A0A0A] border border-white/10 p-4"
                    >
                      <div className="text-sm font-semibold text-white mb-3">Conversion Funnel</div>
                      <div className="space-y-2">
                        {[
                          { label: 'Imported', value: '12,840', color: 'bg-blue-500/20' },
                          { label: 'Qualified', value: '8,210', color: 'bg-blue-500/40' },
                          { label: 'Contacted', value: '6,450', color: 'bg-blue-500/60' },
                          { label: 'Replied', value: '1,584', color: 'bg-blue-500/80' },
                          { label: 'Meeting', value: '318', color: 'bg-blue-500' }
                        ].map((stage, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.5 + i * 0.08 }}
                            className={`${stage.color} rounded p-2 flex items-center justify-between text-xs`}
                          >
                            <span className="text-neutral-200">{stage.label}</span>
                            <span className="font-semibold text-white">{stage.value}</span>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                    {/* Recent Activity */}
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.55 }}
                      className="rounded-md bg-[#0A0A0A] border border-white/10 p-4"
                    >
                      <div className="text-sm font-semibold text-white mb-3">Recent Activity</div>
                      <div className="space-y-2">
                        {[
                          { icon: '💬', title: 'Priya Sharma replied', desc: 'Q3 SaaS – India ICP', time: '2m ago' },
                          { icon: '🔗', title: 'Accepted on LinkedIn', desc: 'CTO outreach EMEA', time: '14m ago' },
                          { icon: '📅', title: 'Meeting booked — R. Mehta', desc: 'Q3 SaaS – India ICP', time: '38m ago' },
                          { icon: '✉️', title: '142 emails delivered', desc: 'Series A Founders', time: '1h ago' }
                        ].map((activity, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.55 + i * 0.08 }}
                            className="flex items-start gap-2 text-xs border-b border-white/5 pb-2 last:border-0"
                          >
                            <span className="text-base">{activity.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-neutral-200 truncate">{activity.title}</div>
                              <div className="text-[10px] text-neutral-500">{activity.desc} • {activity.time}</div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  </div>
                </div>
              )}

              {/* Campaign Sequences Content */}
              {activeMenu === 'Campaign Sequences' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-neutral-400">Personalized multi-channel sequences</span>
                    <span className="text-xs bg-white/10 px-2 py-1 rounded text-white">New campaign</span>
                  </div>
                  {[
                    { name: 'Q3 SaaS – India ICP', status: 'Running', leads: '1,248', sent: '1,020', replied: '246', rate: '24.1%' },
                    { name: 'Series A Founders – US', status: 'Running', leads: '642', sent: '410', replied: '88', rate: '21.5%' },
                    { name: 'CTO outreach EMEA', status: 'Paused', leads: '318', sent: '318', replied: '54', rate: '17%' }
                  ].map((campaign, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 + i * 0.1 }}
                      className="p-3 rounded-md bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-sm font-semibold text-white">{campaign.name}</div>
                          <div className={`text-xs mt-1 ${campaign.status === 'Running' ? 'text-green-400' : campaign.status === 'Paused' ? 'text-yellow-400' : 'text-gray-400'}`}>{campaign.status}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div><span className="text-neutral-400">Leads: </span><span className="text-white font-semibold">{campaign.leads}</span></div>
                        <div><span className="text-neutral-400">Sent: </span><span className="text-white font-semibold">{campaign.sent}</span></div>
                        <div><span className="text-neutral-400">Replied: </span><span className="text-white font-semibold">{campaign.replied}</span></div>
                        <div><span className="text-neutral-400">Rate: </span><span className="text-white font-semibold">{campaign.rate}</span></div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Outbound Workflows Content */}
              {activeMenu === 'Outbound Workflows' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-400">Upload leads and let AI turn them into booked meetings.</span>
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Online</span>
                  </div>
                  <div className="rounded-md bg-[#0A0A0A] border border-white/10 p-4 text-center">
                    <div className="text-xs text-neutral-400 mb-2">Workflow Activity</div>
                    <div className="text-2xl font-bold text-white mb-1">0/12 steps</div>
                    <div className="text-xs text-neutral-500">Your outbound workflows are standing by</div>
                  </div>
                  <div className="space-y-2">
                    {[
                      'Build ICP Filters',
                      'Generate Sequences',
                      'Personalize Emails',
                      'Detect Buying Signals'
                    ].map((action, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className="p-2 rounded text-xs text-neutral-300 bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                      >
                        {action}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* CRM Sync Content */}
              {activeMenu === 'CRM Sync' && (
                <div className="space-y-4">
                  <div className="rounded-md bg-[#0A0A0A] border border-white/10 p-4">
                    <div className="text-sm font-semibold text-white mb-3">Integration Status</div>
                    {[
                      { name: 'Hubspot', status: 'Synced', color: 'green' },
                      { name: 'Pipedrive', status: 'Connected', color: 'green' },
                      { name: 'Salesforce', status: 'Pending', color: 'yellow' }
                    ].map((integration, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 5 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                      >
                        <span className="text-sm text-neutral-300">{integration.name}</span>
                        <span className={`text-xs px-2 py-1 rounded ${integration.color === 'green' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{integration.status}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inbox Health Content */}
              {activeMenu === 'Inbox Health' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.2 }}
                      className="rounded-md bg-[#0A0A0A] border border-white/10 p-4"
                    >
                      <div className="text-xs text-neutral-400 mb-1">Deliverability</div>
                      <div className="text-2xl font-bold text-green-400">High</div>
                    </motion.div>
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 }}
                      className="rounded-md bg-[#0A0A0A] border border-white/10 p-4"
                    >
                      <div className="text-xs text-neutral-400 mb-1">Reputation</div>
                      <div className="text-2xl font-bold text-blue-400">8.9/10</div>
                    </motion.div>
                  </div>
                  <div className="rounded-md bg-[#0A0A0A] border border-white/10 p-4">
                    <div className="text-sm font-semibold text-white mb-3">Domain Health</div>
                    {['SPF Pass', 'DKIM Pass', 'DMARC Pass'].map((check, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className="flex items-center gap-2 py-1 text-xs text-green-400"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        {check}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes shimmer {
              100% { transform: translateX(100%); }
            }
          `}} />
        </div>
      </motion.div>
      </section>

      <BookDemoModal isOpen={isBookDemoOpen} onClose={() => setIsBookDemoOpen(false)} />
    </>
  );
}
