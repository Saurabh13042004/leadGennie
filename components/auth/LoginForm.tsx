"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CircleNotch, WarningCircle } from "@phosphor-icons/react/ssr";
import Button from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only ever return to a path on this site — never an absolute or protocol-relative URL (open-redirect guard).
  const requested = searchParams.get("callbackUrl") || "";
  const callbackUrl = requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\") ? requested : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="auth-email">Email</Label>
        <Input
          id="auth-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="h-10"
          autoComplete="email"
        />
      </div>
      <div>
        <Label htmlFor="auth-password">Password</Label>
        <Input
          id="auth-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
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
        Sign in
      </Button>
    </form>
  );
}
