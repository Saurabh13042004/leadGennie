// LinkedIn automation (D-05, OFF by default) — "Standalone Mode": work through a Google Sheet of LinkedIn URLs.
//
// RETAINED, NOT DELETED, and dead-ended: runStandaloneMode() refuses to start unless automationAllowed(). It also needs
// the Google Sheets pieces (chrome.identity.getAuthToken + the `oauth2` manifest block + the sheets.googleapis.com host
// permission), which the least-privilege manifest no longer declares — restore those three to re-enable it.
import { logEvent } from '../lib/log.js';
import { fetchNextPendingLead, updateLeadStatus } from './gsheets.js';
import { generatePersonalizedMessage } from './personalize.js';
import { acquire, release } from './run-lock.js';
import { automationAllowed } from './gate.js';
import { ensureAutomationScript } from './inject.js';

// --- Standalone Mode (no LeadGennie account — local Google Sheets + Gemini) ---
export async function runStandaloneMode() {
  if (!(await automationAllowed())) throw new Error("LinkedIn automation is turned off.");
  if (!acquire()) throw new Error("Already executing a task.");
  let running = true;

  try {
    const settings = await chrome.storage.sync.get([
      'sheetId', 'sheetRange', 'maxLeads', 'sdrContext', 'customPrompt',
    ]);
    if (!settings.sheetId) {
      throw new Error("Missing Sheet ID. Please configure options.");
    }
    const sheetRange = settings.sheetRange || 'Sheet1!A:Z';
    const sheetName = sheetRange.split('!')[0] || 'Sheet1';
    const maxLeads = settings.maxLeads || 20;
    let sentCount = 0;

    while (running) {
      if (sentCount >= maxLeads) {
        await logEvent(`Reached safety limit: sent ${maxLeads} requests. Stopping standalone mode.`);
        break;
      }

      await logEvent("Fetching next lead from Google Sheets...");
      const lead = await fetchNextPendingLead(settings.sheetId, sheetRange);

      if (!lead) {
        await logEvent("No more pending leads found in the sheet. Stopping.");
        break;
      }

      await logEvent(`Processing lead: ${lead.url}`);

      // 1. Open Tab
      const tab = await chrome.tabs.create({ url: lead.url, active: true });

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 6000));

      // 2. Scrape and Check Status
      await ensureAutomationScript(tab.id);
      const scrapeRes = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { type: 'CHECK_STATUS_AND_SCRAPE' }, resolve);
      });

      if (!scrapeRes || !scrapeRes.success) {
        await logEvent("Scrape failed. Updating sheet to Failed to Scrape.", 'error');
        await updateLeadStatus(settings.sheetId, sheetName, lead.rowIndex, "Failed to Scrape", "", "");
        chrome.tabs.remove(tab.id);
        continue;
      }

      if (scrapeRes.status === "Already Connected" || scrapeRes.status === "Pending" || scrapeRes.status === "Profile not found") {
        await logEvent(`Lead is ${scrapeRes.status}`);
        await updateLeadStatus(settings.sheetId, sheetName, lead.rowIndex, scrapeRes.status, "", "");
        chrome.tabs.remove(tab.id);
        continue;
      }

      // 3. Generate Message via LeadGennie's backend (which calls Gemini)
      await logEvent("Generating message via LeadGennie...");
      let geminiRes;
      try {
        geminiRes = await generatePersonalizedMessage(scrapeRes.context, settings.sdrContext, settings.customPrompt);
      } catch (e) {
        await logEvent(`Personalization failed: ${e.message}`, 'error');
        await updateLeadStatus(settings.sheetId, sheetName, lead.rowIndex, "Gemini Error", "", "");
        chrome.tabs.remove(tab.id);
        continue;
      }

      // 4. Execute Connection
      await logEvent("Executing connection request...");
      await ensureAutomationScript(tab.id);
      await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'EXECUTE_ACTION',
          action: { type: 'SEND_CONNECTION', note: geminiRes.message }
        }, (res) => {
          if (chrome.runtime.lastError || (res && !res.success)) reject(chrome.runtime.lastError || res.error);
          else resolve(res);
        });
      });

      // 5. Update Sheet
      await logEvent("Updating sheet with insights...");
      await updateLeadStatus(settings.sheetId, sheetName, lead.rowIndex, "Request Sent", geminiRes.message, geminiRes.insights);
      chrome.tabs.remove(tab.id);

      sentCount++;

      await logEvent(`Waiting 10 seconds before processing next lead. (${sentCount}/${maxLeads} requests sent today)`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    await logEvent("Standalone sequence complete.", 'success');

  } catch (error) {
    await logEvent(`Standalone Mode Error: ${error.message}`, 'error');
    throw error;
  } finally {
    running = false;
    release();
  }
}
