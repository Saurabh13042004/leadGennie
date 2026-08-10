// services/gsheets.js

// Function to get the OAuth token
async function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, function(token) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

// Function to fetch all leads from the sheet
export async function fetchLeads(sheetId, range) {
  try {
    console.log("Getting Auth Token...");
    const token = await getAuthToken();
    console.log("Token received. Fetching sheet data...");
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log("Sheet API response status:", response.status);
    if (!response.ok) throw new Error("Failed to fetch sheet data.");
    const data = await response.json();
    console.log(`Fetched ${data.values ? data.values.length : 0} rows.`);
    return data.values || [];
  } catch (error) {
    console.error("GSheets Fetch Error:", error);
    throw error;
  }
}

// Find the first pending lead (Assumes schema: A=URL, B=Name, C=Status, D=Message)
export async function fetchNextPendingLead(sheetId, range) {
  const rows = await fetchLeads(sheetId, range);
  
  // Skip header (row 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const url = row[6]; // Column G: Person Linkedin Url
    const name = row[0] + (row[1] ? " " + row[1] : ""); // Columns A + B
    const status = row[7]; // Column H: Status

    if (url && (!status || status.trim() === '' || status.trim() === 'Pending')) {
      return {
        rowIndex: i + 1, // 1-based index for Sheets API
        url: url,
        name: name
      };
    }
  }
  return null;
}

// Update the status and message of a specific row
export async function updateLeadStatus(sheetId, sheetName, rowIndex, status, message = "", insights = "") {
  try {
    const token = await getAuthToken();
    
    // Status is in Column H, Message in Column I, Insights in Column J
    const rangeToUpdate = `${sheetName}!H${rowIndex}:J${rowIndex}`;
    
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${rangeToUpdate}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [[status, message, insights]]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error("Failed to update sheet: " + (err.error?.message || response.statusText));
    }
    return true;
  } catch (error) {
    console.error("GSheets Update Error:", error);
    throw error;
  }
}
