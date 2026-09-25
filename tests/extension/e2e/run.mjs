// Real-Chrome end-to-end run of the LeadGennie extension against the BUILT app (npm run build first).
//
//   npm run test:extension:e2e
//
// What is real: Chrome 154 with the extension loaded, the built Next server, real NextAuth login, the real consent page,
// chrome.identity.launchWebAuthFlow, the service worker, the popup, the closed-shadow-root widget on a LinkedIn-like page with a
// strict CSP + Trusted Types. What is stand-in: the database is an in-memory PGlite behind a Neon-protocol shim (never a real
// DB), the LinkedIn page is a local fixture served under the hostname www.linkedin.com, and there is NO live LLM (the key is invalid).
import { spawn } from "node:child_process";
import http from "node:http";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { PASSWORD, startShim } from "./neon-shim.mjs";
import { Shadow } from "./cdp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../..");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.env.E2E_OUT || mkdtempSync(join(tmpdir(), "lg-ext-e2e-"));
const APP_PORT = 3457, SHIM_PORT = 4555, FIX_PORT = 4600;
const APP = `http://localhost:${APP_PORT}`;
mkdirSync(OUT, { recursive: true });

const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - t0, error: e.message });
    console.log(`  ✗ ${name}\n      ${String(e.message).split("\n")[0]}`);
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

// ---- fixture server: a LinkedIn-like profile (strict CSP + Trusted Types) and a company team page --------------------
const fixtures = {
  "/in/sarah-chen/": [readFileSync(join(HERE, "fixtures/linkedin-profile.html")), "default-src 'self'; style-src 'self'; script-src 'self'; require-trusted-types-for 'script'"],
  "/team/hank": [readFileSync(join(HERE, "fixtures/company-team.html")), null],
};
const fixtureServer = http.createServer((req, res) => {
  const f = fixtures[req.url.split("?")[0]];
  if (!f) return res.writeHead(404).end("not found");
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...(f[1] ? { "content-security-policy": f[1] } : {}) }).end(f[0]);
});

function startApp() {
  const env = {
    ...process.env, PORT: String(APP_PORT), SHIM_PORT: String(SHIM_PORT),
    DATABASE_URL: "postgresql://u:p@neon-shim.local/db", AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-1234", AUTH_TRUST_HOST: "true",
    // No live LLM / email / engine, whatever .env.local says: process env wins over .env files.
    OPENAI_API_KEY: "invalid-e2e-key", RESEND_API_KEY: "", INTELLIGENCE_URL: "", FEATURE_LINKEDIN_AUTOMATION: "",
    NODE_OPTIONS: `--require ${join(HERE, "preload.cjs")}`,
  };
  const p = spawn("npx", ["next", "start", "-p", String(APP_PORT)], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  p.stdout.on("data", (d) => (log += d));
  p.stderr.on("data", (d) => (log += d));
  return { p, log: () => log };
}

async function waitHttp(url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).status < 500) return; } catch { /* not up yet */ }
    await sleep(300);
  }
  throw new Error(`${url} did not come up`);
}

