import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackgroundEffects from "@/components/BackgroundEffects";

export default function TermsPage() {
  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-purple-500/30 selection:text-white overflow-hidden flex flex-col">
      <BackgroundEffects />
      <Navbar />
      
      <main className="flex-grow pt-32 pb-24 px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="border-b border-white/10 pb-8 mb-10">
            <div className="text-purple-400 font-mono text-xs mb-3 tracking-wider uppercase">[ Legal Agreement ]</div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">Terms of Service</h1>
            <p className="text-neutral-500 text-sm font-mono">Last updated: May 2026</p>
          </div>
          
          {/* Body Content */}
          <div className="text-neutral-300 space-y-8 leading-relaxed font-sans">
            <p className="text-lg text-neutral-400">
              Welcome to LeadGennie. By accessing or using LeadGennie, you agree to comply with and be bound by these Terms of Service.
            </p>

            <hr className="border-white/10 my-8" />

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">01.</span> Scope of Service
              </h2>
              <p>
                LeadGennie provides an AI-powered sales outreach, outbound sequence orchestration, and lead database management dashboard operating under the management of DICE Solutions.
              </p>
              <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-3">
                <h3 className="text-white font-semibold">Prohibited Platform Behaviors:</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-neutral-400">
                  <li>Violating international and regional communications laws.</li>
                  <li>Using the platform to send spam, bulk promotional materials, or deceptive communications.</li>
                  <li>Bypassing or abusing connected CRM and email host integration rate limitations.</li>
                  <li>Reverse engineering or abusing developer APIs and data scrapers.</li>
                  <li>Attempting unauthorized platform penetration, account takeover, or credential harvesting.</li>
                </ul>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">02.</span> Account Registration & Safeguards
              </h2>
              <p>
                To utilize LeadGennie, users must register accounts and authenticate third-party channels (such as mail boxes and CRM spaces). You agree to:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-neutral-300">
                <li>Maintain account and API credential confidentiality.</li>
                <li>Promptly inform support of suspected security breach incidents.</li>
                <li>Accept full responsibility for all activities executing under your token credentials.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">03.</span> Compliance & Acceptable Use
              </h2>
              <p>
                Users are solely responsible for ensuring outreach campaigns comply with the CAN-SPAM Act, GDPR, TCPA, Indian telecom directives, and any regional laws governing commercial emails. LeadGennie reserves the absolute right to suspend accounts immediately upon detecting systemic abuse, high bounce thresholds, or spam classifications.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">04.</span> AI-Generated Output & Disclaimers
              </h2>
              <p>
                LeadGennie employs AI systems to compose email copy and LinkedIn messages. Because generative algorithms can exhibit unexpected copy anomalies or hallucinatory references:
              </p>
              <div className="bg-purple-950/20 border border-purple-500/20 rounded-md p-5 text-sm text-purple-200 space-y-2">
                <p className="font-semibold">Review Requirement Notice:</p>
                <p>
                  Outreach content must be reviewed and approved by a human agent before campaign launch. The user retains all legal liability for the content, accuracy, compliance, and delivery targets of all campaigns initiated through LeadGennie.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">05.</span> Service Availability & Evolution
              </h2>
              <p>
                We strive for continuous database and sending system uptime, but we do not guarantee uninterrupted system access. LeadGennie reserves the right to modify parameters, push updates, shift integration requirements, or discontinue specific beta features at any time.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">06.</span> Intellectual Property Rights
              </h2>
              <p>
                All software infrastructure, brand logos, user interface designs, custom logic nodes, and website content are the exclusive intellectual property of LeadGennie and DICE Solutions. License to use the platform is personal, non-transferable, and revocable.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">07.</span> Limitations of Liability
              </h2>
              <p>
                In no event shall LeadGennie, DICE Solutions, or its developers be held liable for any indirect, incidental, or consequential damages. This includes, but is not limited to, lost business revenue, campaign delivery failures, email domain domain-warming blocks, pipeline damage, or integration channel suspension events. Use of the software is entirely at your own risk.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">08.</span> Termination & Suspension
              </h2>
              <p>
                We reserve the right to suspend or terminate accounts, credentials, and API access at our discretion, without prior notice, in the event of terms violations, unpaid platform invoices, or behavior threatening our server reputation.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">09.</span> Governing Law
              </h2>
              <p>
                These Terms of Service and any associated dispute resolution procedures are governed exclusively by the laws of India.
              </p>
            </section>

            <section className="space-y-4 border-t border-white/10 pt-6">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">10.</span> Contact Support
              </h2>
              <p>
                If you have questions regarding the terms of service agreement, please reach out to us at:
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
