import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackgroundEffects from "@/components/BackgroundEffects";
import Link from "next/link";

export default function CompareInstantlyPage() {
  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-purple-500/30 selection:text-white overflow-hidden flex flex-col">
      <BackgroundEffects />
      <Navbar />
      
      <main className="flex-grow pt-32 pb-24 px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="border-b border-white/10 pb-8 mb-10">
            <div className="text-purple-400 font-mono text-xs mb-3 tracking-wider uppercase">[ LeadGennie vs Instantly ]</div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">LeadGennie vs Instantly</h1>
            <p className="text-neutral-400 text-lg leading-relaxed">
              Instantly is focused primarily on bulk email delivery and inbox warming infrastructure. LeadGennie combines deliverability infrastructure with AI SDR outreach, qualification, and CRM sync.
            </p>
          </div>
          
          {/* Comparison Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-[#0c0c0c] border border-white/5 p-6 rounded-xl">
              <h2 className="text-lg font-bold text-white mb-4 font-mono text-sm uppercase text-neutral-400">
                Instantly is optimized for:
              </h2>
              <ul className="space-y-3 text-sm text-neutral-400">
                <li className="flex items-start gap-2">
                  <span className="text-neutral-600 font-mono mt-0.5">•</span>
                  <span><strong>Email Sending:</strong> Simple bulk SMTP connections.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neutral-600 font-mono mt-0.5">•</span>
                  <span><strong>Inbox Warming:</strong> Automated domain warming pools.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-neutral-600 font-mono mt-0.5">•</span>
                  <span><strong>Mailbox Management:</strong> Managing multiple sending address boxes.</span>
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
                  <span><strong>AI SDR workflows:</strong> Automatic lead research and categorization.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>Multi-channel sequence:</strong> Email + LinkedIn messaging sync.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>Lead qualification:</strong> Reads prospect bios and scores company match ratios.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>CRM Sync:</strong> Feeds metrics and logs directly to HubSpot/Salesforce.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 font-mono mt-0.5">•</span>
                  <span><strong>Intelligence layers:</strong> Active deliverability filters and copy optimization.</span>
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
                  <th className="p-4 font-mono text-xs uppercase text-neutral-400">Instantly</th>
                  <th className="p-4 font-mono text-xs uppercase text-purple-400">LeadGennie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-neutral-300">
                <tr>
                  <td className="p-4 font-semibold text-white">Focus</td>
                  <td className="p-4 text-neutral-400">Sending scale / Infrastructure</td>
                  <td className="p-4">AI Outbound operating system</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">LinkedIn Support</td>
                  <td className="p-4 text-neutral-400">No (Email only)</td>
                  <td className="p-4 text-purple-300 font-medium">Yes (Integrated LinkedIn actions)</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">AI Personalization</td>
                  <td className="p-4 text-neutral-400">Basic template spintax</td>
                  <td className="p-4 text-purple-300 font-medium">Autonomous news-driven writer</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">CRM Integrations</td>
                  <td className="p-4 text-neutral-400">Requires Zapier or APIs</td>
                  <td className="p-4 text-purple-300 font-medium">Built-in bi-directional CRM loops</td>
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-white">Inbox Warming</td>
                  <td className="p-4 text-neutral-400">Yes (Built-in)</td>
                  <td className="p-4 text-purple-300 font-medium">Yes (Domain warming partnerships)</td>
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
                Instantly is a useful platform for setting up large mailbox grids, but it leaves sales operators responsible for sourcing, validating, writing, and executing the actual content. This results in standard email campaigns without personalization.
              </p>
              <p>
                LeadGennie combines email infrastructure with AI sales brains. It not only monitors mailbox health and deliverability metrics, but acts as a complete AI SDR. It qualifies leads based on custom rules, writes emails that mention recent updates, coordinates LinkedIn sequences, and updates CRM dashboards automatically.
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
