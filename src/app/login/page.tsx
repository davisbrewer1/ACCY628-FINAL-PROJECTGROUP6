"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NexusLogo } from "@/components/brand/NexusLogo";
import { FormField } from "@/components/FormField";
import { ThemeSelector } from "@/components/ThemeSelector";
import { getDefaultDashboard, normalizeRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

const DEMO_ACCOUNTS = [
  { role: "Administrator", email: "admin@nexus.demo", password: "DemoPass123!" },
  { role: "Executive", email: "executive@nexus.demo", password: "DemoPass123!" },
  { role: "Service Manager", email: "manager@nexus.demo", password: "DemoPass123!" },
  { role: "Account Manager", email: "account@nexus.demo", password: "DemoPass123!" },
  { role: "Technician", email: "tech@nexus.demo", password: "DemoPass123!" },
  { role: "Billing", email: "billing@nexus.demo", password: "DemoPass123!" },
  { role: "Client Admin", email: "clientadmin@nexus.demo", password: "DemoPass123!" },
  { role: "Client User", email: "clientuser@nexus.demo", password: "DemoPass123!" },
];

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "That email or password did not match. Check the demo accounts below or try again."
          : authError.message,
      );
      setLoading(false);
      return;
    }

    await redirectByRole(supabase);
  }

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    await redirectByRole(supabase);
  }

  async function redirectByRole(supabase: ReturnType<typeof createClient>) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Account created. Please check your email to confirm, then log in.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = normalizeRole(profile?.role);
    router.push(getDefaultDashboard(role));
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-sky-600/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_45%)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-6 w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Nexus site
          </Link>
        </div>
        <div className="mb-8 max-w-md text-center text-white">
          <div className="mx-auto mb-4 flex justify-center">
            <NexusLogo size="lg" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Portal sign-in
          </h1>
          <p className="mt-3 text-base text-slate-200">
            Sign in to the Nexus technology operations platform.
          </p>
        </div>

        <div className="card w-full max-w-md border border-base-300/20 bg-base-100 shadow-2xl">
          <div className="card-body gap-4">
            <div role="tablist" className="tabs tabs-boxed bg-base-200">
              <button
                type="button"
                role="tab"
                className={`tab flex-1 ${tab === "login" ? "tab-active" : ""}`}
                onClick={() => {
                  setTab("login");
                  setError(null);
                }}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                className={`tab flex-1 ${tab === "signup" ? "tab-active" : ""}`}
                onClick={() => {
                  setTab("signup");
                  setError(null);
                }}
              >
                Sign up
              </button>
            </div>

            {error ? (
              <div className="alert alert-error text-sm">
                <span>{error}</span>
              </div>
            ) : null}

            {tab === "login" ? (
              <form onSubmit={handleLogin} className="form-grid grid gap-4">
                <FormField label="Email" htmlFor="login-email" required>
                  <input
                    id="login-email"
                    type="email"
                    className="input input-bordered w-full"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </FormField>
                <FormField label="Password" htmlFor="login-password" required>
                  <input
                    id="login-password"
                    type="password"
                    className="input input-bordered w-full"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </FormField>
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "Log in"
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="form-grid grid gap-4">
                <FormField label="Full name" htmlFor="signup-name" required>
                  <input
                    id="signup-name"
                    type="text"
                    className="input input-bordered w-full"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </FormField>
                <FormField label="Email" htmlFor="signup-email" required>
                  <input
                    id="signup-email"
                    type="email"
                    className="input input-bordered w-full"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </FormField>
                <FormField label="Password" htmlFor="signup-password" required>
                  <input
                    id="signup-password"
                    type="password"
                    className="input input-bordered w-full"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </FormField>
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "Create account"
                  )}
                </button>
              </form>
            )}

            <ThemeSelector />
          </div>
        </div>

        <footer className="relative z-10 mt-8 max-w-xl text-center text-sm text-slate-300">
          <p className="font-medium text-slate-200">Demo accounts (password: DemoPass123!)</p>
          <ul className="mt-2 space-y-1">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                {account.role}: {account.email}
              </li>
            ))}
          </ul>
        </footer>
      </div>
    </div>
  );
}
