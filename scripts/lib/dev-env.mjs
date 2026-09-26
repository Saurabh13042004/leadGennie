/**
 * Preflight for `npm run dev:all`: pure functions over parsed env maps, so the mistakes that make the engine
 * "run but do nothing" (empty secrets, secrets that differ between app and engine, fake mode, search switched off)
 * are caught before anything starts. Never returns or logs a secret's value.
 */

/** @param {Record<string,string|undefined>} v @param {string} k */
const has = (v, k) => Boolean(v[k] && v[k].trim());

/**
 * @param {Record<string,string|undefined>} app     parsed .env.local
 * @param {Record<string,string|undefined>} engine  parsed services/intelligence/.env
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function checkDevEnv(app, engine) {
  const errors = [];
  const warnings = [];

  for (const k of ["DATABASE_URL", "AUTH_SECRET", "CRON_SECRET", "CREDENTIALS_ENCRYPTION_KEY"]) {
    if (!has(app, k)) errors.push(`.env.local: ${k} is not set.`);
  }
  for (const k of ["INTELLIGENCE_URL", "INTELLIGENCE_SERVICE_TOKEN", "INTELLIGENCE_SIGNING_SECRET"]) {
    if (!has(app, k)) errors.push(`.env.local: ${k} is not set (the app can't reach the research engine).`);
  }
  for (const k of ["INTELLIGENCE_SERVICE_TOKEN", "INTELLIGENCE_SIGNING_SECRET"]) {
    if (!has(engine, k)) errors.push(`services/intelligence/.env: ${k} is empty — the engine refuses to start without it.`);
    else if (has(app, k) && app[k] !== engine[k]) errors.push(`${k} differs between .env.local and services/intelligence/.env — every engine call would be rejected (401). They must be identical.`);
  }
  if (!has(engine, "OPENAI_API_KEY")) errors.push("services/intelligence/.env: OPENAI_API_KEY is not set (the engine's LLM steps would fail).");

  if (has(app, "INTELLIGENCE_URL")) {
    try {
      const u = new URL(app.INTELLIGENCE_URL);
      if (!["localhost", "127.0.0.1"].includes(u.hostname)) warnings.push(`INTELLIGENCE_URL points at ${u.hostname}, not this machine — dev:all will start a local engine you won't be using.`);
    } catch {
      errors.push(".env.local: INTELLIGENCE_URL is not a valid URL.");
    }
  }

  if (["1", "true"].includes((engine.ENGINE_FAKE_MODE ?? "").trim().toLowerCase())) {
    warnings.push("ENGINE_FAKE_MODE is on: the engine returns canned data and never touches the web, Tavily or OpenAI.");
  }
  const provider = (engine.SEARCH_PROVIDER ?? "none").trim().toLowerCase();
  if (provider === "none") {
    warnings.push("SEARCH_PROVIDER=none: no web/news search — research uses only the company's own website and job boards.");
  } else if (provider === "tavily" && !has(engine, "TAVILY_API_KEY")) {
    errors.push("services/intelligence/.env: SEARCH_PROVIDER=tavily but TAVILY_API_KEY is empty.");
  } else if (provider === "brave" && !has(engine, "BRAVE_API_KEY")) {
    errors.push("services/intelligence/.env: SEARCH_PROVIDER=brave but BRAVE_API_KEY is empty.");
  }
  if (!has(engine, "INTEL_DATABASE_URL")) {
    warnings.push("INTEL_DATABASE_URL is empty: the engine keeps runs in memory — fine for dev, but restarting it loses in-flight runs.");
  }
  return { errors, warnings };
}
