"use client";

import { useEffect, useId, useState } from "react";
import { searchCompanies } from "@/lib/actions/companies";
import { Input, Label } from "@/components/ui/Field";
import type { CompanySummary } from "@/lib/db/companies";

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
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor={`${listId}-company`}>Company</Label>
        <Input
          id={`${listId}-company`}
          list={listId}
          value={company}
          onChange={(e) => handleCompany(e.target.value)}
          autoComplete="off"
          placeholder="Acme Inc."
        />
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s.id} value={s.name}>{s.domain ?? ""}</option>
          ))}
        </datalist>
      </div>
      <div>
        <Label htmlFor={`${listId}-domain`}>Website / domain</Label>
        <Input
          id={`${listId}-domain`}
          value={domain}
          onChange={(e) => onChange({ company, domain: e.target.value })}
          placeholder="acme.com"
        />
      </div>
    </div>
  );
}
