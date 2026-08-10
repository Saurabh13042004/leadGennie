// content.js
console.log("LeadGennie Agent: Content Script Initialized");

const LINKEDIN_DEBUG = true;
function logLinkedInDebug(stage, details = {}) {
  if (!LINKEDIN_DEBUG) return;
  const payload = typeof details === 'object' ? details : { detail: details };
  console.log(`[LeadGennie:LinkedIn:${stage}]`, payload);
  // Also route to background.js's activity log — that's the console the
  // popup/service-worker log is actually watched from; without this, these
  // stages were only ever visible in the automated LinkedIn tab's own
  // DevTools console, which nobody was opening.
  chrome.runtime.sendMessage({
    type: 'LOG_EVENT',
    message: `[LinkedIn:${stage}] ${JSON.stringify(payload)}`,
    level: 'debug',
  }).catch(() => {});
}

// --- Helper Functions: Action Simulation ---
async function simulateTyping(element, text) {
  element.focus();
  for (let i = 0; i < text.length; i++) {
    element.value += text[i];
    element.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, Math.random() * 50 + 50)); // 50-100ms human delay
  }
}

async function simulateClick(element) {
  if (!element) return false;
  element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  await new Promise(r => setTimeout(r, Math.random() * 200 + 100)); // 100-300ms reaction
  element.click();
  return true;
}

const ACTION_BANNER_ID = 'leadgennie-action-banner';

// Uses the `el()` DOM-builder (defined below, hoisted) and plain property
// assignment rather than innerHTML/injected <style> — LinkedIn enforces
// Trusted Types + a strict CSP, which silently blocks both (see the
// "Injected Widget" section further down for the same constraint).
function showLinkedInBanner(text) {
  removeLinkedInBanner();
  const banner = el('div', {
    position: 'fixed', top: '0', left: '0', right: '0', zIndex: '2147483647',
    background: '#0a66c2', color: '#fff', padding: '14px 20px',
    fontSize: '15px', fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: '600', textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
  }, { id: ACTION_BANNER_ID, innerText: text });
  document.body.appendChild(banner);
}

function removeLinkedInBanner() {
  document.getElementById(ACTION_BANNER_ID)?.remove();
}

