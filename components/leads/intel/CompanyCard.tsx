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
    <section className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Building2 className="w-4 h-4 text-neutral-400" />
        <Link href={`/dashboard/leads${leadListQueryString({ companyId: company.id })}`} className="hover:underline">{company.name}</Link>
      </h2>
      {company.description && <p className="mt-2 text-sm text-neutral-400">{company.description}</p>}
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-neutral-500">{k}</dt>
            <dd className="text-neutral-200">{v ?? <span className="text-neutral-600" title="Not found or not verified">unknown</span>}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
