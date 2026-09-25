import { redirect } from "next/navigation";
import { Geist } from "next/font/google";
import { auth } from "@/auth";
import DashboardShell from "@/components/dashboard/DashboardShell";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className={`${geist.variable} ${geist.className} contents`}>
      <DashboardShell user={session.user}>{children}</DashboardShell>
    </div>
  );
}
