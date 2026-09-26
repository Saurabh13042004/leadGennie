// One command for local end-to-end development:  npm run dev:all
//
//   [engine]  Python Intelligence Engine   http://localhost:8000   (services/intelligence, `uv run uvicorn --reload`)
//   [web]     Next.js app                  http://localhost:3000   (`next dev`)
//   [worker]  job worker                   ticks /api/jobs/tick    (research / scoring / drafts / sending run as jobs)
//
// Preflight (scripts/lib/dev-env.mjs) refuses to start on config that would make the stack run but silently do
// nothing (empty or mismatched secrets, a missing key). Ctrl-C stops all three.
//
//   npm run dev:all                 all three
//   npm run dev:all -- --no-worker  without the job worker (then nothing background runs unless you tick it)
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import net from "node:net";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { checkDevEnv } from "./lib/dev-env.mjs";

const ROOT = process.cwd();
const WEB_PORT = Number(process.env.PORT ?? 3000);
const ENGINE_PORT = 8000;
const args = new Set(process.argv.slice(2));
const noColor = !process.stdout.isTTY || process.env.NO_COLOR;
const paint = (code, s) => (noColor ? s : `\x1b[${code}m${s}\x1b[0m`);
const TAGS = { engine: paint(35, "[engine]"), web: paint(36, "[web]   "), worker: paint(33, "[worker]"), dev: paint(32, "[dev]   ") };
const say = (tag, msg) => console.log(`${TAGS[tag]} ${msg}`);

const readEnv = (p) => (existsSync(p) ? parseEnv(readFileSync(p, "utf8")) : null);
const app = readEnv(join(ROOT, ".env.local"));
const engineEnv = readEnv(join(ROOT, "services/intelligence/.env"));
if (!app) fail(".env.local not found. Copy .env.example to .env.local and fill it in.");
if (!engineEnv) fail("services/intelligence/.env not found. Copy services/intelligence/.env.example to services/intelligence/.env.");

const { errors, warnings } = checkDevEnv(app, engineEnv);
for (const w of warnings) say("dev", paint(33, `warning: ${w}`));
if (errors.length) fail(`Fix these first:\n  - ${errors.join("\n  - ")}`);
if (spawnSync("uv", ["--version"], { stdio: "ignore" }).status !== 0) fail("`uv` is not installed (needed to run the Python engine): https://docs.astral.sh/uv/");

function fail(msg) {
  console.error(`${TAGS.dev} ${paint(31, msg)}`);
  process.exit(1);
}

const portFree = (port) =>
  new Promise((resolve) => {
    const s = net.createServer().once("error", () => resolve(false)).once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "127.0.0.1");
  });
for (const [name, port] of [["web", WEB_PORT], ["engine", ENGINE_PORT]]) {
  if (!(await portFree(port))) fail(`Port ${port} (${name}) is already in use. Stop whatever is listening (lsof -iTCP:${port} -sTCP:LISTEN) and retry.`);
}

// The engine reads services/intelligence/.env itself. Give it the ORIGINAL environment only — not .env.local's values —
// so an unrelated variable there can never override the engine's own config. The web app and worker get .env.local.
const baseEnv = { ...process.env };
const webEnv = { ...baseEnv, ...app, PORT: String(WEB_PORT) };
const children = [];

function start(tag, cmd, cmdArgs, opts) {
  const child = spawn(cmd, cmdArgs, { ...opts, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  children.push({ tag, child });
  for (const stream of [child.stdout, child.stderr]) {
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        say(tag, buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    });
  }
  child.on("exit", (code, sig) => {
    if (!stopping) {
      say(tag, paint(31, `exited (${sig ?? code}) — stopping everything`));
      shutdown(1);
    }
  });
  return child;
}

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  say("dev", "stopping…");
  for (const { child } of children) {
    try { process.kill(-child.pid, "SIGTERM"); } catch { /* already gone */ }
  }
  setTimeout(() => {
    for (const { child } of children) {
      try { process.kill(-child.pid, "SIGKILL"); } catch { /* already gone */ }
    }
    process.exit(code);
  }, 4000).unref();
  Promise.all(children.map(({ child }) => new Promise((r) => (child.exitCode !== null ? r() : child.once("exit", r))))).then(() => process.exit(code));
}
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => shutdown(0));

async function waitFor(url, label, ms = 90_000) {
  const until = Date.now() + ms;
  while (Date.now() < until && !stopping) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(3000), redirect: "manual" })).status < 500) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 700));
  }
  if (!stopping) fail(`${label} did not become ready at ${url} within ${ms / 1000}s`);
  return false;
}

say("dev", "starting the research engine…");
start("engine", "uv", ["run", "uvicorn", "app.main:app_factory", "--factory", "--reload", "--port", String(ENGINE_PORT)], { cwd: join(ROOT, "services/intelligence"), env: baseEnv });
await waitFor(`http://127.0.0.1:${ENGINE_PORT}/readyz`, "engine");
say("dev", paint(32, `engine ready → http://localhost:${ENGINE_PORT}/readyz`));

say("dev", "starting the web app…");
start("web", process.execPath, [join(ROOT, "node_modules/next/dist/bin/next"), "dev", "--port", String(WEB_PORT)], { cwd: ROOT, env: webEnv });
await waitFor(`http://127.0.0.1:${WEB_PORT}/login`, "web app");
say("dev", paint(32, `web ready    → http://localhost:${WEB_PORT}`));

if (!args.has("--no-worker")) {
  start("worker", process.execPath, [join(ROOT, "scripts/worker.mjs")], { cwd: ROOT, env: { ...webEnv, APP_URL: `http://localhost:${WEB_PORT}` } });
}
say("dev", paint(32, "all up. Ctrl-C to stop."));
