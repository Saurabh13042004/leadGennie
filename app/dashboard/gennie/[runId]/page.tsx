import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { AppError } from "@/lib/api";
import { getGennieRunAction } from "@/lib/actions/gennie";
import RunView from "@/components/gennie/RunView";

export const metadata = {
  title: "Gennie | LeadGennie",
};

export default async function GennieRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const id = Number(runId);
  if (!Number.isInteger(id) || id < 1) notFound();

  const [session, res] = await Promise.all([auth(), getGennieRunAction(id)]);
  if (!res.ok) {
    if (res.error.code === "NOT_FOUND") notFound();
    throw new AppError(res.error.code, res.error.message);
  }
  const canControl = session?.user?.role !== "viewer";
  return <RunView initial={res.data} canControl={canControl} />;
}
