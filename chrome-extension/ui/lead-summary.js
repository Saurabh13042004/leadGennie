import { RESEARCH_FINISHED, RESEARCH_LABEL, leadSubtitle, leadUrl } from '../lib/capture-model.js';
import { MSG, send } from '../lib/messages.js';
import { RESEARCH_POLL_MAX_MS, RESEARCH_POLL_MS } from '../lib/config.js';
import { avatar, badge, button, callout, emailStatusBadge, h, icon, mount, stageBadge } from './dom.js';

/**
 * "This person is in LeadGennie": a lead's summary, the link to its dashboard page, and "Research with Gennie" with a live
 * status. Used after a capture ("Added"), for a duplicate ("Already in LeadGennie"), and by the on-page widget's lookup.
 */
export function createLeadSummary({ lead, apiBase, session, headline, openUrl, onChange }) {
  const root = h('div', { class: 'lg-col lg-gap-3' });
  let current = lead;
  let research = { phase: 'idle', error: null }; // idle | starting | polling | done
  let timer = null;
  let startedAt = 0;

  const scopes = (session && session.scopes) || [];
  const canResearch = scopes.includes('research:trigger');
  const researchConfigured = !session || !session.features || session.features.research !== false;

  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  async function poll() {
    const res = await send(MSG.GET_LEAD, { id: current.id });
    if (res.ok) {
      current = { ...current, ...res.data.lead };
      onChange && onChange(current);
      if (RESEARCH_FINISHED.has(current.researchStatus)) {
        research = { phase: 'done', error: null };
        render();
        return;
      }
    }
    if (Date.now() - startedAt > RESEARCH_POLL_MAX_MS) {
      research = { phase: 'done', error: null };
      render();
      return;
    }
    render();
    timer = setTimeout(poll, RESEARCH_POLL_MS);
  }

  async function startResearch() {
    research = { phase: 'starting', error: null };
    render();
    const res = await send(MSG.RESEARCH, { id: current.id });
    if (!res.ok) {
      research = { phase: 'idle', error: res.error.message };
      render();
      return;
    }
    if (!res.data.queued && res.data.skipped === 'no_company') {
      research = { phase: 'idle', error: "Add a company or website first — there's nothing to research yet." };
      render();
      return;
    }
    current = { ...current, researchStatus: 'queued' };
    research = { phase: 'polling', error: null };
    startedAt = Date.now();
    render();
    timer = setTimeout(poll, RESEARCH_POLL_MS);
  }

  function researchBlock() {
    const status = current.researchStatus || 'none';
    const inFlight = research.phase === 'polling' || status === 'queued' || status === 'running';
    const blocks = [];

    if (RESEARCH_FINISHED.has(status) && current.icpScore !== null && current.icpScore !== undefined) {
      blocks.push(
        h('div', { class: 'lg-row lg-gap-2 lg-wrap' },
          badge(RESEARCH_LABEL[status], status === 'failed' ? 'rose' : 'emerald', { dot: true }),
          h('span', { class: 'lg-small lg-muted' }, `ICP fit ${current.icpScore}/100${current.qualified === true ? ' · qualified' : ''}`),
        ),
      );
    } else if (inFlight) {
      blocks.push(h('div', { class: 'lg-row lg-gap-2', role: 'status' }, badge(RESEARCH_LABEL[status] === 'Not researched' ? 'Queued…' : RESEARCH_LABEL[status], 'indigo', { dot: true }),
        h('span', { class: 'lg-small lg-muted' }, 'This takes a minute or two. You can close this.')));
    } else if (status === 'failed') {
      blocks.push(callout('error', 'The last research attempt failed. You can try again.'));
    }

    if (!inFlight && canResearch) {
      const done = RESEARCH_FINISHED.has(status) && status !== 'failed';
      blocks.push(
        button({
          label: done ? 'Research again' : 'Research with Gennie', variant: done ? 'secondary' : 'accent', iconName: 'MagicWand', iconWeight: 'fill', block: true,
          busy: research.phase === 'starting', disabled: !researchConfigured, onClick: startResearch,
        }),
      );
      if (!researchConfigured) blocks.push(h('p', { class: 'lg-help' }, "Research isn't set up on this LeadGennie yet — ask an admin."));
    }
    if (research.error) blocks.push(callout('error', research.error));
    return blocks;
  }

  function render() {
    mount(
      root,
      headline && h('div', { class: 'lg-row lg-gap-2 lg-strong' }, icon(headline.tone === 'success' ? 'CheckCircle' : 'IdentificationCard', { weight: 'fill', size: 'lg', className: headline.tone === 'success' ? 'lg-icon-ok' : '' }), headline.text),
      h('div', { class: 'lg-panel lg-row lg-gap-3' },
        avatar(current.fullName),
        h('div', { class: 'lg-grow' },
          h('p', { class: 'lg-strong lg-truncate' }, current.fullName),
          h('p', { class: 'lg-small lg-muted lg-truncate' }, leadSubtitle(current) || 'No title or company yet'),
          h('div', { class: 'lg-row lg-gap-1 lg-wrap', style: 'margin-top:6px' }, stageBadge(current.stage || 'new'), current.email ? emailStatusBadge(current.emailStatus) : badge('No email')),
        ),
      ),
      h('div', { class: 'lg-col lg-gap-2' },
        button({ label: 'Open in LeadGennie', variant: 'primary', iconName: 'ArrowSquareOut', block: true, onClick: () => openUrl(leadUrl(apiBase, current.id)) }),
        ...researchBlock(),
      ),
    );
  }

  render();
  // If research was already running when we looked, keep the status fresh.
  if (current.researchStatus === 'queued' || current.researchStatus === 'running') {
    research = { phase: 'polling', error: null };
    startedAt = Date.now();
    timer = setTimeout(poll, RESEARCH_POLL_MS);
  }
  return { el: root, destroy: stop };
}
