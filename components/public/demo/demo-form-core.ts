/** Plain data + validation for the "Get Early Access" demo request form (BookDemoModal). */

export type DemoFormData = {
  name: string;
  email: string;
  company: string;
  companySize: string;
  outboundVolume: string;
  challenges: string[];
  crmUsed: string;
};

export type DemoField = Exclude<keyof DemoFormData, "challenges">;
export type DemoErrors = Partial<Record<DemoField, string>>;

export const emptyDemoForm = (email = ""): DemoFormData => ({
  name: "",
  email,
  company: "",
  companySize: "",
  outboundVolume: "",
  challenges: [],
  crmUsed: "",
});

export const COMPANY_SIZES = [
  { value: "1-5", label: "1-5 people" },
  { value: "5-20", label: "5-20 people" },
  { value: "20-50", label: "20-50 people" },
  { value: "50-200", label: "50-200 people" },
  { value: "200+", label: "200+ people" },
];

export const OUTBOUND_VOLUMES = [
  { value: "<100", label: "<100/month" },
  { value: "100-1k", label: "100-1k/month" },
  { value: "1k-10k", label: "1k-10k/month" },
  { value: "10k+", label: "10k+/month" },
];

export const CHALLENGES = ["Deliverability", "Personalization", "Reply rates", "Lead management", "Campaign automation"];

export const CRM_OPTIONS = ["HubSpot", "Salesforce", "Pipedrive", "Close", "None", "Other"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same required fields as before (every input/select was `required`); returns inline messages instead of browser bubbles. */
export function validateDemoStep(step: 1 | 2, d: DemoFormData): DemoErrors {
  const e: DemoErrors = {};
  if (step === 1) {
    if (!d.name.trim()) e.name = "Enter your full name.";
    if (!d.email.trim()) e.email = "Enter your work email.";
    else if (!EMAIL_RE.test(d.email.trim())) e.email = "Enter a valid email address.";
    if (!d.company.trim()) e.company = "Enter your company name.";
    if (!d.companySize) e.companySize = "Select your company size.";
  } else {
    if (!d.outboundVolume) e.outboundVolume = "Select your outbound volume.";
    if (!d.crmUsed) e.crmUsed = "Select the CRM you use.";
  }
  return e;
}
