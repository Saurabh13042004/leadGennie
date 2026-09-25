import { leadSubtitle, leadUrl } from '../lib/capture-model.js';
import { collectPageFacts } from '../lib/page-facts.js';
import { PAGE_TEXT_LIMIT } from '../lib/config.js';
import { MSG, send } from '../lib/messages.js';
import { requestOriginAccess } from '../lib/permissions.js';
import { avatar, button, callout, h, icon, logo, mount, spinner, stageBadge } from './dom.js';
import { createCaptureCard } from './capture-card.js';

const app = document.getElementById('app');
const openUrl = (url) => chrome.tabs.create({ url });

let session = null;
let settings = null;
let tab = 'capture';
let card = null;
let leadsCache = { at: 0, q: '', data: null };

/** Reads the page in the active tab through the activeTab grant the popup was opened with. */
async function getActiveTab() {
  // Automation seam: when the popup is opened as an ordinary tab (it can't be "the popup" then), ?tab=<id> names the page
  // to capture. A real toolbar popup never has this parameter.
  const forced = Number(new URLSearchParams(location.search).get('tab'));
  if (Number.isInteger(forced) && forced > 0) {
    try {
      return await chrome.tabs.get(forced);
    } catch {
      /* fall through to the real active tab */
    }
  }
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t || null;
}
const isCapturable = (t) => !!(t && t.id && /^https?:\/\//i.test(t.url || ''));
const isLinkedinProfile = (u) => /^https?:\/\/([\w-]+\.)?linkedin\.com\/in\/[^/]+/i.test(u || '');

async function readTabFacts(t) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId: t.id }, func: collectPageFacts, args: [PAGE_TEXT_LIMIT] });
  if (!res || !res.result) throw new Error('No page data');
  return res.result;
}

// ---- Signed-out ---------------------------------------------------------------------------------------------------
function signedOutView(reason, error) {
  let busy = false;
  const btn = button({ label: 'Connect LeadGennie', variant: 'primary', size: 'md', iconName: 'PlugsConnected', iconWeight: 'fill', block: true, onClick: connectNow });
  const errBox = h('div', {});

  async function connectNow() {
    if (busy) return;
    busy = true;
    // Permission for a custom server must be requested in THIS click handler (user gesture), before anything async.
    const base = (settings && settings.apiBase) || 'http://localhost:3000';
    let granted = true;
    try {
      granted = await requestOriginAccess(base);
    } catch {
      granted = false;
    }
    if (!granted) {
      busy = false;
      return mount(errBox, callout('error', 'LeadGennie needs permission to talk to that server. Allow it and try again.'));
    }
    mount(btn, spinner('sm'), 'Waiting for you to approve…');
    btn.disabled = true;
    const res = await send(MSG.CONNECT, { apiBase: base });
    busy = false;
    if (res.ok) return init();
    btn.disabled = false;
    mount(btn, icon('PlugsConnected', { weight: 'fill', size: 'sm' }), 'Connect LeadGennie');
    if (res.error.code !== 'ACCESS_DENIED') mount(errBox, callout('error', res.error.message));
  }

  return h('div', { class: 'pp-empty' },
    h('div', { class: 'pp-tile' }, icon('PlugsConnected', { weight: 'duotone' })),
    h('p', { class: 'pp-title' }, 'Connect your workspace'),
    h('p', { class: 'lg-muted', style: 'max-width:280px;margin-bottom:10px' }, 'Capture prospects from any page into LeadGennie. You approve the connection in your account — no tokens to copy.'),
    reason === 'expired' ? h('div', { style: 'width:100%;margin-bottom:8px' }, callout('info', 'Your connection expired or was disconnected. Connect again to continue.')) : null,
    error ? h('div', { style: 'width:100%;margin-bottom:8px' }, callout('error', error)) : null,
    h('div', { style: 'width:100%' }, btn), errBox,
    h('p', { class: 'lg-tiny lg-faint', style: 'margin-top:10px' }, `Server: ${(settings && settings.apiBase) || ''} · `, h('button', { class: 'pp-link', onclick: () => chrome.runtime.openOptionsPage() }, 'change')),
  );
}

