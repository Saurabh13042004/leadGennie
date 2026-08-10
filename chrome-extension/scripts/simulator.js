// simulator.js
console.log('LeadGennie: Simulator initialized on LinkedIn');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateConnect(message) {
  try {
    // 1. Find and click Connect button
    const connectBtn = Array.from(document.querySelectorAll('button')).find(btn => 
      btn.innerText.includes('Connect') && !btn.innerText.includes('Pending')
    );
    
    if (!connectBtn) throw new Error('Connect button not found or already connected/pending');
    
    connectBtn.click();
    await sleep(1500);
    
    // 2. Add a note
    const addNoteBtn = document.querySelector('[aria-label="Add a note"]');
    if (addNoteBtn) {
      addNoteBtn.click();
      await sleep(1000);
      
      // 3. Type message
      const textArea = document.querySelector('textarea[name="message"]');
      if (textArea && message) {
        textArea.value = message;
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(1000);
      }
      
      // 4. Send (Simulated by default for safety during dev)
      const sendBtn = document.querySelector('[aria-label="Send invitation"]');
      if (sendBtn) {
        // Uncomment to actually send:
        // sendBtn.click(); 
        console.log('LeadGennie: Connection invitation "sent" (simulated for safety)');
      }
    }
    
    return { success: true, message: 'Connection requested simulated successfully' };
  } catch (error) {
    console.error('LeadGennie Simulation Error:', error);
    return { success: false, error: error.message };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SIMULATE_CONNECT') {
    simulateConnect(request.message).then(sendResponse);
    return true; // Keep message channel open for async
  }
});
