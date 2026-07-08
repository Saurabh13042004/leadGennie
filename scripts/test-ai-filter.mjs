import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const owner = "demo@leadgennie.ai";

const titlePatterns = ["%vp of engineering%", "%cto%"];
const companyPatterns = ["%india%", "%tech%"];

const rows = await sql.query(
  `select count(*)::int as count
   from leads
   where owner_email = $1
     and (job_title ilike any($2::text[]) or company ilike any($3::text[]))`,
  [owner, titlePatterns, companyPatterns]
);
console.log("Matched count:", rows[0].count);
