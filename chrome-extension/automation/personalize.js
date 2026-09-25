// LinkedIn automation (D-05, OFF by default): connection-note drafting and AI element picking.
// The extension never calls an AI provider and holds no AI key — both go to LeadGennie's own /api/extension endpoints,
// which are gated server-side by the `automation` scope.
import { apiFetch } from '../lib/api.js';

export async function generatePersonalizedMessage(leadContext, sdrContext = '', customPrompt = '') {
  const r = await apiFetch('/personalize', { method: 'POST', body: { ...leadContext, sdrContext, customPrompt } });
  return { message: r.message, insights: r.insights };
}

// Fallback for when deterministic selector matching can't confidently find the right element on a page: send the real
// list of clickable elements + a task description to the backend, which asks the model to pick the correct index.
export async function pickElement(candidates, taskDescription) {
  const r = await apiFetch('/pick-element', { method: 'POST', body: { candidates, taskDescription } });
  return { index: r.index, reason: r.reason };
}
