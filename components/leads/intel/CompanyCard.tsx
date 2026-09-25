import Link from "next/link";
import { CompanyMark } from "@/components/ui/Avatar";
import { leadListQueryString } from "@/lib/domain/leads/list-query";
import type { LeadIntelligence } from "@/lib/intelligence/read-model";

/** Company profile block for the lead's properties sidebar. Missing facts read "unknown" — never blank, never guessed. */
export default function CompanyCard({ company }: { company: NonNullable<LeadIntelligence["company"]> }) {
  const rows: [string, string | null][] = [
    ["Industry", company.industry],
    ["Employees", company.employeeCount === null ? null : company.employeeCount.toLocaleString()],
    ["Location", company.location],
    ["Website", company.domain],
  ];
  return (
    <section>
      <div className="flex items-center gap-2.5">
        <CompanyMark name={company.name} size="md" />
        <div className="min-w-0">
          <Link href={`/dashboard/leads${leadListQueryString({ companyId: company.id })}`} className="block truncate text-[13px] font-medium text-neutral-900 hover:text-indigo-600" title="Show all leads at this company">
            {company.name}
          </Link>
          {company.domain && <p className="truncate text-[11px] text-neutral-400">{company.domain}</p>}
        </div>
      </div>
      {company.description && <p className="mt-2.5 text-xs leading-relaxed text-neutral-500">{company.description}</p>}
      <dl className="mt-3 space-y-0.5 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[96px_1fr] items-baseline gap-3 py-1">
            <dt className="text-neutral-500">{k}</dt>
            <dd className="min-w-0 truncate text-neutral-800">{v ?? <span className="text-neutral-400" title="Not found or not verified">unknown</span>}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
