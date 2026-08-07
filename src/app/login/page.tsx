"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NexusLogo } from "@/components/brand/NexusLogo";
import { FormField } from "@/components/FormField";
import { getDefaultDashboard, normalizeRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

const DEMO_PASSWORD = "DemoPass123!";

const DEMO_ACCOUNTS = [
  { role: "Manager", email: "manager@nexus.demo" },
  { role: "Client", email: "clientuser@nexus.demo" },
] as const;

/** Individual technician demo logins (switchable on this page). */
const DEMO_TECHNICIANS = [
  { name: "Terry Tech", email: "tech@nexus.demo" },
  { name: "Jamie Network", email: "tech2@serviceflow.demo" },
  { name: "Chris Cloud", email: "tech3@serviceflow.demo" },
  { name: "Dana Desktop", email: "tech4@serviceflow.demo" },
  { name: "Evan Endpoint", email: "tech5@serviceflow.demo" },
  { name: "Fran Firewall", email: "tech6@serviceflow.demo" },
  { name: "Kai Cipher", email: "kai@nexus.demo" },
  { name: "Quinn Volt", email: "quinn@nexus.demo" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoadingEmail, setDemoLoadingEmail] = useState<string | null>(null);
  const [selectedTechEmail, setSelectedTechEmail] = useState<string>(
    DEMO_TECHNICIANS[0].email,
  );
  const [error, setError] = useState<string | null>(null);

  const selectedTech = useMemo(
    () =>
      DEMO_TECHNICIANS.find((tech) => tech.email === selectedTechEmail) ??
      DEMO_TECHNICIANS[0],
    [selectedTechEmail],
  );

  async function signInWithDemo(emailValue: string) {
    setError(null);
    setDemoLoadingEmail(emailValue);
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email && user.email.toLowerCase() !== emailValue.toLowerCase()) {
      await supabase.auth.signOut();
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: emailValue.trim(),
      password: DEMO_PASSWORD,
    });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "That demo account could not sign in. Confirm the account exists and password is DemoPass123!."
          : authError.message,
      );
      setDemoLoadingEmail(null);
      setLoading(false);
      return;
    }

    setEmail(emailValue);
    setPassword(DEMO_PASSWORD);
    await redirectByRole(supabase);
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const loginEmail = email.trim();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "That email or password did not match. Use a demo account below or try again."
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
      setDemoLoadingEmail(null);
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
    <div className="relative flex min-h-screen flex-col bg-[#0B1220]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/brand/nexus-hero-bg.png')" }}
        />
        <div className="absolute inset-0 bg-[#0B1220]/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B1220]/40 via-transparent to-[#0B1220]/70" />
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
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
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
                  {loading && !demoLoadingEmail ? (
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
          </div>
        </div>

        <footer className="relative z-10 mt-8 w-full max-w-md text-sm text-slate-300">
          <p className="text-center font-medium text-slate-200">
            Demo accounts (password: {DEMO_PASSWORD})
          </p>
          <p className="mt-1 text-center text-xs text-slate-400">
            Click a role to sign in instantly. For technicians, pick who you want
            first.
          </p>

          <div className="mt-4 rounded-xl border border-cyan-400/30 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/90">
              Technician accounts
            </p>
            <label className="mt-3 flex flex-col gap-1.5">
              <span className="text-xs text-slate-400">Switch technician</span>
              <select
                className="select select-bordered w-full border-cyan-500/40 bg-slate-900 text-slate-100"
                value={selectedTechEmail}
                onChange={(event) => setSelectedTechEmail(event.target.value)}
                disabled={loading}
                aria-label="Choose technician demo account"
              >
                {DEMO_TECHNICIANS.map((tech) => (
                  <option key={tech.email} value={tech.email}>
                    {tech.name} · {tech.email}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary btn-sm mt-3 w-full border-0"
              disabled={loading}
              onClick={() => void signInWithDemo(selectedTech.email)}
            >
              {demoLoadingEmail === selectedTech.email ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                `Sign in as ${selectedTech.name}`
              )}
            </button>
          </div>

          <ul className="mt-4 space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left transition hover:border-cyan-400/40 hover:bg-white/10 disabled:opacity-60"
                  disabled={loading}
                  onClick={() => void signInWithDemo(account.email)}
                >
                  <span>
                    <span className="block font-medium text-slate-100">
                      {account.role}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      {account.email}
                    </span>
                  </span>
                  {demoLoadingEmail === account.email ? (
                    <span className="loading loading-spinner loading-sm text-cyan-300" />
                  ) : (
                    <span className="text-xs font-semibold text-cyan-300">
                      Sign in
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </footer>
      </div>
    </div>
  );
}
