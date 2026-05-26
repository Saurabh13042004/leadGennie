import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BackgroundEffects from "@/components/BackgroundEffects";

export default function SecurityPage() {
  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-purple-500/30 selection:text-white overflow-hidden flex flex-col">
      <BackgroundEffects />
      <Navbar />
      
      <main className="flex-grow pt-32 pb-24 px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="border-b border-white/10 pb-8 mb-10">
            <div className="text-purple-400 font-mono text-xs mb-3 tracking-wider uppercase">[ Trust Center ]</div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">Security at LeadGennie</h1>
            <p className="text-neutral-500 text-sm font-mono">Platform Integrity, Encryption & Compliance</p>
          </div>
          
          {/* Body Content */}
          <div className="text-neutral-300 space-y-8 leading-relaxed font-sans">
            <p className="text-lg text-neutral-400">
              LeadGennie is designed with security, privacy, and system reliability at its core. We maintain rigid protection protocols to shield your CRM integrations, customer databases, and outbound sequences.
            </p>

            <hr className="border-white/10 my-8" />

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                Infrastructure Security
              </h2>
              <p>
                We route all incoming and outgoing platform data through isolated enterprise cloud infrastructure. Core security components include:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-neutral-300">
                <li><strong>Encryption in Transit:</strong> All traffic is encrypted using modern TLS (HTTPS) protocols.</li>
                <li><strong>Access Control Bounds:</strong> Rigid role-based access controls (RBAC) isolate staging and production parameters.</li>
                <li><strong>System Auditing:</strong> Automated audit logging tracks access configurations, changes, and API events.</li>
                <li><strong>Threat Surveillance:</strong> Active firewall systems and threat detection logs block bad actors dynamically.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                Data Protection & Storage
              </h2>
              <p>
                Your imported lead sheets, customer accounts, and campaign outputs are guarded with strict isolation buffers:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-neutral-300">
                <li><strong>Database Isolation:</strong> Data rows are partitioned programmatically to block tenant leaks.</li>
                <li><strong>Access Limitations:</strong> Internal engineers can only access production data rows when responding to critical support queries.</li>
                <li><strong>Token Handling:</strong> Connected mailbox credentials and API keys are stored in encrypted environments, isolated from core application servers.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                AI & Model Security
              </h2>
              <p>
                We use secure, enterprise-grade endpoints from trusted AI infrastructure providers:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-neutral-300">
                <li><strong>Zero Retention Pools:</strong> Prompts and payloads sent to models do not persist in secondary training databases.</li>
                <li><strong>No Public Model Training:</strong> Your campaigns, target companies, and personalized responses are never used to train public LLM models.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                Integration Authentication
              </h2>
              <p>
                LeadGennie links to email servers (Gmail, Exchange) and GTM directories (Salesforce, HubSpot, LinkedIn) through secure OAuth protocols:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-neutral-300">
                <li><strong>Minimum Required Scopes:</strong> We request only the minimal read/write scopes required to dispatch sequences and report statistics.</li>
                <li><strong>Revocable Tokens:</strong> Tokens are fully revocable by the user through their Google Workspace, Microsoft, or CRM settings panels at any moment.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                Responsible Disclosure Program
              </h2>
              <p>
                We appreciate the security community's work in keeping applications safe. If you discover a vulnerability or security issue within the LeadGennie platform, please report it to our team:
              </p>
              <div className="bg-neutral-900 border border-white/10 rounded-md p-5 font-mono text-sm space-y-2">
                <p className="text-white font-semibold">Report Vulnerabilities:</p>
                <p>Email: <a href="mailto:security@leadgennie.ai" className="text-purple-400 hover:underline">security@leadgennie.ai</a></p>
                <p className="text-neutral-500 text-xs mt-1">Please include reproduction steps and avoid disrupting active customer data rows during testing.</p>
              </div>
            </section>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
