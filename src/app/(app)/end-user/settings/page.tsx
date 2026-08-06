"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import {
  addClientContact,
  deleteClientContact,
  updateCommunicationPreferences,
  updateNotificationPreferences,
  updateProfileContact,
} from "@/app/actions/profile-settings";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PortalPageHeader } from "@/components/end-user/PortalPageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import type {
  ClientContact,
  CommunicationPreferences,
  NotificationPreferences,
  Profile,
} from "@/lib/types";

type MfaFactor = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
};

function toQrImageSrc(qrCode: string): string {
  if (!qrCode) return "";
  if (qrCode.startsWith("data:")) return qrCode;
  if (qrCode.includes("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`;
  }
  return qrCode;
}

async function cleanupUnverifiedFactors(
  supabase: ReturnType<typeof createClient>,
) {
  const listed = await supabase.auth.mfa.listFactors();
  const all = (listed.data?.all ?? []) as MfaFactor[];
  for (const factor of all) {
    if (factor.status !== "verified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }
}

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  ticket_updates: true,
  security_alerts: true,
  billing_notices: true,
  announcements: true,
  email_enabled: true,
  sms_enabled: false,
};

const DEFAULT_COMMUNICATION: CommunicationPreferences = {
  preferred_channel: "email",
  best_time: "Business hours",
  language: "English",
  marketing_opt_in: false,
};

export default function EndUserSettingsPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaUri, setMfaUri] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirm: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const notificationPrefs = useMemo(() => {
    return {
      ...DEFAULT_NOTIFICATIONS,
      ...(profile?.notification_preferences as NotificationPreferences | null),
    };
  }, [profile]);

  const communicationPrefs = useMemo(() => {
    return {
      ...DEFAULT_COMMUNICATION,
      ...(profile?.communication_preferences as CommunicationPreferences | null),
    };
  }, [profile]);

  async function loadData() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const [{ data: profileData }, { data: contactData }, factorsResult] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("client_contacts")
          .select("*")
          .eq("profile_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.auth.mfa.listFactors(),
      ]);

    setProfile(profileData);
    setContacts(contactData ?? []);
    if (factorsResult.error) {
      console.warn("MFA listFactors:", factorsResult.error.message);
    }
    const listed = [
      ...((factorsResult.data?.totp ?? []) as MfaFactor[]),
      ...((factorsResult.data?.phone ?? []) as MfaFactor[]),
      ...(((factorsResult.data?.all ?? []) as MfaFactor[]).filter(
        (factor) => factor.status === "verified",
      )),
    ];
    const unique = new Map(listed.map((factor) => [factor.id, factor]));
    setFactors([...unique.values()]);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  function runAction(
    action: () => Promise<{ success: boolean; message: string }>,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        showToast(result.message);
        await loadData();
      } else {
        setError(result.message);
      }
    });
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (passwordForm.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setError("Password confirmation does not match.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.password,
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setPasswordForm({ password: "", confirm: "" });
      showToast("Password updated successfully.");
    });
  }

  async function startMfaEnrollment() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();

      // Remove abandoned unverified enrollments so a fresh QR can be created.
      await cleanupUnverifiedFactors(supabase);

      const friendlyName = `Authenticator ${new Date().toLocaleString()}`;
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });
      if (enrollError) {
        setError(enrollError.message);
        return;
      }
      if (!data?.totp) {
        setError("Could not start MFA enrollment. Try again.");
        return;
      }

      setMfaFactorId(data.id);
      setMfaQr(toQrImageSrc(data.totp.qr_code));
      setMfaSecret(data.totp.secret);
      setMfaUri(data.totp.uri ?? null);
      setMfaCode("");
      showToast("Scan the QR code, then enter the 6-digit code to finish MFA setup.");
    });
  }

  async function verifyMfaEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfaFactorId) return;
    const code = mfaCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challenge.error) {
        setError(challenge.error.message);
        return;
      }
      const verified = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verified.error) {
        setError(verified.error.message);
        return;
      }
      setMfaQr(null);
      setMfaSecret(null);
      setMfaUri(null);
      setMfaFactorId(null);
      setMfaCode("");
      showToast("MFA enabled successfully. You’ll be asked for a code when entering the portal.");
      await loadData();
    });
  }

  async function cancelMfaEnrollment() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      if (mfaFactorId) {
        await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      }
      await cleanupUnverifiedFactors(supabase);
      setMfaQr(null);
      setMfaSecret(null);
      setMfaUri(null);
      setMfaFactorId(null);
      setMfaCode("");
    });
  }

  async function removeMfaFactor(factorId: string) {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      });
      if (unenrollError) {
        setError(unenrollError.message);
        return;
      }
      showToast("MFA factor removed.");
      await loadData();
    });
  }

  if (activeRole !== "client_user" && activeRole !== "administrator") {
    return (
      <AlertBanner
        tone="info"
        title="Profile & settings"
        message="This page is designed for client end users. Use the Demo Role Switcher to preview this view."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="Sign in again to manage your profile and settings."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Profile & settings"
        description="Update your contact details, security settings, notifications, and communication preferences."
      />

      {error ? (
        <div className="alert alert-error text-sm">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h2 className="card-title text-base">Contact information</h2>
          <form
            className="grid gap-4 sm:grid-cols-2"
            action={(formData) => runAction(() => updateProfileContact(formData))}
          >
            <FormField label="Full name" htmlFor="full_name" required>
              <input
                id="full_name"
                name="full_name"
                className="input input-bordered w-full"
                defaultValue={profile.full_name ?? ""}
                required
              />
            </FormField>
            <FormField label="Email" htmlFor="email" required>
              <input
                id="email"
                name="email"
                type="email"
                className="input input-bordered w-full"
                defaultValue={profile.email ?? ""}
                required
              />
            </FormField>
            <FormField label="Phone" htmlFor="phone">
              <input
                id="phone"
                name="phone"
                type="tel"
                className="input input-bordered w-full"
                defaultValue={profile.phone ?? ""}
                placeholder="(555) 555-5555"
              />
            </FormField>
            <div className="flex items-end">
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                Save contact info
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h2 className="card-title text-base">Change password</h2>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handlePasswordChange}>
            <FormField label="New password" htmlFor="password" required>
              <input
                id="password"
                type="password"
                className="input input-bordered w-full"
                value={passwordForm.password}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, password: event.target.value }))
                }
                minLength={8}
                required
              />
            </FormField>
            <FormField label="Confirm password" htmlFor="confirm" required>
              <input
                id="confirm"
                type="password"
                className="input input-bordered w-full"
                value={passwordForm.confirm}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, confirm: event.target.value }))
                }
                minLength={8}
                required
              />
            </FormField>
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                Update password
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card border border-primary/20 bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h2 className="card-title text-base">Multi-factor authentication (MFA)</h2>
          <p className="text-sm leading-relaxed text-base-content/70">
            Add an authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.).
            After setup, the portal will ask for a 6-digit code whenever your session needs a second
            factor.
          </p>

          {factors.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {factors.map((factor) => (
                <div
                  key={factor.id}
                  className="rounded-box border border-success/30 bg-success/5 p-4"
                >
                  <p className="font-medium">
                    {factor.friendly_name || factor.factor_type.toUpperCase()}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-success">
                    {factor.status}
                  </p>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm mt-3"
                    disabled={isPending}
                    onClick={() => removeMfaFactor(factor.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-box border border-dashed border-base-300 bg-base-200/40 p-4 text-sm text-base-content/70">
              MFA is not enabled yet. Enable it below to protect your account.
            </div>
          )}

          {!mfaQr ? (
            <button
              type="button"
              className="btn btn-primary w-fit"
              disabled={isPending}
              onClick={() => void startMfaEnrollment()}
            >
              {factors.length > 0 ? "Add another authenticator" : "Enable MFA"}
            </button>
          ) : (
            <div className="space-y-4 rounded-box border border-primary/30 bg-primary/5 p-4">
              <div>
                <p className="font-medium">1. Scan this QR code</p>
                <p className="text-sm text-base-content/70">
                  Open your authenticator app and scan the code, or enter the secret manually.
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mfaQr}
                alt="MFA QR code"
                className="mx-auto max-w-[220px] rounded-box border bg-white p-3"
              />
              {mfaSecret ? (
                <div className="rounded-box border border-base-300 bg-base-100 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                    Manual setup secret
                  </p>
                  <p className="mt-1 break-all font-mono text-sm">{mfaSecret}</p>
                  {mfaUri ? (
                    <p className="mt-2 break-all font-mono text-[11px] text-base-content/55">
                      {mfaUri}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <form className="space-y-3" onSubmit={verifyMfaEnrollment}>
                <p className="font-medium">2. Enter the 6-digit code</p>
                <FormField label="Verification code" htmlFor="mfa_code" required>
                  <input
                    id="mfa_code"
                    className="input input-bordered w-full max-w-xs tracking-[0.35em]"
                    value={mfaCode}
                    onChange={(event) =>
                      setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    required
                  />
                </FormField>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="btn btn-primary" disabled={isPending}>
                    Verify & enable
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={isPending}
                    onClick={() => void cancelMfaEnrollment()}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h2 className="card-title text-base">Notification preferences</h2>
          <form
            className="grid gap-3 sm:grid-cols-2"
            action={(formData) =>
              runAction(() => updateNotificationPreferences(formData))
            }
          >
            {(
              [
                ["ticket_updates", "Ticket status updates"],
                ["security_alerts", "Security alerts"],
                ["billing_notices", "Billing notices"],
                ["announcements", "Company announcements"],
                ["email_enabled", "Email notifications"],
                ["sms_enabled", "SMS notifications"],
              ] as const
            ).map(([name, label]) => (
              <label key={name} className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  name={name}
                  className="checkbox checkbox-primary"
                  defaultChecked={Boolean(notificationPrefs[name])}
                />
                <span className="label-text">{label}</span>
              </label>
            ))}
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                Save notification preferences
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h2 className="card-title text-base">Communication preferences</h2>
          <form
            className="grid gap-4 sm:grid-cols-2"
            action={(formData) =>
              runAction(() => updateCommunicationPreferences(formData))
            }
          >
            <FormField label="Preferred channel" htmlFor="preferred_channel">
              <select
                id="preferred_channel"
                name="preferred_channel"
                className="select select-bordered w-full"
                defaultValue={communicationPrefs.preferred_channel ?? "email"}
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="sms">SMS</option>
              </select>
            </FormField>
            <FormField label="Best time to reach you" htmlFor="best_time">
              <input
                id="best_time"
                name="best_time"
                className="input input-bordered w-full"
                defaultValue={communicationPrefs.best_time ?? ""}
                placeholder="Business hours, mornings, etc."
              />
            </FormField>
            <FormField label="Language" htmlFor="language">
              <input
                id="language"
                name="language"
                className="input input-bordered w-full"
                defaultValue={communicationPrefs.language ?? "English"}
              />
            </FormField>
            <label className="label cursor-pointer justify-start gap-3 self-end">
              <input
                type="checkbox"
                name="marketing_opt_in"
                className="checkbox checkbox-primary"
                defaultChecked={Boolean(communicationPrefs.marketing_opt_in)}
              />
              <span className="label-text">Receive product and service updates</span>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                Save communication preferences
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h2 className="card-title text-base">Additional contacts</h2>
          <p className="text-sm text-base-content/70">
            Add backup contacts for your organization (manager, alternate requester, etc.).
          </p>

          {contacts.length === 0 ? (
            <div className="rounded-box border border-dashed border-base-300 bg-base-200/40 p-4 text-sm text-base-content/70">
              No additional contacts yet. Add a backup person below.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="rounded-box border border-base-300 bg-base-200/20 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{contact.full_name}</p>
                      <p className="text-sm text-base-content/65">
                        {contact.relationship ?? "Contact"}
                        {contact.preferred_contact ? " · Preferred" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      disabled={isPending}
                      onClick={() => runAction(() => deleteClientContact(contact.id))}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-base-content/80">
                    <p>{contact.email ?? "No email"}</p>
                    <p>{contact.phone ?? "No phone"}</p>
                    {contact.notes ? (
                      <p className="text-base-content/60">{contact.notes}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          <form
            className="grid gap-4 border-t border-base-300 pt-4 sm:grid-cols-2"
            action={(formData) => runAction(() => addClientContact(formData))}
          >
            <FormField label="Contact name" htmlFor="contact_full_name" required>
              <input
                id="contact_full_name"
                name="full_name"
                className="input input-bordered w-full"
                required
              />
            </FormField>
            <FormField label="Relationship" htmlFor="relationship">
              <input
                id="relationship"
                name="relationship"
                className="input input-bordered w-full"
                placeholder="Manager, backup requester..."
              />
            </FormField>
            <FormField label="Email" htmlFor="contact_email">
              <input
                id="contact_email"
                name="email"
                type="email"
                className="input input-bordered w-full"
              />
            </FormField>
            <FormField label="Phone" htmlFor="contact_phone">
              <input
                id="contact_phone"
                name="phone"
                type="tel"
                className="input input-bordered w-full"
              />
            </FormField>
            <FormField label="Notes" htmlFor="notes">
              <input id="notes" name="notes" className="input input-bordered w-full" />
            </FormField>
            <label className="label cursor-pointer justify-start gap-3 self-end">
              <input type="checkbox" name="preferred_contact" className="checkbox checkbox-primary" />
              <span className="label-text">Preferred contact</span>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                Add contact
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
