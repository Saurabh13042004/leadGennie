// scraper.js
console.log('LeadGennie: Scraper initialized on LinkedIn');

function scrapeProfileData() {
  const nameElement = document.querySelector('h1');
  const titleElement = document.querySelector('.text-body-medium');
  const companyElement = document.querySelector('[data-field="experience_company_logo"]');
  
  const data = {
    name: nameElement ? nameElement.innerText.trim() : null,
    title: titleElement ? titleElement.innerText.trim() : null,
    company: companyElement ? companyElement.innerText.trim() : null,
    url: window.location.href,
    scrapedAt: new Date().toISOString(),
    source: 'linkedin_extension'
  };
  
  return data;
}

// Listen for messages from the background script or simulator
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SCRAPE_PROFILE') {
    const data = scrapeProfileData();
    sendResponse({ success: true, data });
  }
});
