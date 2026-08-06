"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createInvoicesFromApprovedExpenses, sendWorkAndExpensesToBilling } from "@/app/actions/billing";
import { updateWorkEntryApproval } from "@/app/actions/work-entries";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { ApprovalManagerPanel } from "@/components/ApprovalManagerPanel";
import { ExpenseTracker } from "@/components/ExpenseTracker";
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
  isReadyToInvoiceExpense,
} from "@/lib/manager-ops";
import { allocateOverageHours } from "@/lib/plan-pricing";
import { isOpenTicket, isThisMonth } from "@/lib/dashboard-stats";
import { createClient } from "@/lib/supabase/client";
import type {
  Contract,
  Customer,
  ServiceTicket,
  Technician,
  TicketExpense,
  WorkEntry,
} from "@/lib/types";

interface WorkEntryRow extends WorkEntry {
  technicianName: string;
  customerName: string;
  contractName: string;
  ticketNumber: string;
  ticketTitle: string;
  additionalBillable: number;
  costBreakdown: Array<{ label: string; amount: number }>;
}

type ViewMode = "expenses" | "queue" | "returned" | "ready" | "history";

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
        : initialFilter === "expenses"
          ? "expenses"
          : "expenses",
  );
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [ticketExpenses, setTicketExpenses] = useState<TicketExpense[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});
  const [expenseTicketId, setExpenseTicketId] = useState("");
  const [expenseTechnicianId, setExpenseTechnicianId] = useState("");
  const [isPending, startTransition] = useTransition();

  const canManage = MANAGER_ROLES.has(activeRole);
  const expenseOnly = activeRole === "technician";

  async function loadData() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const [w, tech, c, co, t, ex] = await Promise.all([
      supabase.from("work_entries").select("*").order("work_date", { ascending: false }),
      supabase.from("technicians").select("*").order("technician_name"),
      supabase.from("customers").select("*"),
      supabase.from("contracts").select("*"),
      supabase
        .from("service_tickets")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("ticket_expenses")
        .select("*")
        .order("date", { ascending: false }),
    ]);
    const techRows = tech.data ?? [];
    const ticketRows = t.data ?? [];
    setEntries(w.data ?? []);
    setTicketExpenses((ex.data as TicketExpense[]) ?? []);
    setTechnicians(techRows);
    setCustomers(c.data ?? []);
    setContracts(co.data ?? []);
    setTickets(ticketRows);
    setSelectedIds([]);

    if (user) {
      const linked = techRows.find((row) => row.profile_id === user.id);
      setExpenseTechnicianId(linked?.id ?? techRows[0]?.id ?? "");
    } else {
      setExpenseTechnicianId(techRows[0]?.id ?? "");
    }

    const open = ticketRows.filter((row) => isOpenTicket(row.status));
    const first = ticketRows[0] ?? open[0];
    setExpenseTicketId(first?.id ?? "");
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialFilter === "ready") setView("ready");
    if (initialFilter === "returned") setView("returned");
    if (initialFilter === "queue") setView("queue");
    if (initialFilter === "expenses") setView("expenses");
  }, [initialFilter]);

  const rows: WorkEntryRow[] = useMemo(() => {
    const techMap = new Map(technicians.map((t) => [t.id, t.technician_name]));
    const customerMap = new Map(customers.map((c) => [c.id, c.customer_name]));
    const contractMap = new Map(contracts.map((c) => [c.id, c]));
    const ticketMap = new Map(tickets.map((t) => [t.id, t]));

    const overageByEntryId = new Map<string, number>();
    for (const contract of contracts) {
      const contractEntries = entries.filter((e) => e.contract_id === contract.id);
      if (contractEntries.length === 0) continue;
      const byMonth = new Map<string, typeof contractEntries>();
      for (const entry of contractEntries) {
        const month = entry.work_date?.slice(0, 7) ?? "unknown";
        const list = byMonth.get(month) ?? [];
        list.push(entry);
        byMonth.set(month, list);
      }
      for (const monthEntries of byMonth.values()) {
        const allocated = allocateOverageHours({
          selected: monthEntries,
          includedHoursPerMonth: Number(contract.included_support_hours ?? 0),
        });
        for (const [id, hours] of allocated) {
          overageByEntryId.set(id, hours);
        }
      }
    }

    return entries.map((entry) => {
      const contract = entry.contract_id ? contractMap.get(entry.contract_id) : null;
      const ticket = ticketMap.get(entry.ticket_id);
      const overageHours = overageByEntryId.get(entry.id) ?? (entry.hours_worked ?? 0);
      const additionalBillable =
        overageHours * (contract?.additional_hourly_rate ?? 0) +
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
  const readyExpenses = useMemo(
    () => ticketExpenses.filter(isReadyToInvoiceExpense),
    [ticketExpenses],
  );
  const pendingBillableExpenseCount = useMemo(
    () =>
      ticketExpenses.filter(
        (e) =>
          e.expense_tag === "Billable to Customer" &&
          e.approval_status === "Pending",
      ).length,
    [ticketExpenses],
  );
  const readyExpenseTotal = useMemo(
    () =>
      readyExpenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0),
    [readyExpenses],
  );

  const monthRollup = useMemo(() => {
    const monthEntries = entries.filter((e) => isThisMonth(e.work_date));
    let included = 0;
    let billable = 0;
    for (const contract of contracts) {
      const list = monthEntries.filter((e) => e.contract_id === contract.id);
      if (list.length === 0) continue;
      const allocated = allocateOverageHours({
        selected: list,
        includedHoursPerMonth: Number(contract.included_support_hours ?? 0),
      });
      for (const entry of list) {
        const hours = Number(entry.hours_worked ?? 0);
        const overage = allocated.get(entry.id) ?? 0;
        billable += overage;
        included += Math.max(0, hours - overage);
      }
    }
    for (const entry of monthEntries) {
      if (entry.contract_id) continue;
      billable += Number(entry.hours_worked ?? 0);
    }
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
  }, [entries, rows, ready, pending, returned, contracts]);

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
      const result = await sendWorkAndExpensesToBilling(selectedIds);
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

  function handleInvoiceApprovedExpenses() {
    startTransition(async () => {
      const result = await createInvoicesFromApprovedExpenses();
      if (result.success) {
        showToast(result.message);
        await loadData();
        if ((result.created ?? 0) > 0) {
          router.push("/billing");
        }
      } else {
        showToast(result.message, "error");
      }
    });
  }

  const expenseTicketOptions = useMemo(() => {
    const receivedAt = (ticket: ServiceTicket) => {
      const created = ticket.created_at
        ? new Date(ticket.created_at).getTime()
        : 0;
      const opened = ticket.opened_at
        ? new Date(ticket.opened_at).getTime()
        : 0;
      // Prefer created_at as received time; fall back to opened_at.
      return created || opened || 0;
    };

    return [...tickets].sort((a, b) => receivedAt(b) - receivedAt(a));
  }, [tickets]);

  const selectedExpenseTicket = tickets.find(
    (ticket) => ticket.id === expenseTicketId,
  );

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (expenseOnly) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Expense Tracker"
          description="Add travel, supplies, meals, and other ticket expenses in seconds."
        />

        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body grid gap-3 py-4 sm:grid-cols-2">
            <label className="form-control min-w-0">
              <span className="label-text mb-1 text-xs">Ticket / project</span>
              <select
                className="expense-ticket-select select select-bordered select-sm w-full min-w-0"
                value={expenseTicketId}
                onChange={(e) => setExpenseTicketId(e.target.value)}
              >
                <option value="">Select ticket</option>
                {expenseTicketOptions.map((ticket) => {
                  const fullLabel = `${ticket.ticket_number} — ${ticket.title}`;
                  const label =
                    fullLabel.length > 56
                      ? `${fullLabel.slice(0, 53).trimEnd()}…`
                      : fullLabel;
                  return (
                    <option key={ticket.id} value={ticket.id} title={fullLabel}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="form-control min-w-0">
              <span className="label-text mb-1 text-xs">Technician</span>
              <select
                className="select select-bordered select-sm w-full min-w-0"
                value={expenseTechnicianId}
                onChange={(e) => setExpenseTechnicianId(e.target.value)}
              >
                <option value="">Select technician</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.technician_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <ExpenseTracker
          ticketId={expenseTicketId}
          technicianId={expenseTechnicianId || null}
          ticketLabel={
            selectedExpenseTicket
              ? `${selectedExpenseTicket.ticket_number} — ${selectedExpenseTicket.title}`
              : undefined
          }
        />
      </div>
    );
  }

  if (!canManage) {
    return (
      <AlertBanner
        tone="info"
        title="Work & Billing"
        message="This approval queue is for managers and billing. Technicians log and correct time from My Work, and track expenses under Expense Tracker."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work & Billing"
        description="Approve technician time and billable Expense Tracker items, then send to Billing. Travel/meals invoice only after Billable + manager approval. Parts and equipment follow work-entry and contract budget rules."
      />

      <ApprovalManagerPanel tickets={tickets} technicians={technicians} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <button
          type="button"
          onClick={() => setView("expenses")}
          className={`rounded-box border p-4 text-left transition ${
            view === "expenses"
              ? "border-warning bg-warning/10"
              : "border-base-300 bg-base-100 hover:border-base-content/20"
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-base-content/60">
            Billable expenses
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {pendingBillableExpenseCount}
          </p>
          <p className="text-xs text-base-content/55">
            Pending approval · {readyExpenses.length} ready to invoice
          </p>
        </button>
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
          <p className="text-xs text-base-content/55">{ready.length} approved entries</p>
        </button>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">
            Hours this month
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {formatHours(monthRollup.included + monthRollup.billable)}
          </p>
          <p className="text-xs text-base-content/55">
            {formatHours(monthRollup.included)} in plan pool · {formatHours(monthRollup.billable)} overage
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
            ["expenses", `Billable expenses (${pendingBillableExpenseCount})`],
            ["queue", `Approve queue (${pending.length})`],
            ["returned", `Returned (${returned.length})`],
            [
              "ready",
              `Ready to invoice (${ready.length + readyExpenses.length})`,
            ],
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

      {view === "expenses" ? (
        <div className="space-y-4">
          <div className="rounded-box border border-base-300 bg-base-200/40 px-4 py-3 text-sm text-base-content/70">
            Technicians mark Expense Tracker items as{" "}
            <span className="font-medium text-base-content">Billable to Customer</span>
            . Approve them in the panel above. Approved items appear under Ready to
            invoice and can be sent to Billing as draft invoices. Internal expenses
            never invoice.
          </div>
          {readyExpenses.length > 0 ? (
            <div className="card border border-primary/30 bg-primary/5 shadow-sm">
              <div className="card-body gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-medium">
                      Approved expenses ready to invoice
                    </h3>
                    <p className="text-sm text-base-content/60">
                      {readyExpenses.length} item
                      {readyExpenses.length === 1 ? "" : "s"} ·{" "}
                      {formatCurrency(readyExpenseTotal)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={isPending}
                    onClick={handleInvoiceApprovedExpenses}
                  >
                    {isPending ? (
                      <span className="loading loading-spinner loading-sm" />
                    ) : (
                      "Invoice approved expenses"
                    )}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Ticket</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readyExpenses.map((expense) => {
                        const ticket = tickets.find(
                          (t) => t.id === expense.ticket_id,
                        );
                        return (
                          <tr key={expense.id}>
                            <td>{formatDate(expense.date)}</td>
                            <td className="font-mono text-xs">
                              {ticket?.ticket_number ?? "—"}
                            </td>
                            <td>{expense.type}</td>
                            <td className="max-w-xs truncate text-sm">
                              {expense.description ?? "—"}
                            </td>
                            <td className="text-right">
                              {formatCurrency(expense.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-base-content/60">
              No approved billable expenses waiting to invoice. Pending items are
              in the approval panel above.
            </p>
          )}
        </div>
      ) : null}

      {view === "ready" ? (
        <div className="rounded-box border border-base-300 bg-base-200/40 px-4 py-3 text-sm text-base-content/70">
          Select approved work entries, then{" "}
          <span className="font-medium text-base-content">Send to Billing</span>.
          Plan hour pools apply automatically. Send also invoices any approved
          Expense Tracker billable items ({readyExpenses.length} ready ·{" "}
          {formatCurrency(readyExpenseTotal)}). Parts and equipment on work entries
          keep existing contract-budget rules. Creates{" "}
          <span className="font-medium text-base-content">Draft</span> invoices.
        </div>
      ) : null}

      {view === "ready" &&
      (selectedIds.length > 0 || readyExpenses.length > 0) ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 rounded-box border border-primary/40 bg-primary/10 p-3 shadow-sm">
          <span className="text-sm font-medium">
            {selectedIds.length} work selected
            {readyExpenses.length > 0
              ? ` · ${readyExpenses.length} expenses ready`
              : ""}
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={isPending || (selectedIds.length === 0 && readyExpenses.length === 0)}
            onClick={handlePushToInvoice}
          >
            {isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Send to Billing"
            )}
          </button>
          {selectedIds.length > 0 ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedIds([])}
            >
              Clear
            </button>
          ) : null}
          <span className="text-xs text-base-content/60">
            Creates draft invoices and opens Billing
          </span>
        </div>
      ) : null}

      {view !== "expenses" && visibleRows.length === 0 ? (
        <EmptyState
          title={
            view === "queue"
              ? "Approval queue is clear"
              : view === "returned"
                ? "Nothing returned to technicians"
                : view === "ready"
                  ? "No approved work ready to invoice"
                  : "No work entries yet"
          }
          description="Entries appear after technicians log work on tickets in My Work."
        />
      ) : null}

      {view !== "expenses" && visibleRows.length > 0 ? (
        <div className="space-y-3">
          {visibleRows.map((row) => {
            const expanded = expandedId === row.id;
            const selectable =
              view === "ready" ||
              (view === "history" &&
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
      ) : null}
    </div>
  );
}
