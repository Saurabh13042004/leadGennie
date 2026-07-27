import { Plug, CheckCircle2, AlertCircle } from "lucide-react";
import { auth } from "@/auth";
import { listConnections } from "@/lib/actions/integrations";
import DisconnectButton from "@/components/dashboard/integrations/DisconnectButton";

export const metadata = {
  title: "Integrations | LeadGennie",
};

const OTHER_PROVIDERS = ["Salesforce", "Pipedrive", "Close"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const [session, connections] = await Promise.all([auth(), listConnections()]);
  const hubspotConnections = connections.filter((c) => c.provider === "hubspot");
  const canManage = session?.user?.role === "owner" || session?.user?.role === "admin";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Plug className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Integrations</h1>
          <p className="text-sm text-neutral-500">Connect your tools</p>
        </div>
      </div>

      {connected && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Connected to HubSpot successfully.
        </div>
      )}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Couldn&apos;t connect HubSpot: {error}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-6 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-[#FF7A59]/10 flex items-center justify-center shrink-0 border border-[#FF7A59]/20">
              <span className="text-[#FF7A59] font-bold text-sm">HS</span>
            </div>
            <div>
              <p className="text-white font-medium">HubSpot</p>
              <p className="text-sm text-neutral-500">
                Sync contacts, companies, and deals via OAuth 2.0
              </p>
            </div>
          </div>
          {canManage ? (
            <a
              href="/api/integrations/hubspot/connect"
              className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-neutral-200 transition-colors"
            >
              + Add HubSpot account
            </a>
          ) : (
            <span className="text-xs text-neutral-500 border border-white/10 rounded-lg px-3 py-2">
              Admin or owner role required
            </span>
          )}
        </div>

        {hubspotConnections.length > 0 && (
          <div className="mt-6 space-y-3 border-t border-white/10 pt-6">
            {hubspotConnections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
              >
                <div>
                  <p className="text-sm text-white font-medium">
                    {conn.label ?? `Portal ${conn.portal_id ?? conn.id}`}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Connected {new Date(conn.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-full">
                    {conn.status}
                  </span>
                  {canManage && <DisconnectButton id={conn.id} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {OTHER_PROVIDERS.map((name) => (
          <div
            key={name}
            className="rounded-xl border border-dashed border-white/10 bg-[#0A0A0A] p-5 flex items-center justify-between opacity-60"
          >
            <p className="text-white font-medium">{name}</p>
            <span className="text-xs text-neutral-500">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  );
}
