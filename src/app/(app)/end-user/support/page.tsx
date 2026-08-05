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
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  buildTicketLiveSteps,
  formatLiveStepTime,
  getActiveLiveSummary,
} from "@/lib/ticket-live-status";
import {
  SUPPORT_ISSUE_CATEGORIES,
  SUPPORT_ISSUE_SUBCATEGORIES,
  type HardwareAsset,
  type Profile,
  type ServiceTicket,
  type SupportIssueCategory,
  type Technician,
  type TicketPriority,
  type WorkEntry,
} from "@/lib/types";

const PRIORITY_RANK: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

const URGENCY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "Critical", label: "Critical — cannot work at all" },
  { value: "High", label: "High — major impact on work" },
  { value: "Medium", label: "Medium — partial impact" },
  { value: "Low", label: "Low — minor inconvenience" },
];

function deviceLabel(asset: HardwareAsset): string {
  const parts = [
    asset.asset_number,
    asset.manufacturer,
    asset.model,
    asset.assigned_employee ? `(${asset.assigned_employee})` : null,
  ].filter(Boolean);
  return parts.join(" — ");
}

function issueTypeLabel(ticket: ServiceTicket): string {
  if (ticket.ai_involved) return "AI Issue";
  if (ticket.cybersecurity_incident) return "Security Concern";
  return "Software/Hardware Issue";
}

