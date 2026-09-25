// Redirects the (fake) Neon host to the local shim for every fetch in the Next server process. Test harness only.
const realFetch = globalThis.fetch;
const wrapped = function (url, init) {
  const u = typeof url === "string" ? url : url && url.url ? url.url : String(url);
  if (u.includes("api.local")) return realFetch(`http://127.0.0.1:${process.env.SHIM_PORT || 4555}/sql`, init);
  return realFetch(url, init);
};
Object.defineProperty(globalThis, "fetch", { configurable: true, get: () => wrapped, set: () => {} });
