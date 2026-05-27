import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackgroundEffects from "@/components/BackgroundEffects";
import Link from "next/link";

export default function CompareApolloPage() {
  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-purple-500/30 selection:text-white overflow-hidden flex flex-col">
      <BackgroundEffects />
      <Navbar />
      
      <main className="flex-grow pt-32 pb-24 px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="border-b border-white/10 pb-8 mb-10">
            <div className="text-purple-400 font-mono text-xs mb-3 tracking-wider uppercase">[ LeadGennie vs Apollo.io ]</div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">LeadGennie vs Apollo.io</h1>
            <p className="text-neutral-400 text-lg leading-relaxed">
              Apollo is a robust database directory for finding contact records. LeadGennie is built as an AI-native outbound operating system that automates the entire sales rep loop.
            </p>
          </div>
          
          {/* Comparison Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-[#0c0c0c] border border-white/5 p-6 rounded-xl">
              <h2 className="text-lg font-bold text-white mb-4 font-mono text-sm uppercase text-neutral-400">
                Apollo is optimized for:
              </h2>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <span className="text-neutral-600 font-mono mt-0.5">•</span>
                  <span><strong>Prospect Discovery:</strong> Static contact database search.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neutral-600 font-mono mt-0.5">•</span>
                  <span><strong>Filters:</strong> Standard firmographic parameters (employee count, location).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neutral-600 font-mono mt-0.5">•</span>
                  <span><strong>Manual Workflows:</strong> Manually reviewing lists and sequences.</span>
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
                  <span><strong>Automated workflows loops:</strong> Real-time ICP mapping.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>AI Personalization:</strong> Generates unique angles for every single lead.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>ICP-driven Automation:</strong> Evaluates targets in plain English, scoring match probability.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>Intelligent Orchestration:</strong> Dynamic timing, deliverability filters, and LinkedIn syncing.</span>
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
                  <th className="p-4 font-mono text-xs uppercase text-neutral-400">Apollo.io</th>
                  <th className="p-4 font-mono text-xs uppercase text-purple-400">LeadGennie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-neutral-300">
                <tr>
                  <td className="p-4 font-semibold text-white">Focus Area</td>
                  <td className="p-4 text-neutral-400">Lead Directory / Database</td>
                  <td className="p-4">Automated Outbound Orchestration</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Target ICP Matching</td>
                  <td className="p-4 text-neutral-400">Manual filter attributes</td>
                  <td className="p-4 text-purple-300 font-medium">Plain-English AI Scoring (High Accuracy)</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Sequence Writing</td>
                  <td className="p-4 text-neutral-400">Template variables (e.g. {"{first_name}"})</td>
                  <td className="p-4 text-purple-300 font-medium">Hyper-personalized AI copies</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Outreach Platforms</td>
                  <td className="p-4 text-neutral-400">Emails & basic calls</td>
                  <td className="p-4 text-purple-300 font-medium">Multi-channel (Email + LinkedIn sequences)</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Data Exclusivity</td>
                  <td className="p-4 text-neutral-400">Same database shared globally</td>
                  <td className="p-4 text-purple-300 font-medium">Real-time target scrapers (Fresh data)</td>
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
                Apollo.io provides a massive contact list directory, but because everyone filters by the same attributes, target accounts get bombarded with generic templates. This reduces your domain reputation and drives down reply rates.
              </p>
              <p>
                LeadGennie bypasses database limitations by using real-time scrapers to build highly targeted list coordinates based on recent hire signals, funding news, or intent variables. The outbound engine then handles list validation, scores accounts based on custom plain-English instructions, and writes unique personalized copies to book meetings.
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
