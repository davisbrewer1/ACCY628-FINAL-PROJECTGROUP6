"use client";

import { useEffect, useMemo, useState } from "react";
import { calcContractProfit, calcProfitMargin } from "@/lib/calculations";
import { isThisMonth } from "@/lib/dashboard-stats";
import { EmptyState } from "@/components/EmptyState";
import { MonthPicker, isInSelectedMonth, monthKeyFromDate } from "@/components/MonthPicker";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import {
  cashCollectedMtd,
  getPastDueInvoices,
  getReadyToInvoiceEntries,
  getRenewalsInDays,
} from "@/lib/manager-ops";
import { createClient } from "@/lib/supabase/client";
import type {
  Contract,
  Customer,
  Invoice,
  Payment,
  ServiceTicket,
  Technician,
  WorkEntry,
} from "@/lib/types";
import { differenceInMinutes, parseISO } from "date-fns";

type ReportView = "cash" | "margin" | "leakage" | "churn" | "resolution";

function formatDurationHours(hours: number | null): string {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours < 24) return `${hours.toFixed(1)} hrs`;
  const days = hours / 24;
  return `${hours.toFixed(1)} hrs (${days.toFixed(1)} days)`;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ReportView>("cash");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [resolutionCustomerId, setResolutionCustomerId] = useState("");
  const [resolutionTechId, setResolutionTechId] = useState("");
  const [resolutionMonth, setResolutionMonth] = useState<Date | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [co, w, i, p, t, c, tech] = await Promise.all([
        supabase.from("contracts").select("*"),
        supabase.from("work_entries").select("*"),
        supabase.from("invoices").select("*"),
        supabase.from("payments").select("*"),
        supabase.from("service_tickets").select("*"),
        supabase.from("customers").select("*").order("customer_name"),
        supabase.from("technicians").select("*").eq("active", true).order("technician_name"),
      ]);
      setContracts(co.data ?? []);
      setWorkEntries(w.data ?? []);
      setInvoices(i.data ?? []);
      setPayments(p.data ?? []);
      setTickets(t.data ?? []);
      setCustomers(c.data ?? []);
      setTechnicians(tech.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const summary = useMemo(() => {
    const recurringRevenue = contracts
      .filter((c) => c.contract_status === "Active")
      .reduce((sum, c) => sum + (c.monthly_recurring_fee ?? 0), 0);

    const unbilledRevenue = getReadyToInvoiceEntries(workEntries).reduce(
      (sum, e) => sum + (e.total_direct_cost ?? 0),
      0,
    );

    const accountsReceivable = invoices.reduce(
      (sum, i) => sum + (i.remaining_balance ?? 0),
      0,
    );

    const pastDue = getPastDueInvoices(invoices).reduce(
      (sum, i) => sum + (i.remaining_balance ?? 0),
      0,
    );

    return {
      recurringRevenue,
      unbilledRevenue,
      accountsReceivable,
      pastDue,
      cashMtd: cashCollectedMtd(payments),
      renewals90: getRenewalsInDays(contracts, 90).length,
    };
  }, [contracts, workEntries, invoices, payments]);

  const contractRows = useMemo(() => {
    return contracts.map((contract) => {
      const costs = workEntries
        .filter((e) => e.contract_id === contract.id)
        .reduce((sum, e) => sum + (e.total_direct_cost ?? 0), 0);
      const monthHours = workEntries
        .filter((e) => e.contract_id === contract.id && isThisMonth(e.work_date))
        .reduce((sum, e) => sum + (e.hours_worked ?? 0), 0);
      const included = contract.included_support_hours ?? 0;
      const revenue = contract.monthly_recurring_fee ?? 0;
      const profit = calcContractProfit(revenue, costs);
      const margin = calcProfitMargin(revenue, costs);
      const overHours = included > 0 && monthHours > included;
      const leakageHours = Math.max(0, monthHours - included);
      const leakageEstimate =
        leakageHours * (contract.additional_hourly_rate ?? 0);

      return {
        id: contract.id,
        name: contract.contract_name,
        customerId: contract.customer_id,
        revenue,
        costs,
        profit,
        margin,
        overHours,
        leakageHours,
        leakageEstimate,
        renewalDate: contract.renewal_date,
        automaticRenewal: contract.automatic_renewal,
        lowMargin: margin != null && margin < 10,
        negative: profit < 0,
      };
    });
  }, [contracts, workEntries]);

  const viewRows = useMemo(() => {
    if (view === "margin") {
      return [...contractRows].sort(
        (a, b) => (a.margin ?? 999) - (b.margin ?? 999),
      );
    }
    if (view === "leakage") {
      return contractRows
        .filter((r) => r.overHours)
        .sort((a, b) => b.leakageEstimate - a.leakageEstimate);
    }
    if (view === "churn") {
      const renewing = new Set(getRenewalsInDays(contracts, 90).map((c) => c.id));
      return contractRows
        .filter((r) => renewing.has(r.id) || r.lowMargin || r.negative)
        .sort((a, b) => {
          const ad = a.renewalDate ?? "9999";
          const bd = b.renewalDate ?? "9999";
          return ad.localeCompare(bd);
        });
    }
    return [...contractRows].sort((a, b) => b.revenue - a.revenue);
  }, [view, contractRows, contracts]);

  const resolvedTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (!t.opened_at || !t.completed_at) return false;
      const status = t.status ?? "";
      return status === "Completed" || status === "Closed";
    });
  }, [tickets]);

  const monthsWithResolutions = useMemo(() => {
    const keys = new Set<string>();
    for (const t of resolvedTickets) {
      const key = monthKeyFromDate(t.completed_at ?? "");
      if (key) keys.add(key);
    }
    return keys;
  }, [resolvedTickets]);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.customer_name])),
    [customers],
  );
  const techMap = useMemo(
    () => new Map(technicians.map((t) => [t.id, t.technician_name])),
    [technicians],
  );

  const resolutionStats = useMemo(() => {
    const filtered = resolvedTickets.filter((t) => {
      if (resolutionCustomerId && t.customer_id !== resolutionCustomerId) {
        return false;
      }
      if (
        resolutionTechId &&
        t.assigned_technician_id !== resolutionTechId
      ) {
        return false;
      }
      if (!isInSelectedMonth(t.completed_at, resolutionMonth)) {
        return false;
      }
      return true;
    });

    const withHours = filtered
      .map((t) => {
        const opened = parseISO(t.opened_at!);
        const completed = parseISO(t.completed_at!);
        const minutes = differenceInMinutes(completed, opened);
        if (Number.isNaN(minutes) || minutes < 0) return null;
        return {
          ticket: t,
          hours: minutes / 60,
        };
      })
      .filter((row): row is { ticket: ServiceTicket; hours: number } => row != null);

    const avgHours =
      withHours.length > 0
        ? withHours.reduce((sum, row) => sum + row.hours, 0) / withHours.length
        : null;

    const companyAvg =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, t) => {
            const minutes = differenceInMinutes(
              parseISO(t.completed_at!),
              parseISO(t.opened_at!),
            );
            return sum + (Number.isNaN(minutes) || minutes < 0 ? 0 : minutes / 60);
          }, 0) / resolvedTickets.length
        : null;

    return {
      count: withHours.length,
      avgHours,
      companyAvg,
      rows: withHours
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 25),
    };
  }, [
    resolvedTickets,
    resolutionCustomerId,
    resolutionTechId,
    resolutionMonth,
  ]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const nextActions: Record<ReportView, string> = {
    cash: "Collect past-due AR and invoice unbilled overages.",
    margin: "Review lowest-margin contracts for rate or scope changes.",
    leakage: "Approve and invoice hours beyond included allotments.",
    churn: "Call accounts renewing soon with low margin or service risk.",
    resolution:
      "Coach technicians or adjust staffing where average resolution time is above the company baseline.",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manager reports"
        description="Cash, margin, leakage, churn risk, and ticket resolution time — each with a next action."
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["cash", "Cash vs billed"],
            ["margin", "Margin by contract"],
            ["leakage", "Hours leakage"],
            ["churn", "Churn / renewal risk"],
            ["resolution", "Ticket resolution time"],
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

      <div className="alert alert-info text-sm">
        <span>
          <strong>Next action:</strong> {nextActions[view]}
        </span>
      </div>

      {view === "resolution" ? (
        <>
          <div className="flex flex-wrap items-end gap-4 rounded-box border border-base-300 bg-base-100 p-4">
            <label className="form-control w-full max-w-xs">
              <span className="label-text mb-1 text-xs font-medium">Customer</span>
              <select
                className="select select-bordered select-sm"
                value={resolutionCustomerId}
                onChange={(e) => setResolutionCustomerId(e.target.value)}
              >
                <option value="">All customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control w-full max-w-xs">
              <span className="label-text mb-1 text-xs font-medium">Technician</span>
              <select
                className="select select-bordered select-sm"
                value={resolutionTechId}
                onChange={(e) => setResolutionTechId(e.target.value)}
              >
                <option value="">All technicians</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.technician_name}
                  </option>
                ))}
              </select>
            </label>

            <MonthPicker
              label="Resolved in month"
              activeMonthKeys={monthsWithResolutions}
              value={resolutionMonth}
              onChange={setResolutionMonth}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              title="Company average (all time)"
              value={formatDurationHours(resolutionStats.companyAvg)}
              hint={`${resolvedTickets.length} resolved tickets`}
            />
            <StatCard
              title="Filtered average"
              value={formatDurationHours(resolutionStats.avgHours)}
              hint={`${resolutionStats.count} ticket${resolutionStats.count === 1 ? "" : "s"} in filter`}
              tone="info"
            />
            <StatCard
              title="Vs company baseline"
              value={
                resolutionStats.avgHours != null &&
                resolutionStats.companyAvg != null &&
                resolutionStats.companyAvg > 0
                  ? `${(
                      ((resolutionStats.avgHours - resolutionStats.companyAvg) /
                        resolutionStats.companyAvg) *
                      100
                    ).toFixed(0)}%`
                  : "—"
              }
              hint="Negative is faster than company average"
              tone={
                resolutionStats.avgHours != null &&
                resolutionStats.companyAvg != null &&
                resolutionStats.avgHours > resolutionStats.companyAvg
                  ? "warning"
                  : "success"
              }
            />
          </div>

          <div className="card border bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">Resolved tickets in filter</h2>
              {resolutionStats.rows.length === 0 ? (
                <EmptyState
                  title="No resolved tickets"
                  description="Try another customer, technician, or month. Gray months in the calendar have no resolutions."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>Customer</th>
                        <th>Technician</th>
                        <th>Opened</th>
                        <th>Completed</th>
                        <th className="text-right">Resolution time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolutionStats.rows.map(({ ticket, hours }) => (
                        <tr key={ticket.id}>
                          <td>
                            <div className="font-mono text-xs">{ticket.ticket_number}</div>
                            <div className="font-medium">{ticket.title}</div>
                          </td>
                          <td>{customerMap.get(ticket.customer_id) ?? "—"}</td>
                          <td>
                            {ticket.assigned_technician_id
                              ? techMap.get(ticket.assigned_technician_id) ?? "—"
                              : "Unassigned"}
                          </td>
                          <td>{formatDateTime(ticket.opened_at)}</td>
                          <td>{formatDateTime(ticket.completed_at)}</td>
                          <td className="text-right font-medium">
                            {formatDurationHours(hours)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="MRR"
              value={formatCurrency(summary.recurringRevenue)}
              href="/contracts"
            />
            <StatCard
              title="Ready / unbilled"
              value={formatCurrency(summary.unbilledRevenue)}
              tone="info"
              href="/time-costs?filter=ready"
            />
            <StatCard
              title="Open AR"
              value={formatCurrency(summary.accountsReceivable)}
              hint={`${formatCurrency(summary.pastDue)} past due`}
              tone={summary.pastDue > 0 ? "danger" : "default"}
              href="/billing?filter=past-due"
            />
            <StatCard
              title={view === "churn" ? "Renewals (90d)" : "Cash MTD"}
              value={
                view === "churn"
                  ? summary.renewals90
                  : formatCurrency(summary.cashMtd)
              }
              tone="success"
              href={view === "churn" ? "/contracts?filter=renewals" : "/billing?filter=cash"}
            />
          </div>

          <div className="card border bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-base">
                {view === "cash" && "Contracts by revenue (cash context)"}
                {view === "margin" && "Lowest margin contracts first"}
                {view === "leakage" && "Hours over included allotment"}
                {view === "churn" && "Renewal and margin risk accounts"}
              </h2>

              {viewRows.length === 0 ? (
                <EmptyState
                  title="Nothing in this view"
                  description="Data will appear once contracts and work entries exist for this filter."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th>Contract</th>
                        <th>Revenue</th>
                        <th>Direct costs</th>
                        <th>Profit</th>
                        <th>Margin</th>
                        {view === "leakage" ? <th>Leakage $</th> : null}
                        {view === "churn" ? <th>Renewal</th> : null}
                        <th>Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewRows.map((row) => (
                        <tr key={row.id}>
                          <td className="font-medium">{row.name}</td>
                          <td>{formatCurrency(row.revenue)}</td>
                          <td>{formatCurrency(row.costs)}</td>
                          <td className={row.negative ? "font-medium text-error" : ""}>
                            {formatCurrency(row.profit)}
                          </td>
                          <td>
                            {row.margin != null ? formatPercent(row.margin) : "—"}
                          </td>
                          {view === "leakage" ? (
                            <td className="font-medium text-warning">
                              {formatCurrency(row.leakageEstimate)}
                            </td>
                          ) : null}
                          {view === "churn" ? (
                            <td>
                              {row.renewalDate ?? "—"}
                              <div className="text-xs text-base-content/60">
                                {row.automaticRenewal ? "Auto" : "Manual"}
                              </div>
                            </td>
                          ) : null}
                          <td className="flex flex-wrap gap-1">
                            {row.negative ? <StatusBadge status="Negative profit" /> : null}
                            {row.lowMargin ? <StatusBadge status="Low margin" /> : null}
                            {row.overHours ? <StatusBadge status="Over included hours" /> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
