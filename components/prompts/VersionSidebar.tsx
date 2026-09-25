import type { ReactNode } from "react";
import { Check, Copy, PaperPlaneTilt, Prohibit, X } from "@phosphor-icons/react/ssr";
import type { PromptVersion } from "@/lib/actions/prompts";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Spinner, shortDate } from "@/components/settings/bits";
import { statusMeta } from "./meta";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="min-w-0 truncate text-right text-xs text-neutral-800">{children}</dd>
    </div>
  );
}

/** Version facts + lifecycle actions (approve / reject / deprecate / clone / submit). Pure view: handlers come from the editor. */
export default function VersionSidebar({
  version,
  canManage,
  canApprove,
  busy,
  onDecide,
  onDeprecate,
  onClone,
  onSubmit,
}: {
  version: PromptVersion;
  canManage: boolean;
  canApprove: boolean;
  busy: boolean;
  onDecide: (d: "approved" | "rejected") => void;
  onDeprecate: () => void;
  onClone: () => void;
  onSubmit: () => void;
}) {
  const s = statusMeta(version.status);
  const isDraft = version.status === "draft";
  const tested = version.lastTestPassed === null ? null : version.lastTestPassed;

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
        <h3 className="text-[13px] font-semibold text-neutral-900">Version {version.versionNumber}</h3>
        <Badge tone={s.tone} dot>{s.label}</Badge>
      </div>
      <dl className="divide-y divide-neutral-100 px-4 py-1.5">
        <Row label="Model"><span className="font-mono text-[11px]">{version.model}</span></Row>
        <Row label="Created">{shortDate(version.createdAt)}</Row>
        <Row label="Last test">
          {tested === null ? (
            <span className="text-neutral-400">Not run</span>
          ) : (
            <Badge tone={tested ? "emerald" : "rose"}>{tested ? "Passed" : "Failed"}</Badge>
          )}
        </Row>
        {version.publishedAt && <Row label="Published">{shortDate(version.publishedAt)}</Row>}
        {version.deprecatedAt && <Row label="Deprecated">{shortDate(version.deprecatedAt)}</Row>}
      </dl>

      <Actions>
        {version.status === "pending_approval" && canApprove && (
          <>
            <Button variant="primary" onClick={() => onDecide("approved")} disabled={busy} className="flex-1">
              <Check className="h-3.5 w-3.5" weight="bold" />
              Approve & publish
            </Button>
            <Button variant="danger" onClick={() => onDecide("rejected")} disabled={busy}>
              <X className="h-3.5 w-3.5" weight="bold" />
              Reject
            </Button>
          </>
        )}
        {version.status === "published" && canApprove && (
          <Button variant="danger" onClick={onDeprecate} disabled={busy} className="flex-1">
            <Prohibit className="h-3.5 w-3.5" weight="bold" />
            Deprecate
          </Button>
        )}
        {!isDraft && canManage && (
          <Button onClick={onClone} disabled={busy} className="flex-1">
            {busy ? <Spinner className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" weight="bold" />}
            Clone to edit
          </Button>
        )}
        {isDraft && canManage && (
          <Button variant="primary" onClick={onSubmit} disabled={busy || !version.lastTestPassed} className="flex-1">
            {busy ? <Spinner className="h-3.5 w-3.5" /> : <PaperPlaneTilt className="h-3.5 w-3.5" weight="bold" />}
            Submit for approval
          </Button>
        )}
      </Actions>
    </Card>
  );
}

/** Footer row that disappears when there's nothing the viewer can do. */
function Actions({ children }: { children: ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  if (items.length === 0) return null;
  return <div className="flex flex-wrap gap-2 rounded-b-xl border-t border-neutral-100 bg-neutral-50/60 px-4 py-3">{children}</div>;
}
