"use client";

import { useEffect, useId, useState } from "react";
import { searchCompanies } from "@/lib/actions/companies";
import type { CompanySummary } from "@/lib/db/companies";

const inputCls =
  "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20";

/**
 * Company name + domain with autocomplete over this workspace's companies.
 * Picking a suggestion fills both fields, so the lead links to that company
 * instead of creating a near-duplicate.
 */
export default function CompanyField({
  company, domain, onChange,
}: {
  company: string;
  domain: string;
  onChange: (v: { company: string; domain: string }) => void;
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<CompanySummary[]>([]);

  useEffect(() => {
    const q = company.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchCompanies(q).then((r) => { if (!cancelled) setSuggestions(r); }).catch(() => { if (!cancelled) setSuggestions([]); });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [company]);

  function handleCompany(value: string) {
    const match = suggestions.find((s) => s.name === value);
    onChange({ company: value, domain: match?.domain && !domain ? match.domain : domain });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-sm text-neutral-300 mb-1.5" htmlFor={`${listId}-company`}>Company</label>
        <input
          id={`${listId}-company`}
          list={listId}
          value={company}
          onChange={(e) => handleCompany(e.target.value)}
          autoComplete="off"
          className={inputCls}
        />
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s.id} value={s.name}>{s.domain ?? ""}</option>
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-sm text-neutral-300 mb-1.5" htmlFor={`${listId}-domain`}>Company website / domain</label>
        <input
          id={`${listId}-domain`}
          value={domain}
          onChange={(e) => onChange({ company, domain: e.target.value })}
          placeholder="acme.com"
          className={inputCls}
        />
      </div>
    </div>
  );
}
