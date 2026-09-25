// LinkedIn automation (D-05, OFF by default) — real mouse/keyboard input through the Chrome DevTools Protocol.
//
// RETAINED, NOT DELETED: this only runs when the workspace has LinkedIn automation enabled AND the person has granted
// the optional "debugger" permission (see automation/index.js). With the flag off nothing here is ever called.

// --- Trusted click (Chrome DevTools Protocol) ---
// A script-dispatched element.click() sets event.isTrusted = false — a
// browser-level guarantee page JS cannot fake. Confirmed live: LinkedIn's
// "open the message compose overlay" action didn't fire for a script click
// even on the correct, AI-verified element (URL never changed, no compose
// box ever mounted) — the same symptom for both a wrong link and the
// confirmed-right one, which is what pointed at the click itself rather
// than element-selection. chrome.debugger lets an extension attach to a tab
// via CDP and dispatch a real mouse event at the OS/browser input level,
// which LinkedIn's own code cannot distinguish from a genuine user click.
// Attaching shows Chrome's own "is being debugged" banner on the tab —
// visible by design, not something an extension can hide.
async function trustedClick(tabId, selector) {
  await chrome.debugger.attach({ tabId }, '1.3');
  try {
    // Attaching resizes the tab's viewport (the infobar takes real space),
    // reflowing the page — any coordinates measured before this point are
    // already stale. Give the reflow a moment to settle, then re-locate and
    // re-measure the target *inside the CDP session* so the click uses
    // current, post-attach coordinates. Also hit-tests at that point so a
    // failure here is diagnosable without another round trip.
    await new Promise((resolve) => setTimeout(resolve, 250));

    const { result } = await chrome.debugger.sendCommand({ tabId }, 'Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { found: false };
        const r = el.getBoundingClientRect();
        const x = Math.round(r.left + r.width / 2);
        const y = Math.round(r.top + r.height / 2);
        const hit = document.elementFromPoint(x, y);
        const hitMatches = !!hit && (hit === el || el.contains(hit) || hit.contains(el));
        return { found: true, x, y, hitTag: hit && hit.tagName, hitMatches };
      })()`,
      returnByValue: true,
    });
    const point = result && result.value;
    if (!point || !point.found) {
      throw new Error(`Trusted click target not found after debugger attach (selector: ${selector})`);
    }
    const { x, y } = point;

    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseMoved', x, y,
    });
    await new Promise((resolve) => setTimeout(resolve, 60 + Math.random() * 120));
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1,
    });
    await new Promise((resolve) => setTimeout(resolve, 40 + Math.random() * 80));
    await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1,
    });
    return point;
  } finally {
    await chrome.debugger.detach({ tabId }).catch(() => {});
  }
}

// Companion to trustedClick — same trust gap, one layer over. Manual DOM
// text-node insertion + synthetic beforeinput/input events left characters
// genuinely present in the DOM, but LinkedIn's editor never recognized it as
// real input (confirmed live: placeholder stayed active, Send never
// enabled). CDP's Input.insertText inserts into whatever element the page
// currently has focused, generating real trusted input events the same way
// a real IME/keyboard would — the target must already be focused via a
// regular DOM .focus()/click before this is called.
async function trustedType(tabId, text) {
  await chrome.debugger.attach({ tabId }, '1.3');
  try {
    await new Promise((resolve) => setTimeout(resolve, 200)); // let the infobar reflow settle
    for (const ch of text) {
      await chrome.debugger.sendCommand({ tabId }, 'Input.insertText', { text: ch });
      await new Promise((resolve) => setTimeout(resolve, 35 + Math.random() * 90));
    }
  } finally {
    await chrome.debugger.detach({ tabId }).catch(() => {});
  }
}

export { trustedClick, trustedType };
