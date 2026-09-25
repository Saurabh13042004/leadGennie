import { redirect } from "next/navigation";
import { LinkBreak, PlugsConnected } from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import { requireRole } from "@/lib/auth/workspace-context";
import { connectParamsSchema, parseConnectParams } from "@/lib/domain/extension/auth-service";
import { linkedinAutomationEnabled } from "@/lib/feature-flags";
import { scopesForRole } from "@/lib/extension/scopes";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ConnectConsent from "@/components/extension/ConnectConsent";

export const metadata = { title: "Connect the extension | LeadGennie" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Where the browser extension sends you to sign in and approve a connection. Standalone (no dashboard shell): it opens
 * in a small window. The proxy already redirects signed-out visitors to /login and back here with the query intact;
 * the check below is defence in depth.
 */
export default async function ConnectExtensionPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const raw = { redirect_uri: first(sp.redirect_uri), state: first(sp.state), code_challenge: first(sp.code_challenge), device: first(sp.device) };
  let params;
  try {
    params = parseConnectParams(connectParamsSchema.parse(raw));
  } catch (e) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <Card className="w-full">
          <EmptyState
            compact
            icon={LinkBreak}
            title="This connection request can't be used"
            description={e instanceof Error && e.message ? e.message : "Open the LeadGennie extension and choose Connect again."}
          />
        </Card>
      </main>
    );
  }

  const { workspaceId, workspaceName, role } = await requireRole("viewer");
  void workspaceId;
  const scopes = scopesForRole(role, { automation: linkedinAutomationEnabled() });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-2.5 text-neutral-900">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white">
          <PlugsConnected className="h-4.5 w-4.5" weight="fill" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">LeadGennie</span>
      </div>
      <ConnectConsent
        params={params}
        user={{ name: session.user.name ?? "", email: session.user.email ?? "" }}
        workspaceName={workspaceName}
        role={role}
        scopes={scopes}
      />
    </main>
  );
}
