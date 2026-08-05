"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, LogIn, LogOut, LayoutDashboard } from "lucide-react";
import {
  getDefaultDashboard,
  normalizeRole,
} from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";

const DEMO_PASSWORD = "DemoPass123!";

const PORTAL_ROLES = [
  {
    label: "Manager",
    description: "Service delivery console",
    email: "manager@nexus.demo",
    href: "/operations",
  },
  {
    label: "Technician",
    description: "Assigned work & time entry",
    email: "tech@nexus.demo",
    href: "/technician",
  },
  {
    label: "Client User",
    description: "Submit tickets & concerns",
    email: "clientuser@nexus.demo",
    href: "/end-user",
  },
] as const;

export function PortalLoginMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<{
    email: string | null;
    role: UserRole;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function loadSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSignedIn(null);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, email")
        .eq("id", user.id)
        .maybeSingle();

      setSignedIn({
        email: profile?.email ?? user.email ?? null,
        role: normalizeRole(profile?.role),
      });
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadSession();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loginAs(email: string, href: string) {
    setError(null);
    setLoadingEmail(email);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: DEMO_PASSWORD,
    });

    if (authError) {
      setError(authError.message);
      setLoadingEmail(null);
      return;
    }

    setOpen(false);
    setLoadingEmail(null);
    router.push(href);
    router.refresh();
  }

  async function handleLogout() {
    setLoadingEmail("logout");
    const supabase = createClient();
    await supabase.auth.signOut();
    setSignedIn(null);
    setOpen(false);
    setLoadingEmail(null);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="btn btn-sm gap-1 border-base-300 bg-base-100/90 shadow-sm backdrop-blur"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <LogIn className="size-4" aria-hidden="true" />
        Portal
        <ChevronDown className="size-3.5 opacity-70" aria-hidden="true" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close portal menu"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-72 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl"
          >
            {error ? (
              <div className="alert alert-error mb-2 py-2 text-xs">
                <span>{error}</span>
              </div>
            ) : null}

            {signedIn ? (
              <div className="space-y-1 p-1">
                <p className="px-2 py-1 text-xs text-base-content/60">
                  Signed in as {signedIn.email}
                </p>
                <button
                  type="button"
                  role="menuitem"
                  className="btn btn-ghost btn-sm w-full justify-start gap-2"
                  onClick={() => {
                    setOpen(false);
                    router.push(getDefaultDashboard(signedIn.role));
                  }}
                >
                  <LayoutDashboard className="size-4" aria-hidden="true" />
                  Open console
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="btn btn-ghost btn-sm w-full justify-start gap-2"
                  disabled={loadingEmail === "logout"}
                  onClick={handleLogout}
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  {loadingEmail === "logout" ? "Signing out…" : "Log out"}
                </button>
              </div>
            ) : (
              <div className="space-y-1 p-1">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-base-content/50">
                  Demo portal login
                </p>
                {PORTAL_ROLES.map((role) => (
                  <button
                    key={role.email}
                    type="button"
                    role="menuitem"
                    className="btn btn-ghost btn-sm h-auto w-full flex-col items-start gap-0 py-2"
                    disabled={loadingEmail !== null}
                    onClick={() => loginAs(role.email, role.href)}
                  >
                    <span className="font-semibold">
                      {loadingEmail === role.email ? "Signing in…" : role.label}
                    </span>
                    <span className="text-xs font-normal text-base-content/60">
                      {role.description}
                    </span>
                  </button>
                ))}
                <div className="divider my-1" />
                <Link
                  href="/login"
                  role="menuitem"
                  className="btn btn-ghost btn-sm w-full justify-start"
                  onClick={() => setOpen(false)}
                >
                  Email / password login
                </Link>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
