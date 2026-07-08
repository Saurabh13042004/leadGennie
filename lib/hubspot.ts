const AUTHORIZE_URL = "https://app.hubspot.com/oauth/authorize";
const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const TOKEN_INFO_URL = "https://api.hubapi.com/oauth/v1/access-tokens";

export const HUBSPOT_DEFAULT_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
];

function getScopes() {
  const configured = process.env.HUBSPOT_SCOPES;
  return configured ? configured.split(/\s+/).filter(Boolean) : HUBSPOT_DEFAULT_SCOPES;
}

function getClientCredentials() {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

export function buildHubspotAuthorizeUrl(redirectUri: string, state: string) {
  const { clientId } = getClientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: getScopes().join(" "),
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type HubspotTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export async function exchangeHubspotCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getClientCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token exchange failed: ${res.status} ${text}`);
  }

  return (await res.json()) as HubspotTokenResponse;
}

export async function refreshHubspotToken(refreshToken: string) {
  const { clientId, clientSecret } = getClientCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token refresh failed: ${res.status} ${text}`);
  }

  return (await res.json()) as HubspotTokenResponse;
}

export async function fetchHubspotTokenInfo(accessToken: string) {
  const res = await fetch(`${TOKEN_INFO_URL}/${accessToken}`);
  if (!res.ok) {
    throw new Error(`HubSpot token info lookup failed: ${res.status}`);
  }
  return (await res.json()) as {
    hub_domain?: string;
    hub_id?: number;
    user?: string;
    scopes?: string[];
  };
}

export async function revokeHubspotRefreshToken(refreshToken: string) {
  await fetch(`https://api.hubapi.com/oauth/v1/refresh-tokens/${refreshToken}`, {
    method: "DELETE",
  }).catch(() => {
    // best-effort revoke; ignore failures so disconnect always succeeds locally
  });
}
