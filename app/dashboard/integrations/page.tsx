import { LockKey, Plus } from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import { listConnections } from "@/lib/actions/integrations";
import DisconnectButton from "@/components/dashboard/integrations/DisconnectButton";
import SettingsFrame from "@/components/settings/SettingsFrame";
import { Callout, shortDate } from "@/components/settings/bits";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { CompanyMark } from "@/components/ui/Avatar";

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
    <SettingsFrame title="Integrations" description="Connect HubSpot and other tools to LeadGennie.">
      <div className="space-y-6">
        {connected && <Callout tone="success" role="status">Connected to HubSpot successfully.</Callout>}
        {error && <Callout>Couldn&apos;t connect HubSpot: {error}</Callout>}

        <section>
          <h3 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400">CRM</h3>
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 md:p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF7A59]/10 text-sm font-bold text-[#FF7A59] ring-1 ring-inset ring-[#FF7A59]/20">
                HS
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900">
                  HubSpot
                  {hubspotConnections.length > 0 && (
                    <Badge tone="emerald" dot>
                      {hubspotConnections.length} connected
                    </Badge>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">Sync contacts, companies, and deals via OAuth 2.0</p>
              </div>
              {canManage ? (
                <a href="/api/integrations/hubspot/connect" className={buttonClasses({ variant: hubspotConnections.length ? "secondary" : "primary" })}>
                  <Plus className="h-3.5 w-3.5" weight="bold" />
                  {hubspotConnections.length ? "Add account" : "Connect HubSpot"}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                  <LockKey className="h-3.5 w-3.5 text-neutral-400" weight="duotone" /> Admin or owner role required
                </span>
              )}
            </div>

            {hubspotConnections.length > 0 && (
              <ul className="divide-y divide-neutral-100 border-t border-neutral-100 bg-neutral-50/40">
                {hubspotConnections.map((conn) => (
                  <li key={conn.id} className="flex items-center gap-3 px-4 py-2.5 md:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-neutral-900">{conn.label ?? `Portal ${conn.portal_id ?? conn.id}`}</p>
                      <p className="text-[11px] text-neutral-500">
                        {conn.portal_id ? `Portal ${conn.portal_id} · ` : ""}Connected {shortDate(conn.created_at)}
                      </p>
                    </div>
                    <Badge tone={conn.status === "connected" ? "emerald" : "amber"}>{conn.status}</Badge>
                    {canManage && <DisconnectButton id={conn.id} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section>
          <h3 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400">More integrations</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {OTHER_PROVIDERS.map((name) => (
              <div key={name} className="flex items-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-3">
                <CompanyMark name={name} size="md" className="opacity-70 grayscale" />
                <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-500">{name}</p>
                <Badge>Coming soon</Badge>
              </div>
            ))}
          </div>
        </section>
      </div>
    </SettingsFrame>
  );
}
