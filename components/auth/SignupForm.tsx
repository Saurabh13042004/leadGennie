"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

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
        <label className="block text-sm text-neutral-300 mb-1.5">Full name</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
          placeholder="Jane Doe"
        />
      </div>
      <div>
        <label className="block text-sm text-neutral-300 mb-1.5">Company</label>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
          placeholder="Juntrax Solutions"
        />
      </div>
      <div>
        <label className="block text-sm text-neutral-300 mb-1.5">Work email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
          placeholder="you@company.com"
        />
      </div>
      <div>
        <label className="block text-sm text-neutral-300 mb-1.5">Password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
          placeholder="At least 8 characters"
        />
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-60"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Create account
      </button>
    </form>
  );
}
