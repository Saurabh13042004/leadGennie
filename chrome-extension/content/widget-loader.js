// LeadGennie on-page card for LinkedIn profiles. A classic content script whose only job is to load the real widget as an
// ES module (so it can share code with the popup). The module lives in web_accessible_resources, limited to linkedin.com.
(async () => {
  if (window.top !== window) return; // never inside LinkedIn's embedded frames
  try {
    const mod = await import(chrome.runtime.getURL('content/widget.mjs'));
    mod.start();
  } catch (e) {
    // Never break the host page. (Common cause: the extension was reloaded while this tab stayed open.)
    console.debug('[LeadGennie] widget not started:', e && e.message);
  }
})();
