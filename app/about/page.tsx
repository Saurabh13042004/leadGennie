import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackgroundEffects from "@/components/BackgroundEffects";

export default function AboutPage() {
  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-purple-500/30 selection:text-white overflow-hidden flex flex-col">
      <BackgroundEffects />
      <Navbar />
      
      <main className="flex-grow pt-32 pb-24 px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="border-b border-white/10 pb-8 mb-10">
            <div className="text-purple-400 font-mono text-xs mb-3 tracking-wider uppercase">[ Our Story ]</div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">About LeadGennie</h1>
            <p className="text-neutral-500 text-sm font-mono">Building the AI-Native Outbound Stack</p>
          </div>
          
          {/* Body Content */}
          <div className="text-neutral-300 space-y-8 leading-relaxed font-sans">
            <p className="text-lg text-neutral-400">
              LeadGennie is building the AI-native outbound stack for modern revenue teams. We believe outbound sales should feel intelligent, automated, personalized, and fast—not like manual spreadsheet busywork.
            </p>
            <p>
              Our mission is to replace repetitive SDR workflows with autonomous AI systems that help teams generate high-quality pipelines faster with significantly less manual effort. By letting AI handle data parsing, profile analysis, and sequence writing, human sales teams can focus on what they do best: building trust and closing deals.
            </p>

            <hr className="border-white/10 my-8" />

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                Built by DICE Solutions
              </h2>
              <p>
                LeadGennie is a product developed and operated by <strong>DICE Solutions</strong>. 
              </p>
              <p className="text-neutral-400">
                DICE Solutions focuses on building scalable, modern software products at the intersection of AI, SaaS infrastructure, automation platforms, developer tooling, and premium web systems. By leveraging DICE Solutions&apos; engineering foundation, LeadGennie guarantees enterprise-grade reliability, secure data isolation, and state-of-the-art AI systems integration.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                What We Believe
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="bg-white/5 border border-white/10 p-5 rounded-lg">
                  <h3 className="text-white font-semibold mb-2 font-mono text-sm">[ Deep Personalization ]</h3>
                  <p className="text-sm text-neutral-400">
                    Spamming generic email templates is dead. Outbound must be contextualized using prospect intent, company news, and ICP-driven parameters.
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 p-5 rounded-lg">
                  <h3 className="text-white font-semibold mb-2 font-mono text-sm">[ Autonomous Scale ]</h3>
                  <p className="text-sm text-neutral-400">
                    A single sales operator should be equipped with the outbound leverage of a ten-person SDR agency through smart AI systems.
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 p-5 rounded-lg">
                  <h3 className="text-white font-semibold mb-2 font-mono text-sm">[ Data-Driven Workflows ]</h3>
                  <p className="text-sm text-neutral-400">
                    AI SDR loops should feed directly into HubSpot, Salesforce, and other CRM tools, keeping lead data fresh with zero manual sync delays.
                  </p>
                </div>
                <div className="bg-white/5 border border-white/10 p-5 rounded-lg">
                  <h3 className="text-white font-semibold mb-2 font-mono text-sm">[ Deliverability First ]</h3>
                  <p className="text-sm text-neutral-400">
                    Scaling campaigns is useless if emails go to spam. Built-in domain rotation and inbox warming are critical pillars of GTM success.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-4 border-t border-white/10 pt-6">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                Connect with DICE Solutions
              </h2>
              <p>
                Whether you want to learn more about our AI research, explore custom GTM installations, or join our development team, get in touch:
                <br />
                <a href="mailto:support@leadgennie.ai" className="text-purple-400 hover:underline font-mono">support@leadgennie.ai</a>
              </p>
            </section>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
