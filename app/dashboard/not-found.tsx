import Link from "next/link";
import { ArrowLeft, Compass, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import EmptyState from "@/components/ui/EmptyState";
import { Kbd } from "@/components/ui/Field";
import { buttonClasses } from "@/components/ui/Button";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="That page doesn't exist, or it isn't available in your workspace."
        actions={
          <>
            <Link href="/dashboard" className={buttonClasses({ variant: "primary" })}>
              <ArrowLeft className="h-3.5 w-3.5" weight="bold" />
              Back to Command Center
            </Link>
            <Link href="/dashboard/leads" className={buttonClasses({ variant: "secondary" })}>
              Go to Leads
            </Link>
          </>
        }
      >
        <p className="mt-6 flex items-center gap-1.5 text-[12px] text-neutral-400">
          <MagnifyingGlass className="h-3.5 w-3.5" weight="bold" />
          Looking for something? Press <Kbd>⌘</Kbd>
          <Kbd>K</Kbd> to search.
        </p>
      </EmptyState>
    </div>
  );
}
