import { sql } from "@/lib/db/client";

/** Provenance for values captured through the extension: where each field came from, and whether a person edited it. */
export type ProvenanceRow = { field: string; value: string; source: "extension" | "user"; confidence: number | null };

export async function recordLeadProvenance(workspaceId: number, leadId: number, rows: ProvenanceRow[]): Promise<void> {
  if (rows.length === 0) return;
  await sql`
    insert into field_provenance (workspace_id, entity_type, entity_id, field, value, source, confidence, set_by)
    select ${workspaceId}, 'lead', ${leadId}, x.field, x.value, x.source, x.confidence, 'user'
    from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as x(field text, value text, source text, confidence numeric)
  `;
}
