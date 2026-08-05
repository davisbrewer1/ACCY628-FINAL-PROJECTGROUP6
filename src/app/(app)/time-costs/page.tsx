"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createInvoicesFromWorkEntries } from "@/app/actions/billing";
import { updateWorkEntryApproval } from "@/app/actions/work-entries";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import {
  getDisputedWorkEntries,
  getPendingApprovalEntries,
  getReadyToInvoiceEntries,
} from "@/lib/manager-ops";
import { isThisMonth } from "@/lib/dashboard-stats";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Customer, ServiceTicket, Technician, WorkEntry } from "@/lib/types";

interface WorkEntryRow extends WorkEntry {
  technicianName: string;
  customerName: string;
  contractName: string;
  ticketNumber: string;
  ticketTitle: string;
  additionalBillable: number;
  costBreakdown: Array<{ label: string; amount: number }>;
}

type ViewMode = "queue" | "returned" | "ready" | "history";

const MANAGER_ROLES = new Set([
  "administrator",
  "service_manager",
  "account_manager",
  "billing",
]);

const ENTRY_TYPE_HINTS = [
  { id: "included", label: "Included / block hours", included: true },
  { id: "billable", label: "Billable T&M / overage", included: false },
] as const;

export default function WorkBillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialFilter = searchParams.get("filter");
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>(
    initialFilter === "ready"
      ? "ready"
      : initialFilter === "returned"
        ? "returned"
        : "queue",
  );
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const canManage = MANAGER_ROLES.has(activeRole);

  async function loadData() {
    const supabase = createClient();
    const [w, tech, c, co, t] = await Promise.all([
      supabase.from("work_entries").select("*").order("work_date", { ascending: false }),
      supabase.from("technicians").select("*"),
      supabase.from("customers").select("*"),
      supabase.from("contracts").select("*"),
      supabase.from("service_tickets").select("*"),
    ]);
    setEntries(w.data ?? []);
    setTechnicians(tech.data ?? []);
    setCustomers(c.data ?? []);
    setContracts(co.data ?? []);
    setTickets(t.data ?? []);
    setSelectedIds([]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialFilter === "ready") setView("ready");
    if (initialFilter === "returned") setView("returned");
    if (initialFilter === "queue") setView("queue");
  }, [initialFilter]);

  const rows: WorkEntryRow[] = useMemo(() => {
    const techMap = new Map(technicians.map((t) => [t.id, t.technician_name]));
    const customerMap = new Map(customers.map((c) => [c.id, c.customer_name]));
    const contractMap = new Map(contracts.map((c) => [c.id, c]));
    const ticketMap = new Map(tickets.map((t) => [t.id, t]));

    return entries.map((entry) => {
      const contract = entry.contract_id ? contractMap.get(entry.contract_id) : null;
      const ticket = ticketMap.get(entry.ticket_id);
      const billableHours = entry.included_in_contract ? 0 : (entry.hours_worked ?? 0);
      const additionalBillable =
        billableHours * (contract?.additional_hourly_rate ?? 0) +
        (entry.parts_cost ?? 0) +
        (entry.software_cost ?? 0) +
        (entry.equipment_cost ?? 0) +
        (entry.travel_cost ?? 0) +
        (entry.other_cost ?? 0);

      const costBreakdown = [
        { label: "Labor (internal)", amount: entry.labor_cost ?? 0 },
        { label: "Parts", amount: entry.parts_cost ?? 0 },
        { label: "Software", amount: entry.software_cost ?? 0 },
        { label: "Equipment", amount: entry.equipment_cost ?? 0 },
        { label: "Travel", amount: entry.travel_cost ?? 0 },
        { label: "Other", amount: entry.other_cost ?? 0 },
      ].filter((c) => c.amount > 0);

      return {
        ...entry,
        technicianName: techMap.get(entry.technician_id) ?? "Unknown",
        customerName: customerMap.get(entry.customer_id) ?? "Unknown",
        contractName: contract?.contract_name ?? "No contract linked",
        ticketNumber: ticket?.ticket_number ?? "—",
        ticketTitle: ticket?.title ?? "Ticket",
        additionalBillable,
        costBreakdown,
      };
    });
  }, [entries, technicians, customers, contracts, tickets]);

  const pending = useMemo(() => getPendingApprovalEntries(entries), [entries]);
  const returned = useMemo(() => getDisputedWorkEntries(entries), [entries]);
  const ready = useMemo(() => getReadyToInvoiceEntries(entries), [entries]);

  const monthRollup = useMemo(() => {
    const monthEntries = entries.filter((e) => isThisMonth(e.work_date));
    const included = monthEntries
      .filter((e) => e.included_in_contract)
      .reduce((sum, e) => sum + (e.hours_worked ?? 0), 0);
    const billable = monthEntries
      .filter((e) => !e.included_in_contract)
      .reduce((sum, e) => sum + (e.hours_worked ?? 0), 0);
    const readyAmount = rows
      .filter((r) => ready.some((e) => e.id === r.id))
      .reduce((sum, r) => sum + r.additionalBillable, 0);
    return {
      included,
      billable,
      readyAmount,
      pendingCount: pending.length,
      returnedCount: returned.length,
    };
  }, [entries, rows, ready, pending, returned]);

  const visibleRows = useMemo(() => {
    if (view === "queue") {
      const ids = new Set(pending.map((e) => e.id));
      return rows.filter((r) => ids.has(r.id));
    }
    if (view === "returned") {
      const ids = new Set(returned.map((e) => e.id));
      return rows.filter((r) => ids.has(r.id));
    }
    if (view === "ready") {
      const ids = new Set(ready.map((e) => e.id));
      return rows.filter((r) => ids.has(r.id));
    }
    return rows;
  }, [view, rows, pending, returned, ready]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleApproval(id: string, status: "Approved" | "Disputed") {
    const notes = disputeNotes[id] ?? "";
    startTransition(async () => {
      const result = await updateWorkEntryApproval(id, status, notes);
      if (result.success) {
        showToast(result.message);
        setExpandedId(null);
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    });
  }

  function handlePushToInvoice() {
    startTransition(async () => {
      const result = await createInvoicesFromWorkEntries(selectedIds);
      if (result.success) {
        showToast(result.message);
        setSelectedIds([]);
        await loadData();
        router.push("/billing");
      } else {
        showToast(result.message, "error");
      }
    });
  }

  if (!canManage) {
    return (
      <AlertBanner
        tone="info"
        title="Work & Billing"
        message="This approval queue is for managers and billing. Technicians log and correct time from My Work."
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work & Billing"
        description="Approve or return technician time, then push billable overages into the invoice queue. Same handoff path Operations uses for ready-to-invoice."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => setView("queue")}
          className={`rounded-box border p-4 text-left transition ${
            view === "queue"
              ? "border-warning bg-warning/10"
              : "border-base-300 bg-base-100 hover:border-base-content/20"
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-base-content/60">
            Needs approval
          </p>
          <p className="mt-1 text-2xl font-semibold">{monthRollup.pendingCount}</p>
          <p className="text-xs text-base-content/55">Technician submissions waiting on you</p>
        </button>
        <button
          type="button"
          onClick={() => setView("returned")}
          className={`rounded-box border p-4 text-left transition ${
            view === "returned"
              ? "border-error bg-error/10"
              : "border-base-300 bg-base-100 hover:border-base-content/20"
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-base-content/60">
            Returned to tech
          </p>
          <p className="mt-1 text-2xl font-semibold">{monthRollup.returnedCount}</p>
          <p className="text-xs text-base-content/55">Waiting for correction in My Work</p>
        </button>
        <button
          type="button"
          onClick={() => setView("ready")}
          className={`rounded-box border p-4 text-left transition ${
            view === "ready"
              ? "border-primary bg-primary/10"
              : "border-base-300 bg-base-100 hover:border-base-content/20"
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-base-content/60">
            Ready to invoice
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {formatCurrency(monthRollup.readyAmount)}
          </p>
          <p className="text-xs text-base-content/55">{ready.length} billable entries</p>
        </button>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">
            Hours this month
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {formatHours(monthRollup.included + monthRollup.billable)}
          </p>
          <p className="text-xs text-base-content/55">
            {formatHours(monthRollup.included)} included · {formatHours(monthRollup.billable)} billable
          </p>
        </div>
      </div>

      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <p className="text-sm font-medium">Flexible entry types (MSP-friendly)</p>
        <p className="mt-1 text-xs text-base-content/60">
          Work can be treated as included block hours or billable T&amp;M overage. Cost lines stay optional so break/fix, project, and cyber shops can use only what they need.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ENTRY_TYPE_HINTS.map((hint) => (
            <span key={hint.id} className="badge badge-ghost badge-sm">
              {hint.label}
            </span>
          ))}
          <span className="badge badge-ghost badge-sm">Remote / on-site</span>
          <span className="badge badge-ghost badge-sm">Optional cost lines</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["queue", `Approve queue (${pending.length})`],
            ["returned", `Returned (${returned.length})`],
            ["ready", `Ready to invoice (${ready.length})`],
            ["history", "History"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn btn-sm ${view === value ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setView(value)}
          >
            {label}
          </button>
        ))}
        <Link href="/billing" className="btn btn-outline btn-sm ml-auto">
          Open billing
        </Link>
      </div>

      {view === "ready" ? (
        <div className="rounded-box border border-base-300 bg-base-200/40 px-4 py-3 text-sm text-base-content/70">
          Select billable entries, then{" "}
          <span className="font-medium text-base-content">Send to Billing</span>.
          That creates <span className="font-medium text-base-content">Draft</span>{" "}
          invoices (one per customer + contract) and moves the work out of this queue.
        </div>
      ) : null}

      {view === "ready" && selectedIds.length > 0 ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-box border border-primary/40 bg-primary/10 p-3 shadow-sm">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={isPending}
            onClick={handlePushToInvoice}
          >
            {isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Send to Billing"
            )}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>
            Clear
          </button>
          <span className="text-xs text-base-content/60">
            Creates draft invoices and opens Billing
          </span>
        </div>
      ) : null}

      {visibleRows.length === 0 ? (
        <EmptyState
          title={
            view === "queue"
              ? "Approval queue is clear"
              : view === "returned"
                ? "Nothing returned to technicians"
                : view === "ready"
                  ? "No billable work ready"
                  : "No work entries yet"
          }
          description="Entries appear after technicians log work on tickets in My Work."
        />
      ) : (
        <div className="space-y-3">
          {visibleRows.map((row) => {
            const expanded = expandedId === row.id;
            const selectable =
              view === "ready" ||
              (view === "history" &&
                !row.included_in_contract &&
                row.approval_status === "Approved" &&
                row.billing_status !== "Billed");

            return (
              <article
                key={row.id}
                className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start gap-3">
                  {selectable ? (
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm mt-1"
                      checked={selectedIds.includes(row.id)}
                      onChange={() => toggleSelected(row.id)}
                      aria-label={`Select work entry for ${row.ticketNumber}`}
                    />
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">
                        {row.technicianName}
                        <span className="font-normal text-base-content/50"> · </span>
                        {row.customerName}
                      </h3>
                      <StatusBadge
                        status={row.included_in_contract ? "Included" : "Billable"}
                      />
                      <StatusBadge status={row.approval_status ?? "Pending"} />
                      {row.billing_status ? (
                        <StatusBadge status={row.billing_status} />
                      ) : null}
                    </div>

                    <p className="mt-1 text-sm text-base-content/75">
                      <Link
                        href="/service-tickets"
                        className="link link-hover font-mono text-xs"
                      >
                        {row.ticketNumber}
                      </Link>
                      {" — "}
                      {row.ticketTitle}
                    </p>
                    <p className="text-xs text-base-content/55">
                      {formatDate(row.work_date)}
                      {row.service_method ? ` · ${row.service_method}` : ""}
                      {" · "}
                      {row.contractName}
                    </p>

                    <p className="mt-2 text-sm">
                      {row.work_performed?.trim() || (
                        <span className="text-base-content/50">No work notes logged</span>
                      )}
                    </p>

                    {row.approval_notes ? (
                      <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
                        <span className="font-medium">Manager note: </span>
                        {row.approval_notes}
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-base-content/55">Hours </span>
                        <span className="font-semibold">{formatHours(row.hours_worked)}</span>
                      </div>
                      <div>
                        <span className="text-base-content/55">Internal cost </span>
                        <span className="font-semibold">
                          {formatCurrency(row.total_direct_cost)}
                        </span>
                      </div>
                      <div>
                        <span className="text-base-content/55">Billable $ </span>
                        <span className="font-semibold">
                          {row.included_in_contract
                            ? "—"
                            : formatCurrency(row.additionalBillable)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                    >
                      {expanded ? "Hide details" : "Details"}
                    </button>
                    {view === "queue" || row.approval_status === "Pending" ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          disabled={isPending}
                          onClick={() => handleApproval(row.id, "Approved")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={isPending}
                          onClick={() => setExpandedId(row.id)}
                        >
                          Return
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {expanded ? (
                  <div className="mt-4 grid gap-4 border-t border-base-300 pt-4 lg:grid-cols-2">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                        Cost breakdown
                      </h4>
                      {row.costBreakdown.length === 0 ? (
                        <p className="mt-2 text-sm text-base-content/55">No direct costs recorded.</p>
                      ) : (
                        <ul className="mt-2 space-y-1 text-sm">
                          {row.costBreakdown.map((cost) => (
                            <li key={cost.label} className="flex justify-between gap-3">
                              <span>{cost.label}</span>
                              <span className="font-medium">{formatCurrency(cost.amount)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {row.resolution_notes ? (
                        <div className="mt-3">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                            Resolution notes
                          </h4>
                          <p className="mt-1 text-sm whitespace-pre-wrap">{row.resolution_notes}</p>
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href="/technicians" className="btn btn-ghost btn-xs">
                          Technicians
                        </Link>
                        <Link href="/customers" className="btn btn-ghost btn-xs">
                          Customers
                        </Link>
                        <Link href="/contracts" className="btn btn-ghost btn-xs">
                          Contracts
                        </Link>
                      </div>
                    </div>

                    {(view === "queue" || row.approval_status === "Pending") && (
                      <div className="rounded-lg border border-base-300 bg-base-200/40 p-3">
                        <FormField
                          label="Return to technician (required for dispute)"
                          htmlFor={`notes-${row.id}`}
                        >
                          <textarea
                            id={`notes-${row.id}`}
                            className="textarea textarea-bordered min-h-24 w-full"
                            placeholder="e.g. Hours look high for a remote check — split travel, or mark as billable overage."
                            value={disputeNotes[row.id] ?? ""}
                            onChange={(e) =>
                              setDisputeNotes((prev) => ({
                                ...prev,
                                [row.id]: e.target.value,
                              }))
                            }
                          />
                        </FormField>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            disabled={isPending}
                            onClick={() => handleApproval(row.id, "Approved")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-warning btn-sm"
                            disabled={isPending}
                            onClick={() => handleApproval(row.id, "Disputed")}
                          >
                            Return with note
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
