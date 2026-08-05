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
  AiPlatform,
  Profile,
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
  "AI tool giving incorrect, unsafe, or biased outputs",
  "Cannot access an approved AI platform or license",
  "Suspected data being entered into an unapproved AI tool",
  "Automation or AI workflow blocking business work",
];

function isAiTicket(ticket: ServiceTicket): boolean {
  return (
    ticket.ai_involved === true ||
    ticket.category === "AI Assistance" ||
    (ticket.category ?? "").toLowerCase().includes("ai")
  );
}

export default function AiConcernPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [platforms, setPlatforms] = useState<AiPlatform[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData(customerId: string) {
    const supabase = createClient();
    const [p, t] = await Promise.all([
      supabase
        .from("ai_platforms")
        .select("*")
        .eq("customer_id", customerId)
        .order("platform_name"),
      supabase
        .from("service_tickets")
        .select("*")
        .eq("customer_id", customerId)
        .order("opened_at", { ascending: false }),
    ]);
    setPlatforms(p.data ?? []);
    setTickets((t.data ?? []).filter(isAiTicket));
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
    formData.set("request_type", "ai");
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
        title="AI concerns"
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
        title="AI issue"
        description="Review approved AI platforms for your organization and report AI-related problems."
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
            Report AI Issue
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Approved platforms" value={platforms.length} tone="info" />
        <StatCard title="Open AI reports" value={openTickets.length} tone="warning" />
        <StatCard title="Closed AI reports" value={closedTickets.length} />
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h2 className="card-title text-base">When to report an AI issue</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-base-content/80">
            {REPORT_GUIDANCE.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h2 className="card-title text-base">Approved AI platforms</h2>
          <p className="text-sm text-base-content/60">
            Read-only view of AI tools covered by your IT management service.
          </p>
          {platforms.length === 0 ? (
            <EmptyState
              title="No AI platforms listed"
              description="When Nexus tracks AI platforms for your organization, they will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Vendor</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Active users</th>
                    <th>Health</th>
                    <th>License expires</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((platform) => (
                    <tr key={platform.id}>
                      <td className="font-medium">{platform.platform_name}</td>
                      <td>{platform.vendor ?? "—"}</td>
                      <td>{platform.department ?? "—"}</td>
                      <td>
                        <StatusBadge status={platform.status} />
                      </td>
                      <td>
                        {platform.active_users}/{platform.licensed_users}
                      </td>
                      <td>{platform.health_score ?? "—"}</td>
                      <td>{formatDate(platform.license_expires_on)}</td>
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
          <h2 className="card-title text-base">Open AI reports ({openTickets.length})</h2>
          {openTickets.length === 0 ? (
            <EmptyState
              title="No open AI reports"
              description="Submitted AI issues still in progress will show here."
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
          <h2 className="card-title text-base">Closed AI reports ({closedTickets.length})</h2>
          {closedTickets.length === 0 ? (
            <EmptyState
              title="No closed AI reports"
              description="Resolved AI issues will appear here."
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
          <h3 className="text-lg font-bold">Report AI Issue</h3>
          {error ? (
            <div className="alert alert-error mt-4 text-sm">
              <span>{error}</span>
            </div>
          ) : null}
          <form action={handleSubmit} className="mt-4 grid gap-4">
            <input type="hidden" name="request_type" value="ai" />
            <FormField label="Title" htmlFor="title" required>
              <input id="title" name="title" className="input input-bordered w-full" required />
            </FormField>
            <FormField label="Related AI platform (optional)" htmlFor="category">
              <select id="category" name="category" className="select select-bordered w-full" defaultValue="AI Assistance">
                <option value="AI Assistance">General AI Assistance</option>
                {platforms.map((platform) => (
                  <option key={platform.id} value={`AI Assistance — ${platform.platform_name}`}>
                    {platform.platform_name}
                  </option>
                ))}
              </select>
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
                defaultValue="Medium"
                required
              >
                {URGENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Describe the AI concern" htmlFor="description" required>
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
