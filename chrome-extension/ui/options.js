import { normalizeApiBase } from '../lib/auth.js';
import { MSG, send } from '../lib/messages.js';
import { requestOriginAccess } from '../lib/permissions.js';
import { SCOPE_LABEL } from '../lib/scope-labels.js';
import { badge, button, callout, h, logo, mount, spinner } from './dom.js';

const app = document.getElementById('app');
let state = { session: null, settings: null, logs: [], note: null, busy: null };

const section = (title, description, ...body) =>
  h('section', { class: 'lg-card op-section' }, h('header', {}, h('h2', {}, title), description ? h('p', {}, description) : null), ...body);

async function refresh() {
  const [status, logs] = await Promise.all([send(MSG.STATUS), send(MSG.GET_LOGS)]);
  state.session = status.ok && status.data.connected ? status.data.session : null;
  state.settings = status.ok ? status.data.settings : { apiBase: 'http://localhost:3000' };
  state.logs = logs.ok ? logs.data.logs : [];
  render();
}

function connectionSection() {
  const s = state.session;
  const note = state.note;
  const serverInput = h('input', { class: 'lg-input', id: 'server', value: state.settings.apiBase, spellcheck: 'false', 'aria-label': 'LeadGennie address' });

  async function saveServer() {
    try {
      const base = normalizeApiBase(serverInput.value);
      if (!(await requestOriginAccess(base))) throw new Error('Permission to reach that server was not granted.');
      await send(MSG.SAVE_SETTINGS, { apiBase: base });
      state.settings = { ...state.settings, apiBase: base };
      state.note = { tone: 'success', text: `Saved. Connect to ${base} to use it.` };
    } catch (e) {
      state.note = { tone: 'error', text: e.message };
    }
    render();
  }

  async function connectNow() {
    state.busy = 'connect';
    state.note = null;
    render();
    let base;
    try {
      base = normalizeApiBase(serverInput.value);
      if (!(await requestOriginAccess(base))) throw new Error('Permission to reach that server was not granted.');
    } catch (e) {
      state.busy = null;
      state.note = { tone: 'error', text: e.message };
      return render();
    }
    const res = await send(MSG.CONNECT, { apiBase: base });
    state.busy = null;
    state.note = res.ok ? { tone: 'success', text: 'Connected.' } : res.error.code === 'ACCESS_DENIED' ? null : { tone: 'error', text: res.error.message };
    await refresh();
  }

  async function testConnection() {
    state.busy = 'test';
    render();
    const res = await send(MSG.REFRESH);
    state.busy = null;
    state.note = res.ok ? { tone: 'success', text: `Connection is working — signed in to ${res.data.workspace && res.data.workspace.name ? res.data.workspace.name : 'your workspace'}.` } : { tone: 'error', text: res.error.message };
    await refresh();
  }

  async function disconnectNow() {
    if (!confirm('Disconnect this browser from LeadGennie?')) return;
    await send(MSG.DISCONNECT);
    state.note = { tone: 'info', text: 'Disconnected.' };
    await refresh();
  }

  const noteEl = note ? callout(note.tone, note.text) : null;

  if (!s) {
    return section('Connection', 'Connect this browser to your LeadGennie workspace.',
      h('div', { class: 'op-body' },
        h('div', {}, h('div', { class: 'lg-label-row' }, h('label', { class: 'lg-label', for: 'server' }, 'LeadGennie address')), serverInput,
          h('p', { class: 'lg-help' }, 'Use your LeadGennie web address (for local development: http://localhost:3000).')),
        noteEl,
        h('div', { class: 'lg-row lg-gap-2' },
          button({ label: 'Connect LeadGennie', variant: 'primary', iconName: 'PlugsConnected', iconWeight: 'fill', onClick: connectNow, busy: state.busy === 'connect' }),
          button({ label: 'Save address', variant: 'secondary', onClick: saveServer }))));
  }

  const scopes = (s.scopes || []).map((sc) => SCOPE_LABEL[sc] || sc);
  return section('Connection', 'This browser is connected to your workspace.',
    h('div', { class: 'op-body' },
      h('dl', { class: 'op-kv' },
        h('dt', {}, 'Workspace'), h('dd', {}, s.workspace ? s.workspace.name : h('span', { class: 'lg-muted' }, 'Shared workspace token')),
        h('dt', {}, 'Signed in as'), h('dd', {}, s.user ? `${s.user.name || ''} · ${s.user.email || ''}`.replace(/^ · /, '') : h('span', { class: 'lg-muted' }, 'Not tied to a person (older token)')),
        h('dt', {}, 'Role'), h('dd', {}, s.user && s.user.role ? badge(s.user.role, 'indigo') : '—'),
        h('dt', {}, 'Server'), h('dd', { class: 'lg-mono lg-small' }, s.apiBase),
        h('dt', {}, 'This browser'), h('dd', {}, s.deviceLabel || '—'),
        h('dt', {}, 'Can'), h('dd', {}, h('div', { class: 'lg-row lg-gap-1 lg-wrap' }, ...scopes.map((t) => badge(t))))),
      s.kind === 'legacy' ? callout('warning', 'This browser uses an older shared workspace token. Reconnect to use your own account — it is safer and can be revoked from the dashboard.') : null,
      noteEl,
      h('div', { class: 'lg-row lg-gap-2 lg-wrap' },
        button({ label: 'Test connection', variant: 'secondary', iconName: 'ArrowClockwise', onClick: testConnection, busy: state.busy === 'test' }),
        button({ label: s.kind === 'legacy' ? 'Reconnect with my account' : 'Reconnect', variant: s.kind === 'legacy' ? 'primary' : 'secondary', iconName: 'PlugsConnected', onClick: connectNow, busy: state.busy === 'connect' }),
        button({ label: 'Disconnect', variant: 'danger', iconName: 'LinkBreak', onClick: disconnectNow }))));
}