export default function EndUserSupportPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const detailRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [assets, setAssets] = useState<HardwareAsset[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [issueCategory, setIssueCategory] = useState<SupportIssueCategory | "">("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData(customerId: string, silent = false) {
    const supabase = createClient();
    const [t, a, tech, work] = await Promise.all([
      supabase
        .from("service_tickets")
        .select("*")
        .eq("customer_id", customerId)
        .order("opened_at", { ascending: false }),
      supabase
        .from("hardware_assets")
        .select("*")
        .eq("customer_id", customerId)
        .order("asset_number", { ascending: true }),
      supabase.from("technicians").select("*"),
      supabase
        .from("work_entries")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ]);
    setTickets(t.data ?? []);
    setAssets(a.data ?? []);
    setTechnicians(tech.data ?? []);
    setWorkEntries(work.data ?? []);
    setLastRefreshedAt(new Date());
    if (!silent) setLoading(false);
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

  // Live refresh while a ticket detail dialog is open.
  useEffect(() => {
    if (!selectedTicketId || !profile?.customer_id) return;
    const customerId = profile.customer_id;
    const interval = window.setInterval(() => {
      void loadData(customerId, true);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [selectedTicketId, profile?.customer_id]);

  const openTickets = useMemo(() => {
    return [...tickets]
      .filter((t) => isOpenTicket(t.status))
      .sort((a, b) => {
        const aRank = PRIORITY_RANK[a.priority ?? "Medium"] ?? 99;
        const bRank = PRIORITY_RANK[b.priority ?? "Medium"] ?? 99;
        if (aRank !== bRank) return aRank - bRank;
        return String(b.opened_at ?? "").localeCompare(String(a.opened_at ?? ""));
      });
  }, [tickets]);

  const closedTickets = useMemo(() => {
    return [...tickets]
      .filter((t) => !isOpenTicket(t.status))
      .sort((a, b) => {
        const aRank = PRIORITY_RANK[a.priority ?? "Medium"] ?? 99;
        const bRank = PRIORITY_RANK[b.priority ?? "Medium"] ?? 99;
        if (aRank !== bRank) return aRank - bRank;
        return String(b.opened_at ?? "").localeCompare(String(a.opened_at ?? ""));
      });
  }, [tickets]);

  const assetById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset])),
    [assets],
  );
  const techById = useMemo(
    () => new Map(technicians.map((tech) => [tech.id, tech])),
    [technicians],
  );

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );

  const selectedUpdates = useMemo(() => {
    if (!selectedTicket) return [];
    return workEntries
      .filter((entry) => entry.ticket_id === selectedTicket.id)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }, [workEntries, selectedTicket]);

  const selectedTech = useMemo(() => {
    if (!selectedTicket?.assigned_technician_id) return null;
    return techById.get(selectedTicket.assigned_technician_id) ?? null;
  }, [selectedTicket, techById]);

  const selectedAsset = useMemo(() => {
    if (!selectedTicket?.hardware_asset_id) return undefined;
    return assetById.get(selectedTicket.hardware_asset_id);
  }, [selectedTicket, assetById]);

  const liveSteps = useMemo(() => {
    if (!selectedTicket) return [];
    return buildTicketLiveSteps(
      selectedTicket,
      selectedTech?.technician_name ?? null,
      selectedUpdates,
    );
  }, [selectedTicket, selectedTech, selectedUpdates]);

  const liveSummary = useMemo(
    () => getActiveLiveSummary(liveSteps),
    [liveSteps],
  );

  function openTicketDetails(ticketId: string) {
    setSelectedTicketId(ticketId);
    if (profile?.customer_id) {
      void loadData(profile.customer_id, true);
    }
    detailRef.current?.showModal();
  }

  function closeTicketDetails() {
    setSelectedTicketId(null);
    detailRef.current?.close();
  }

  function renderTicketTable(list: ServiceTicket[], clickable: boolean) {
    return (
      <div className="overflow-x-auto">
        <table className="table table-zebra">
          <thead>
            <tr>
              <th>Ticket #</th>
              <th>Title</th>
              <th>Employee</th>
              <th>Category</th>
              <th>Subcategory</th>
              <th>Device</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Opened</th>
            </tr>
          </thead>
          <tbody>
            {list.map((ticket) => {
              const linkedAsset = ticket.hardware_asset_id
                ? assetById.get(ticket.hardware_asset_id)
                : undefined;
              return (
                <tr
                  key={ticket.id}
                  className={clickable ? "cursor-pointer hover:bg-base-200/80" : undefined}
                  onClick={clickable ? () => openTicketDetails(ticket.id) : undefined}
                  onKeyDown={
                    clickable
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openTicketDetails(ticket.id);
                          }
                        }
                      : undefined
                  }
                  tabIndex={clickable ? 0 : undefined}
                  role={clickable ? "button" : undefined}
                  aria-label={
                    clickable
                      ? `View live updates for ticket ${ticket.ticket_number}`
                      : undefined
                  }
                >
                  <td className="font-mono text-sm">{ticket.ticket_number}</td>
                  <td className="font-medium">
                    {ticket.title}
                    {clickable ? (
                      <div className="text-xs font-normal text-primary">
                        Click for live status updates
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <div>{ticket.requester_name ?? "—"}</div>
                    <div className="text-xs text-base-content/60">
                      {ticket.requester_email ?? ""}
                    </div>
                  </td>
                  <td className="text-sm">{issueTypeLabel(ticket)}</td>
                  <td>{ticket.category ?? "—"}</td>
                  <td className="text-sm">
                    {linkedAsset ? deviceLabel(linkedAsset) : "—"}
                  </td>
                  <td>
                    <PriorityBadge priority={ticket.priority ?? "Medium"} />
                  </td>
                  <td>
                    <StatusBadge status={ticket.status ?? "New"} />
                  </td>
                  <td>{formatDate(ticket.opened_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function openDialog() {
    setError(null);
    setIssueCategory("");
    dialogRef.current?.showModal();
  }

  function handleSubmit(formData: FormData) {
    if (!profile?.customer_id) return;
    if (!issueCategory) {
      setError("Please select a category for this support ticket.");
      return;
    }
    formData.set("issue_category", issueCategory);
    formData.set(
      "request_type",
      issueCategory === "AI Issue"
        ? "ai"
        : issueCategory === "Security Concern"
          ? "security"
          : "support",
    );
    setError(null);
    startTransition(async () => {
      const result = await createPortalTicket(formData, profile.customer_id!);
      if (result.success) {
        showToast(result.message);
        setIssueCategory("");
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
        title="Support tickets"
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
        title="Support tickets"
        description="Submit AI, security, or software/hardware support tickets. Click an open ticket to see live status updates."
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={openDialog}>
            <Plus className="size-4" />
            New Support Ticket
          </button>
        }
      />

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">
            Open tickets ({openTickets.length})
          </h2>
          <p className="text-sm text-base-content/60">
            Click any open ticket to view live progress, technician assignment, and work updates.
          </p>
          {openTickets.length === 0 ? (
            <EmptyState
              title="No open tickets"
              description="Submit a support ticket to get help from the Nexus team."
              action={
                <button type="button" className="btn btn-primary" onClick={openDialog}>
                  Submit Ticket
                </button>
              }
            />
          ) : (
            renderTicketTable(openTickets, true)
          )}
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">
            Closed tickets ({closedTickets.length})
          </h2>
          <p className="text-sm text-base-content/60">
            Completed and closed requests, still ranked by original priority.
          </p>
          {closedTickets.length === 0 ? (
            <EmptyState
              title="No closed tickets"
              description="Resolved tickets will appear here once they are completed or closed."
            />
          ) : (
            renderTicketTable(closedTickets, false)
          )}
        </div>
      </div>

      <dialog
        ref={detailRef}
        className="modal"
        onClose={() => setSelectedTicketId(null)}
      >
        <div className="modal-box max-w-2xl">
          {selectedTicket ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">{selectedTicket.title}</h3>
                  <p className="font-mono text-sm text-base-content/60">
                    {selectedTicket.ticket_number}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PriorityBadge priority={selectedTicket.priority ?? "Medium"} />
                  <StatusBadge status={selectedTicket.status ?? "New"} />
                </div>
              </div>

              <div className="rounded-box border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Live status
                </p>
                <p className="mt-1 text-sm font-medium">{liveSummary}</p>
                <p className="mt-2 text-xs text-base-content/60">
                  Auto-refreshes every 10 seconds
                  {lastRefreshedAt
                    ? ` · Last updated ${lastRefreshedAt.toLocaleTimeString()}`
                    : ""}
                </p>

                <ol className="mt-4 space-y-3">
                  {liveSteps.map((step) => {
                    const timestamp = formatLiveStepTime(step.at);
                    return (
                      <li key={step.id} className="flex gap-3">
                        <span
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                            step.state === "complete"
                              ? "bg-success text-success-content"
                              : step.state === "active"
                                ? "bg-primary text-primary-content"
                                : "bg-base-300 text-base-content/60"
                          }`}
                          aria-hidden="true"
                        >
                          {step.state === "complete" ? "✓" : step.state === "active" ? "●" : ""}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p
                              className={`text-sm font-semibold ${
                                step.state === "upcoming" ? "text-base-content/50" : ""
                              }`}
                            >
                              {step.label}
                              {step.state === "active" ? (
                                <span className="badge badge-primary badge-xs ml-2">Now</span>
                              ) : null}
                            </p>
                            {timestamp ? (
                              <p className="text-xs text-base-content/50">{timestamp}</p>
                            ) : null}
                          </div>
                          <p
                            className={`mt-0.5 text-sm ${
                              step.state === "upcoming"
                                ? "text-base-content/45"
                                : "text-base-content/75"
                            }`}
                          >
                            {step.detail}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-box border border-base-300 p-3">
                  <p className="text-xs uppercase tracking-wide text-base-content/60">Category</p>
                  <p className="mt-1 font-medium">{issueTypeLabel(selectedTicket)}</p>
                </div>
                <div className="rounded-box border border-base-300 p-3">
                  <p className="text-xs uppercase tracking-wide text-base-content/60">
                    Subcategory
                  </p>
                  <p className="mt-1 font-medium">{selectedTicket.category ?? "—"}</p>
                </div>
                <div className="rounded-box border border-base-300 p-3">
                  <p className="text-xs uppercase tracking-wide text-base-content/60">Technician</p>
                  <p className="mt-1 font-medium">
                    {selectedTech?.technician_name ??
                      (selectedTicket.assigned_technician_id
                        ? "Technician assigned"
                        : "Not assigned yet")}
                  </p>
                  {selectedTech?.specialty ? (
                    <p className="text-xs text-base-content/60">{selectedTech.specialty}</p>
                  ) : null}
                </div>
                <div className="rounded-box border border-base-300 p-3">
                  <p className="text-xs uppercase tracking-wide text-base-content/60">
                    Service method
                  </p>
                  <p className="mt-1 font-medium">
                    {selectedTicket.service_method ?? "To be determined"}
                  </p>
                </div>
                <div className="rounded-box border border-base-300 p-3">
                  <p className="text-xs uppercase tracking-wide text-base-content/60">Location</p>
                  <p className="mt-1 font-medium">{selectedTicket.location ?? "—"}</p>
                </div>
                <div className="rounded-box border border-base-300 p-3">
                  <p className="text-xs uppercase tracking-wide text-base-content/60">Device</p>
                  <p className="mt-1 font-medium">
                    {selectedAsset ? deviceLabel(selectedAsset) : "None linked"}
                  </p>
                </div>
              </div>

              {selectedTicket.description ? (
                <div className="rounded-box border border-base-300 p-3">
                  <p className="text-xs uppercase tracking-wide text-base-content/60">
                    Original request
                  </p>
                  <p className="mt-1 text-sm text-base-content/80">{selectedTicket.description}</p>
                </div>
              ) : null}

              {selectedTicket.resolution_notes ? (
                <div className="rounded-box border border-base-300 p-3">
                  <p className="text-xs uppercase tracking-wide text-base-content/60">
                    Resolution notes
                  </p>
                  <p className="mt-1 text-sm text-base-content/80">
                    {selectedTicket.resolution_notes}
                  </p>
                </div>
              ) : null}

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="font-semibold">Work updates</h4>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => profile?.customer_id && loadData(profile.customer_id, true)}
                  >
                    Refresh now
                  </button>
                </div>
                {selectedUpdates.length === 0 ? (
                  <EmptyState
                    title="No work logged yet"
                    description="As technicians work this ticket, updates about what they are doing will appear here."
                  />
                ) : (
                  <div className="space-y-3">
                    {selectedUpdates.map((entry) => {
                      const tech = techById.get(entry.technician_id);
                      return (
                        <div
                          key={entry.id}
                          className="rounded-box border border-base-300 p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">
                                {tech?.technician_name ?? "Technician"}
                              </p>
                              <p className="text-xs text-base-content/60">
                                {formatDate(entry.work_date ?? entry.created_at)}
                                {entry.service_method ? ` · ${entry.service_method}` : ""}
                                {entry.hours_worked != null
                                  ? ` · ${entry.hours_worked} hrs`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          {entry.work_performed ? (
                            <p className="mt-2 text-sm text-base-content/80">
                              <span className="font-medium">Work performed: </span>
                              {entry.work_performed}
                            </p>
                          ) : null}
                          {entry.resolution_notes ? (
                            <p className="mt-1 text-sm text-base-content/80">
                              <span className="font-medium">Notes: </span>
                              {entry.resolution_notes}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="modal-action">
                <button type="button" className="btn" onClick={closeTicketDetails}>
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-xl">
          <h3 className="text-lg font-bold">Submit Support Ticket</h3>
          <p className="mt-1 text-sm text-base-content/60">
            Rank how urgent the problem is. The system sets ticket priority from that urgency ranking.
          </p>
          {error ? (
            <div className="alert alert-error mt-4 text-sm">
              <span>{error}</span>
            </div>
          ) : null}
          <form action={handleSubmit} className="form-grid mt-4 grid gap-4">
            <FormField label="Category" htmlFor="issue_category" required>
              <select
                id="issue_category"
                name="issue_category"
                className="select select-bordered w-full"
                value={issueCategory}
                onChange={(event) =>
                  setIssueCategory(event.target.value as SupportIssueCategory | "")
                }
                required
              >
                <option value="" disabled>
                  Select a category
                </option>
                {SUPPORT_ISSUE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Subcategory of issue" htmlFor="category" required>
              <select
                id="category"
                name="category"
                className="select select-bordered w-full"
                defaultValue=""
                key={issueCategory || "none"}
                required
                disabled={!issueCategory}
              >
                <option value="" disabled>
                  {issueCategory ? "Select a subcategory" : "Select a category first"}
                </option>
                {issueCategory
                  ? SUPPORT_ISSUE_SUBCATEGORIES[issueCategory].map((subcategory) => (
                      <option key={subcategory} value={subcategory}>
                        {subcategory}
                      </option>
                    ))
                  : null}
              </select>
            </FormField>

            <FormField label="Ticket title" htmlFor="title" required>
              <input
                id="title"
                name="title"
                className="input input-bordered w-full"
                placeholder="Brief summary of the issue"
                required
              />
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
                  placeholder="(555) 555-5555"
                  required
                />
              </FormField>
            </div>

            <FormField label="Office location" htmlFor="location" required>
              <input
                id="location"
                name="location"
                className="input input-bordered w-full"
                placeholder="Office, floor, desk, or remote"
                required
              />
            </FormField>

            <FormField
              label="Related company device (optional)"
              htmlFor="hardware_asset_id"
            >
              <select
                id="hardware_asset_id"
                name="hardware_asset_id"
                className="select select-bordered w-full"
                defaultValue=""
              >
                <option value="">No device / not sure</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {deviceLabel(asset)}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Urgency ranking" htmlFor="urgency" required>
              <select
                id="urgency"
                name="urgency"
                className="select select-bordered w-full"
                defaultValue={issueCategory === "Security Concern" ? "High" : "Medium"}
                key={`urgency-${issueCategory || "none"}`}
                required
              >
                {URGENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Describe the issue" htmlFor="description" required>
              <textarea
                id="description"
                name="description"
                className="textarea textarea-bordered w-full"
                rows={3}
                placeholder="What happened, and what do you need help with?"
                required
              />
            </FormField>

            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setIssueCategory("");
                  dialogRef.current?.close();
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Submit ticket"
                )}
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
