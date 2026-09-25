import LegalPage, { type LegalSection } from "@/components/public/legal/LegalPage";
import { Item, List, MailLink, Panel, PanelBlock } from "@/components/public/legal/prose";

const SECTIONS: LegalSection[] = [
  {
    id: "infrastructure",
    title: "Infrastructure Security",
    body: (
      <>
        <p>We route all incoming and outgoing platform data through isolated enterprise cloud infrastructure. Core security components include:</p>
        <List>
          <Item label="Encryption in Transit">All traffic is encrypted using modern TLS (HTTPS) protocols.</Item>
          <Item label="Access Control Bounds">Rigid role-based access controls (RBAC) isolate staging and production parameters.</Item>
          <Item label="System Auditing">Automated audit logging tracks access configurations, changes, and API events.</Item>
          <Item label="Threat Surveillance">Active firewall systems and threat detection logs block bad actors dynamically.</Item>
        </List>
      </>
    ),
  },
  {
    id: "data-protection",
    title: "Data Protection & Storage",
    body: (
      <>
        <p>Your imported lead sheets, customer accounts, and campaign outputs are guarded with strict isolation buffers:</p>
        <List>
          <Item label="Database Isolation">Data rows are partitioned programmatically to block tenant leaks.</Item>
          <Item label="Access Limitations">Internal engineers can only access production data rows when responding to critical support queries.</Item>
          <Item label="Token Handling">
            Connected mailbox credentials and API keys are stored in encrypted environments, isolated from core application servers.
          </Item>
        </List>
      </>
    ),
  },
  {
    id: "ai-security",
    title: "AI & Model Security",
    body: (
      <>
        <p>We use secure, enterprise-grade endpoints from trusted AI infrastructure providers:</p>
        <List>
          <Item label="Zero Retention Pools">Prompts and payloads sent to models do not persist in secondary training databases.</Item>
          <Item label="No Public Model Training">
            Your campaigns, target companies, and personalized responses are never used to train public LLM models.
          </Item>
        </List>
      </>
    ),
  },
  {
    id: "integrations",
    title: "Integration Authentication",
    body: (
      <>
        <p>
          LeadGennie links to email servers (Gmail, Exchange) and GTM directories (Salesforce, HubSpot, LinkedIn) through secure OAuth protocols:
        </p>
        <List>
          <Item label="Minimum Required Scopes">We request only the minimal read/write scopes required to dispatch sequences and report statistics.</Item>
          <Item label="Revocable Tokens">
            Tokens are fully revocable by the user through their Google Workspace, Microsoft, or CRM settings panels at any moment.
          </Item>
        </List>
      </>
    ),
  },
  {
    id: "disclosure",
    title: "Responsible Disclosure Program",
    body: (
      <>
        <p>
          We appreciate the security community&apos;s work in keeping applications safe. If you discover a vulnerability or security issue within the LeadGennie
          platform, please report it to our team:
        </p>
        <Panel>
          <PanelBlock title="Report Vulnerabilities:">
            <p>
              Email: <MailLink email="security@leadgennie.ai" />
            </p>
            <p className="mt-2 text-[13px] text-neutral-500">
              Please include reproduction steps and avoid disrupting active customer data rows during testing.
            </p>
          </PanelBlock>
        </Panel>
      </>
    ),
  },
];

export default function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Trust Center"
      title="Security at LeadGennie"
      meta="Platform Integrity, Encryption & Compliance"
      sections={SECTIONS}
      intro={
        <p>
          LeadGennie is designed with security, privacy, and system reliability at its core. We maintain rigid protection protocols to shield your CRM
          integrations, customer databases, and outbound sequences.
        </p>
      }
    />
  );
}
