"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  markWorkEntriesReadyToInvoice,
  updateWorkEntryApproval,
} from "@/app/actions/work-entries";
import { EmptyState } from "@/components/EmptyState";
import { ApprovalManagerPanel } from "@/components/ApprovalManagerPanel";
import { ExpenseTracker } from "@/components/ExpenseTracker";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import {
  getPendingApprovalEntries,
  getReadyToInvoiceEntries,
} from "@/lib/manager-ops";
import { isOpenTicket, isThisMonth } from "@/lib/dashboard-stats";
import { createClient } from "@/lib/supabase/client";
import type {
  Contract,
  Customer,
  ServiceTicket,
  Technician,
  WorkEntry,
} from "@/lib/types";

interface WorkEntryRow extends WorkEntry {
  technicianName: string;
  customerName: string;
  contractName: string;
  ticketNumber: string;
  additionalBillable: number;
}

type ViewMode = "queue" | "ready" | "all";

export default function TimeCostsPage() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("filter");
  const { activeRole } = useDemoRole();
  const expenseOnly = activeRole === "technician";
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>(
    initialFilter === "ready" ? "ready" : "queue",
  );
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expenseTicketId, setExpenseTicketId] = useState("");
  const [expenseTechnicianId, setExpenseTechnicianId] = useState("");
  const [isPending, startTransition] = useTransition();

  async function loadData() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const [w, tech, c, co, t] = await Promise.all([
      supabase
        .from("work_entries")
        .select("*")
        .order("work_date", { ascending: false }),
      supabase.from("technicians").select("*").order("technician_name"),
      supabase.from("customers").select("*"),
      supabase.from("contracts").select("*"),
      supabase
        .from("service_tickets")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    const techRows = tech.data ?? [];
    const ticketRows = t.data ?? [];
    setEntries(w.data ?? []);
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
    void loadData();
  }, []);

  useEffect(() => {
    if (initialFilter === "ready") setView("ready");
  }, [initialFilter]);

  const rows: WorkEntryRow[] = useMemo(() => {
    const techMap = new Map(technicians.map((t) => [t.id, t.technician_name]));
    const customerMap = new Map(customers.map((c) => [c.id, c.customer_name]));
    const contractMap = new Map(contracts.map((c) => [c.id, c]));
    const ticketMap = new Map(tickets.map((t) => [t.id, t.ticket_number]));

    return entries.map((entry) => {
      const contract = entry.contract_id
        ? contractMap.get(entry.contract_id)
        : null;
      const billableHours = entry.included_in_contract
        ? 0
        : (entry.hours_worked ?? 0);
      const additionalBillable =
        billableHours * (contract?.additional_hourly_rate ?? 0) +
        (entry.parts_cost ?? 0) +
        (entry.software_cost ?? 0) +
        (entry.equipment_cost ?? 0) +
        (entry.travel_cost ?? 0) +
        (entry.other_cost ?? 0);

      return {
        ...entry,
        technicianName: techMap.get(entry.technician_id) ?? "Unknown",
        customerName: customerMap.get(entry.customer_id) ?? "Unknown",
        contractName: contract?.contract_name ?? "—",
        ticketNumber: ticketMap.get(entry.ticket_id) ?? "—",
        additionalBillable,
      };
    });
  }, [entries, technicians, customers, contracts, tickets]);

  const pending = useMemo(() => getPendingApprovalEntries(entries), [entries]);
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
    return { included, billable, readyAmount, pendingCount: pending.length };
  }, [entries, rows, ready, pending]);

  const visibleRows = useMemo(() => {
    if (view === "queue") {
      const pendingIds = new Set(pending.map((e) => e.id));
      return rows.filter((r) => pendingIds.has(r.id));
    }
    if (view === "ready") {
      const readyIds = new Set(ready.map((e) => e.id));
      return rows.filter((r) => readyIds.has(r.id));
    }
    return rows;
  }, [view, rows, pending, ready]);

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

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleApproval(id: string, status: "Approved" | "Disputed") {
    startTransition(async () => {
      const result = await updateWorkEntryApproval(id, status);
      if (result.success) {
        showToast(result.message);
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    });
  }

  function handlePushToInvoice() {
    startTransition(async () => {
      const result = await markWorkEntriesReadyToInvoice(selectedIds);
      if (result.success) {
        showToast(result.message);
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const expenseSection = (
    <>
      {!expenseOnly ? (
        <div className="divider">Ticket expenses</div>
      ) : null}

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
    </>
  );

  if (expenseOnly) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Expense Tracker"
          description="Add travel, supplies, meals, and other ticket expenses in seconds."
        />
        {expenseSection}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Time & costs"
        description="Approve or dispute work, see included vs billable hours, and push approved overages to invoice."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Pending approval"
          value={monthRollup.pendingCount}
          tone="warning"
        />
        <StatCard
          title="Included hours (MTD)"
          value={formatHours(monthRollup.included)}
        />
        <StatCard
          title="Billable hours (MTD)"
          value={formatHours(monthRollup.billable)}
          tone="info"
        />
        <StatCard
          title="Ready to invoice $"
          value={formatCurrency(monthRollup.readyAmount)}
          tone="success"
          href="/billing"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["queue", "Approve / dispute queue"],
            ["ready", "Ready to invoice"],
            ["all", "All entries"],
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
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-box border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-medium">
            {selectedIds.length} selected
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={isPending}
            onClick={handlePushToInvoice}
          >
            Push to invoice queue
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSelectedIds([])}
          >
            Clear
          </button>
        </div>
      ) : null}

      {visibleRows.length === 0 ? (
        <EmptyState
          title="Nothing in this view"
          description="Work entries appear once technicians log time on tickets."
        />
      ) : (
        <div className="card border bg-base-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th />
                  <th>Date</th>
                  <th>Technician</th>
                  <th>Customer / contract</th>
                  <th>Ticket</th>
                  <th>Hours</th>
                  <th>Total cost</th>
                  <th>Type</th>
                  <th className="text-right">Billable $</th>
                  <th>Approval</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleSelected(row.id)}
                        aria-label={`Select work entry ${row.id}`}
                      />
                    </td>
                    <td>{formatDate(row.work_date)}</td>
                    <td>{row.technicianName}</td>
                    <td>
                      <div className="font-medium">{row.customerName}</div>
                      <div className="text-xs text-base-content/60">
                        {row.contractName}
                      </div>
                    </td>
                    <td className="font-mono text-xs">{row.ticketNumber}</td>
                    <td>{formatHours(row.hours_worked)}</td>
                    <td>{formatCurrency(row.total_direct_cost)}</td>
                    <td>
                      <StatusBadge
                        status={
                          row.included_in_contract ? "Included" : "Billable"
                        }
                      />
                    </td>
                    <td className="text-right">
                      {row.included_in_contract
                        ? "—"
                        : formatCurrency(row.additionalBillable)}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <StatusBadge
                          status={row.approval_status ?? "Pending"}
                        />
                        {row.billing_status ? (
                          <span className="text-xs text-base-content/60">
                            {row.billing_status}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          disabled={
                            isPending || row.approval_status === "Approved"
                          }
                          onClick={() => handleApproval(row.id, "Approved")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-warning"
                          disabled={
                            isPending || row.approval_status === "Disputed"
                          }
                          onClick={() => handleApproval(row.id, "Disputed")}
                        >
                          Dispute
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ApprovalManagerPanel tickets={tickets} technicians={technicians} />

      {expenseSection}
    </div>
  );
}
