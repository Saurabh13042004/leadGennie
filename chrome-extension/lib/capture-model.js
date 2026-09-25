/**
 * The capture card's data model — pure functions shared by the popup and the on-page widget, so both behave
 * identically and can be tested without a browser.
 */

export const FIELDS = [
  { key: 'full_name', cand: 'fullName', label: 'Name', required: true, placeholder: 'Sarah Chen', autocomplete: 'name' },
  { key: 'job_title', cand: 'jobTitle', label: 'Job title', placeholder: 'VP Sales' },
  { key: 'company', cand: 'company', label: 'Company', placeholder: 'Acme Inc' },
  { key: 'company_domain', cand: 'companyDomain', label: 'Company website', placeholder: 'acme.com' },
  { key: 'email', cand: 'email', label: 'Email', placeholder: 'sarah@acme.com', type: 'email' },
  { key: 'linkedin_url', cand: 'linkedinUrl', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/in/…' },
];

/** Source labels shown next to a prefilled field ("read from the page title"…). Empty = nothing to say. */
export const SOURCE_HINT = {
  jsonld: 'from the page',
  linkedin_title: 'from the profile',
  selection: 'from your selection',
  site: 'from this website',
  mailto: 'from a link on the page',
  llm: 'read from the page',
  workspace: 'matches a company you have',
  email_domain: "from their email",
};

/** Form values (strings) from the server's candidate. */
export function formFromCandidate(candidate) {
  const f = (candidate && candidate.fields) || {};
  const form = {};
  for (const { key, cand } of FIELDS) form[key] = f[cand] || '';
  return form;
}

/** Which fields the person typed or changed, versus accepted as read from the page (recorded as provenance). */
export function editedFields(original, current) {
  return FIELDS.map((f) => f.key).filter((k) => (original[k] || '').trim() !== (current[k] || '').trim());
}

const blank = (v) => v === undefined || v === null || String(v).trim() === '';

/** Client-side check before we bother the server: only what a person can fix in the card itself. */
export function validateForm(form) {
  const errors = {};
  if (blank(form.full_name)) errors.full_name = 'Enter a name.';
  if (!blank(form.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errors.email = "That doesn't look like an email address.";
  return errors;
}

/** The payload for POST /api/extension/leads. Empty strings become null so the server stores "unknown", not "". */
export function toLeadDraft(form, { sourceUrl, original }) {
  const draft = {};
  for (const { key } of FIELDS) draft[key] = blank(form[key]) ? null : form[key].trim();
  draft.full_name = form.full_name.trim();
  draft.source_url = sourceUrl || null;
  draft.edited_fields = editedFields(original || {}, form);
  return draft;
}

/** A one-line subtitle for a lead: "VP Sales · Acme · acme.com". */
export function leadSubtitle(lead) {
  return [lead.jobTitle, lead.company, lead.companyDomain].filter(Boolean).join(' · ');
}

/** The dashboard address for a lead. */
export function leadUrl(apiBase, leadId) {
  return `${apiBase}/dashboard/leads/${leadId}`;
}

/** Research states the UI treats as "finished, stop polling". */
export const RESEARCH_FINISHED = new Set(['done', 'partial', 'failed']);

export const RESEARCH_LABEL = {
  none: 'Not researched',
  queued: 'Queued…',
  running: 'Researching…',
  done: 'Researched',
  partial: 'Researched (partial)',
  failed: 'Research failed',
};

/** Friendly copy for an ApiError code in the card. `retryable` decides whether to show a Retry button. */
export function describeError(error) {
  const code = (error && error.code) || 'ERROR';
  const message = (error && error.message) || 'Something went wrong.';
  switch (code) {
    case 'UNAUTHENTICATED':
    case 'NOT_CONNECTED':
      return { title: 'Sign in to continue', message: 'Your LeadGennie connection expired or was disconnected.', action: 'connect', retryable: false };
    case 'FORBIDDEN':
      return { title: "You can't do that here", message, action: null, retryable: false };
    case 'RATE_LIMITED':
      return { title: 'Slow down a moment', message: `Too many requests. Try again${error && error.retryAfter ? ` in ${error.retryAfter}s` : ' shortly'}.`, action: null, retryable: true };
    case 'NETWORK':
      return { title: "Can't reach LeadGennie", message, action: null, retryable: true };
    case 'NOT_CONFIGURED':
      return { title: 'Not set up yet', message, action: null, retryable: false };
    case 'VALIDATION_ERROR':
      return { title: 'Check the details', message, action: null, retryable: false };
    default:
      return { title: 'Something went wrong', message, action: null, retryable: true };
  }
}
