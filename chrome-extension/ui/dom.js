import { ICONS } from './icons.js';

/**
 * Tiny DOM builder. Everything is created with createElement / createElementNS / textContent — never innerHTML, never
 * DOMParser, never an inline <style>. LinkedIn (like most large sites) enforces Trusted Types and a strict CSP, under
 * which string-to-markup APIs throw; plain DOM construction and CSSOM are exempt by spec, so this works everywhere the
 * on-page widget has to run, and it is also XSS-safe by construction (values are text, never markup).
 */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** h('button', { class: 'lg-btn', onclick }, 'Save', h('span', {}, '…')) */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style') applyStyle(el, v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

/**
 * Styles go through CSSOM (el.style.setProperty), never setAttribute('style', …): a page with a strict CSP can block inline
 * style ATTRIBUTES, but CSSOM changes are exempt — the same reason the whole widget is built without markup strings.
 */
export function applyStyle(el, style) {
  if (typeof style === 'string') {
    for (const decl of style.split(';')) {
      const i = decl.indexOf(':');
      if (i > 0) el.style.setProperty(decl.slice(0, i).trim(), decl.slice(i + 1).trim());
    }
  } else Object.assign(el.style, style);
}

export function append(parent, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    parent.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return parent;
}

/** Replace all children (a safe `innerHTML = ''` + append). */
export function mount(parent, ...children) {
  parent.replaceChildren();
  return append(parent, children);
}

/** A Phosphor icon as an inline <svg> that inherits currentColor. weight: 'duotone' | 'bold' | 'fill'. */
export function icon(name, { weight = 'duotone', size, className = '' } = {}) {
  const shapes = ICONS[name] && ICONS[name][weight];
  if (!shapes) throw new Error(`Unknown icon "${name}" (${weight})`);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 256 256');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `lg-icon ${size === 'sm' ? 'lg-icon-sm' : size === 'lg' ? 'lg-icon-lg' : ''} ${className}`.trim());
  for (const [tag, attrs] of shapes) {
    const shape = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) shape.setAttribute(k, v);
    svg.append(shape);
  }
  return svg;
}

export function spinner(size) {
  return icon('CircleNotch', { weight: 'bold', size, className: 'lg-spin' });
}

/** The dashboard's brand mark: the sparkle on a dark tile. */
export function logo() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', 'M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z');
  svg.append(p);
  return h('span', { class: 'lg-logo' }, svg);
}

export function button({ label, variant = 'secondary', size, block, iconName, iconWeight = 'bold', onClick, disabled, busy, title, type = 'button' }) {
  const cls = ['lg-btn', `lg-btn-${variant}`, size ? `lg-btn-${size}` : '', block ? 'lg-btn-block' : ''].filter(Boolean).join(' ');
  return h('button', { class: cls, type, onclick: onClick, disabled: disabled || busy, title, 'aria-busy': busy ? 'true' : undefined },
    busy ? spinner('sm') : iconName ? icon(iconName, { weight: iconWeight, size: 'sm' }) : null, label);
}

export function badge(text, tone = 'neutral', { dot = false } = {}) {
  return h('span', { class: `lg-badge ${tone !== 'neutral' ? `lg-badge-${tone}` : ''} ${dot ? 'lg-badge-dot' : ''}`.trim() }, text);
}

export function callout(tone, ...children) {
  const name = { error: 'WarningCircle', warning: 'WarningCircle', success: 'CheckCircle', info: 'Info' }[tone] || 'Info';
  return h('div', { class: `lg-callout lg-callout-${tone}`, role: tone === 'error' ? 'alert' : undefined }, icon(name, { weight: 'fill', size: 'sm' }), h('div', { class: 'lg-grow' }, children));
}

const AVATAR_TONES = ['', 'sky', 'emerald', 'amber', 'rose', 'violet'];
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
export function avatar(name) {
  let hash = 0;
  for (const ch of String(name || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length];
  return h('span', { class: `lg-avatar ${tone ? `lg-avatar-${tone}` : ''}`.trim() }, initials(name));
}

/** Dashboard stage → badge tone (mirrors components/leads: new/outreached/engaged…). */
export function stageBadge(stage) {
  const tone = { new: 'neutral', outreached: 'sky', engaged: 'emerald', replied: 'emerald', interested: 'violet', meeting: 'violet', won: 'emerald', lost: 'rose', unsubscribed: 'rose', bounced: 'rose' }[stage] || 'neutral';
  return badge(stage, tone, { dot: true });
}

export function emailStatusBadge(status) {
  const map = { valid: ['Valid', 'emerald'], risky: ['Risky', 'amber'], invalid: ['Invalid', 'rose'], unverified: ['Unverified', 'neutral'] };
  const [label, tone] = map[status] || map.unverified;
  return badge(label, tone);
}
