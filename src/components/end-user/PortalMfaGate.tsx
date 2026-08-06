"use client";

import { useEffect, useState, useTransition } from "react";
import { FormField } from "@/components/FormField";
import { createClient } from "@/lib/supabase/client";

/**
 * If the signed-in user has MFA enrolled but this session is still aal1,
 * require a TOTP code before showing portal content.
 */
export function PortalMfaGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const supabase = createClient();
      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (cancelled) return;

      if (aalError) {
        setChecking(false);
        return;
      }

      if (aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        const factors = await supabase.auth.mfa.listFactors();
        const totp = factors.data?.totp?.[0];
        if (totp) {
          setFactorId(totp.id);
          setNeedsMfa(true);
        }
      }

      setChecking(false);
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        setError(challenge.error.message);
        return;
      }

      const verified = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });

      if (verified.error) {
        setError(verified.error.message);
        return;
      }

      setNeedsMfa(false);
      setCode("");
    });
  }

  if (checking) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (needsMfa) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-4">
        <div className="card border border-primary/30 bg-base-100 shadow-lg">
          <div className="card-body gap-4">
            <h1 className="card-title text-lg">Verify your identity</h1>
            <p className="text-sm text-base-content/70">
              Multi-factor authentication is enabled on your account. Enter the 6-digit code from
              your authenticator app to continue to the portal.
            </p>
            <form className="space-y-3" onSubmit={handleVerify}>
              <FormField label="Authentication code" htmlFor="portal-mfa-code" required>
                <input
                  id="portal-mfa-code"
                  className="input input-bordered w-full tracking-[0.3em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  required
                />
              </FormField>
              {error ? <p className="text-sm text-error">{error}</p> : null}
              <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
                {isPending ? "Verifying..." : "Continue"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
