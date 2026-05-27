import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackgroundEffects from "@/components/BackgroundEffects";
import Link from "next/link";

export default function CompareClayPage() {
  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-purple-500/30 selection:text-white overflow-hidden flex flex-col">
      <BackgroundEffects />
      <Navbar />
      
      <main className="flex-grow pt-32 pb-24 px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="border-b border-white/10 pb-8 mb-10">
            <div className="text-purple-400 font-mono text-xs mb-3 tracking-wider uppercase">[ LeadGennie vs Clay ]</div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">LeadGennie vs Clay</h1>
            <p className="text-neutral-400 text-lg leading-relaxed">
              Clay is an incredible tool for data enrichment and list building. LeadGennie builds on top of data operations by running as a fully automated outbound engine.
            </p>
          </div>
          
          {/* Comparison Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-[#0c0c0c] border border-white/5 p-6 rounded-xl">
              <h2 className="text-lg font-bold text-white mb-4 font-mono text-sm uppercase text-neutral-400">
                Clay focuses on:
              </h2>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <span className="text-neutral-600 font-mono mt-0.5">•</span>
                  <span><strong>Lead enrichment:</strong> Aggregating 50+ data providers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neutral-600 font-mono mt-0.5">•</span>
                  <span><strong>Workflow building:</strong> Custom table cells and builder macros.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neutral-600 font-mono mt-0.5">•</span>
                  <span><strong>Data operations:</strong> Cleaning lists and scraping websites.</span>
                </li>
              </ul>
            </div>

            <div className="bg-purple-950/10 border border-purple-500/10 p-6 rounded-xl">
              <h2 className="text-lg font-bold text-purple-400 mb-4 font-mono text-sm uppercase">
                LeadGennie focuses on:
              </h2>
              <ul className="space-y-3 text-sm text-neutral-200">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>Workflows automation:</strong> Conversing and researching 24/7.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>Personalized outreach:</strong> Composing unique emails based on buying intent.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>Outbound execution:</strong> Booking meetings automatically on your calendar.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>Campaign automation:</strong> Smart sequences across LinkedIn and email.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Detailed Matrix Table */}
          <div className="bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden mb-12">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 font-mono text-xs uppercase text-neutral-400">Feature</th>
                  <th className="p-4 font-mono text-xs uppercase text-neutral-400">Clay</th>
                  <th className="p-4 font-mono text-xs uppercase text-purple-400">LeadGennie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-neutral-300">
                <tr>
                  <td className="p-4 font-semibold text-white">Data Enrichment</td>
                  <td className="p-4 text-neutral-400">Yes (Multi-provider waterfall)</td>
                  <td className="p-4">Yes (Built-in ICP target scraper)</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Outbound Sending</td>
                  <td className="p-4 text-neutral-400">No (Requires external integration)</td>
                  <td className="p-4 text-purple-300 font-medium">Yes (Built-in domain rotation)</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">AI Content Flow</td>
                  <td className="p-4 text-neutral-400">Raw prompts in cells</td>
                  <td className="p-4 text-purple-300 font-medium">Automated campaign writer</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">CRM Integration</td>
                  <td className="p-4 text-neutral-400">Manual mapping needed</td>
                  <td className="p-4 text-purple-300 font-medium">Native 1-click bi-directional sync</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Autonomous Actions</td>
                  <td className="p-4 text-neutral-400">Manual table runs</td>
                  <td className="p-4 text-purple-300 font-medium">Auto qualifications & bookings</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Callout */}
          <section className="space-y-4 mb-12">
            <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
              Why Teams Choose LeadGennie
            </h2>
            <div className="space-y-3 text-neutral-300 text-sm">
              <p>
                While Clay is excellent for database operations and sourcing contact attributes, it leaves the actual outbound execution to secondary tools. Sales operators must manage complex integrations, copy templates across apps, and constantly sync leads back to their CRMs.
              </p>
              <p>
                LeadGennie acts as an integrated <strong>outbound operating system</strong>. It qualified prospects, generates hyper-targeted sequences based on news, sends outbound emails and LinkedIn campaigns, optimizes deliverability, and books meetings directly into your calendar without complex sheet setups.
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
