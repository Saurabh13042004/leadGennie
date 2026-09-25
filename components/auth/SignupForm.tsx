"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react/ssr";
import Button from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

export default function SignupForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, company }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Account created, but sign in failed. Please try logging in.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="auth-name">Full name</Label>
        <Input
          id="auth-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          className="h-10"
        />
      </div>
      <div>
        <Label htmlFor="auth-company">Company</Label>
        <Input
          id="auth-company"
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="LeadGennie Solutions"
          className="h-10"
        />
      </div>
      <div>
        <Label htmlFor="auth-email">Work email</Label>
        <Input
          id="auth-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="h-10"
        />
      </div>
      <div>
        <Label htmlFor="auth-password">Password</Label>
        <Input
          id="auth-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="h-10"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" weight="fill" />
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={loading}
        className="h-10 w-full"
      >
        {loading && (
          <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />
        )}
        Create account
      </Button>
    </form>
  );
}
