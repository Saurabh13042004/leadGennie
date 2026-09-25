import { getSession } from '../lib/storage.js';

/**
 * The single question every automation entry point asks first. All three must hold:
 *   1. the server says LinkedIn automation is on (D-05: off by default),
 *   2. this connection was granted the `automation` scope,
 *   3. the person has granted the OPTIONAL `debugger` permission (it is not in the install-time permission list).
 * Anything else and the automation code simply does not run.
 */
export async function automationAllowed() {
  const s = await getSession();
  if (!s || !s.features || !s.features.linkedinAutomation) return false;
  if (!Array.isArray(s.scopes) || !s.scopes.includes('automation')) return false;
  try {
    return await chrome.permissions.contains({ permissions: ['debugger'] });
  } catch {
    return false;
  }
}