function activitySection() {
  const logs = state.logs.slice().reverse();
  return section('Activity', 'What the extension has done for you. Nothing from the pages you visit is stored here.',
    logs.length === 0
      ? h('div', { class: 'op-body lg-muted' }, 'No activity yet.')
      : h('ul', { class: 'op-log' }, ...logs.map((l) => h('li', {}, h('time', {}, new Date(l.ts).toLocaleTimeString()), h('span', { class: l.level === 'error' ? 'err' : l.level === 'success' ? 'ok' : '' }, l.message)))),
    h('div', { class: 'op-body lg-row lg-gap-2', style: 'border-top:1px solid var(--n-100)' },
      button({ label: 'Refresh', variant: 'secondary', size: 'xs', onClick: refresh }),
      button({ label: 'Clear', variant: 'ghost', size: 'xs', onClick: async () => { await send(MSG.CLEAR_LOGS); refresh(); } })));
}

function automationSection() {
  const s = state.session;
  if (!s || !s.features || !s.features.linkedinAutomation) return null; // hidden entirely while the server has it off (D-05)
  const granted = (s.scopes || []).includes('automation');
  async function enable() {
    const ok = await chrome.permissions.request({ permissions: ['debugger', 'alarms'] });
    state.note = ok ? { tone: 'success', text: 'Automation permissions granted.' } : { tone: 'error', text: 'Permission was not granted.' };
    render();
  }
  return section('LinkedIn automation (advanced)', 'Sends the LinkedIn messages your campaigns queue, from your own browser.',
    h('div', { class: 'op-body' },
      callout('warning', 'Automating LinkedIn can get your account restricted. It is off by default and only available because your workspace administrator turned it on.'),
      granted ? null : callout('info', 'Reconnect the extension so this connection is allowed to use automation.'),
      h('div', {}, button({ label: 'Grant automation permissions', variant: 'secondary', onClick: enable, disabled: !granted }))));
}

function render() {
  const about = section('About', null, h('div', { class: 'op-body' },
    h('dl', { class: 'op-kv' }, h('dt', {}, 'Version'), h('dd', {}, chrome.runtime.getManifest().version), h('dt', {}, 'Extension ID'), h('dd', { class: 'lg-mono lg-small' }, chrome.runtime.id)),
    h('p', { class: 'lg-help' }, 'Manage every connected browser from Settings → Browser extension in your LeadGennie dashboard.')));
  mount(app, h('div', { class: 'op-wrap' },
    h('div', { class: 'op-head' }, logo(), h('h1', { class: 'op-title' }, 'LeadGennie extension')),
    connectionSection(), activitySection(), automationSection(), about));
}

mount(app, h('div', { class: 'op-wrap lg-row lg-muted' }, spinner()));
refresh();
