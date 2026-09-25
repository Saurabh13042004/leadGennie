import Link from "next/link";
import { CaretRight, Robot, SealCheck } from "@phosphor-icons/react/ssr";
import type { PromptSummary } from "@/lib/actions/prompts";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { IconTile, shortDate } from "@/components/settings/bits";
import NewPromptButton from "./NewPromptButton";
import { statusMeta, typeIcon, typeLabel } from "./meta";

const COLS = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 md:grid-cols-[minmax(0,1fr)_120px_190px_110px_16px]";

export default function PromptsListView({ prompts, canCreate }: { prompts: PromptSummary[]; canCreate: boolean }) {
  if (prompts.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Robot}
          title="No prompts yet"
          description="Build a reusable, versioned prompt — draft it, test it against the model, then submit for approval before it can be published."
          actions={canCreate && <NewPromptButton />}
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className={`${COLS} border-b border-neutral-200/80 bg-neutral-50/60 px-4 py-2 text-xs font-medium text-neutral-500 md:px-5`}>
        <span>Prompt</span>
        <span className="hidden md:block">Live version</span>
        <span className="hidden md:block">Latest version</span>
        <span className="hidden md:block">Created</span>
        <span />
      </div>
      <ul className="divide-y divide-neutral-100">
        {prompts.map((p) => {
          const latest = p.latestStatus ? statusMeta(p.latestStatus) : null;
          return (
            <li key={p.id}>
              <Link href={`/dashboard/ai-prompts/${p.id}`} className={`group ${COLS} px-4 py-3 transition-colors hover:bg-neutral-50/70 md:px-5`}>
                <span className="flex min-w-0 items-center gap-3">
                  <IconTile icon={typeIcon(p.type)} className="group-hover:text-indigo-600" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-neutral-900">{p.name}</span>
                    <span className="block truncate text-xs text-neutral-500">
                      {typeLabel(p.type)}
                      {p.channel ? ` · ${p.channel}` : ""}
                    </span>
                  </span>
                </span>
                <span className="hidden md:block">
                  {p.publishedVersion ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <SealCheck className="h-3.5 w-3.5" weight="fill" />v{p.publishedVersion}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400">Not published</span>
                  )}
                </span>
                <span className="hidden md:block">
                  {latest && (
                    <Badge tone={latest.tone} dot>
                      v{p.latestVersion} · {latest.label}
                    </Badge>
                  )}
                </span>
                <span className="hidden text-xs text-neutral-500 md:block">{shortDate(p.createdAt)}</span>
                <CaretRight className="h-3.5 w-3.5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" weight="bold" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
