"use client";

import { EmptyState } from "@/components/EmptyState";
import { MonthPicker } from "@/components/MonthPicker";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDateTime, formatPercent } from "@/lib/format";
import type { Customer, ServiceTicket, Technician } from "@/lib/types";

export type LegacyReportView =
  | "cash"
  | "margin"
  | "leakage"
  | "churn"
  | "resolution";

type ContractRow = {
  id: string;
  name: string;
  customerId: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number | null;
  overHours: boolean;
  leakageHours: number;
  leakageEstimate: number;
  renewalDate: string | null;
  automaticRenewal: boolean | null;
  lowMargin: boolean;
  negative: boolean;
};

type Summary = {
  recurringRevenue: number;
  unbilledRevenue: number;
  accountsReceivable: number;
  pastDue: number;
  cashMtd: number;
  renewals90: number;
};

type ResolutionStats = {
  count: number;
  avgHours: number | null;
  companyAvg: number | null;
  rows: { ticket: ServiceTicket; hours: number }[];
};

function formatDurationHours(hours: number | null): string {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours < 24) return `${hours.toFixed(1)} hrs`;
  const days = hours / 24;
  return `${hours.toFixed(1)} hrs (${days.toFixed(1)} days)`;
}

const nextActions: Record<LegacyReportView, string> = {
  cash: "Collect past-due AR and invoice unbilled overages.",
  margin: "Review lowest-margin contracts for rate or scope changes.",
  leakage: "Approve and invoice hours beyond included allotments.",
  churn: "Call accounts renewing soon with low margin or service risk.",
  resolution:
    "Coach technicians or adjust staffing where average resolution time is above the company baseline.",
};

interface ExistingReportPanelProps {
  view: LegacyReportView;
  summary: Summary;
  viewRows: ContractRow[];
  customers: Customer[];
  technicians: Technician[];
  customerMap: Map<string, string>;
  techMap: Map<string, string>;
  resolutionCustomerId: string;
  resolutionTechId: string;
  resolutionMonth: Date | null;
  monthsWithResolutions: Set<string>;
  resolvedTicketCount: number;
  resolutionStats: ResolutionStats;
  onResolutionCustomerId: (id: string) => void;
  onResolutionTechId: (id: string) => void;
  onResolutionMonth: (month: Date | null) => void;
}

export function ExistingReportPanel({
  view,
  summary,
  viewRows,
  customers,
  technicians,
  customerMap,
  techMap,
  resolutionCustomerId,
  resolutionTechId,
  resolutionMonth,
  monthsWithResolutions,
  resolvedTicketCount,
  resolutionStats,
  onResolutionCustomerId,
  onResolutionTechId,
  onResolutionMonth,
}: ExistingReportPanelProps) {
  return (
    <div className="space-y-4">
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
                onChange={(e) => onResolutionCustomerId(e.target.value)}
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
              <span className="label-text mb-1 text-xs font-medium">
                Technician
              </span>
              <select
                className="select select-bordered select-sm"
                value={resolutionTechId}
                onChange={(e) => onResolutionTechId(e.target.value)}
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
              onChange={onResolutionMonth}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              title="Company average (all time)"
              value={formatDurationHours(resolutionStats.companyAvg)}
              hint={`${resolvedTicketCount} resolved tickets`}
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
                            <div className="font-mono text-xs">
                              {ticket.ticket_number}
                            </div>
                            <div className="font-medium">{ticket.title}</div>
                          </td>
                          <td>{customerMap.get(ticket.customer_id) ?? "—"}</td>
                          <td>
                            {ticket.assigned_technician_id
                              ? (techMap.get(ticket.assigned_technician_id) ??
                                "—")
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
              href={
                view === "churn"
                  ? "/contracts?filter=renewals"
                  : "/billing?filter=cash"
              }
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
                          <td
                            className={
                              row.negative ? "font-medium text-error" : ""
                            }
                          >
                            {formatCurrency(row.profit)}
                          </td>
                          <td>
                            {row.margin != null
                              ? formatPercent(row.margin)
                              : "—"}
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
                            {row.negative ? (
                              <StatusBadge status="Negative profit" />
                            ) : null}
                            {row.lowMargin ? (
                              <StatusBadge status="Low margin" />
                            ) : null}
                            {row.overHours ? (
                              <StatusBadge status="Over included hours" />
                            ) : null}
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
