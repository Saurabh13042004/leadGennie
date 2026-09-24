// Idempotent, batched, resumable backfills for Phase 1 (docs/phases/phase-01, WP1.1).
//
// Each function takes a driver ({ query(text, params) -> rows }, see migrator.mjs),
// walks the table in keyset-paginated batches (never one giant statement, never
// OFFSET), and is safe to run repeatedly: it only touches rows still missing the
// value it produces, so the second run is a no-op.
//
// The normalization rules are imported from the same pure TypeScript modules the
// app uses (Node type-stripping), so a backfilled company and an imported one
// can never be keyed differently.
import { normalizeCompanyName, nameKeyFromDomain } from "../../lib/domain/companies/normalize.ts";
import { splitFullName } from "../../lib/domain/leads/names.ts";
import { classifyEmail, corporateDomainFromEmail } from "../../lib/domain/leads/email.ts";

const BATCH = 1000;

/** Link leads to companies. Pass 1: by the free-text company name. Pass 2: leads with no company text but a corporate email domain. */
export async function backfillCompanies(driver, { batchSize = BATCH, log = () => {} } = {}) {
  const stats = { byName: { leadsLinked: 0, companiesCreated: 0 }, byDomain: { leadsLinked: 0, companiesCreated: 0 } };

  // ---- Pass 1: distinct (workspace, company text), keyset-paginated ----
  let lastWs = 0;
  let lastCompany = "";
  for (;;) {
    const batch = await driver.query(
      `select distinct workspace_id, company from leads
       where company_id is null and company is not null and btrim(company) <> ''
         and (workspace_id, company) > ($1::bigint, $2::text)
       order by workspace_id, company limit $3`,
      [lastWs, lastCompany, batchSize],
    );
    if (batch.length === 0) break;
    const last = batch[batch.length - 1];
    lastWs = Number(last.workspace_id);
    lastCompany = last.company;

    const groups = new Map(); // `${ws}\u0000${key}` -> { ws, key, name, companies: [raw...] }
    for (const r of batch) {
      const key = normalizeCompanyName(r.company);
      if (!key) continue; // nothing usable (e.g. "!!!") — leave the lead unlinked
      const gk = `${r.workspace_id}\u0000${key}`;
      const g = groups.get(gk) ?? { ws: Number(r.workspace_id), key, name: r.company.replace(/\s+/g, " ").trim(), raws: [] };
      g.raws.push(r.company);
      groups.set(gk, g);
    }
    const list = [...groups.values()];
    if (list.length === 0) continue;

    const existing = await driver.query(
      `select id, workspace_id, name_key, domain from companies
       where (workspace_id, name_key) in (select * from unnest($1::bigint[], $2::text[]))`,
      [list.map((g) => g.ws), list.map((g) => g.key)],
    );
    const pick = (g, rows) => {
      const same = rows.filter((c) => Number(c.workspace_id) === g.ws && c.name_key === g.key);
      // Same rule as the import matcher: a name-only company, else a single unambiguous one.
      return same.find((c) => c.domain === null) ?? (same.length === 1 ? same[0] : null);
    };
    const toCreate = list.filter((g) => !pick(g, existing));
    if (toCreate.length > 0) {
      const inserted = await driver.query(
        `insert into companies (workspace_id, name, name_key, source)
         select * from unnest($1::bigint[], $2::text[], $3::text[], $4::text[])
         on conflict do nothing returning id`,
        [toCreate.map((g) => g.ws), toCreate.map((g) => g.name), toCreate.map((g) => g.key), toCreate.map(() => "backfill")],
      );
      stats.byName.companiesCreated += inserted.length;
    }
    const all = await driver.query(
      `select id, workspace_id, name_key, domain from companies
       where (workspace_id, name_key) in (select * from unnest($1::bigint[], $2::text[]))`,
      [list.map((g) => g.ws), list.map((g) => g.key)],
    );

    const links = []; // [ws, rawCompanyText, companyId]
    for (const g of list) {
      const company = pick(g, all);
      if (!company) continue;
      for (const raw of new Set(g.raws)) links.push([g.ws, raw, Number(company.id)]);
    }
    if (links.length > 0) {
      const res = await driver.query(
        `update leads l set company_id = m.cid
         from unnest($1::bigint[], $2::text[], $3::bigint[]) as m(ws, company, cid)
         where l.workspace_id = m.ws and l.company = m.company and l.company_id is null
         returning l.id`,
        [links.map((x) => x[0]), links.map((x) => x[1]), links.map((x) => x[2])],
      );
      stats.byName.leadsLinked += res.length;
    }
    log(`companies(name): ${stats.byName.leadsLinked} leads linked so far`);
  }

  // ---- Pass 2: no company text, corporate email domain ----
  let lastId = 0;
  for (;;) {
    const batch = await driver.query(
      `select id, workspace_id, email from leads
       where id > $1 and company_id is null and (company is null or btrim(company) = '') and email is not null
       order by id limit $2`,
      [lastId, batchSize],
    );
    if (batch.length === 0) break;
    lastId = Number(batch[batch.length - 1].id);

    const withDomain = batch.flatMap((r) => {
      const domain = corporateDomainFromEmail(r.email);
      return domain ? [{ id: Number(r.id), ws: Number(r.workspace_id), domain }] : [];
    });
    if (withDomain.length === 0) continue;
    const pairs = [...new Map(withDomain.map((r) => [`${r.ws}\u0000${r.domain}`, r])).values()];

    const inserted = await driver.query(
      `insert into companies (workspace_id, name, name_key, domain, source)
       select * from unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[])
       on conflict do nothing returning id`,
      [pairs.map((p) => p.ws), pairs.map((p) => p.domain), pairs.map((p) => nameKeyFromDomain(p.domain)),
        pairs.map((p) => p.domain), pairs.map(() => "backfill")],
    );
    stats.byDomain.companiesCreated += inserted.length;

    const res = await driver.query(
      `update leads l set company_id = c.id
       from unnest($1::bigint[], $2::bigint[], $3::text[]) as m(id, ws, domain)
       join companies c on c.workspace_id = m.ws and lower(c.domain) = m.domain
       where l.id = m.id and l.workspace_id = m.ws and l.company_id is null
       returning l.id`,
      [withDomain.map((r) => r.id), withDomain.map((r) => r.ws), withDomain.map((r) => r.domain)],
    );
    stats.byDomain.leadsLinked += res.length;
    log(`companies(domain): ${stats.byDomain.leadsLinked} leads linked so far`);
  }
  return stats;
}

