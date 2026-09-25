// The LinkedIn-automation content script is NOT declared in the manifest (so it never loads on ordinary LinkedIn browsing).
// It is injected into a tab only when automation is genuinely allowed and a send/scrape is about to happen. It marks itself
// (`window.__lgAutomationLoaded`), so injecting twice is a no-op.
export async function ensureAutomationScript(tabId) {
  const [loaded] = await chrome.scripting.executeScript({ target: { tabId }, func: () => Boolean(window.__lgAutomationLoaded) });
  if (loaded && loaded.result) return;
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content/linkedin-automation.js'] });
}