// ---- Capture tab --------------------------------------------------------------------------------------------------
async function captureView() {
  const t = await getActiveTab();
  const box = h('div', { class: 'pp-pad lg-col lg-gap-3' });

  if (!isCapturable(t)) {
    return mount(box, h('div', { class: 'pp-empty', style: 'padding:14px 8px' },
      h('div', { class: 'pp-tile' }, icon('UserPlus', { weight: 'duotone' })),
      h('p', { class: 'pp-title' }, 'Open a prospect’s page'),
      h('p', { class: 'lg-muted', style: 'max-width:260px' }, 'Go to a LinkedIn profile or a company’s team page, then open LeadGennie again to add them as a lead.')));
  }

  const host = (() => { try { return new URL(t.url).hostname.replace(/^www\./, ''); } catch { return t.url; } })();
  const startCard = () => {
    if (card) card.destroy();
    card = createCaptureCard({
      session, apiBase: session.apiBase, openUrl,
      getFacts: () => readTabFacts(t),
      onConnect: () => { session = null; init(); },
    });
    mount(box, card.el);
    card.start();
  };

  if (isLinkedinProfile(t.url)) {
    startCard(); // a LinkedIn profile: opening the popup here is clear intent
  } else {
    mount(box,
      h('div', { class: 'lg-panel lg-row lg-gap-2' }, icon('Globe', { weight: 'duotone', className: 'lg-faint' }), h('div', { class: 'lg-grow' },
        h('p', { class: 'lg-strong lg-truncate' }, t.title || host), h('p', { class: 'lg-small lg-muted lg-truncate' }, host))),
      button({ label: 'Read this page', variant: 'primary', iconName: 'MagicWand', iconWeight: 'fill', block: true, onClick: startCard }),
      h('p', { class: 'lg-help', style: 'margin-top:-4px' }, 'Tip: select a person’s name or email on the page first — it takes priority over everything else.'));
  }
  return box;
}

// ---- Leads tab ----------------------------------------------------------------------------------------------------
function leadsView() {
  const list = h('div', {});
  const input = h('input', { class: 'lg-input', type: 'search', placeholder: 'Search your leads', 'aria-label': 'Search leads', value: leadsCache.q });
  let timer = null;

  function row(lead) {
    return h('button', { class: 'lg-lead', type: 'button', onclick: () => openUrl(leadUrl(session.apiBase, lead.id)) },
      avatar(lead.fullName),
      h('div', { class: 'lg-grow' }, h('p', { class: 'lg-strong lg-truncate' }, lead.fullName), h('p', { class: 'lg-small lg-muted lg-truncate' }, leadSubtitle(lead) || lead.email || 'No details yet')),
      stageBadge(lead.stage));
  }

  async function load(q) {
    mount(list, h('div', { class: 'pp-pad lg-col lg-gap-2' }, ...[1, 2, 3, 4].map(() => h('div', { class: 'lg-skeleton', style: 'height:38px' }))));
    const res = await send(MSG.LIST, { q, limit: 15 });
    if (!res.ok) {
      const unauth = res.error.code === 'UNAUTHENTICATED';
      return mount(list, h('div', { class: 'pp-pad lg-col lg-gap-2' }, callout('error', res.error.message),
        unauth ? button({ label: 'Connect LeadGennie', variant: 'primary', block: true, onClick: () => { session = null; init(); } }) : button({ label: 'Try again', variant: 'secondary', iconName: 'ArrowClockwise', block: true, onClick: () => load(q) })));
    }
    leadsCache = { at: Date.now(), q, data: res.data };
    const { leads, total } = res.data;
    if (leads.length === 0) {
      return mount(list, h('div', { class: 'pp-empty' }, h('div', { class: 'pp-tile' }, icon('UsersThree', { weight: 'duotone' })),
        h('p', { class: 'pp-title' }, q ? 'No matches' : 'No leads yet'), h('p', { class: 'lg-muted' }, q ? 'Try a different name, email or company.' : 'Leads you add from any page will show up here — and in your dashboard.')));
    }
    mount(list, ...leads.map(row), h('div', { class: 'pp-pad lg-row lg-between', style: 'border-top:1px solid var(--n-100)' },
      h('span', { class: 'lg-small lg-muted lg-tabnum' }, `${leads.length} of ${total.toLocaleString()}`),
      button({ label: 'Open all leads', variant: 'ghost', size: 'xs', iconName: 'ArrowSquareOut', onClick: () => openUrl(`${session.apiBase}/dashboard/leads`) })));
  }

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => load(input.value.trim()), 250); });
  load(input.value.trim());
  return h('div', {}, h('div', { class: 'pp-search' }, icon('MagnifyingGlass', { weight: 'bold', size: 'sm' }), input), list);
}

