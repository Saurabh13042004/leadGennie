import { Suspense } from "react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = {
  title: "Sign in | LeadGennie",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your LeadGennie workspace"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-white hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
