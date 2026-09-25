import { LockKey } from "@phosphor-icons/react/ssr";
import Card from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { PROVIDER_MARK } from "./status";

const OPTIONS = [
  { key: "gmail", slug: "google", name: "Google", detail: "Gmail / Google Workspace", cta: "Connect Google" },
  { key: "microsoft", slug: "microsoft", name: "Microsoft", detail: "Outlook / Microsoft 365", cta: "Connect Microsoft" },
] as const;

/**
 * "Choose your provider". Plain links to the connect route (a full-page redirect to the provider, not a fetch), so this needs no
 * client JavaScript. A provider the server has no credentials for says so instead of leading the user into an error.
 */
export default function ConnectMailboxCards({ availability, canConnect }: { availability: { gmail: boolean; microsoft: boolean }; canConnect: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((o) => {
        const ready = availability[o.key];
        const mark = PROVIDER_MARK[o.key];
        return (
          <Card key={o.key} className="flex items-center gap-3.5 p-4">
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold ring-1 ring-inset", mark.cls)}>{mark.letter}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-neutral-900">{o.name}</p>
              <p className="text-xs text-neutral-500">{o.detail}</p>
              {!ready && <p className="mt-1 text-xs text-amber-700">Not set up on this server yet — see docs/mailboxes.md.</p>}
            </div>
            {canConnect && ready ? (
              <a href={`/api/mailboxes/${o.slug}/connect`} className={buttonClasses({ variant: "primary" })}>{o.cta}</a>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                <LockKey className="h-3.5 w-3.5 text-neutral-400" weight="duotone" /> {canConnect ? "Unavailable" : "Admin or owner required"}
              </span>
            )}
          </Card>
        );
      })}
    </div>
  );
}
