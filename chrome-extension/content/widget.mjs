// LeadGennie on-page card for LinkedIn profiles (loaded by content/widget-loader.js).
//
// A pill in the bottom-right corner that says whether this person is already in LeadGennie, and opens the same capture
// card the popup uses. Rendered in a CLOSED shadow root so LinkedIn's CSS can't touch it (and it can't touch LinkedIn's), and
// built with DOM/CSSOM APIs only — LinkedIn enforces Trusted Types and a strict CSP, which forbid markup strings and inline
// <style>. Nothing is read from the page until the person clicks; nothing is saved until they press Add lead.
import { PAGE_TEXT_LIMIT } from '../lib/config.js';
import { collectPageFacts } from '../lib/page-facts.js';
import { MSG, send } from '../lib/messages.js';
import { createCaptureCard } from '../ui/capture-card.js';
import { button, callout, h, icon, logo, mount, spinner, stageBadge } from '../ui/dom.js';
import { createLeadSummary } from '../ui/lead-summary.js';

const HOST_ID = 'leadgennie-root';

const WIDGET_CSS = `
.w-wrap { position: relative; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.w-pill { display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px 0 8px; border: 0; border-radius: 999px; background: #fff; cursor: pointer;
  box-shadow: 0 0 0 1px rgba(229,229,229,.9), 0 6px 20px -4px rgba(0,0,0,.18); font-weight: 500; color: var(--n-900); }
.w-pill:hover { box-shadow: 0 0 0 1px var(--n-300), 0 8px 24px -4px rgba(0,0,0,.22); }
.w-pill:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(99,102,241,.5), 0 6px 20px -4px rgba(0,0,0,.18); }
.w-pill .lg-logo { width: 22px; height: 22px; border-radius: 6px; }
.w-pill .lg-logo svg { width: 11px; height: 11px; }
.w-panel { width: 328px; max-height: min(78vh, 620px); overflow-y: auto; border-radius: 14px; background: #fff;
  box-shadow: 0 0 0 1px rgba(229,229,229,.9), 0 16px 40px -8px rgba(0,0,0,.28); }
.w-head { display: flex; align-items: center; gap: 8px; padding: 10px 10px 10px 12px; border-bottom: 1px solid var(--n-100); }
.w-body { padding: 12px; }
.w-close { position: absolute; top: -8px; right: -8px; width: 20px; height: 20px; border: 0; border-radius: 50%; background: var(--n-900); color: #fff; cursor: pointer;
  display: none; align-items: center; justify-content: center; }
.w-wrap:hover .w-close { display: inline-flex; }
`;

let stylesPromise = null;
function loadStyles() {
  stylesPromise ||= (async () => {
    const css = await (await fetch(chrome.runtime.getURL('ui/lg.css'))).text();
    const sheet = new CSSStyleSheet(); // constructable stylesheets are CSSOM: not blocked by a page's style-src
    sheet.replaceSync(`${css}\n${WIDGET_CSS}`);
    try {
      // Fonts can't be declared inside a shadow root; register Geist on the document. If the page's CSP refuses it, the
      // system font stack in lg.css is used — the widget still works, it just isn't Geist.
      const face = new FontFace('Geist', `url(${chrome.runtime.getURL('fonts/Geist-Variable.woff2')})`, { weight: '100 900' });
      document.fonts.add(await face.load());
    } catch {
      /* fall back to the system stack */
    }
    return sheet;
  })();
  return stylesPromise;
}

const isProfilePath = () => /^\/in\/[^/]+\/?$/.test(window.location.pathname);
const profileUrl = () => window.location.href.split('?')[0].split('#')[0];
const openUrl = (url) => window.open(url, '_blank', 'noopener');

class Widget {
  constructor() {
    this.host = null;
    this.root = null;
    this.open = false;
    this.dismissed = false;
    this.status = null; // { connected, session }
    this.lookup = { phase: 'checking', lead: null };
    this.card = null;
    this.summary = null;
    this.forUrl = null;
  }

  async mountHost() {
    if (this.host) return;
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.setProperty('all', 'initial');
    Object.assign(host.style, { position: 'fixed', right: '20px', bottom: '20px', zIndex: '2147483647' });
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.adoptedStyleSheets = [await loadStyles()];
    this.root = h('div', { class: 'lg-root w-wrap' });
    shadow.append(this.root);
    document.documentElement.append(host);
    this.host = host;
  }

  unmount() {
    this.teardown();
    if (this.host) this.host.remove();
    this.host = null;
    this.root = null;
  }

  teardown() {
    if (this.card) this.card.destroy();
    if (this.summary) this.summary.destroy();
    this.card = null;
    this.summary = null;
  }

  async show() {
    const url = profileUrl();
    if (this.forUrl === url && this.host) return;
    this.forUrl = url;
    this.open = false;
    this.dismissed = false;
    this.teardown();
    await this.mountHost();
    this.lookup = { phase: 'checking', lead: null };
    this.render();

    const status = await send(MSG.STATUS);
    this.status = status.ok ? status.data : { connected: false, session: null };
    if (!status.ok) {
      this.lookup = { phase: 'error', error: status.error.message };
      return this.render();
    }
    if (!this.status.connected) {
      this.lookup = { phase: 'signedout' };
      return this.render();
    }
    const res = await send(MSG.LOOKUP, { linkedinUrl: url });
    if (this.forUrl !== url) return; // navigated away meanwhile
    if (!res.ok) {
      this.lookup = res.error.code === 'UNAUTHENTICATED' ? { phase: 'signedout' } : { phase: 'error', error: res.error.message };
    } else {
      this.lookup = res.data.found ? { phase: 'found', lead: res.data.lead } : { phase: 'missing' };
    }
    this.render();
  }

