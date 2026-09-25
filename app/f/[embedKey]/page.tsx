import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkle } from "@phosphor-icons/react/ssr";
import { getPublicForm } from "@/lib/forms-core";
import HostedFormClient from "@/components/public-form/HostedFormClient";

export default async function HostedFormPage({ params }: { params: Promise<{ embedKey: string }> }) {
  const { embedKey } = await params;
  const form = await getPublicForm(embedKey);
  if (!form) notFound();

  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center bg-[#f7f7f6] px-4 py-10 sm:py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black,transparent)]"
      />
      <main className="w-full max-w-md">
        <div className="rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_-24px_rgba(0,0,0,0.18)]">
          <HostedFormClient embedKey={embedKey} form={form} />
        </div>
        <Link href="/" className="group mx-auto mt-6 flex w-fit items-center gap-1.5 text-xs text-neutral-500 transition-colors hover:text-neutral-800">
          Powered by
          <span className="flex h-4 w-4 items-center justify-center rounded bg-neutral-900 text-white">
            <Sparkle className="h-2.5 w-2.5" weight="fill" />
          </span>
          <span className="font-semibold text-neutral-800">LeadGennie</span>
        </Link>
      </main>
    </div>
  );
}
