/**
 * Reads what the current page looks like, for the server to interpret. Deliberately dumb: no parsing of names or
 * companies here (that lives server-side, where it is tested and can change without shipping a new extension).
 *
 * SELF-CONTAINED on purpose — chrome.scripting.executeScript({ func }) serialises this function's source and runs
 * it inside the page, so it may only reference its own parameters and page globals, never module scope.
 * `doc`/`win` are trailing parameters so unit tests can pass a fake page; the FIRST parameter is the only one callers
 * pass through executeScript `args` (which are JSON-serialised, so `undefined` placeholders would arrive as null).
 */
export function collectPageFacts(textLimit = 12000, doc = document, win = window) {
  const clean = (s) => String(s || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const attr = (sel, name) => {
    const el = doc.querySelector(sel);
    return el ? clean(el.getAttribute(name)) : '';
  };

  const main = doc.querySelector('main') || doc.body || doc.documentElement;
  const text = clean(main ? main.innerText || main.textContent : '').slice(0, textLimit);

  const headings = Array.from(doc.querySelectorAll('h1'))
    .map((h) => clean(h.innerText || h.textContent))
    .filter(Boolean)
    .slice(0, 6)
    .map((h) => h.slice(0, 200));

  const jsonld = [];
  for (const node of Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).slice(0, 10)) {
    const raw = node.textContent || '';
    if (raw.length > 50000) continue; // a giant blob is never a contact card
    try {
      jsonld.push(JSON.parse(raw));
    } catch {
      /* malformed JSON-LD is common; skip it */
    }
  }

  const emails = [];
  for (const a of Array.from(doc.querySelectorAll('a[href^="mailto:"]')).slice(0, 60)) {
    const addr = decodeURIComponent((a.getAttribute('href') || '').slice(7).split('?')[0]).trim();
    if (addr && !emails.includes(addr)) emails.push(addr);
    if (emails.length >= 30) break;
  }

  const selection = win && win.getSelection ? clean(String(win.getSelection())).slice(0, 5000) : '';

  const facts = {
    url: (win && win.location && win.location.href) || '',
    title: clean(doc.title).slice(0, 500),
    text,
    headings,
    jsonld,
    emails,
  };
  const siteName = attr('meta[property="og:site_name"]', 'content') || attr('meta[name="application-name"]', 'content');
  if (siteName) facts.siteName = siteName.slice(0, 200);
  const canonical = attr('link[rel="canonical"]', 'href');
  if (canonical) facts.canonicalUrl = canonical.slice(0, 2000);
  if (selection) facts.selection = selection;
  return facts;
}
