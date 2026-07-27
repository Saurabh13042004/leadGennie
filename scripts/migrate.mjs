import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import bcrypt from "bcryptjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync(join(__dirname, "../lib/db/schema.sql"), "utf-8");

// Strip full-line `--` comments before splitting on `;` — a semicolon inside
// a comment (e.g. "does X; does Y") otherwise fragments the statement that
// follows it, since this splitter has no notion of SQL comment syntax.
const withoutComments = schema
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

const statements = withoutComments
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
  console.log("Ran:", statement.split("\n")[0].slice(0, 60));
}

console.log(`Migration complete (${statements.length} statements).`);

const demoEmail = "demo@leadgennie.ai";
const existingUser = await sql`select id from users where email = ${demoEmail}`;
if (existingUser.length === 0) {
  const passwordHash = bcrypt.hashSync("demo1234", 10);
  await sql`
    insert into users (name, email, password_hash, company)
    values ('Demo User', ${demoEmail}, ${passwordHash}, 'Juntrax Solutions')
  `;
  console.log("Seeded demo user.");
} else {
  console.log("Demo user already present.");
}
