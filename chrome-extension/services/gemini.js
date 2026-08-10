// services/gemini.js
//
// The extension never calls Gemini directly and never holds an AI key —
// it calls our own backend (authenticated with the same workspace API
// token used for queue sync), which calls Gemini server-side. See
// app/api/extension/personalize/route.ts.
export async function generatePersonalizedMessage(connection, leadContext, sdrContext = "", customPrompt = "") {
  if (!connection || !connection.apiToken) {
    throw new Error("Not connected to LeadGennie — add your API token in Settings.");
  }

  const response = await fetch(`${connection.apiBase}/api/extension/personalize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${connection.apiToken}`,
    },
    body: JSON.stringify({ ...leadContext, sdrContext, customPrompt }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `LeadGennie API error (${response.status})`);
  }

  return response.json(); // { message, insights }
}