// element.click() dispatches a synthetic event with isTrusted: false, which
// page JS can check for and simply not act on — confirmed live: LinkedIn's
// message-compose overlay never opened for a script click even on the
// correct element (URL never changed, no compose box mounted), for both a
// wrong link and a since-verified-correct one, which is what pointed at the
// click mechanism itself rather than element selection. Routes through
// background.js's chrome.debugger-based Input.dispatchMouseEvent instead,
// which is indistinguishable from a real user click because it's generated
// at the browser/OS input level, not by page script.
async function simulateTrustedClick(element) {
  if (!element) return false;
  element.scrollIntoView({ block: 'center', inline: 'center' });
  await randomDelay(300, 600);

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    logLinkedInDebug('simulateTrustedClick:zeroSize', { tag: element.tagName });
    return false;
  }

  // Coordinates measured here go stale the instant chrome.debugger attaches
  // in background.js — attaching shows Chrome's "being debugged" infobar,
  // which resizes the viewport and reflows the page, shifting everything
  // below it. Confirmed live: a click hit-tested correctly against the exact
  // right element *before* attach still failed to open anything. Fix: tag
  // the element and have background.js re-locate + re-measure it via CDP
  // Runtime.evaluate *after* attach (banner already showing), so the click
  // coordinates reflect the post-attach layout, not the pre-attach one.
  const marker = `lg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  element.setAttribute('data-lg-click-target', marker);
  const selector = `[data-lg-click-target="${marker}"]`;

  // Diagnostic: isTrusted is true for both real hardware clicks and CDP-
  // dispatched ones, but event.sourceCapabilities is only populated for
  // genuine hardware input — null for CDP/synthetic dispatch. If LinkedIn
  // (or an anti-bot layer in front of it) keys off that distinction, it
  // would explain a click that's fully correct by every other measure
  // (right element, right coordinates, isTrusted) still doing nothing.
  // Capturing across the whole down/up/click sequence, not just 'click',
  // in case the pipeline stops earlier than that.
  const capturedEvents = [];
  const captureTypes = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
  const captureHandler = (e) => {
    capturedEvents.push({
      type: e.type,
      isTrusted: e.isTrusted,
      sourceCapabilities: e.sourceCapabilities
        ? { firesTouchEvents: e.sourceCapabilities.firesTouchEvents }
        : null,
    });
  };
  captureTypes.forEach((type) => document.addEventListener(type, captureHandler, true));

  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'TRUSTED_CLICK', selector }, resolve);
  });
  element.removeAttribute('data-lg-click-target');

  await randomDelay(300, 400); // let any resulting events finish bubbling/capturing
  captureTypes.forEach((type) => document.removeEventListener(type, captureHandler, true));
  logLinkedInDebug('simulateTrustedClick:eventCapture', { events: capturedEvents });

  if (chrome.runtime.lastError || !response || !response.success) {
    logLinkedInDebug('simulateTrustedClick:failed', {
      error: response?.error || chrome.runtime.lastError?.message,
      tag: element.tagName,
    });
    return false;
  }
  logLinkedInDebug('simulateTrustedClick:succeeded', {
    tag: element.tagName,
    point: response.point,
    hitMatches: response.point?.hitMatches,
  });
  return true;
}

function randomDelay(minMs, maxMs) {
  return new Promise((resolve) => setTimeout(resolve, minMs + Math.random() * (maxMs - minMs)));
}

// Same problem as simulateTrustedClick, one layer over: dispatching manual
// DOM text nodes + synthetic beforeinput/input events (typeIntoMessageField,
// below) inserted characters into the DOM, but LinkedIn's editor never
// recognized it as real input — confirmed live: the placeholder ("Write a
// message…") stayed visible/active and Send never enabled, even though the
// characters were genuinely present in the DOM. Routes through
// chrome.debugger's CDP Input.insertText instead, the same mechanism Send
// button clicks use for trust, which types into whatever element the page
// currently has focused at the real input level rather than faking events.
async function simulateTrustedType(element, text) {
  if (!element) return false;
  element.focus();
  await randomDelay(300, 600);

  // Confirmed live: a raw newline passed through CDP Input.insertText into
  // this editor is silently dropped — no line break, no space, the words on
  // either side just run together. A real Enter keypress is how chat
  // editors normally insert a line break, but most chat UIs (LinkedIn
  // included) also treat Enter as "send" — not worth risking a premature
  // send mid-message for cosmetic formatting, so newlines become spaces.
  const flatText = text.replace(/\r?\n+/g, ' ');

  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'TRUSTED_TYPE', text: flatText }, resolve);
  });

  if (chrome.runtime.lastError || !response || !response.success) {
    logLinkedInDebug('simulateTrustedType:failed', {
      error: response?.error || chrome.runtime.lastError?.message,
    });
    return false;
  }

  // Normalize whitespace (nbsp, collapsed spaces) on both sides before
  // comparing — the DOM text and our source text won't match byte-for-byte
  // even on a fully successful type.
  const finalText = (element.innerText || element.value || '').replace(/\s+/g, ' ').trim();
  const expectedPreview = flatText.replace(/\s+/g, ' ').trim().slice(0, Math.min(12, flatText.length));
  const landed = finalText.length > 0 && finalText.includes(expectedPreview);
  logLinkedInDebug('simulateTrustedType:result', { landed, finalTextPreview: finalText.slice(0, 80) });
  return landed;
}

// `document.execCommand('insertText', ...)` is deprecated and unreliable
// against framework-controlled contenteditable widgets (LinkedIn's message
// box is an Ember component, confirmed from real pasted markup — it starts
// as an empty `<p><br></p>`, a typical rich-editor placeholder that
// execCommand doesn't always handle). Its return value can also be `true`
// while nothing actually landed. Select-and-clear first, try execCommand,
// then verify the DOM really changed and fall back to a direct write + a
// real InputEvent (so any framework input listener still fires) if not.
// Returns whether text actually ended up in the box — never assume success.
async function typeIntoMessageField(el, text) {
  if (!el) return false;

  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    el.focus();
    await randomDelay(800, 1600);
    el.value = '';
    for (const ch of text) {
      el.value += ch;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: ch }));
      await randomDelay(70, 150);
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return el.value === text;
  }

  el.focus();
  await randomDelay(900, 2000);
  el.textContent = '';

  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.addRange(range);
  }

  let composed = '';
  for (const ch of text) {
    composed += ch;
    const textNode = document.createTextNode(ch);
    el.appendChild(textNode);

    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: ch }));
    el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: ch }));
    el.dispatchEvent(new Event('keyup', { bubbles: true }));
    await randomDelay(80, 170);
  }

  const finalText = (el.textContent || '').replace(/\u00A0/g, ' ').trim();
  return finalText.length > 0 && finalText.includes(text.trim().slice(0, Math.min(12, text.length)));
}

// LinkedIn's action buttons can still be hydrating when the tab first opens,
// and the page is a SPA so a single querySelector right after tab-create is
// a race. Poll briefly instead of assuming the DOM is ready.
async function waitForElement(finder, timeoutMs = 8000, intervalMs = 400) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = finder();
    if (el) {
      logLinkedInDebug('waitForElement:found', { timeoutMs, elapsedMs: Date.now() - start, tag: el?.tagName || 'unknown' });
      return el;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  logLinkedInDebug('waitForElement:timeout', { timeoutMs, intervalMs });
  return null;
}

// LinkedIn renders the "Message" action inconsistently — sometimes a real
// <button aria-label="Message ..."> , sometimes an <a href="/messaging/
// compose/...?interop=msgOverlay"><span>Message</span></a>. Confirmed live:
// a profile can carry *two* separate "Message" triggers at once — the real
// header button, and a second one inside a "Highlights" card (e.g. shared
// education), which persistently links to the Premium/InMail suggested-
// icebreaker compose flow (`aria-label="Message with Premium"`,
// `href` carrying prefilled `body=`/`subject=` params) even once the person
// is a genuine 1st-degree connection. `document.querySelector` just returns
// whichever matches first in DOM order — repeatedly the wrong one here — so
// every tier below actively skips Premium/prefilled candidates first and
// only falls back to them if nothing plain exists at all.
function isPremiumOrPrefilledMessageLink(el) {
  const label = (el.getAttribute('aria-label') || '').toLowerCase();
  const href = el.getAttribute('href') || '';
  return label.includes('premium') || href.includes('body=') || href.includes('subject=');
}

// The profile page routinely carries *other* "Message X" triggers besides
// the one for the actual profile we're on — "People also viewed"/"More
// profiles for you" sidebar cards each have their own. Confirmed live: this
// caused a real send attempt to grab `aria-label="Message Suhas Gujarathi"`
// on Satwik Dubey's profile — a completely different person's trigger,
// picked only because it came first in DOM order. Filtering out Premium
// links wasn't enough; the trigger has to be verified as actually naming
// the profile owner before it's safe to click.
// Last-resort fallback (see SEND_MESSAGE) when deterministic matching can't
// confidently find the right element — five rounds of selector-guessing
// couldn't locate the real "Message" trigger on a real profile at all (see
// leadgennie_linkedin_dm_debugging_chain memory). Rather than a sixth
// selector guess, hand Gemini a plain-text list of what the page actually
// rendered and let it decide, the same way a human would visually pick the
// right one. Tags each element with a data attribute so the chosen index
// can be looked back up directly, without re-deriving the same list twice.
const CANDIDATE_INDEX_ATTR = 'data-lg-candidate-index';
const MAX_CANDIDATES_FOR_AI = 60;

function extractClickableCandidates() {
  const elements = Array.from(document.querySelectorAll('button, a[href]'))
    .filter((el) => {
      if (el.offsetParent === null) return false; // hidden
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      // Confirmed live: a candidate with a href matching the right profile
      // (recipient param and all) still resolved to (1126, 27) on click —
      // inside LinkedIn's fixed global top nav band, not the profile card's
      // own Message button. offsetParent!==null doesn't rule out a
      // sticky/duplicate element sitting up there; no real profile-page
      // action button renders this high, so exclude the band outright.
      if (rect.top < 60) return false;
      return true;
    });

  const candidates = [];
  elements.forEach((el) => {
    const text = (el.innerText || '').trim().slice(0, 80);
    const ariaLabel = (el.getAttribute('aria-label') || '').trim().slice(0, 120);
    if (!text && !ariaLabel) return; // skip decorative/icon-only elements
    if (candidates.length >= MAX_CANDIDATES_FOR_AI) return;

    const index = candidates.length;
    el.setAttribute(CANDIDATE_INDEX_ATTR, String(index));
    candidates.push({
      index,
      tag: el.tagName.toLowerCase(),
      text,
      ariaLabel,
      href: (el.getAttribute('href') || '').slice(0, 200),
    });
  });
  return candidates;
}

function getElementByCandidateIndex(index) {
  return document.querySelector(`[${CANDIDATE_INDEX_ATTR}="${index}"]`);
}

async function pickElementViaAI(taskDescription) {
  const candidates = extractClickableCandidates();
  logLinkedInDebug('pickElementViaAI:start', { candidateCount: candidates.length, taskDescription });

  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'PICK_ELEMENT', candidates, taskDescription }, resolve);
  });

  if (chrome.runtime.lastError || !response || !response.success) {
    logLinkedInDebug('pickElementViaAI:failed', { error: response?.error || chrome.runtime.lastError?.message });
    return null;
  }

  const { index, reason } = response.data;
  logLinkedInDebug('pickElementViaAI:result', { index, reason });
  if (typeof index !== 'number') return null;

  const el = getElementByCandidateIndex(index);
  if (!el) logLinkedInDebug('pickElementViaAI:indexNotFound', { index });
  return el || null;
}

function getProfileOwnerName() {
  const h1 = document.querySelector('h1');
  if (h1?.innerText?.trim()) return h1.innerText.trim();
  return document.title.split('|')[0].split(' - ')[0].trim();
}

function nameMatches(el, ownerName) {
  if (!ownerName) return false;
  const label = (el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const normalizedOwner = ownerName.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!label || !normalizedOwner) return false;
  if (label.includes(normalizedOwner)) return true;
  const firstName = normalizedOwner.split(' ')[0];
  return firstName.length > 2 && label.includes(firstName);
}

function findMessageTrigger() {
  const ownerName = getProfileOwnerName();
  logLinkedInDebug('findMessageTrigger:ownerName', { ownerName });

  const byAriaLabel = Array.from(document.querySelectorAll('button[aria-label^="Message"], a[aria-label^="Message"]'));
  const plainAriaLabel = byAriaLabel.filter((el) => !isPremiumOrPrefilledMessageLink(el));

  const nameMatched = plainAriaLabel.find((el) => nameMatches(el, ownerName));
  if (nameMatched) {
    logLinkedInDebug('findMessageTrigger:nameMatched', {
      ownerName,
      ariaLabel: nameMatched.getAttribute('aria-label'),
      candidateCount: byAriaLabel.length,
    });
    return nameMatched;
  }

  const byHref = Array.from(document.querySelectorAll('a[href*="/messaging/compose"]'))
    .filter((el) => !isPremiumOrPrefilledMessageLink(el));
  const hrefNameMatched = byHref.find((el) => nameMatches(el, ownerName));
  if (hrefNameMatched) {
    logLinkedInDebug('findMessageTrigger:hrefNameMatched', { ownerName, href: hrefNameMatched.getAttribute('href') });
    return hrefNameMatched;
  }

  // Deliberately do NOT fall back to "just take the first one" here — that
  // is exactly what sent a message trigger meant for a stranger. If nothing
  // can be confirmed as belonging to this profile, return null and let the
  // caller refuse to proceed rather than risk messaging the wrong person.
  logLinkedInDebug('findMessageTrigger:noNameMatch', {
    ownerName,
    candidateLabels: byAriaLabel.map((el) => (el.getAttribute('aria-label') || '').trim()),
  });
  return null;
}

// The real Message control on a current profile page carries NO aria-label
// at all — confirmed from live markup:
//   <a aria-disabled="false" href="/messaging/compose/?profileUrn=...
//      &recipient=...&screenContext=NON_SELF_PROFILE_VIEW&interop=msgOverlay"
//      componentkey="..."><span>...<span>Message</span></span></a>
// That is exactly why every `aria-label^="Message"` tier above always missed
// it and fell through to the AI picker: the attribute it keys on doesn't
// exist. Match on the thing that *is* structurally guaranteed instead — an
// anchor whose href is a /messaging/compose/ link carrying a recipient.
//
// Ownership check, replacing the old name-matching: a profile page also
// carries compose links for *other* people (the "People also viewed" /
// "More profiles for you" cards), and those already caused a real send aimed
// at the wrong person. Rather than compare display names, walk up from each
// link to the nearest ancestor that contains any /in/ profile links at all —
// if that container points only at *other* people's slugs, the link belongs
// to their card and is rejected outright.
function profileSlugFromPath(pathname) {
  const match = (pathname || '').match(/^\/in\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]).toLowerCase() : null;
}

function belongsToProfileOwner(link, ownerSlug) {
  if (!ownerSlug) return false;

  let node = link.parentElement;
  for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
    const profileLinks = Array.from(node.querySelectorAll('a[href^="/in/"]'));
    if (profileLinks.length === 0) continue;

    const slugs = profileLinks
      .map((el) => {
        try {
          return profileSlugFromPath(new URL(el.getAttribute('href'), window.location.origin).pathname);
        } catch (e) {
          return null; // malformed href — ignore rather than break the search
        }
      })
      .filter(Boolean);
    if (slugs.length === 0) continue;

    // First container that mentions anyone decides: the owner's own action
    // row sits alongside links back to their own profile, a suggestion card
    // only ever links to the person it's advertising.
    return slugs.includes(ownerSlug);
  }

  // No /in/ links anywhere above it — that's the top-card action row on a
  // page that doesn't self-link, which only the profile owner's own controls
  // occupy. Suggestion cards always link to the person they advertise.
  return true;
}

function findProfileMessageLink() {
  const ownerSlug = profileSlugFromPath(window.location.pathname);
  const all = Array.from(document.querySelectorAll('a[href*="/messaging/compose"]'));

  const candidates = all
    .filter((el) => !isPremiumOrPrefilledMessageLink(el))
    .filter((el) => (el.getAttribute('href') || '').includes('recipient='))
    .filter((el) => belongsToProfileOwner(el, ownerSlug));

  if (candidates.length === 0) {
    logLinkedInDebug('findProfileMessageLink:noneFound', {
      ownerSlug,
      totalComposeLinks: all.length,
      hrefs: all.slice(0, 6).map((el) => (el.getAttribute('href') || '').slice(0, 120)),
    });
    return null;
  }

  // Prefer the one whose visible text is exactly "Message" (the top-card
  // action) over any other compose link that survived the checks.
  const exact = candidates.find((el) => (el.innerText || '').trim().toLowerCase() === 'message');
  const chosen = exact || candidates[0];

  logLinkedInDebug('findProfileMessageLink:found', {
    ownerSlug,
    candidateCount: candidates.length,
    usedExactText: Boolean(exact),
    href: (chosen.getAttribute('href') || '').slice(0, 160),
  });
  return chosen;
}

// Same reasoning as findMessageTrigger — a single hardcoded class
// (msg-form__contenteditable) is one guess at LinkedIn's current markup, not
// a guarantee. Widen to any visible contenteditable that looks like a
// message compose box before falling back to "whatever's visible."
//
// `[contenteditable="true"]` (exact string match) misses a real, common
// case: browsers/frameworks often serialize the attribute as
// `contenteditable=""` (empty string) rather than the literal text "true" —
// both mean "editable" per the HTML spec, but only one matches that exact
// CSS attribute selector. Confirmed this profile opens LinkedIn's
// conversation-bubble overlay (msg-overlay-conversation-bubble), not the
// full messaging page, so the compose box may not even be under the
// `msg-form__contenteditable` class this was originally written for.
function isEditable(el) {
  const val = el.getAttribute('contenteditable');
  return val === '' || val === 'true';
}

function isInsideMessagingContext(el) {
  if (!el) return false;
  const hints = [
    'msg-',
    'messaging',
    'conversation',
    'compose',
    'message-overlay',
    'msg-overlay',
    'chat',
    'send-message'
  ];

  const attributes = [
    el.getAttribute('aria-label') || '',
    el.getAttribute('aria-placeholder') || '',
    el.getAttribute('data-testid') || '',
    el.getAttribute('data-control-name') || '',
    el.className || '',
    el.id || ''
  ].join(' ').toLowerCase();

  return hints.some(h => attributes.includes(h)) || Boolean(el.closest('[class*="msg-"], [class*="messaging"], [class*="conversation"], [class*="chat"], [data-testid*="message"], [data-control-name*="message"]'));
}

function collectAllMatchingElements(root, selector, depth = 0) {
  const matches = [];
  // Depth cap is a defensive safety net, not the primary fix — the actual
  // bug was scanning `document.querySelectorAll('iframe')` (the *global*
  // document) on every recursive call instead of scoping to `root`. That
  // meant every recursive step rediscovered the same top-level iframe(s)
  // and recursed into them again with nothing ever changing between calls —
  // guaranteed "Maximum call stack size exceeded" on any page with even one
  // iframe (LinkedIn profile pages routinely have them: ads, embeds).
  if (!root || depth > 5) return matches;

  const push = (node) => {
    if (!node) return;
    if (typeof node.querySelectorAll === 'function') {
      matches.push(...Array.from(node.querySelectorAll(selector)));
    }
    if (node.shadowRoot) {
      matches.push(...collectAllMatchingElements(node.shadowRoot, selector, depth + 1));
    }
  };

  push(root);

  if (root instanceof HTMLIFrameElement && root.contentDocument) {
    matches.push(...collectAllMatchingElements(root.contentDocument, selector, depth + 1));
  }

  if (typeof root.querySelectorAll === 'function') {
    root.querySelectorAll('iframe').forEach((iframe) => {
      try {
        if (iframe.contentDocument) {
          matches.push(...collectAllMatchingElements(iframe.contentDocument, selector, depth + 1));
        }
      } catch (e) {
        // Cross-origin iframe — inaccessible from here, safely skip.
      }
    });
  }

  return matches;
}

// Exact markup confirmed live from the real compose overlay:
//   <div class="msg-form__contenteditable ..." contenteditable="true"
//        role="textbox" dir="auto" aria-multiline="true"
//        aria-label="Write a message…"><p><br></p></div>
// Tightest-first: an exact structural match is tried before any of the loose
// heuristics below, so a real compose box is never passed over in favour of
// some other editable on the page (the nav search box, a comment field, ...).
const COMPOSE_BOX_SELECTORS = [
  'div.msg-form__contenteditable[contenteditable="true"][role="textbox"][aria-multiline="true"]',
  'div.msg-form__contenteditable[contenteditable="true"][role="textbox"]',
  'div.msg-form__contenteditable[contenteditable="true"]',
  'form[class*="msg-form"] div[contenteditable="true"][role="textbox"]',
  'div[aria-label="Write a message…"][contenteditable="true"]',
  'div[aria-label^="Write a message"][contenteditable="true"]',
];

function findMessageComposeBox() {
  for (const selector of COMPOSE_BOX_SELECTORS) {
    const matches = collectAllMatchingElements(document, selector)
      .filter((el) => el && (el.offsetParent !== null || isInsideMessagingContext(el)));
    if (matches.length > 0) {
      logLinkedInDebug('findMessageComposeBox:exactMatch', {
        selector,
        matchCount: matches.length,
        ariaLabel: matches[0].getAttribute('aria-label'),
      });
      return matches[0];
    }
  }

  const exactLinkedIn = document.querySelector('.msg-form__contenteditable[role="textbox"], .msg-form__contenteditable[contenteditable="true"], .msg-form__contenteditable[contenteditable=""], .msg-form__contenteditable');
  if (exactLinkedIn && (exactLinkedIn.offsetParent !== null || isInsideMessagingContext(exactLinkedIn))) {
    logLinkedInDebug('findMessageComposeBox:exactLinkedIn', { className: exactLinkedIn.className, role: exactLinkedIn.getAttribute('role') });
    return exactLinkedIn;
  }

  const selectorCandidates = [
    'div.msg-form__contenteditable',
    'div[role="textbox"][aria-multiline="true"]',
    'div[role="textbox"]',
    'div[contenteditable="true"]',
    'div[contenteditable=""]',
    'div[contenteditable="plaintext-only"]',
    'textarea[name="message"]',
    'textarea[placeholder*="message" i]',
    'textarea[aria-label*="message" i]',
    'div[aria-label*="write a message" i]',
    'div[aria-label*="message" i]',
    'div[data-placeholder*="message" i]',
    'div[placeholder*="message" i]',
    'div[data-test-id*="message" i]'
  ];

  for (const selector of selectorCandidates) {
    const matches = collectAllMatchingElements(document, selector);
    const el = matches.find((candidate) => candidate && (candidate.offsetParent !== null || isInsideMessagingContext(candidate)));
    if (el) {
      logLinkedInDebug('findMessageComposeBox:selectorMatch', { selector, className: el.className, tagName: el.tagName });
      return el;
    }
  }

  const allEditable = collectAllMatchingElements(document, '[contenteditable], [role="textbox"], textarea')
    .filter((el) => {
      if (!el) return false;
      if (el.tagName === 'TEXTAREA') return true;
      if (el instanceof HTMLElement) {
        const editableValue = el.getAttribute('contenteditable');
        const role = el.getAttribute('role');
        return editableValue === '' || editableValue === 'true' || editableValue === 'plaintext-only' || role === 'textbox';
      }
      return false;
    })
    .filter((el) => el.offsetParent !== null || isInsideMessagingContext(el));

  if (allEditable.length > 0) {
    const first = allEditable[0];
    logLinkedInDebug('findMessageComposeBox:fallbackEditable', { tagName: first.tagName, className: first.className, role: first.getAttribute('role') });
    return first;
  }

  logLinkedInDebug('findMessageComposeBox:noneFound', { editableCount: collectAllMatchingElements(document, '[contenteditable], [role="textbox"], textarea').length });
  return null;
}

// Exact markup confirmed live:
//   <button class="msg-form__send-button artdeco-button artdeco-button--1"
//           disabled="" type="submit">Send</button>
// It ships *disabled* and LinkedIn only enables it once its own editor state
// registers real text — which makes "is it enabled yet" a far better proof
// that typing actually landed than reading textContent back ourselves.
function findSendButton({ mustBeEnabled = true } = {}) {
  const tightest = collectAllMatchingElements(document, 'button.msg-form__send-button[type="submit"]')
    .concat(collectAllMatchingElements(document, 'button.msg-form__send-button'));

  const usable = tightest.filter((el) => !mustBeEnabled || !el.disabled);
  if (usable.length > 0) {
    logLinkedInDebug('findSendButton:exactMatch', {
      disabled: usable[0].disabled,
      text: (usable[0].innerText || '').trim(),
    });
    return usable[0];
  }

  // Only reached if LinkedIn renamed the class — deliberately still requires
  // the button to live inside a msg form so we can't click "Send" on some
  // unrelated form elsewhere on the page.
  const scoped = Array.from(document.querySelectorAll('form[class*="msg-form"] button[type="submit"], div[class*="msg-form"] button[type="submit"]'))
    .filter((el) => (el.innerText || '').trim().toLowerCase() === 'send')
    .filter((el) => !mustBeEnabled || !el.disabled);
  if (scoped.length > 0) {
    logLinkedInDebug('findSendButton:scopedFallback', { text: (scoped[0].innerText || '').trim() });
    return scoped[0];
  }

  return null;
}

function detectBrokenLinkedInPage() {
  const hasInvalidChromeResource = Array.from(document.querySelectorAll('script, link, img')).some((el) => {
    const src = el.src || el.href || '';
    return src.startsWith('chrome-extension://invalid/') || src.startsWith('chrome-extension://invalid');
  });

  const hasLinkedInReactFailure = !!document.body?.innerText?.includes('Minified React error #418') ||
    Array.from(document.querySelectorAll('*')).some((el) => (el.textContent || '').includes('Minified React error #418'));

  const hasBlockedByClient = !!document.body?.innerText?.includes('ERR_BLOCKED_BY_CLIENT') ||
    Array.from(document.querySelectorAll('*')).some((el) => (el.textContent || '').includes('ERR_BLOCKED_BY_CLIENT'));

  return hasInvalidChromeResource || hasLinkedInReactFailure || hasBlockedByClient;
}

// --- Page Text Extraction (Scraping) ---
// Hand-picked selectors (.feed-shared-update-v2__description etc.) chased
// LinkedIn's markup and kept losing — a profile full of real posts about a
// YC application, a Product Hunt launch, and open-source PRs still came back
// "no public information available" because none of the guessed classes
// matched that profile's actual DOM. Grabbing the raw visible text instead
// and letting the AI (server-side, see lib/ai/linkedin-personalize.ts)
// figure out what's relevant is far more robust to LinkedIn's per-profile
// layout variance than another round of selector-guessing would be.
const MAX_PAGE_TEXT_CHARS = 8000;

function scrapePageText() {
  const main = document.querySelector('main') || document.body;
  return (main.innerText || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_PAGE_TEXT_CHARS);
}

// --- Connection Status Check ---
function checkConnectionStatus() {
  const title = document.title.toLowerCase();
  const profileUnavailable = Boolean(document.querySelector('.profile-unavailable'));
  const hasPageNotFound = title.includes("page not found") || title.includes("unavailable");
  logLinkedInDebug('checkConnectionStatus:start', { url: window.location.href, title, profileUnavailable, hasPageNotFound });

  if (hasPageNotFound || profileUnavailable) {
    logLinkedInDebug('checkConnectionStatus:profileNotFound', { url: window.location.href, title });
    return "Profile not found";
  }

  const buttons = Array.from(document.querySelectorAll('button'));
  const isConnected = buttons.some(b => b.innerText.toLowerCase().includes('message') && !b.innerText.toLowerCase().includes('connect'));
  const isPending = buttons.some(b => b.innerText.toLowerCase().includes('pending'));

  if (isConnected) {
    logLinkedInDebug('checkConnectionStatus:alreadyConnected', { buttonCount: buttons.length });
    return "Already Connected";
  }
  if (isPending) {
    logLinkedInDebug('checkConnectionStatus:pending', { buttonCount: buttons.length });
    return "Pending";
  }

  logLinkedInDebug('checkConnectionStatus:notConnected', { buttonCount: buttons.length });
  return "Not Connected";
}

// --- Execution Command Listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CHECK_STATUS_AND_SCRAPE') {
    const status = checkConnectionStatus();
    const context = { profileUrl: window.location.href.split('?')[0], pageText: scrapePageText() };
    sendResponse({ success: true, status, context });
    return true;
  }
  
  if (request.type === 'EXECUTE_ACTION') {
    handleAction(request.action)
      .then(() => sendResponse({ success: true }))
      // navigateTo is set when the profile-page click failed to open the
      // compose overlay — this content script can't navigate itself without
      // destroying the context mid-send, so background.js does it and then
      // re-enters via TYPE_AND_SEND.
      .catch(e => sendResponse({ success: false, error: e.message, navigateTo: e.navigateTo || null }));
    return true; // Keep channel open for async execution
  }
});

// Flip to false only once you've verified the flow end-to-end on a throwaway
// LinkedIn profile. While true, every action types the message but never
// clicks Send — and throws instead of resolving, so callers (background.js's
// sync loop) report an honest "failed: dry run", never a false "sent". Real
// LinkedIn automation risks the account being rate-limited or restricted, so
// this default is deliberate, not a bug to "clean up".
const DRY_RUN = false;

// Shared tail of both send paths (overlay-from-click and full messaging page
// after navigation): focus the real compose box, type, then send.
async function composeTypeAndSend(msgArea, message) {
  logLinkedInDebug('compose:boxFound', {
    tagName: msgArea.tagName,
    ariaLabel: msgArea.getAttribute('aria-label'),
    role: msgArea.getAttribute('role'),
  });

  // Click into the box before typing rather than only calling .focus() —
  // LinkedIn's editor sets up its internal selection/caret state on the
  // pointer interaction, and a bare focus() can leave it in a state where
  // inserted text never registers as user input.
  await randomDelay(700, 1500);
  await simulateTrustedClick(msgArea);
  await randomDelay(400, 900);

  // Confirmed live: manual DOM insertion + synthetic input events left
  // characters genuinely in the DOM, but LinkedIn's editor never recognized
  // it — the placeholder stayed active and Send never enabled. CDP
  // Input.insertText (same trust mechanism as the clicks) is required here,
  // same as the click problem one layer up.
  const typed = await simulateTrustedType(msgArea, message);
  logLinkedInDebug('compose:typingResult', { typed, messageLength: message.length, preview: message.slice(0, 80) });
  if (!typed) {
    throw new Error("Trusted typing into the compose box failed or wasn't recognized by LinkedIn's editor — the placeholder likely never cleared.");
  }

  // LinkedIn ships the Send button disabled and enables it off its own
  // editor state, so waiting for it to become enabled is a far stronger
  // proof that the text actually registered than reading textContent back
  // (which reflects only what we wrote into the DOM ourselves).
  await randomDelay(800, 1600);
  const sendBtn = await waitForElement(() => findSendButton({ mustBeEnabled: true }), 12000, 400);
  if (!sendBtn) {
    const anySend = findSendButton({ mustBeEnabled: false });
    logLinkedInDebug('compose:sendStillDisabled', {
      sendButtonExists: Boolean(anySend),
      boxText: (msgArea.innerText || '').trim().slice(0, 80),
    });
    throw new Error(
      anySend
        ? "Message text was inserted but LinkedIn never enabled its Send button — it didn't register the text as real input."
        : "Send button not found in the compose form."
    );
  }

  if (DRY_RUN) throw new Error("Dry run — set DRY_RUN=false in content.js to actually send.");

  await randomDelay(600, 1400);
  const sendClicked = await simulateTrustedClick(sendBtn);
  if (!sendClicked) throw new Error("Trusted click on the Send button failed.");

  // Confirm against LinkedIn's own post-send state rather than a fixed
  // sleep: after a real send the editor is cleared, which re-disables the
  // Send button. Either signal alone is enough.
  const confirmed = await waitForElement(() => {
    const cleared = (msgArea.innerText || '').replace(/ /g, ' ').trim().length === 0;
    const reDisabled = !findSendButton({ mustBeEnabled: true });
    return cleared || reDisabled ? msgArea : null;
  }, 15000, 500);

  if (!confirmed) {
    throw new Error("Clicked Send but the compose box never cleared — could not confirm the message actually sent.");
  }

  logLinkedInDebug('compose:sendConfirmed', { url: window.location.href });
}

// --- Action Handlers ---
async function handleAction(action) {
  console.log("LeadGennie: Commencing action simulation ->", action.type);
  logLinkedInDebug('handleAction:start', { type: action.type, messageLength: action.message?.length || 0, noteLength: action.note?.length || 0 });

  switch (action.type) {
    case 'SEND_CONNECTION': {
      const connectBtn = await waitForElement(() =>
        document.querySelector('button[aria-label^="Invite"], button[aria-label^="Connect"]')
      );
      if (!connectBtn) {
        throw new Error(
          "Connect button not found — the page may not have finished loading, or you may already be connected to this person."
        );
      }

      const connectClickOk = await simulateTrustedClick(connectBtn);
      if (!connectClickOk) throw new Error("Trusted click on the Connect button failed.");
      await new Promise(r => setTimeout(r, 1000));

      if (action.note) {
        const addNoteBtn = document.querySelector('button[aria-label="Add a note"]');
        if (addNoteBtn) {
          const noteClickOk = await simulateTrustedClick(addNoteBtn);
          if (!noteClickOk) throw new Error("Trusted click on the Add a note button failed.");
          await new Promise(r => setTimeout(r, 1000));

          const textArea = document.querySelector('textarea[name="message"]');
          if (textArea) await simulateTyping(textArea, action.note);
        }
      }

      if (DRY_RUN) throw new Error("Dry run — set DRY_RUN=false in content.js to actually send.");

      const sendBtn = document.querySelector('button[aria-label="Send invitation"]');
      if (!sendBtn) throw new Error("Send invitation button not found");
      const inviteClickOk = await simulateTrustedClick(sendBtn);
      if (!inviteClickOk) throw new Error("Trusted click on the Send invitation button failed.");
      break;
    }

    case 'SEND_MESSAGE': {
      logLinkedInDebug('SEND_MESSAGE:begin', { url: window.location.href, messageLength: action.message?.length || 0 });
      if (detectBrokenLinkedInPage()) {
        logLinkedInDebug('SEND_MESSAGE:brokenPage', { url: window.location.href, bodyText: document.body?.innerText?.slice(0, 250) });
        throw new Error(
          "LinkedIn page is unhealthy or blocked by a browser extension/ad blocker. Disable ad/privacy blockers for LinkedIn and reload the page before sending messages."
        );
      }

      // Step 1 — locate the profile owner's own Message link (structural
      // href match + ownership check; see findProfileMessageLink).
      const messageLink = await waitForElement(findProfileMessageLink, 10000, 400);
      if (!messageLink) {
        throw new Error(
          "Couldn't find this profile's Message link. Most likely this lead isn't a 1st-degree connection yet — " +
          "LinkedIn only offers Message to accepted connections, so send a connection request first."
        );
      }

      // Resolved to absolute now, while we still have the element — the
      // navigation fallback below needs it even if the click destroys or
      // re-renders the node.
      const composeUrl = new URL(messageLink.getAttribute('href'), window.location.origin).href;

      // Step 2 — try the click. Kept as the first attempt because when it
      // does work it opens the lightweight overlay in place, no page load.
      logLinkedInDebug('SEND_MESSAGE:triggerClick', { composeUrl: composeUrl.slice(0, 160) });
      await simulateTrustedClick(messageLink);

      let msgArea = await waitForElement(findMessageComposeBox, 10000, 500);

      // Step 3 — fallback. Repeatedly confirmed live that LinkedIn can
      // silently swallow this click even when it is provably correct in
      // every measurable way (right element, right coordinates, CDP-trusted
      // dispatch, isTrusted:true, populated sourceCapabilities) — see the
      // leadgennie_linkedin_dm_debugging_chain memory. The href is a real
      // navigable URL though, and navigation isn't something page JS can
      // decline. Hand it back to background.js: this content script can't
      // navigate itself, because doing so destroys the very context that
      // would have to finish the send.
      if (!msgArea) {
        const editableCount = document.querySelectorAll('[contenteditable]').length;
        logLinkedInDebug('SEND_MESSAGE:clickDidNotOpenCompose', { editableCount, composeUrl: composeUrl.slice(0, 160) });
        const navigationError = new Error("Message overlay didn't open from the click — retrying via direct navigation.");
        navigationError.navigateTo = composeUrl;
        throw navigationError;
      }

      await composeTypeAndSend(msgArea, action.message);
      break;
    }

    // Entered by background.js after it navigates the tab straight to the
    // /messaging/compose/ URL, skipping the profile-page click entirely.
    case 'TYPE_AND_SEND': {
      logLinkedInDebug('TYPE_AND_SEND:begin', { url: window.location.href, messageLength: action.message?.length || 0 });

      // A full messaging page load has more to mount than the overlay did,
      // so this gets a longer window than the post-click poll above.
      const msgArea = await waitForElement(findMessageComposeBox, 25000, 500);
      if (!msgArea) {
        const editableCount = document.querySelectorAll('[contenteditable]').length;
        logLinkedInDebug('TYPE_AND_SEND:composeBoxNotFound', { editableCount, url: window.location.href, bodyText: document.body?.innerText?.slice(0, 300) });
        throw new Error(
          `Compose box never appeared on the messaging page (${window.location.href}). ` +
          `contenteditable elements on page: ${editableCount}.`
        );
      }

      await composeTypeAndSend(msgArea, action.message);
      break;
    }

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

// --- Injected Widget (feature request: buttons on every profile page) ---
const WIDGET_ID = 'leadgennie-widget';

function isProfilePage() {
  return /^\/in\/[^/]+\/?$/.test(window.location.pathname);
}

// Builds every node via document.createElement + inline .style property
// assignment — deliberately never uses innerHTML or an injected <style> tag.
// LinkedIn (like most Microsoft properties) enforces Trusted Types and a
// strict CSP; innerHTML with a plain string throws under Trusted Types, and
// injected <style> tags can be blocked by style-src. Both fail *silently*
// from setInterval's perspective (uncaught, but nothing crashes the page),
// which is exactly "the widget just never appears, no visible error" — the
// symptom this replaced. Plain DOM + CSSOM (.style.x = y) APIs are exempt
// from both restrictions by spec, so this is the durable fix, not a guess.
function el(tag, styles, props) {
  const node = document.createElement(tag);
  if (styles) Object.assign(node.style, styles);
  if (props) Object.assign(node, props);
  return node;
}

const BTN_STYLE = {
  width: '100%', padding: '8px', marginBottom: '6px', border: 'none', borderRadius: '6px',
  background: '#4f46e5', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
  fontFamily: 'inherit',
};

function buildWidget() {
  if (document.getElementById(WIDGET_ID)) return;

  const widget = el('div', {
    position: 'fixed', bottom: '20px', right: '20px', zIndex: '2147483647',
    background: '#0A0D14', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
    padding: '12px', width: '260px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)', color: '#fff',
  });
  widget.id = WIDGET_ID;

  const closeBtn = el('button', {
    position: 'absolute', top: '8px', right: '10px', cursor: 'pointer', color: '#6b7280',
    fontSize: '14px', background: 'none', border: 'none', width: 'auto', padding: '0', margin: '0',
  }, { textContent: '×' });
  closeBtn.setAttribute('aria-label', 'Close');

  const title = el('div', { fontSize: '13px', fontWeight: '700', marginBottom: '8px', color: '#6366f1' }, {
    textContent: 'LeadGennie',
  });

  const addBtn = el('button', BTN_STYLE, { textContent: '+ Add to Lead List' });
  const genBtn = el('button', { ...BTN_STYLE, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)' }, {
    textContent: 'Generate Message',
  });
  const resultEl = el('div', {
    marginTop: '8px', fontSize: '11px', color: '#a8a29e', maxHeight: '140px',
    overflowY: 'auto', whiteSpace: 'pre-wrap',
  });

  widget.appendChild(closeBtn);
  widget.appendChild(title);
  widget.appendChild(addBtn);
  widget.appendChild(genBtn);
  widget.appendChild(resultEl);
  document.body.appendChild(widget);

  function showResult(text, level) {
    resultEl.textContent = text;
    resultEl.style.color = level === 'error' ? '#f87171' : level === 'success' ? '#4ade80' : '#a8a29e';
  }

  closeBtn.addEventListener('click', () => widget.remove());

  addBtn.addEventListener('click', () => {
    addBtn.disabled = true;
    showResult('Reading profile and extracting lead info...');
    const pageText = scrapePageText();
    const linkedin_url = window.location.href.split('?')[0];
    chrome.runtime.sendMessage({ type: 'ADD_LEAD', pageText, linkedin_url }, (res) => {
      addBtn.disabled = false;
      if (chrome.runtime.lastError || !res || !res.success) {
        showResult(`Error: ${res?.error || chrome.runtime.lastError?.message || 'Could not add lead'}`, 'error');
        return;
      }
      showResult(`Added ${res.data.full_name} to your lead list.`, 'success');
    });
  });

  genBtn.addEventListener('click', () => {
    genBtn.disabled = true;
    showResult('Reading profile and generating message...');
    const context = { profileUrl: window.location.href.split('?')[0], pageText: scrapePageText() };
    chrome.runtime.sendMessage({ type: 'PERSONALIZE_SCRAPE', context }, (res) => {
      genBtn.disabled = false;
      if (chrome.runtime.lastError || !res || !res.success) {
        showResult(`Error: ${res?.error || chrome.runtime.lastError?.message || 'Could not generate message'}`, 'error');
        return;
      }
      showResult(`${res.data.message}\n\nInsight: ${res.data.insights}`, 'success');
    });
  });
}

function removeWidget() {
  document.getElementById(WIDGET_ID)?.remove();
}

function syncWidgetToPage() {
  if (isProfilePage()) {
    buildWidget();
  } else {
    removeWidget();
  }
}

// LinkedIn is a single-page app — navigating between profiles doesn't reload
// the page, so this content script only runs once per tab's lifetime.
// Poll the URL rather than relying on a single load-time check.
let lastPath = null;
setInterval(() => {
  if (window.location.pathname !== lastPath) {
    lastPath = window.location.pathname;
    syncWidgetToPage();
  }
}, 1000);
syncWidgetToPage();
