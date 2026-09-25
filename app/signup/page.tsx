import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import SignupForm from "@/components/auth/SignupForm";

export const metadata = {
  title: "Create account | LeadGennie",
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Start automating your sales engagement with LeadGennie"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-neutral-900 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm initialEmail={typeof email === "string" && email.length <= 254 ? email : ""} />
    </AuthShell>
  );
}
