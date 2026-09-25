import { redirect } from "next/navigation";
import { LinkBreak } from "@phosphor-icons/react/ssr";

import { auth } from "@/auth";
import { requireRole } from "@/lib/auth/workspace-context";
import {
  connectParamsSchema,
  parseConnectParams,
} from "@/lib/domain/extension/auth-service";
import { linkedinAutomationEnabled } from "@/lib/feature-flags";
import { scopesForRole } from "@/lib/extension/scopes";

import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ConnectConsent from "@/components/extension/ConnectConsent";

export const metadata = {
  title: "Connect the extension | LeadGennie",
};

export const dynamic = "force-dynamic";

type SearchParams = Record<
  string,
  string | string[] | undefined
>;

const first = (
  value: string | string[] | undefined
): string | undefined => {
  return Array.isArray(value) ? value[0] : value;
};

/**
 * Where the browser extension sends the user to sign in
 * and approve a connection.
 */
export default async function ConnectExtensionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const raw = {
    redirect_uri: first(sp.redirect_uri),
    state: first(sp.state),
    code_challenge: first(sp.code_challenge),
    device: first(sp.device),
  };

  let params;

  try {
    params = parseConnectParams(
      connectParamsSchema.parse(raw)
    );
  } catch (e) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <Card className="w-full">
          <EmptyState
            compact
            icon={LinkBreak}
            title="This connection request can't be used"
            description={
              e instanceof Error && e.message
                ? e.message
                : "Open the LeadGennie extension and choose Connect again."
            }
          />
        </Card>
      </main>
    );
  }

  /*
   * Everything below this point runs on the SERVER.
   *
   * requireRole() may access workspace/database information.
   */
  const {
    workspaceId,
    workspaceName,
    role,
  } = await requireRole("viewer");

  const scopes = scopesForRole(role, {
    automation: linkedinAutomationEnabled(),
  });

  /*
   * workspaceId isn't currently needed by the UI.
   * Keep it available here if your connection action needs it later.
   */
  void workspaceId;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-2.5 text-neutral-900">
        {/* The same brand mark as the dashboard's workspace menu. */}
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-b from-neutral-800 to-neutral-950 shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]">
          <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z" />
          </svg>
        </span>

        <span className="text-[15px] font-semibold tracking-tight">
          LeadGennie
        </span>
      </div>

      <ConnectConsent
        params={params}
        user={{
          name: session.user.name ?? "",
          email: session.user.email ?? "",
        }}
        workspaceName={workspaceName}
        role={role}
        scopes={scopes}
      />
    </main>
  );
}