// E2E harness: speaks Neon's HTTP SQL protocol over an in-memory PGlite, seeded from the real migrations, so the BUILT app
// can run end-to-end without touching any real database. Never point this at production: it has no connection to it.
import http from "node:http";
import { PGlite } from "@electric-sql/pglite";
import bcrypt from "bcryptjs";
import { loadMigrations, migrate, pgliteDriver } from "../../../scripts/lib/migrator.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
export const PASSWORD = "Passw0rd!Passw0rd";

export async function startShim({ port = 4555 } = {}) {
  // Return raw TEXT for every type, like a real Postgres server does over the wire.
  const parsers = Object.fromEntries(Array.from({ length: 4000 }, (_, i) => [i, (v) => v]));
  const db = new PGlite({ parsers });
  await migrate(pgliteDriver(db), loadMigrations(join(ROOT, "db/migrations")));

  const hash = bcrypt.hashSync(PASSWORD, 8);
  await db.exec(`
    insert into users (name, email, password_hash, company) values
      ('Olivia Owner', 'owner@example.com', '${hash}', 'Acme Outbound'),
      ('Vic Viewer', 'viewer@example.com', '${hash}', null);
    insert into workspaces (name, slug, created_by_user_id) values ('Acme Outbound', 'acme-outbound', 1);
    insert into workspace_members (workspace_id, user_id, role, status) values (1, 1, 'owner', 'active'), (1, 2, 'viewer', 'active');
    insert into companies (workspace_id, name, name_key, domain) values (1, 'Initech', 'initech', 'initech.com');
    insert into leads (workspace_id, full_name, first_name, last_name, email, email_status, company, company_id, job_title, stage, source, created_at) values
      (1, 'Bill Lumbergh', 'Bill', 'Lumbergh', 'bill@initech.com', 'unverified', 'Initech', 1, 'VP Operations', 'new', 'csv', now() - interval '2 days'),
      (1, 'Peter Gibbons', 'Peter', 'Gibbons', 'peter@initech.com', 'valid', 'Initech', 1, 'Software Engineer', 'engaged', 'manual', now() - interval '1 day');
  `);

  const lit = (v) => (Array.isArray(v) ? "{" + v.map((x) => (x === null ? "NULL" : Array.isArray(x) ? lit(x) : "\"" + String(x).replace(/(["\\])/g, "\\$1") + "\"")).join(",") + "}" : v);
  const shape = (res) => ({
    command: "SELECT",
    rowCount: res.rows.length,
    fields: res.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
    rows: res.rows.map((r) => r.map((c) => (c === null ? null : lit(c)))),
  });

  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += c;
    try {
      const p = JSON.parse(body);
      let out;
      if (p.queries) {
        const results = [];
        await db.transaction(async (tx) => {
          for (const q of p.queries) results.push(shape(await tx.query(q.query, q.params ?? [], { rowMode: "array" })));
        });
        out = { results };
      } else out = shape(await db.query(p.query, p.params ?? [], { rowMode: "array" }));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ message: e.message, code: e.code }));
    }
  });
  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return { db, close: () => new Promise((r) => server.close(r)), port };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { port } = await startShim();
  console.log(`neon shim listening on ${port}`);
}
