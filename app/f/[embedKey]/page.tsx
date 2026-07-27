import { notFound } from "next/navigation";
import { getPublicForm } from "@/lib/forms-core";
import HostedFormClient from "@/components/public-form/HostedFormClient";

export default async function HostedFormPage({ params }: { params: Promise<{ embedKey: string }> }) {
  const { embedKey } = await params;
  const form = await getPublicForm(embedKey);
  if (!form) notFound();

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0A0A0A] p-6">
        <HostedFormClient embedKey={embedKey} form={form} />
      </div>
    </div>
  );
}
