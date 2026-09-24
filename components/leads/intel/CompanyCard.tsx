import Link from "next/link";
import { Building2 } from "lucide-react";
import { leadListQueryString } from "@/lib/domain/leads/list-query";
import type { LeadIntelligence } from "@/lib/intelligence/read-model";

export default function CompanyCard({ company }: { company: NonNullable<LeadIntelligence["company"]> }) {
  const rows: [string, string | null][] = [
    ["Industry", company.industry],
    ["Employees", company.employeeCount === null ? null : company.employeeCount.toLocaleString()],
    ["Location", company.location],
    ["Website", company.domain],
  ];
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2"><Building2 className="w-4 h-4 text-neutral-400" />
        <Link href={`/dashboard/leads${leadListQueryString({ companyId: company.id })}`} className="hover:text-indigo-600 transition-colors">{company.name}</Link>
      </h2>
      {company.description && <p className="mt-2 text-sm text-neutral-500">{company.description}</p>}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-neutral-500">{k}</dt>
            <dd className="text-neutral-700">{v ?? <span className="text-neutral-400" title="Not found or not verified">unknown</span>}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