/** first_name / last_name from full_name. Best-effort and lossy; full_name stays authoritative. */
export async function backfillLeadNames(driver, { batchSize = BATCH, log = () => {} } = {}) {
  let lastId = 0;
  let updated = 0;
  for (;;) {
    const batch = await driver.query(
      `select id, full_name from leads
       where id > $1 and first_name is null and last_name is null and btrim(full_name) <> ''
       order by id limit $2`,
      [lastId, batchSize],
    );
    if (batch.length === 0) break;
    lastId = Number(batch[batch.length - 1].id);
    const split = batch.map((r) => ({ id: Number(r.id), ...splitFullName(r.full_name) }));
    const res = await driver.query(
      `update leads l set first_name = v.first_name, last_name = v.last_name
       from unnest($1::bigint[], $2::text[], $3::text[]) as v(id, first_name, last_name)
       where l.id = v.id and l.first_name is null and l.last_name is null
       returning l.id`,
      [split.map((s) => s.id), split.map((s) => s.firstName), split.map((s) => s.lastName)],
    );
    updated += res.length;
    log(`lead names: ${updated} updated so far`);
  }
  return { updated };
}

/** email_status for existing leads from the offline classifier (syntax / role / disposable). No DNS lookups. */
export async function backfillEmailStatus(driver, { batchSize = BATCH, log = () => {} } = {}) {
  let lastId = 0;
  let updated = 0;
  for (;;) {
    const batch = await driver.query(
      `select id, email from leads where id > $1 and email is not null and email_status = 'unverified' order by id limit $2`,
      [lastId, batchSize],
    );
    if (batch.length === 0) break;
    lastId = Number(batch[batch.length - 1].id);
    const changed = batch
      .map((r) => ({ id: Number(r.id), status: classifyEmail(r.email).status }))
      .filter((r) => r.status !== "unverified");
    if (changed.length === 0) continue;
    const res = await driver.query(
      `update leads l set email_status = v.status
       from unnest($1::bigint[], $2::text[]) as v(id, status)
       where l.id = v.id and l.email_status = 'unverified'
       returning l.id`,
      [changed.map((c) => c.id), changed.map((c) => c.status)],
    );
    updated += res.length;
    log(`email status: ${updated} updated so far`);
  }
  return { updated };
}