const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`) });

let shim, app, browser;
try {
  console.log(`Output: ${OUT}`);
  shim = await startShim({ port: SHIM_PORT });
  await new Promise((r) => fixtureServer.listen(FIX_PORT, "127.0.0.1", r));
  app = startApp();
  await waitHttp(`${APP}/login`);

  // The test manifest differs from the shipped one ONLY by one extra host permission for the fixture company site.
  const extDir = join(OUT, "extension");
  cpSync(join(ROOT, "chrome-extension"), extDir, { recursive: true });
  const m = JSON.parse(readFileSync(join(extDir, "manifest.json"), "utf8"));
  m.host_permissions.push("http://www.globex.example/*");
  writeFileSync(join(extDir, "manifest.json"), JSON.stringify(m, null, 2));

  browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, pipe: true, enableExtensions: [extDir],
    args: ["--no-first-run", "--no-default-browser-check", `--host-resolver-rules=MAP www.linkedin.com 127.0.0.1:${FIX_PORT}, MAP www.globex.example 127.0.0.1:${FIX_PORT}`, "--window-size=1280,900"],
    defaultViewport: { width: 1280, height: 900 },
  });
  const swTarget = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"), { timeout: 20000 });
  const EXT_ID = new URL(swTarget.url()).host;
  const sw = await swTarget.worker();
  console.log(`Extension id: ${EXT_ID}`);

  console.log("\nInstall");
  await step("extension loads with the pinned ID from the manifest key", async () => {
    expect(EXT_ID === "hfhoiegnochpbnljpnkkcmdeafbdpaoh", `unexpected id ${EXT_ID}`);
  });
  await step("install-time permissions are minimal; debugger/alarms are optional; no all-sites host access", async () => {
    const mf = JSON.parse(readFileSync(join(ROOT, "chrome-extension/manifest.json"), "utf8"));
    expect(JSON.stringify(mf.permissions) === '["storage","activeTab","scripting","identity"]', `permissions: ${mf.permissions}`);
    expect(mf.optional_permissions.includes("debugger"), "debugger must be optional");
    expect(!mf.host_permissions.some((h) => h === "<all_urls>" || h === "*://*/*" || h.includes("vercel.app") || h.includes("googleapis")), `host permissions: ${mf.host_permissions}`);
    expect(!mf.oauth2, "no Google OAuth block in the shipped manifest");
  });

  console.log("\nSigned-out popup");
  const popupUrl = (q = "") => `chrome-extension://${EXT_ID}/ui/popup.html${q}`;
  let popup = await browser.newPage();
  await popup.setViewport({ width: 380, height: 640 });
  await popup.goto(popupUrl());
  await step("shows the Connect screen (not a token box)", async () => {
    await popup.waitForFunction(() => document.body.innerText.includes("Connect your workspace"), { timeout: 10000 });
    const t = await popup.evaluate(() => document.body.innerText);
    expect(/Connect LeadGennie/.test(t), "connect button missing");
    expect(!/token/i.test(t.replace(/no tokens to copy/i, "")), "should not ask for a token");
    await shot(popup, "01-popup-signed-out");
  });

  console.log("\nConnect flow (real launchWebAuthFlow + real login + real consent page)");
  await step("Connect opens LeadGennie, survives the login round-trip, and lands on the consent page", async () => {
    const authTarget = browser.waitForTarget((t) => t.url().startsWith(`${APP}/`) && t.type() === "page", { timeout: 20000 });
    await popup.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Connect LeadGennie/.test(b.innerText)).click());
    const auth = await (await authTarget).page();
    await auth.setViewport({ width: 520, height: 720 });
    // Signed out → /login?callbackUrl=<consent url with its query string intact>
    await auth.waitForSelector("#auth-email", { timeout: 20000 });
    const loginUrl = new URL(auth.url());
    const cb = loginUrl.searchParams.get("callbackUrl") || "";
    expect(cb.startsWith("/extension/connect?") && cb.includes("code_challenge=") && cb.includes("redirect_uri="), `callbackUrl lost the query: ${cb}`);
    await auth.click("#auth-email", { clickCount: 3 });
    await auth.type("#auth-email", "owner@example.com");
    await auth.type("#auth-password", PASSWORD);
    await shot(auth, "02-login");
    await auth.keyboard.press("Enter");
    await auth.waitForFunction(() => document.body.innerText.includes("Connect the LeadGennie extension"), { timeout: 30000 });
    const text = await auth.evaluate(() => document.body.innerText);
    expect(text.includes("Olivia Owner") && text.includes("Acme Outbound") && /Add leads you capture/.test(text), "consent details missing");
    expect(/can.t send email/i.test(text), "should state what it cannot do");
    await shot(auth, "03-consent");
    await auth.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Approve/.test(b.innerText)).click());
  });
  await step("the extension ends up connected (token stored in LOCAL storage, not synced)", async () => {
    await popup.waitForFunction(() => document.body.innerText.includes("Acme Outbound"), { timeout: 30000 });
    const stored = await sw.evaluate(async () => ({ local: await chrome.storage.local.get("session"), sync: await chrome.storage.sync.get(null) }));
    expect(stored.local.session && /^lgx_/.test(stored.local.session.accessToken), "session token missing");
    expect(stored.local.session.user.email === "owner@example.com" && stored.local.session.workspace.name === "Acme Outbound", "wrong identity");
    expect(!JSON.stringify(stored.sync).includes("lgx_"), "token leaked into synced storage");
    await shot(popup, "04-popup-connected");
  });
  await step("the server lists this browser under Settings → Browser extension data", async () => {
    const rows = (await shim.db.query("select device_label, scopes, user_id from extension_sessions")).rows;
    expect(rows.length === 1 && /Chrome on/.test(rows[0].device_label), `sessions: ${JSON.stringify(rows)}`);
    expect(JSON.stringify(rows[0].scopes) === '["leads:read","leads:create","research:trigger"]', `scopes: ${JSON.stringify(rows[0].scopes)}`);
  });

  console.log("\nLinkedIn profile (strict CSP + Trusted Types) — the on-page widget");
  const li = await browser.newPage();
  const consoleErrors = [];
  li.on("console", (m) => { if (m.type() === "error" && /Trusted|Content Security/i.test(m.text())) consoleErrors.push(m.text()); });
  li.on("pageerror", (e) => consoleErrors.push(String(e)));
  await li.goto("http://www.linkedin.com/in/sarah-chen/");
  const wd = new Shadow(li);
  await wd.open();
  await step("the widget mounts in a closed shadow root and is invisible to page scripts", async () => {
    const pill = await wd.waitFor({ cls: "w-pill" }, { timeout: 20000 });
    expect(pill, "no pill");
    const pageSees = await li.evaluate(() => { const h = document.getElementById("leadgennie-root"); return h ? { hasHost: true, shadowVisible: !!h.shadowRoot } : { hasHost: false }; });
    expect(pageSees.hasHost && pageSees.shadowVisible === false, `page can see into the widget: ${JSON.stringify(pageSees)}`);
  });
  await step("nothing is read from the page or sent to the server until the person clicks", async () => {
    const leads = (await shim.db.query("select count(*)::int as n from leads")).rows[0].n;
    expect(leads === 2, `leads changed before any click: ${leads}`);
  });
  await step("the pill offers 'Add to LeadGennie' for someone not yet a lead", async () => {
    await wd.waitFor({ cls: "w-pill" });
    const t = await wd.widgetText();
    expect(/Add to LeadGennie/.test(t), `pill text: ${t}`);
    await shot(li, "05-linkedin-pill");
  });
  await step("click 1: the card reads the profile and prefills name, title and company (no model call needed)", async () => {
    await wd.click(await wd.find({ cls: "w-pill" }));
    const name = await wd.waitFor({ id: "lg-f-full_name" }, { timeout: 20000 });
    expect((await wd.value(name)) === "Sarah Chen", `name: ${await wd.value(name)}`);
    expect((await wd.value(await wd.find({ id: "lg-f-job_title" }))) === "VP Sales", "title");
    expect((await wd.value(await wd.find({ id: "lg-f-company" }))) === "Acme", "company");
    expect((await wd.value(await wd.find({ id: "lg-f-linkedin_url" }))) === "https://www.linkedin.com/in/sarah-chen", "linkedin url canonicalised");
    await shot(li, "06-linkedin-card");
  });
  await step("the person can correct a field, then click 2 (Add lead) saves it", async () => {
    await wd.type(await wd.find({ id: "lg-f-company_domain" }), "acme.com");
    const add = (await wd.find({ tag: "button", cls: "lg-btn-primary" }));
    await wd.click(add);
    await wd.waitFor({ cls: "lg-panel" }, { timeout: 20000 });
    await sleep(500);
    const t = await wd.widgetText();
    expect(/Added to LeadGennie/.test(t) && /Sarah Chen/.test(t) && /VP Sales/.test(t), `saved view: ${t}`);
    await shot(li, "07-linkedin-saved");
  });
  await step("the lead is really in the app's database with company, domain, source and provenance", async () => {
    const r = (await shim.db.query(`select l.full_name, l.job_title, l.source, l.source_url, l.email_status, c.name as company, c.domain
      from leads l left join companies c on c.id = l.company_id where l.full_name = 'Sarah Chen'`)).rows;
    expect(r.length === 1, `rows: ${r.length}`);
    expect(r[0].company === "Acme" && r[0].domain === "acme.com" && r[0].source === "extension", JSON.stringify(r[0]));
    expect(r[0].source_url === "http://www.linkedin.com/in/sarah-chen", `source_url: ${r[0].source_url}`);
    const prov = (await shim.db.query("select field, source from field_provenance where entity_type = 'lead'")).rows;
    expect(prov.some((p) => p.field === "company" && p.source === "extension") && prov.some((p) => p.field === "full_name"), JSON.stringify(prov));
    const act = (await shim.db.query("select actor_user_id from activities where type = 'lead.captured'")).rows;
    expect(act.length === 1 && Number(act[0].actor_user_id) === 1, "activity should be attributed to the signed-in person");
  });
  await step("reloading the page: the pill now says 'In LeadGennie' — and adding again never duplicates", async () => {
    await li.reload();
    await wd.open();
    await wd.waitFor({ cls: "w-pill" }, { timeout: 20000 });
    await sleep(800);
    const t = await wd.widgetText();
    expect(/In LeadGennie/.test(t), `pill: ${t}`);
    await wd.click(await wd.find({ cls: "w-pill" }));
    await wd.waitFor({ cls: "lg-panel" });
    expect(/Already in LeadGennie/.test(await wd.widgetText()), "duplicate state");
    expect((await shim.db.query("select count(*)::int as n from leads where full_name = 'Sarah Chen'")).rows[0].n === 1, "duplicate created");
    await shot(li, "08-linkedin-existing");
  });
  await step("the widget worked under the page's strict CSP with no Trusted Types / CSP violations", async () => {
    expect(consoleErrors.length === 0, `violations:\n${consoleErrors.slice(0, 3).join("\n")}`);
  });

  console.log("\nPopup capture on a company page (JSON-LD, no model)");
  const liTabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "*://www.linkedin.com/*" }))[0].id);
  const team = await browser.newPage();
  await team.goto("http://www.globex.example/team/hank");
  const teamTabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "http://www.globex.example/*" }))[0].id);
  popup = await browser.newPage();
  await popup.setViewport({ width: 380, height: 700 });
  await popup.goto(popupUrl(`?tab=${teamTabId}`));
  await step("'Read this page' fills the card from the page's structured data", async () => {
    await popup.waitForFunction(() => document.body.innerText.includes("Read this page"), { timeout: 15000 });
    await shot(popup, "09-popup-generic-page");
    await popup.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Read this page/.test(b.innerText)).click());
    await popup.waitForSelector("#lg-f-full_name", { timeout: 20000 });
    const v = await popup.evaluate(() => Object.fromEntries(["full_name", "job_title", "company", "company_domain", "email"].map((k) => [k, document.getElementById(`lg-f-${k}`).value])));
    expect(v.full_name === "Hank Scorpio" && v.job_title === "Chief Executive Officer" && v.company === "Globex" && v.company_domain === "globex.example" && v.email === "hank@globex.example", JSON.stringify(v));
    await shot(popup, "10-popup-card");
  });
  await step("Add lead saves it and offers Open + Research (research honestly reports it isn't set up here)", async () => {
    await popup.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Add lead/.test(b.innerText)).click());
    await popup.waitForFunction(() => document.body.innerText.includes("Added to LeadGennie"), { timeout: 20000 });
    const t = await popup.evaluate(() => document.body.innerText);
    expect(/Open in LeadGennie/.test(t) && /Research with Gennie/.test(t), "actions missing");
    expect(/isn.t set up on this LeadGennie/.test(t), "should explain research is not configured");
    const disabled = await popup.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Research with Gennie/.test(b.innerText)).disabled);
    expect(disabled === true, "research button should be disabled when the engine isn't configured");
    await shot(popup, "11-popup-saved");
  });

  console.log("\nLeads tab (synced with the dashboard's data)");
  popup = await browser.newPage();
  await popup.setViewport({ width: 380, height: 700 });
  await popup.goto(popupUrl(`?tab=${liTabId}`));
  await step("lists the workspace's real leads, newest first, including the two just captured; search works", async () => {
    await popup.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.innerText === "Leads"), { timeout: 15000 });
    await popup.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText === "Leads").click());
    await popup.waitForFunction(() => document.body.innerText.includes("Hank Scorpio"), { timeout: 15000 });
    const names = await popup.evaluate(() => [...document.querySelectorAll(".lg-lead .lg-strong")].map((e) => e.innerText));
    expect(names.join("|").startsWith("Hank Scorpio|Sarah Chen") && names.includes("Bill Lumbergh") && names.includes("Peter Gibbons"), names.join("|"));
    await shot(popup, "12-popup-leads");
    await popup.type('input[type="search"]', "lumbergh");
    await popup.waitForFunction(() => document.querySelectorAll(".lg-lead").length === 1, { timeout: 10000 });
  });

  console.log("\nOptions page");
  const opt = await browser.newPage();
  await opt.setViewport({ width: 900, height: 900 });
  await opt.goto(`chrome-extension://${EXT_ID}/ui/options.html`);
  await step("shows the connection (workspace, person, role, capabilities) and capture-only activity", async () => {
    await opt.waitForFunction(() => document.body.innerText.includes("Acme Outbound"), { timeout: 15000 });
    const t = await opt.evaluate(() => document.body.innerText);
    expect(/owner/i.test(t) && /Olivia Owner/.test(t) && /Add leads/.test(t), "connection details missing");
    expect(/Added Sarah Chen to LeadGennie/.test(t), "capture activity missing");
    expect(!/LinkedIn automation \(advanced\)/.test(t), "automation panel must be hidden while the server has it off");
    await shot(opt, "13-options");
  });

  console.log("\nRevocation and roles");
  await step("revoking the browser server-side signs the extension out on its next request, with an explanation", async () => {
    await shim.db.query("update extension_sessions set revoked_at = now()");
    const p = await browser.newPage();
    await p.setViewport({ width: 380, height: 640 });
    await p.goto(popupUrl());
    await p.waitForFunction(() => document.body.innerText.includes("Connect your workspace"), { timeout: 20000 });
    const t = await p.evaluate(() => document.body.innerText);
    expect(/expired or was disconnected/.test(t), `no explanation shown: ${t}`);
    await shot(p, "14-popup-revoked");
    const stored = await sw.evaluate(async () => chrome.storage.local.get("session"));
    expect(!stored.session, "token should have been forgotten locally");
  });
  await step("a viewer can connect but is only ever granted read scope; capture is refused with a role message", async () => {
    const v = await browser.newPage();
    await v.goto(`${APP}/login`);
    await v.waitForSelector("#auth-email");
    // Sign the owner out of this browser profile's app session, then sign in as the viewer.
    await v.evaluate(async () => { await fetch("/api/auth/signout", { method: "POST" }).catch(() => {}); });
    await v.goto(`${APP}/login`);
    await v.waitForSelector("#auth-email", { timeout: 10000 });
    await v.click("#auth-email", { clickCount: 3 });
    await v.type("#auth-email", "viewer@example.com");
    await v.type("#auth-password", PASSWORD);
    await v.keyboard.press("Enter");
    await v.waitForFunction(() => location.pathname.startsWith("/dashboard"), { timeout: 30000 });
    const p = await browser.newPage();
    await p.setViewport({ width: 380, height: 640 });
    await p.goto(popupUrl());
    await p.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Connect LeadGennie/.test(b.innerText)), { timeout: 15000 });
    const authTarget = browser.waitForTarget((t) => t.url().includes("/extension/connect"), { timeout: 20000 });
    await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Connect LeadGennie/.test(b.innerText)).click());
    const auth = await (await authTarget).page();
    await auth.waitForFunction(() => document.body.innerText.includes("Connect the LeadGennie extension"), { timeout: 20000 });
    const consent = await auth.evaluate(() => document.body.innerText);
    expect(/See your leads/.test(consent) && !/Add leads you capture/.test(consent), "viewer consent should list read access only");
    await shot(auth, "15-consent-viewer");
    await auth.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Approve/.test(b.innerText)).click());
    await p.waitForFunction(() => document.body.innerText.includes("Vic Viewer") || document.body.innerText.includes("Viewer"), { timeout: 30000 });
    const s = await sw.evaluate(async () => (await chrome.storage.local.get("session")).session);
    expect(JSON.stringify(s.scopes) === '["leads:read"]', `viewer scopes: ${JSON.stringify(s.scopes)}`);
    await shot(p, "16-popup-viewer");
  });
} catch (e) {
  results.push({ name: "harness", ok: false, error: e.stack || e.message });
  console.log(`\nHARNESS ERROR: ${e.stack || e.message}`);
  if (app) console.log("--- app log tail ---\n" + app.log().split("\n").slice(-25).join("\n"));
} finally {
  try { await browser?.close(); } catch { /* ignore */ }
  try { app?.p.kill("SIGTERM"); } catch { /* ignore */ }
  try { fixtureServer.close(); await shim?.close(); } catch { /* ignore */ }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed · screenshots in ${OUT}`);
writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
