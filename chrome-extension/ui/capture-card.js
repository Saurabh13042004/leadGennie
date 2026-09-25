import { FIELDS, SOURCE_HINT, describeError, formFromCandidate, toLeadDraft, validateForm } from '../lib/capture-model.js';
import { MSG, send } from '../lib/messages.js';
import { button, callout, h, mount, spinner } from './dom.js';
import { createLeadSummary } from './lead-summary.js';

/**
 * The capture card: read the page → show what we found → the person edits → save. One implementation for the popup and
 * the on-page widget (they pass in how to read the page and how to open a link).
 *
 *   phases: reading → review → saving → saved | existing        (or error → manual entry)
 *
 * The extension only READS the page (getFacts) — deciding what those facts mean is the server's job, and nothing is
 * saved until the person presses Add lead.
 */
export function createCaptureCard({ getFacts, session, apiBase, openUrl, onConnect, onSaved }) {
  const root = h('div', { class: 'lg-col lg-gap-3' });
  let state = { phase: 'reading' };
  let summary = null;

  const setState = (next) => {
    state = next;
    render();
  };
  const destroySummary = () => {
    if (summary) summary.destroy();
    summary = null;
  };

  async function start() {
    destroySummary();
    setState({ phase: 'reading' });
    let facts;
    try {
      facts = await getFacts();
    } catch (e) {
      return setState({ phase: 'error', error: { code: 'PAGE', message: "LeadGennie can't read this page (browser pages and some protected pages are off limits)." }, manual: null });
    }
    const res = await send(MSG.EXTRACT, { facts });
    if (!res.ok) return setState({ phase: 'error', error: res.error, manual: { sourceUrl: facts.url } });

    const { candidate, existing } = res.data;
    if (existing) return setState({ phase: 'existing', lead: existing });
    const form = formFromCandidate(candidate);
    setState({ phase: 'review', candidate, form, original: { ...form }, errors: {}, sourceUrl: candidate.sourceUrl, saveError: null });
  }

  async function save() {
    const errors = validateForm(state.form);
    if (Object.keys(errors).length) return setState({ ...state, errors });
    setState({ ...state, phase: 'saving', errors: {}, saveError: null });
    const res = await send(MSG.CREATE, { lead: toLeadDraft(state.form, { sourceUrl: state.sourceUrl, original: state.original }) });
    if (!res.ok) return setState({ ...state, phase: 'review', saveError: res.error });
    onSaved && onSaved(res.data);
    setState({ phase: res.data.created ? 'saved' : 'existing', lead: res.data.lead });
  }

  function fieldRow(f, s) {
    const hint = s.candidate && s.candidate.sources[f.cand] && s.form[f.key] === s.original[f.key] ? SOURCE_HINT[s.candidate.sources[f.cand]] : '';
    const err = s.errors[f.key];
    const id = `lg-f-${f.key}`;
    return h('label', { class: 'lg-field', for: id },
      h('div', { class: 'lg-label-row' }, h('span', { class: 'lg-label' }, f.label, f.required ? ' *' : ''), hint ? h('span', { class: 'lg-hint' }, hint) : null),
      h('input', {
        id, class: 'lg-input', type: f.type || 'text', value: s.form[f.key], placeholder: f.placeholder, autocomplete: f.autocomplete || 'off', spellcheck: 'false',
        'aria-invalid': err ? 'true' : undefined, 'aria-describedby': err ? `${id}-err` : undefined,
        oninput: (e) => {
          state.form[f.key] = e.target.value;
          if (state.errors[f.key]) {
            delete state.errors[f.key];
            e.target.removeAttribute('aria-invalid');
            const m = root.querySelector(`#${id}-err`);
            if (m) m.remove();
          }
        },
        onkeydown: (e) => {
          if (e.key === 'Enter') save();
          e.stopPropagation(); // keep the host page's keyboard shortcuts from swallowing typing
        },
        onkeyup: (e) => e.stopPropagation(),
        onkeypress: (e) => e.stopPropagation(),
      }),
      err ? h('p', { class: 'lg-error', id: `${id}-err` }, err) : null,
    );
  }

  function reviewView() {
    const s = state;
    const c = s.candidate;
    const rows = Object.fromEntries(FIELDS.map((f) => [f.key, fieldRow(f, s)]));
    const err = s.saveError ? describeError(s.saveError) : null;
    return [
      c && c.warnings.length ? h('div', { class: 'lg-col lg-gap-1' }, c.warnings.map((w) => callout('warning', w))) : null,
      h('form', { class: 'lg-form', onsubmit: (e) => e.preventDefault() },
        rows.full_name,
        h('div', { class: 'lg-form-2' }, rows.job_title, rows.company),
        rows.company_domain,
        h('div', { class: 'lg-form-2' }, rows.email, rows.linkedin_url),
      ),
      c
        ? h('p', { class: 'lg-help' }, c.confidence === 'high' ? 'Read from this page — check the details, then add.' : c.confidence === 'medium' ? 'Some details were read from the page. Please check them.' : "We couldn't read much from this page — fill in what you know.")
        : h('p', { class: 'lg-help' }, 'Fill in what you know, then add.'),
      err ? callout('error', h('strong', {}, err.title), ' — ', err.message) : null,
      h('div', { class: 'lg-row lg-gap-2' },
        button({ label: 'Add lead', variant: 'primary', iconName: 'UserPlus', iconWeight: 'fill', block: true, onClick: save, busy: s.phase === 'saving' }),
        button({ label: 'Re-read', variant: 'ghost', iconName: 'ArrowClockwise', onClick: start, disabled: s.phase === 'saving', title: 'Read this page again' }),
      ),
    ];
  }

  function errorView() {
    const d = describeError(state.error);
    return [
      callout('error', h('strong', {}, d.title), h('div', {}, d.message)),
      h('div', { class: 'lg-row lg-gap-2' },
        d.action === 'connect' && onConnect ? button({ label: 'Connect LeadGennie', variant: 'primary', iconName: 'PlugsConnected', iconWeight: 'fill', block: true, onClick: onConnect }) : null,
        d.retryable ? button({ label: 'Try again', variant: 'secondary', iconName: 'ArrowClockwise', block: true, onClick: start }) : null,
        state.manual ? button({ label: 'Enter details myself', variant: 'secondary', iconName: 'UserPlus', block: true, onClick: () => {
          const form = formFromCandidate(null);
          setState({ phase: 'review', candidate: null, form, original: { ...form }, errors: {}, sourceUrl: state.manual.sourceUrl, saveError: null });
        } }) : null,
      ),
    ];
  }

  function render() {
    if (state.phase === 'saved' || state.phase === 'existing') {
      destroySummary();
      summary = createLeadSummary({
        lead: state.lead, apiBase, session, openUrl,
        headline: state.phase === 'saved' ? { tone: 'success', text: 'Added to LeadGennie' } : { tone: 'info', text: 'Already in LeadGennie' },
      });
      return mount(root, summary.el);
    }
    if (state.phase === 'reading') {
      return mount(root,
        h('div', { class: 'lg-row lg-gap-2 lg-muted', role: 'status', 'aria-live': 'polite' }, spinner('sm'), 'Reading this page…'),
        h('div', { class: 'lg-col lg-gap-2' }, ...[70, 100, 100, 60].map((w) => h('div', { class: 'lg-skeleton', style: `height:32px;width:${w}%` }))),
      );
    }
    if (state.phase === 'error') return mount(root, ...errorView());
    return mount(root, ...reviewView()); // review | saving
  }

  render();
  return { el: root, start, destroy: destroySummary };
}
