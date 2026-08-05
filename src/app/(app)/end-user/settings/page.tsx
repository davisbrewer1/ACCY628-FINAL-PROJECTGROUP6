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
import { PageHeader } from "@/components/PageHeader";
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
    const verified = factorsResult.data?.totp ?? [];
    const all = [
      ...(factorsResult.data?.totp ?? []),
      ...(factorsResult.data?.phone ?? []),
    ] as MfaFactor[];
    setFactors(all.length > 0 ? all : (verified as MfaFactor[]));
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
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (enrollError) {
        setError(enrollError.message);
        return;
      }
      setMfaFactorId(data.id);
      setMfaQr(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      showToast("Scan the QR code, then enter the 6-digit code to finish MFA setup.");
    });
  }

  async function verifyMfaEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfaFactorId) return;
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
        code: mfaCode.trim(),
      });
      if (verified.error) {
        setError(verified.error.message);
        return;
      }
      setMfaQr(null);
      setMfaSecret(null);
      setMfaFactorId(null);
      setMfaCode("");
      showToast("MFA enabled successfully.");
      await loadData();
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
      <PageHeader
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

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h2 className="card-title text-base">Multi-factor authentication (MFA)</h2>
          <p className="text-sm text-base-content/70">
            Protect your account with an authenticator app. Enrollment requires a valid 6-digit code.
          </p>

          {factors.length > 0 ? (
            <div className="space-y-2">
              {factors.map((factor) => (
                <div
                  key={factor.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-box border border-base-300 p-3"
                >
                  <div>
                    <p className="font-medium">
                      {factor.friendly_name || factor.factor_type.toUpperCase()}
                    </p>
                    <p className="text-xs text-base-content/60">Status: {factor.status}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={isPending}
                    onClick={() => removeMfaFactor(factor.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="MFA not enabled"
              description="Add an authenticator app to require a second step at sign-in."
            />
          )}

          {!mfaQr ? (
            <button
              type="button"
              className="btn btn-primary btn-sm w-fit"
              disabled={isPending}
              onClick={() => void startMfaEnrollment()}
            >
              Enable MFA
            </button>
          ) : (
            <div className="space-y-3 rounded-box border border-base-300 p-4">
              <p className="text-sm">Scan this QR code in your authenticator app:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mfaQr} alt="MFA QR code" className="max-w-xs rounded-box border bg-white p-2" />
              {mfaSecret ? (
                <p className="font-mono text-xs break-all text-base-content/70">
                  Secret: {mfaSecret}
                </p>
              ) : null}
              <form className="flex flex-wrap items-end gap-3" onSubmit={verifyMfaEnrollment}>
                <FormField label="Verification code" htmlFor="mfa_code" required>
                  <input
                    id="mfa_code"
                    className="input input-bordered w-40"
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value)}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    required
                  />
                </FormField>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  Verify & enable
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setMfaQr(null);
                    setMfaSecret(null);
                    setMfaFactorId(null);
                    setMfaCode("");
                  }}
                >
                  Cancel
                </button>
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
            <EmptyState
              title="No additional contacts"
              description="Add someone who can be reached about your support requests."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Relationship</th>
                    <th>Preferred</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id}>
                      <td className="font-medium">{contact.full_name}</td>
                      <td>{contact.email ?? "—"}</td>
                      <td>{contact.phone ?? "—"}</td>
                      <td>{contact.relationship ?? "—"}</td>
                      <td>{contact.preferred_contact ? "Yes" : "No"}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-error"
                          disabled={isPending}
                          onClick={() =>
                            runAction(() => deleteClientContact(contact.id))
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
