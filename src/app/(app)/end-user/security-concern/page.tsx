"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createPortalTicket } from "@/app/actions/tickets";
import { isOpenTicket } from "@/lib/dashboard-stats";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  SecurityAlert,
  SecurityScore,
  ServiceTicket,
  TicketPriority,
} from "@/lib/types";

const URGENCY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "Critical", label: "Critical — cannot work at all" },
  { value: "High", label: "High — major impact on work" },
  { value: "Medium", label: "Medium — partial impact" },
  { value: "Low", label: "Low — minor inconvenience" },
];

const REPORT_GUIDANCE = [
  "Phishing emails, suspicious links, or unexpected password prompts",
  "Account lockouts or unauthorized login attempts",
  "Suspected malware, ransomware, or unusual device behavior",
  "Lost/stolen devices or accidental data exposure",
];

function isSecurityTicket(ticket: ServiceTicket): boolean {
  return (
    ticket.cybersecurity_incident === true ||
    ticket.category === "Cybersecurity" ||
    (ticket.category ?? "").toLowerCase().includes("security")
  );
}

function pct(value: number | null | undefined): string {
  return value == null ? "—" : `${value}%`;
}

export default function SecurityConcernPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [score, setScore] = useState<SecurityScore | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData(customerId: string) {
    const supabase = createClient();
    const [s, a, t] = await Promise.all([
      supabase
        .from("security_scores")
        .select("*")
        .eq("customer_id", customerId)
        .order("last_assessed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("security_alerts")
        .select("*")
        .or(`customer_id.eq.${customerId},customer_id.is.null`)
        .order("detected_at", { ascending: false }),
      supabase
        .from("service_tickets")
        .select("*")
        .eq("customer_id", customerId)
        .order("opened_at", { ascending: false }),
    ]);
    setScore(s.data ?? null);
    setAlerts((a.data ?? []).filter((alert) => alert.status !== "Resolved"));
    setTickets((t.data ?? []).filter(isSecurityTicket));
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(profileData);
      if (profileData?.customer_id) {
        await loadData(profileData.customer_id);
      } else {
        setLoading(false);
      }
    }
    init();
  }, []);

  const openTickets = useMemo(
    () => tickets.filter((ticket) => isOpenTicket(ticket.status)),
    [tickets],
  );
  const closedTickets = useMemo(
    () => tickets.filter((ticket) => !isOpenTicket(ticket.status)),
    [tickets],
  );

  function handleSubmit(formData: FormData) {
    if (!profile?.customer_id) return;
    formData.set("request_type", "security");
    setError(null);
    startTransition(async () => {
      const result = await createPortalTicket(formData, profile.customer_id!);
      if (result.success) {
        showToast(result.message);
        dialogRef.current?.close();
        await loadData(profile.customer_id!);
      } else {
        setError(result.message);
      }
    });
  }

  if (activeRole !== "client_user" && activeRole !== "administrator") {
    return (
      <AlertBanner
        tone="info"
        title="Security concerns"
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

  if (!profile?.customer_id) {
    return (
      <EmptyState
        title="No organization linked"
        description="Your account is not linked to a customer organization. Contact your IT administrator."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security concern"
        description="Review your organization’s security posture and report cybersecurity issues."
        action={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setError(null);
              dialogRef.current?.showModal();
            }}
          >
            <Plus className="size-4" />
            Report Security Concern
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Security health"
          value={score?.health_score ?? "—"}
          tone={
            score == null
              ? "default"
              : score.health_score >= 80
                ? "success"
                : score.health_score >= 60
                  ? "warning"
                  : "danger"
          }
        />
        <StatCard title="Open alerts" value={alerts.length} tone={alerts.length > 0 ? "warning" : "success"} />
        <StatCard title="Open reports" value={openTickets.length} tone="warning" />
        <StatCard title="Closed reports" value={closedTickets.length} />
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h2 className="card-title text-base">When to report a security concern</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-base-content/80">
            {REPORT_GUIDANCE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h2 className="card-title text-base">Security posture (read-only)</h2>
          {score ? (
            <>
              <p className="text-sm text-base-content/60">
                Last assessed {formatDate(score.last_assessed_at)}. These values are managed by Nexus
                and cannot be edited by client users.
              </p>
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <tbody>
                    <tr>
                      <th>Firewall status</th>
                      <td>{score.firewall_status ?? "—"}</td>
                      <th>Endpoint coverage</th>
                      <td>{pct(score.endpoint_coverage_pct)}</td>
                    </tr>
                    <tr>
                      <th>Antivirus current</th>
                      <td>{pct(score.antivirus_current_pct)}</td>
                      <th>Patch compliance</th>
                      <td>{pct(score.patch_compliance_pct)}</td>
                    </tr>
                    <tr>
                      <th>Encryption coverage</th>
                      <td>{pct(score.encryption_coverage_pct)}</td>
                      <th>MFA adoption</th>
                      <td>{pct(score.mfa_adoption_pct)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {score.notes ? (
                <p className="text-sm text-base-content/70">{score.notes}</p>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="No security score yet"
              description="When Nexus completes a security assessment for your organization, details will appear here."
            />
          )}
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h2 className="card-title text-base">Active security alerts ({alerts.length})</h2>
          {alerts.length === 0 ? (
            <EmptyState
              title="No active alerts"
              description="Current cybersecurity alerts for your organization will show here."
            />
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className="rounded-box border border-base-300 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-xs text-base-content/60">
                        {alert.alert_type} · Detected {formatDate(alert.detected_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <PriorityBadge priority={alert.severity} />
                      <StatusBadge status={alert.status} />
                    </div>
                  </div>
                  {alert.description ? (
                    <p className="mt-2 text-sm text-base-content/80">{alert.description}</p>
                  ) : null}
                  {alert.recommended_solution ? (
                    <p className="mt-2 text-sm">
                      <span className="font-medium">Recommended: </span>
                      {alert.recommended_solution}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Open security reports ({openTickets.length})</h2>
          {openTickets.length === 0 ? (
            <EmptyState
              title="No open security reports"
              description="Submitted security concerns still in progress will show here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Title</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {openTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="font-mono text-sm">{ticket.ticket_number}</td>
                      <td className="font-medium">{ticket.title}</td>
                      <td>
                        <PriorityBadge priority={ticket.priority ?? "Medium"} />
                      </td>
                      <td>
                        <StatusBadge status={ticket.status ?? "New"} />
                      </td>
                      <td>{formatDate(ticket.opened_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Closed security reports ({closedTickets.length})</h2>
          {closedTickets.length === 0 ? (
            <EmptyState
              title="No closed security reports"
              description="Resolved security concerns will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Title</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {closedTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="font-mono text-sm">{ticket.ticket_number}</td>
                      <td className="font-medium">{ticket.title}</td>
                      <td>
                        <PriorityBadge priority={ticket.priority ?? "Medium"} />
                      </td>
                      <td>
                        <StatusBadge status={ticket.status ?? "New"} />
                      </td>
                      <td>{formatDate(ticket.opened_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-xl">
          <h3 className="text-lg font-bold">Report Security Concern</h3>
          {error ? (
            <div className="alert alert-error mt-4 text-sm">
              <span>{error}</span>
            </div>
          ) : null}
          <form action={handleSubmit} className="mt-4 grid gap-4">
            <input type="hidden" name="request_type" value="security" />
            <FormField label="Title" htmlFor="title" required>
              <input id="title" name="title" className="input input-bordered w-full" required />
            </FormField>
            <FormField label="Employee name" htmlFor="requester_name" required>
              <input
                id="requester_name"
                name="requester_name"
                className="input input-bordered w-full"
                defaultValue={profile.full_name ?? ""}
                required
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Employee email" htmlFor="requester_email" required>
                <input
                  id="requester_email"
                  name="requester_email"
                  type="email"
                  className="input input-bordered w-full"
                  defaultValue={profile.email ?? ""}
                  required
                />
              </FormField>
              <FormField label="Employee phone" htmlFor="requester_phone" required>
                <input
                  id="requester_phone"
                  name="requester_phone"
                  type="tel"
                  className="input input-bordered w-full"
                  required
                />
              </FormField>
            </div>
            <FormField label="Office location" htmlFor="location" required>
              <input id="location" name="location" className="input input-bordered w-full" required />
            </FormField>
            <FormField label="Urgency ranking" htmlFor="urgency" required>
              <select
                id="urgency"
                name="urgency"
                className="select select-bordered w-full"
                defaultValue="High"
                required
              >
                {URGENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Describe the security concern" htmlFor="description" required>
              <textarea
                id="description"
                name="description"
                className="textarea textarea-bordered w-full"
                rows={3}
                required
              />
            </FormField>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <span className="loading loading-spinner loading-sm" /> : "Submit"}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </div>
  );
}
