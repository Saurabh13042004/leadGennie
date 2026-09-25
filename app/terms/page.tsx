import LegalPage, { type LegalSection } from "@/components/public/legal/LegalPage";
import { Callout, List, MailLink, Panel, PanelBlock } from "@/components/public/legal/prose";

const SECTIONS: LegalSection[] = [
  {
    id: "scope",
    title: "Scope of Service",
    body: (
      <>
        <p>
          LeadGennie provides an intelligent sales outreach, outbound sequence orchestration, and lead database management dashboard operating under the management
          of DICE Solutions.
        </p>
        <Panel>
          <PanelBlock title="Prohibited Platform Behaviors:">
            <List>
              <li>Violating international and regional communications laws.</li>
              <li>Using the platform to send spam, bulk promotional materials, or deceptive communications.</li>
              <li>Bypassing or abusing connected CRM and email host integration rate limitations.</li>
              <li>Reverse engineering or abusing developer APIs and data scrapers.</li>
              <li>Attempting unauthorized platform penetration, account takeover, or credential harvesting.</li>
            </List>
          </PanelBlock>
        </Panel>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Account Registration & Safeguards",
    body: (
      <>
        <p>
          To utilize LeadGennie, users must register accounts and authenticate third-party channels (such as mail boxes and CRM spaces). You agree to:
        </p>
        <List>
          <li>Maintain account and API credential confidentiality.</li>
          <li>Promptly inform support of suspected security breach incidents.</li>
          <li>Accept full responsibility for all activities executing under your token credentials.</li>
        </List>
      </>
    ),
  },
  {
    id: "compliance",
    title: "Compliance & Acceptable Use",
    body: (
      <p>
        Users are solely responsible for ensuring outreach campaigns comply with the CAN-SPAM Act, GDPR, TCPA, Indian telecom directives, and any regional laws
        governing commercial emails. LeadGennie reserves the absolute right to suspend accounts immediately upon detecting systemic abuse, high bounce thresholds,
        or spam classifications.
      </p>
    ),
  },
  {
    id: "ai-output",
    title: "AI-Generated Output & Disclaimers",
    body: (
      <>
        <p>
          LeadGennie employs AI systems to compose email copy and LinkedIn messages. Because generative algorithms can exhibit unexpected copy anomalies or
          hallucinatory references:
        </p>
        <Callout title="Review Requirement Notice:">
          <p>
            Outreach content must be reviewed and approved by a human agent before campaign launch. The user retains all legal liability for the content,
            accuracy, compliance, and delivery targets of all campaigns initiated through LeadGennie.
          </p>
        </Callout>
      </>
    ),
  },
  {
    id: "availability",
    title: "Service Availability & Evolution",
    body: (
      <p>
        We strive for continuous database and sending system uptime, but we do not guarantee uninterrupted system access. LeadGennie reserves the right to modify
        parameters, push updates, shift integration requirements, or discontinue specific beta features at any time.
      </p>
    ),
  },
  {
    id: "ip",
    title: "Intellectual Property Rights",
    body: (
      <p>
        All software infrastructure, brand logos, user interface designs, custom logic nodes, and website content are the exclusive intellectual property of
        LeadGennie and DICE Solutions. License to use the platform is personal, non-transferable, and revocable.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitations of Liability",
    body: (
      <p>
        In no event shall LeadGennie, DICE Solutions, or its developers be held liable for any indirect, incidental, or consequential damages. This includes, but
        is not limited to, lost business revenue, campaign delivery failures, email domain-warming blocks, pipeline damage, or integration channel suspension
        events. Use of the software is entirely at your own risk.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Termination & Suspension",
    body: (
      <p>
        We reserve the right to suspend or terminate accounts, credentials, and API access at our discretion, without prior notice, in the event of terms
        violations, unpaid platform invoices, or behavior threatening our server reputation.
      </p>
    ),
  },
  {
    id: "governing-law",
    title: "Governing Law",
    body: <p>These Terms of Service and any associated dispute resolution procedures are governed exclusively by the laws of India.</p>,
  },
  {
    id: "contact",
    title: "Contact Support",
    body: (
      <p>
        If you have questions regarding the terms of service agreement, please reach out to us at: <MailLink email="support@leadgennie.ai" />
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal Agreement"
      title="Terms of Service"
      updated="May 2026"
      sections={SECTIONS}
      intro={<p>Welcome to LeadGennie. By accessing or using LeadGennie, you agree to comply with and be bound by these Terms of Service.</p>}
    />
  );
}
