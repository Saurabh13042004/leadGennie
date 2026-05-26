import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackgroundEffects from "@/components/BackgroundEffects";
import Link from "next/link";

export default function CompareHubspotPage() {
  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-purple-500/30 selection:text-white overflow-hidden flex flex-col">
      <BackgroundEffects />
      <Navbar />
      
      <main className="flex-grow pt-32 pb-24 px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="border-b border-white/10 pb-8 mb-10">
            <div className="text-purple-400 font-mono text-xs mb-3 tracking-wider uppercase">[ LeadGennie vs HubSpot ]</div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">LeadGennie vs HubSpot</h1>
            <p className="text-neutral-400 text-lg leading-relaxed">
              HubSpot is an industry-standard customer relationship management (CRM) database. LeadGennie is an AI outbound execution layer that connects with HubSpot to automate pipeline generation.
            </p>
          </div>
          
          {/* Comparison Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-[#0c0c0c] border border-white/5 p-6 rounded-xl">
              <h2 className="text-lg font-bold text-white mb-4 font-mono text-sm uppercase text-neutral-400">
                HubSpot is optimized for:
              </h2>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <span className="text-neutral-600 font-mono mt-0.5">•</span>
                  <span><strong>Customer CRM:</strong> Central system of record for leads and customers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neutral-600 font-mono mt-0.5">•</span>
                  <span><strong>Inbound Pipelines:</strong> Sourcing and managing organic website leads.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neutral-600 font-mono mt-0.5">•</span>
                  <span><strong>Sales Pipelines:</strong> Custom deal stages and manual workflows.</span>
                </li>
              </ul>
            </div>

            <div className="bg-purple-950/10 border border-purple-500/10 p-6 rounded-xl">
              <h2 className="text-lg font-bold text-purple-400 mb-4 font-mono text-sm uppercase">
                LeadGennie is optimized for:
              </h2>
              <ul className="space-y-3 text-sm text-neutral-200">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>Autonomous outbound:</strong> Replaces manual cold calling and copywriting.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>Pipeline generation:</strong> Launches targeted campaigns at scale.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>Auto qualification:</strong> Identifies ICP matches using AI filters.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>Bi-directional CRM sync:</strong> Pushes campaign replies and bookings to HubSpot.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Detailed Comparison Table */}
          <div className="bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden mb-12">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 font-mono text-xs uppercase text-neutral-400">Feature</th>
                  <th className="p-4 font-mono text-xs uppercase text-neutral-400">HubSpot</th>
                  <th className="p-4 font-mono text-xs uppercase text-purple-400">LeadGennie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-neutral-300">
                <tr>
                  <td className="p-4 font-semibold text-white">Platform Category</td>
                  <td className="p-4 text-neutral-400">Database CRM / Inbound Marketing</td>
                  <td className="p-4">AI Outbound Execution Engine</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Outbound Prospecting</td>
                  <td className="p-4 text-neutral-400">Manual sales sequences</td>
                  <td className="p-4 text-purple-300 font-medium">Autonomous AI SDR agents</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">AI Personalization</td>
                  <td className="p-4 text-neutral-400">Basic template tokens</td>
                  <td className="p-4 text-purple-300 font-medium">Context-driven generative copy</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">CRM Integration</td>
                  <td className="p-4 text-neutral-400">Native database hub</td>
                  <td className="p-4 text-purple-300 font-medium">Native 1-click bi-directional sync</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Setup Complexity</td>
                  <td className="p-4 text-neutral-400">Requires months of customization</td>
                  <td className="p-4 text-purple-300 font-medium">Out-of-the-box templates (<span className="font-mono text-xs">5 mins</span>)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Callout */}
          <section className="space-y-4 mb-12">
            <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
              Why Teams Choose LeadGennie with HubSpot
            </h2>
            <div className="space-y-3 text-neutral-300 text-sm">
              <p>
                LeadGennie does not aim to replace HubSpot. Instead, it acts as an intelligent sales agent that sits next to your HubSpot CRM.
              </p>
              <p>
                Instead of requiring your sales reps to manually copy contact directories, draft cold templates, monitor sending tools, and click deal pipelines, LeadGennie automates the execution. It imports list targets from your HubSpot filters, qualify contacts using AI rules, triggers personalized email sequences, and feeds activity logs, replies, and booked meetings directly back to your HubSpot CRM in real time.
              </p>
            </div>
          </section>

          <div className="border-t border-white/10 pt-10 text-center">
            <h3 className="text-lg font-bold text-white mb-4">Ready to automate your outbound sequences?</h3>
            <Link href="/#waitlist">
              <button className="bg-white text-black font-semibold px-6 py-3 rounded-md hover:bg-neutral-200 transition-colors">
                Get Started with LeadGennie
              </button>
            </Link>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
