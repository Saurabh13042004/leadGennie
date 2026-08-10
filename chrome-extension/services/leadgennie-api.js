// services/leadgennie-api.js
// Thin wrapper around the authenticated /api/extension/* endpoints that
// aren't specific to queue-sync or AI (those live in background.js and
// services/gemini.js respectively).

export async function addLeadToCrm(connection, lead) {
  if (!connection || !connection.apiToken) {
    throw new Error("Not connected to LeadGennie — add your API token in Settings.");
  }

  const response = await fetch(`${connection.apiBase}/api/extension/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${connection.apiToken}`,
    },
    body: JSON.stringify(lead),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `LeadGennie API error (${response.status})`);
  }

  return response.json();
}

// Fallback for when deterministic selector matching can't confidently find
// the right element on a page (see leadgennie_linkedin_dm_debugging_chain
// memory) — sends the real list of clickable elements + a task description
// to the backend, which asks Gemini to pick the correct index.
export async function pickElement(connection, candidates, taskDescription) {
  if (!connection || !connection.apiToken) {
    throw new Error("Not connected to LeadGennie — add your API token in Settings.");
  }

  const response = await fetch(`${connection.apiBase}/api/extension/pick-element`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${connection.apiToken}`,
    },
    body: JSON.stringify({ candidates, taskDescription }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `LeadGennie API error (${response.status})`);
  }

  return response.json(); // { index: number | null, reason: string }
}