// ---- Shell --------------------------------------------------------------------------------------------------------
function header() {
  const ws = session.workspace && session.workspace.name;
  const role = session.user && session.user.role;
  return h('header', { class: 'pp-header' },
    logo(),
    h('div', { class: 'lg-grow' }, h('p', { class: 'lg-strong lg-truncate' }, ws || 'LeadGennie'), role ? h('p', { class: 'lg-tiny lg-faint' }, role[0].toUpperCase() + role.slice(1)) : null),
    h('button', { class: 'lg-icon-btn', title: 'Open dashboard', 'aria-label': 'Open dashboard', onclick: () => openUrl(`${session.apiBase}/dashboard`) }, icon('ArrowSquareOut', { weight: 'bold', size: 'sm' })));
}

function footer() {
  const who = session.user ? session.user.email : 'Legacy workspace token';
  return h('footer', { class: 'pp-footer' },
    h('span', { class: 'lg-tiny lg-muted lg-grow lg-truncate', title: who }, who),
    h('button', { class: 'pp-link', onclick: disconnectNow }, 'Disconnect'),
    h('button', { class: 'lg-icon-btn', title: 'Settings', 'aria-label': 'Settings', onclick: () => chrome.runtime.openOptionsPage() }, icon('GearSix', { weight: 'bold', size: 'sm' })));
}

async function disconnectNow() {
  if (!confirm('Disconnect this browser from LeadGennie?')) return;
  await send(MSG.DISCONNECT);
  session = null;
  init();
}

async function renderMain() {
  const body = h('div', { class: 'pp-body' });
  const tabs = h('div', { class: 'lg-tabs', role: 'tablist' },
    ...[['capture', 'Capture'], ['leads', 'Leads']].map(([id, label]) =>
      h('button', { class: 'lg-tab', role: 'tab', 'aria-selected': String(tab === id), onclick: () => { tab = id; renderMain(); } }, label)));
  mount(app, header(), tabs, body, footer());
  if (card) { card.destroy(); card = null; }
  if (tab === 'capture') mount(body, await captureView());
  else mount(body, leadsView());
}

async function init() {
  const status = await send(MSG.STATUS);
  if (!status.ok || !status.data.connected) {
    session = null;
    settings = status.ok ? status.data.settings : null;
    return mount(app, h('div', { class: 'pp-body' }, signedOutView(status.ok ? status.data.reason : null, status.ok ? null : status.error.message)));
  }
  session = status.data.session;
  settings = status.data.settings;
  await renderMain();
  // Roles and server features can change while a session lives: re-read them, and re-render only if something did.
  const fresh = await send(MSG.REFRESH);
  if (fresh.ok && JSON.stringify(fresh.data.scopes) !== JSON.stringify(session.scopes)) {
    session = fresh.data;
    renderMain();
  } else if (!fresh.ok && fresh.error.code === 'UNAUTHENTICATED') {
    init();
  }
}

window.addEventListener('unload', () => card && card.destroy());
init();
