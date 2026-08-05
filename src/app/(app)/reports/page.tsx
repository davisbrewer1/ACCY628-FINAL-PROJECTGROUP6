"use client";

import { useEffect, useMemo, useState } from "react";
import { calcContractProfit, calcProfitMargin } from "@/lib/calculations";
import { isThisMonth } from "@/lib/dashboard-stats";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  cashCollectedMtd,
  getPastDueInvoices,
  getReadyToInvoiceEntries,
  getRenewalsInDays,
} from "@/lib/manager-ops";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Invoice, Payment, WorkEntry } from "@/lib/types";

type ReportView = "cash" | "margin" | "leakage" | "churn";

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ReportView>("cash");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [co, w, i, p] = await Promise.all([
        supabase.from("contracts").select("*"),
        supabase.from("work_entries").select("*"),
        supabase.from("invoices").select("*"),
        supabase.from("payments").select("*"),
      ]);
      setContracts(co.data ?? []);
      setWorkEntries(w.data ?? []);
      setInvoices(i.data ?? []);
      setPayments(p.data ?? []);
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
    // cash / billed focus uses contracts with AR-linked context via same table
    return [...contractRows].sort((a, b) => b.revenue - a.revenue);
  }, [view, contractRows, contracts]);

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
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manager reports"
        description="Saved views tied to cash, margin, hours leakage, and churn risk — each with a next action."
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["cash", "Cash vs billed"],
            ["margin", "Margin by contract"],
            ["leakage", "Hours leakage"],
            ["churn", "Churn / renewal risk"],
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
    </div>
  );
}
