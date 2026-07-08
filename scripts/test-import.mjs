import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const owner = "demo@leadgennie.ai";

const fullNames = ["Alice Wong", "Bob Smith"];
const emails = ["alice@acme.io", "bob@beta.io"];
const companies = ["Acme Inc", "Beta Corp"];
const jobTitles = ["VP of Engineering", "CTO"];
const linkedinUrls = ["https://linkedin.com/in/alice", "https://linkedin.com/in/bob"];
const ownerEmails = fullNames.map(() => owner);
const sources = fullNames.map(() => "csv");

await sql.query(
  `insert into leads (owner_email, full_name, email, company, job_title, linkedin_url, source)
   select * from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[])`,
  [ownerEmails, fullNames, emails, companies, jobTitles, linkedinUrls, sources]
);

const rows = await sql`select full_name, company, job_title from leads where owner_email = ${owner} order by created_at desc limit 5`;
console.log(rows);
