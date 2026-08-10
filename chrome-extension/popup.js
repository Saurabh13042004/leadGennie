document.addEventListener('DOMContentLoaded', () => {
  const scrapeBtn = document.getElementById('scrapeBtn');
  const standaloneBtn = document.getElementById('standaloneBtn');
  const syncBtn = document.getElementById('syncBtn');
  const optionsBtn = document.getElementById('optionsBtn');
  const logBox = document.getElementById('logBox');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  function log(msg) {
    logBox.innerHTML += `<br>> ${msg}`;
    logBox.scrollTop = logBox.scrollHeight;
    // Also persist to the shared activity log (viewable in Settings) so this
    // isn't lost the moment the popup closes.
    const level = /^error/i.test(msg) ? 'error' : 'info';
    chrome.runtime.sendMessage({ type: 'LOG_EVENT', message: msg, level });
  }

  optionsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  // Hide the wrong legacy button based on mode to prevent confusion
  chrome.storage.sync.get(['standaloneMode'], (data) => {
    if (data.standaloneMode) {
      scrapeBtn.classList.add('hidden');
    } else {
      standaloneBtn.classList.add('hidden');
    }
  });

  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (chrome.runtime.lastError || !response || !response.connected) {
      statusDot.classList.add('off');
      statusText.textContent = 'Not connected — open Settings';
      return;
    }
    statusDot.classList.remove('off');
    statusText.textContent = `Connected — ${response.connection.apiBase}`;
    syncBtn.classList.remove('hidden');
  });

  syncBtn.addEventListener('click', () => {
    syncBtn.disabled = true;
    log('Syncing with LeadGennie queue...');
    chrome.runtime.sendMessage({ type: 'SYNC_NOW' }, (response) => {
      syncBtn.disabled = false;
      if (chrome.runtime.lastError) {
        log(`Error: ${chrome.runtime.lastError.message}`);
      } else if (!response || !response.success) {
        log(`Failed: ${response?.error || 'Unknown error'}`);
      } else if (response.skipped) {
        log(`Skipped (${response.skipped}).`);
      } else {
        log(`Sent ${response.synced}, failed ${response.failed}, of ${response.total} queued.`);
      }
    });
  });

  standaloneBtn.addEventListener('click', () => {
    log("Starting Standalone Mode...");
    chrome.runtime.sendMessage({ type: 'START_STANDALONE_RUN' }, (response) => {
      if (chrome.runtime.lastError) {
        log(`Error: ${chrome.runtime.lastError.message}`);
      } else if (!response || !response.success) {
        log(`Failed: ${response?.error || 'Unknown error'}`);
      } else {
        log("Standalone sequence initiated.");
        log("Watch the new tab for progress.");
      }
    });
  });

  scrapeBtn.addEventListener('click', async () => {
    log("Initiating profile scan...");

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const activeTab = tabs[0];
      if (!activeTab.url.includes('linkedin.com')) {
        log("Error: Please navigate to a LinkedIn profile first.");
        return;
      }

      log("Injecting extractor scripts...");

      chrome.tabs.sendMessage(activeTab.id, { type: 'CHECK_STATUS_AND_SCRAPE' }, (res) => {
        if (chrome.runtime.lastError || !res || !res.success) {
           log("Error: Could not extract context.");
           return;
        }
        log(`Context extracted. Status: ${res.status}`);
        log("Generating message via LeadGennie...");

        chrome.runtime.sendMessage({ type: 'PERSONALIZE_SCRAPE', context: res.context }, (pRes) => {
          if (chrome.runtime.lastError || !pRes || !pRes.success) {
            log(`Error: ${pRes?.error || chrome.runtime.lastError?.message || 'Could not generate message'}`);
            return;
          }
          log(`Message: ${pRes.data.message}`);
          log(`Insight: ${pRes.data.insights}`);
        });
      });
    });
  });
});
