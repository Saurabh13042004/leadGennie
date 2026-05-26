import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackgroundEffects from "@/components/BackgroundEffects";

export default function PrivacyPage() {
  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-purple-500/30 selection:text-white overflow-hidden flex flex-col">
      <BackgroundEffects />
      <Navbar />
      
      <main className="flex-grow pt-32 pb-24 px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="border-b border-white/10 pb-8 mb-10">
            <div className="text-purple-400 font-mono text-xs mb-3 tracking-wider uppercase">[ Trust & Safety ]</div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">Privacy Policy</h1>
            <p className="text-neutral-500 text-sm font-mono">Last updated: May 2026</p>
          </div>
          
          {/* Body Content */}
          <div className="text-neutral-300 space-y-8 leading-relaxed font-sans">
            <p className="text-lg text-neutral-400">
              Welcome to LeadGennie. LeadGennie (&ldquo;LeadGennie&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is an AI-native outbound automation platform operated under DICE Solutions.
            </p>
            <p>
              This Privacy Policy explains how we collect, use, store, and protect your information when you use our website, platform, APIs, integrations, and services. By using LeadGennie, you agree to the practices described below.
            </p>

            <hr className="border-white/10 my-8" />

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">01.</span> Information We Collect
              </h2>
              
              <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="text-white font-semibold mb-2">Information You Provide:</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-400">
                    <li>Name and company details</li>
                    <li>Work email address</li>
                    <li>Billing and invoice information</li>
                    <li>CRM connection data and access tokens</li>
                    <li>Uploaded lead lists, CSV files, and ICP descriptions</li>
                    <li>Messages sent through support, waitlist, or feedback channels</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-2">Automatically Collected Information:</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-neutral-400">
                    <li>IP address and device parameters</li>
                    <li>Browser information and usage logs</li>
                    <li>Usage analytics and session details</li>
                    <li>API usage logs and campaign activity metrics</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-2">Third-Party Integrations:</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    If you connect integrations such as Gmail, Outlook, HubSpot, Salesforce, LinkedIn, or Google Sheets, we may access limited account data necessary to execute campaigns and sync records.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">02.</span> How We Use Information
              </h2>
              <p>
                We use collected information to run and improve the LeadGennie platform. Specifically to:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-neutral-300">
                <li>Provide and maintain LeadGennie services</li>
                <li>Personalize and optimize AI-generated outreach templates</li>
                <li>Analyze product usage to debug performance and add features</li>
                <li>Maintain platform integrity, preventing abuse and fraud</li>
                <li>Process billing transactions securely</li>
                <li>Communicate critical product upgrades and notices</li>
                <li>Provide prompt customer support channels</li>
              </ul>
              <div className="bg-purple-950/20 border border-purple-500/20 rounded-md p-4 text-sm text-purple-200">
                <strong>Data Sale Restriction:</strong> We do NOT sell personal customer data to data brokers or advertising channels.
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">03.</span> AI & Outreach Data
              </h2>
              <p>
                LeadGennie utilizes AI models to generate personalized copy, evaluate Ideal Customer Profiles (ICPs), score prospect accounts, and orchestrate outbound sequences.
              </p>
              <p className="text-neutral-400">
                All uploaded lead assets are processed securely. We do not use customer outreach files or unique campaign outputs to train public AI models.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">04.</span> Data Retention
              </h2>
              <p>
                We retain client and campaign data only as long as necessary to provide active outbound services, comply with legal requirements, or maintain fraud prevention buffers. Users can request total deletion of their account databases and connected tokens at any time by contacting support.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">05.</span> Security Safeguards
              </h2>
              <p>
                We implement industry-standard protective measures, including HTTPS encryption in transit, isolated database environments, strict role-based access bounds, detailed audit logging, and automated threat monitoring. 
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">06.</span> Cookies & Preference Storage
              </h2>
              <p>
                We use cookies and active session tokens to keep users authenticated, store visual theme preferences, and compile product analytics. You can control cookie allowance policies via your web browser settings.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">07.</span> Third-Party Service Providers
              </h2>
              <p>
                To maintain uptime and execute services, we route encrypted payloads through verified cloud hosting providers, database sync layers, payment processors, and AI inference API endpoints.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">08.</span> International Data Transfers
              </h2>
              <p>
                Your information may be processed and stored in regions outside your state or country where our primary cloud databases and infrastructure providers maintain operations.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">09.</span> User Data Rights
              </h2>
              <p>
                Depending on your location, you may have the legal right to access, rectify, port, or request deletion of personal campaign records. Contact support to initiate these request routines.
              </p>
            </section>

            <section className="space-y-4 border-t border-white/10 pt-6">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">10.</span> Changes & Updates
              </h2>
              <p>
                We may modify this policy periodically to track new integrations or compliance criteria. Continued platform use after updates constitutes acceptance of the latest policy terms.
              </p>
            </section>

            <section className="space-y-4 border-t border-white/10 pt-6">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <span className="text-purple-400 text-sm">11.</span> Contact Information
              </h2>
              <div className="font-mono text-sm bg-neutral-900/50 p-4 border border-white/5 rounded-md space-y-1">
                <p className="text-white font-semibold">LeadGennie</p>
                <p className="text-neutral-400">A product by DICE Solutions</p>
                <p className="text-neutral-400">Email: <a href="mailto:support@leadgennie.ai" className="text-purple-400 hover:underline">support@leadgennie.ai</a></p>
              </div>
            </section>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
