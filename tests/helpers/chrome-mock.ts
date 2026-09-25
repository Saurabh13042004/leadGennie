/**
 * A minimal in-memory `chrome` for unit-testing the extension's plain ES modules (lib/*). Only the surface those modules
 * touch: storage.local/sync, identity.getRedirectURL/launchWebAuthFlow, runtime.sendMessage. Real-browser behaviour is
 * covered separately by the Chrome end-to-end run (tests/extension/e2e).
 */
type Store = Record<string, unknown>;

function area(store: Store) {
  return {
    async get(keys?: string | string[] | null) {
      if (keys == null) return { ...store };
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, structuredClone(store[k])]));
    },
    async set(items: Store) {
      for (const [k, v] of Object.entries(items)) store[k] = structuredClone(v);
    },
    async remove(keys: string | string[]) {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete store[k];
    },
  };
}

export type ChromeMock = {
  local: Store;
  sync: Store;
  launchWebAuthFlow: (details: { url: string; interactive: boolean }) => Promise<string>;
  messages: { type: string; payload?: unknown }[];
};

export function installChrome(overrides: Partial<Pick<ChromeMock, "launchWebAuthFlow">> = {}): ChromeMock {
  const state: ChromeMock = {
    local: {},
    sync: {},
    messages: [],
    launchWebAuthFlow: overrides.launchWebAuthFlow ?? (async () => {
      throw new Error("launchWebAuthFlow not scripted");
    }),
  };
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { local: area(state.local), sync: area(state.sync) },
    identity: {
      getRedirectURL: (path = "") => `https://testextensionidtestextensionid12.chromiumapp.org/${path}`,
      launchWebAuthFlow: (d: { url: string; interactive: boolean }) => state.launchWebAuthFlow(d),
    },
    runtime: { lastError: undefined, sendMessage: (m: { type: string; payload?: unknown }, cb?: (r: unknown) => void) => { state.messages.push(m); cb?.({ ok: true, data: {} }); } },
    permissions: { contains: async () => true, request: async () => true },
  };
  return state;
}

export function removeChrome() {
  delete (globalThis as unknown as { chrome?: unknown }).chrome;
}