  hide() {
    this.forUrl = null;
    this.unmount();
  }

  canCreate() {
    const scopes = (this.status && this.status.session && this.status.session.scopes) || [];
    return scopes.includes('leads:create');
  }

  pill() {
    const l = this.lookup;
    let label;
    if (l.phase === 'checking') label = h('span', { class: 'lg-row lg-gap-2 lg-muted' }, spinner('sm'), 'LeadGennie');
    else if (l.phase === 'found') label = h('span', { class: 'lg-row lg-gap-2' }, 'In LeadGennie', stageBadge(l.lead.stage));
    else if (l.phase === 'signedout') label = 'Connect LeadGennie';
    else if (l.phase === 'error') label = h('span', { class: 'lg-row lg-gap-2' }, icon('WarningCircle', { weight: 'fill', size: 'sm', className: 'lg-faint' }), 'LeadGennie unavailable');
    else label = this.canCreate() ? h('span', { class: 'lg-row lg-gap-2' }, icon('UserPlus', { weight: 'fill', size: 'sm' }), 'Add to LeadGennie') : 'Not in LeadGennie';
    return h('button', { class: 'w-pill', type: 'button', 'aria-label': 'LeadGennie', 'aria-expanded': String(this.open), onclick: () => this.toggle() }, logo(), label);
  }

  toggle() {
    this.open = !this.open;
    this.render(); // render() starts the capture card the first time the panel opens on a person we don't know yet
  }

  panelBody() {
    const l = this.lookup;
    const session = this.status && this.status.session;
    if (l.phase === 'signedout') {
      return h('div', { class: 'lg-col lg-gap-3' },
        h('p', { class: 'lg-muted' }, 'Connect your LeadGennie workspace to add this person and see if you already know them.'),
        button({ label: 'Connect LeadGennie', variant: 'primary', iconName: 'PlugsConnected', iconWeight: 'fill', block: true, onClick: async (e) => {
          const b = e.currentTarget;
          b.disabled = true;
          const settings = (this.status && this.status.settings) || {};
          const res = await send(MSG.CONNECT, { apiBase: settings.apiBase || 'http://localhost:3000' });
          if (res.ok) { this.forUrl = null; this.show(); this.open = true; } else { b.disabled = false; }
        } }));
    }
    if (l.phase === 'error') return callout('error', l.error);
    if (l.phase === 'found') {
      if (!this.summary) this.summary = createLeadSummary({ lead: l.lead, apiBase: session.apiBase, session, headline: { tone: 'info', text: 'Already in LeadGennie' }, openUrl });
      return this.summary.el;
    }
    if (l.phase === 'missing') {
      if (!this.canCreate()) return h('p', { class: 'lg-muted' }, "This person isn't in LeadGennie yet, and your role in this workspace can't add leads.");
      if (!this.card) {
        this.card = createCaptureCard({
          session, apiBase: session.apiBase, openUrl, getFacts: async () => collectPageFacts(PAGE_TEXT_LIMIT),
          onConnect: () => { this.forUrl = null; this.show(); },
        });
      }
      return this.card.el;
    }
    return h('div', { class: 'lg-row lg-gap-2 lg-muted' }, spinner('sm'), 'Checking LeadGennie…');
  }

  render() {
    if (!this.root || this.dismissed) return;
    const children = [];
    if (this.open) {
      children.push(h('div', { class: 'w-panel', role: 'dialog', 'aria-label': 'LeadGennie' },
        h('div', { class: 'w-head' }, logo(), h('span', { class: 'lg-strong lg-grow' }, 'LeadGennie'),
          h('button', { class: 'lg-icon-btn', type: 'button', title: 'Close', 'aria-label': 'Close', onclick: () => { this.open = false; this.render(); } }, icon('X', { weight: 'bold', size: 'sm' }))),
        h('div', { class: 'w-body' }, this.panelBody())));
    }
    children.push(this.pill());
    children.push(h('button', { class: 'w-close', type: 'button', title: 'Hide for this page', 'aria-label': 'Hide LeadGennie for this page', onclick: () => { this.dismissed = true; this.teardown(); mount(this.root); } }, icon('X', { weight: 'bold', size: 'sm' })));
    mount(this.root, ...children);
    if (this.open && this.lookup.phase === 'missing' && this.card && !this.card.started) {
      this.card.started = true;
      this.card.start();
    }
  }
}

export function start() {
  const widget = new Widget();
  // LinkedIn is a single-page app: moving between profiles doesn't reload the page, so watch the address.
  let last = null;
  const sync = () => {
    const key = isProfilePath() ? profileUrl() : null;
    if (key === last) return;
    last = key;
    if (key) widget.show();
    else widget.hide();
  };
  setInterval(sync, 1000);
  sync();
}
