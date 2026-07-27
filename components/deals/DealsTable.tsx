import type { Deal } from "@/lib/actions/deals";

const STATUS_STYLES: Record<Deal["status"], string> = {
  open: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  won: "bg-green-500/10 text-green-300 border-green-500/20",
  lost: "bg-red-500/10 text-red-300 border-red-500/20",
};

export default function DealsTable({ deals }: { deals: Deal[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-3 font-medium">Deal</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Value</th>
              <th className="px-4 py-3 font-medium">Probability</th>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-white">{d.name}</td>
                <td className="px-4 py-3 text-neutral-300">{d.stageName}</td>
                <td className="px-4 py-3 text-green-400 tabular-nums">${d.value.toLocaleString()}</td>
                <td className="px-4 py-3 text-neutral-300 tabular-nums">{d.probability}%</td>
                <td className="px-4 py-3 text-neutral-400">{d.accountCompany || "—"}</td>
                <td className="px-4 py-3 text-neutral-400">{d.ownerName || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs border rounded-full px-2.5 py-1 ${STATUS_STYLES[d.status]}`}>
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
