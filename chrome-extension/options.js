import { generatePersonalizedMessage } from './services/gemini.js';

const DEFAULT_API_BASE = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
  const apiBase = document.getElementById('apiBase');
  const apiToken = document.getElementById('apiToken');
  const connectBtn = document.getElementById('connectBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');
  const connectionStatus = document.getElementById('connectionStatus');

  const standaloneMode = document.getElementById('standaloneMode');
  const standaloneSettings = document.getElementById('standaloneSettings');
  const sheetId = document.getElementById('sheetId');
  const sheetRange = document.getElementById('sheetRange');
  const maxLeads = document.getElementById('maxLeads');
  const sdrContext = document.getElementById('sdrContext');
  const customPrompt = document.getElementById('customPrompt');
  const testPromptBtn = document.getElementById('testPromptBtn');
  const testOutput = document.getElementById('testOutput');
  const saveBtn = document.getElementById('saveBtn');
  const statusMsg = document.getElementById('statusMsg');

  const logList = document.getElementById('logList');
  const refreshLogsBtn = document.getElementById('refreshLogsBtn');
  const clearLogsBtn = document.getElementById('clearLogsBtn');

  function renderLogs(logs) {
    if (!logs || logs.length === 0) {
      logList.innerHTML = '<span style="color:#6b7280">No activity yet.</span>';
      return;
    }
    const colors = { error: '#f87171', success: '#4ade80', info: '#a8a29e' };
    logList.innerHTML = logs
      .slice()
      .reverse()
      .map((l) => {
        const time = new Date(l.ts).toLocaleTimeString();
        const color = colors[l.level] || colors.info;
        return `<div style="color:${color}; margin-bottom:4px;">[${time}] ${l.message}</div>`;
      })
      .join('');
  }

  function loadLogs() {
    chrome.runtime.sendMessage({ type: 'GET_LOGS' }, (res) => renderLogs(res?.logs));
  }

  refreshLogsBtn.addEventListener('click', loadLogs);
  clearLogsBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_LOGS' }, () => loadLogs());
  });
  loadLogs();

  function renderConnectionStatus(connection) {
    if (connection && connection.apiToken) {
      connectionStatus.textContent = `Connected — ${connection.apiBase}`;
      connectionStatus.className = 'status connected';
    } else {
      connectionStatus.textContent = 'Not connected';
      connectionStatus.className = 'status disconnected';
    }
  }

  let currentConnection = null;

  // Load existing settings
  chrome.storage.sync.get(
    ['connection', 'standaloneMode', 'sheetId', 'sheetRange', 'maxLeads', 'sdrContext', 'customPrompt'],
    (data) => {
      apiBase.value = data.connection?.apiBase || DEFAULT_API_BASE;
      apiToken.value = data.connection?.apiToken || '';
      currentConnection = data.connection || null;
      renderConnectionStatus(data.connection);

      if (data.standaloneMode) {
        standaloneMode.checked = true;
        standaloneSettings.classList.remove('hidden');
      }
      if (data.sheetId) sheetId.value = data.sheetId;
      if (data.sheetRange) sheetRange.value = data.sheetRange;
      if (data.maxLeads) maxLeads.value = data.maxLeads;
      if (data.sdrContext) sdrContext.value = data.sdrContext;
      if (data.customPrompt) customPrompt.value = data.customPrompt;
    }
  );

  connectBtn.addEventListener('click', async () => {
    const base = (apiBase.value || DEFAULT_API_BASE).trim().replace(/\/$/, '');
    const token = apiToken.value.trim();
    if (!token) {
      connectionStatus.textContent = 'Paste your API token first.';
      connectionStatus.className = 'status disconnected';
      return;
    }

    connectBtn.disabled = true;
    connectionStatus.textContent = 'Connecting...';
    connectionStatus.className = 'status';

    try {
      const res = await fetch(`${base}/api/extension/queue`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) throw new Error('Invalid API token.');
      if (!res.ok) throw new Error(`Unexpected response (${res.status}).`);

      const connection = { apiBase: base, apiToken: token };
      await chrome.storage.sync.set({ connection });
      currentConnection = connection;
      renderConnectionStatus(connection);
    } catch (e) {
      connectionStatus.textContent = `Connection failed: ${e.message}`;
      connectionStatus.className = 'status disconnected';
    } finally {
      connectBtn.disabled = false;
    }
  });

  disconnectBtn.addEventListener('click', async () => {
    await chrome.storage.sync.remove('connection');
    apiToken.value = '';
    currentConnection = null;
    renderConnectionStatus(null);
  });

  standaloneMode.addEventListener('change', (e) => {
    if (e.target.checked) {
      standaloneSettings.classList.remove('hidden');
    } else {
      standaloneSettings.classList.add('hidden');
    }
  });

  testPromptBtn.addEventListener('click', async () => {
    testOutput.style.display = 'block';
    testOutput.style.color = '#a8a29e';
    testOutput.innerText = "Generating test message...";
    testPromptBtn.disabled = true;

    const mockContext = {
      profileUrl: "https://linkedin.com/in/mock-user",
      recentPosts: ["Just published an article on how AI is changing B2B sales automation. The results are incredible!"],
      jobPostings: ["Hiring a Senior Account Executive"],
      fundingInfo: "Recently raised $5M Series A to scale our go-to-market motion."
    };

    try {
      const res = await generatePersonalizedMessage(currentConnection, mockContext, sdrContext.value, customPrompt.value);
      testOutput.style.color = '#22c55e';
      testOutput.innerHTML = `<strong style="color:white">Message:</strong><br>${res.message}<br><br><strong style="color:white">Insight:</strong><br>${res.insights}`;
    } catch (e) {
      testOutput.style.color = '#ef4444';
      testOutput.innerText = `Error: ${e.message}`;
    } finally {
      testPromptBtn.disabled = false;
    }
  });

  saveBtn.addEventListener('click', () => {
    chrome.storage.sync.set({
      standaloneMode: standaloneMode.checked,
      sheetId: sheetId.value,
      sheetRange: sheetRange.value || 'Sheet1!A:Z',
      maxLeads: parseInt(maxLeads.value, 10) || 20,
      sdrContext: sdrContext.value,
      customPrompt: customPrompt.value
    }, () => {
      statusMsg.textContent = 'Settings saved successfully!';
      setTimeout(() => statusMsg.textContent = '', 3000);
    });
  });
});
