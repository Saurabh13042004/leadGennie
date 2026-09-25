import LegalPage, { type LegalSection } from "@/components/public/legal/LegalPage";
import { Callout, List, MailLink, Panel, PanelBlock } from "@/components/public/legal/prose";

const SECTIONS: LegalSection[] = [
  {
    id: "information-we-collect",
    title: "Information We Collect",
    body: (
      <Panel>
        <PanelBlock title="Information You Provide:">
          <List>
            <li>Name and company details</li>
            <li>Work email address</li>
            <li>Billing and invoice information</li>
            <li>CRM connection data and access tokens</li>
            <li>Uploaded lead lists, CSV files, and ICP descriptions</li>
            <li>Messages sent through support, waitlist, or feedback channels</li>
          </List>
        </PanelBlock>
        <PanelBlock title="Automatically Collected Information:">
          <List>
            <li>IP address and device parameters</li>
            <li>Browser information and usage logs</li>
            <li>Usage analytics and session details</li>
            <li>API usage logs and campaign activity metrics</li>
          </List>
        </PanelBlock>
        <PanelBlock title="Third-Party Integrations:">
          <p>
            If you connect integrations such as Gmail, Outlook, HubSpot, Salesforce, LinkedIn, or Google Sheets, we may access limited account data necessary to
            execute campaigns and sync records.
          </p>
        </PanelBlock>
      </Panel>
    ),
  },
  {
    id: "how-we-use-information",
    title: "How We Use Information",
    body: (
      <>
        <p>We use collected information to run and improve the LeadGennie platform. Specifically to:</p>
        <List>
          <li>Provide and maintain LeadGennie services</li>
          <li>Personalize and optimize AI-generated outreach templates</li>
          <li>Analyze product usage to debug performance and add features</li>
          <li>Maintain platform integrity, preventing abuse and fraud</li>
          <li>Process billing transactions securely</li>
          <li>Communicate critical product upgrades and notices</li>
          <li>Provide prompt customer support channels</li>
        </List>
        <Callout title="Data Sale Restriction:">
          <p>We do NOT sell personal customer data to data brokers or advertising channels.</p>
        </Callout>
      </>
    ),
  },
  {
    id: "ai-outreach-data",
    title: "AI & Outreach Data",
    body: (
      <>
        <p>
          LeadGennie utilizes AI models to generate personalized copy, evaluate Ideal Customer Profiles (ICPs), score prospect accounts, and orchestrate outbound
          sequences.
        </p>
        <p>All uploaded lead assets are processed securely. We do not use customer outreach files or unique campaign outputs to train public AI models.</p>
      </>
    ),
  },
  {
    id: "data-retention",
    title: "Data Retention",
    body: (
      <p>
        We retain client and campaign data only as long as necessary to provide active outbound services, comply with legal requirements, or maintain fraud
        prevention buffers. Users can request total deletion of their account databases and connected tokens at any time by contacting support.
      </p>
    ),
  },
  {
    id: "security-safeguards",
    title: "Security Safeguards",
    body: (
      <p>
        We implement industry-standard protective measures, including HTTPS encryption in transit, isolated database environments, strict role-based access
        bounds, detailed audit logging, and automated threat monitoring.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies & Preference Storage",
    body: (
      <p>
        We use cookies and active session tokens to keep users authenticated, store visual theme preferences, and compile product analytics. You can control
        cookie allowance policies via your web browser settings.
      </p>
    ),
  },
  {
    id: "service-providers",
    title: "Third-Party Service Providers",
    body: (
      <p>
        To maintain uptime and execute services, we route encrypted payloads through verified cloud hosting providers, database sync layers, payment processors,
        and AI inference API endpoints.
      </p>
    ),
  },
  {
    id: "international-transfers",
    title: "International Data Transfers",
    body: (
      <p>
        Your information may be processed and stored in regions outside your state or country where our primary cloud databases and infrastructure providers
        maintain operations.
      </p>
    ),
  },
  {
    id: "user-rights",
    title: "User Data Rights",
    body: (
      <p>
        Depending on your location, you may have the legal right to access, rectify, port, or request deletion of personal campaign records. Contact support to
        initiate these request routines.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes & Updates",
    body: (
      <p>
        We may modify this policy periodically to track new integrations or compliance criteria. Continued platform use after updates constitutes acceptance of
        the latest policy terms.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact Information",
    body: (
      <Panel>
        <PanelBlock title="LeadGennie">
          <p>A product by DICE Solutions</p>
          <p className="mt-1">
            Email: <MailLink email="support@leadgennie.ai" />
          </p>
        </PanelBlock>
      </Panel>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Trust & Safety"
      title="Privacy Policy"
      updated="May 2026"
      sections={SECTIONS}
      intro={
        <>
          <p>
            Welcome to LeadGennie. LeadGennie (&ldquo;LeadGennie&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is an AI-native outbound
            automation platform operated under DICE Solutions.
          </p>
          <p className="text-[15px] text-neutral-600">
            This Privacy Policy explains how we collect, use, store, and protect your information when you use our website, platform, APIs, integrations, and
            services. By using LeadGennie, you agree to the practices described below.
          </p>
        </>
      }
    />
  );
}
