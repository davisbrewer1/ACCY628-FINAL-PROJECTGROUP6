"use client";

import { useEffect, useMemo, useState } from "react";
import { calcContractProfit, calcProfitMargin } from "@/lib/calculations";
import { isThisMonth } from "@/lib/dashboard-stats";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatPercent } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Invoice, Payment, WorkEntry } from "@/lib/types";

const ACCOUNTING_TOOLTIPS = {
  recurringRevenue:
    "Monthly service fees should be associated with the service period in which support is delivered.",
  additionalRevenue:
    "Work performed beyond included contract hours may create additional billable revenue once approved.",
  unbilledRevenue:
    "Earned but unbilled service revenue represents completed work not yet invoiced.",
  unearnedRevenue:
    "Billed but unearned amounts are advance payments that should not be treated as earned revenue yet.",
  accountsReceivable:
    "Outstanding invoice balances represent amounts customers owe but have not yet paid.",
  payments:
    "Customer payments reduce accounts receivable when applied to outstanding invoices.",
  directLabor:
    "Direct labor cost is calculated from hours worked multiplied by technician internal rates.",
  passThrough:
    "Software and equipment costs should be connected to the related customer, contract, and ticket.",
  profitability:
    "Contract profit equals revenue minus direct costs. Margin is unavailable when revenue is zero.",
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
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

    const additionalRevenue = workEntries
      .filter((e) => !e.included_in_contract && e.approval_status === "Approved")
      .reduce((sum, e) => sum + (e.total_direct_cost ?? 0), 0);

    const unbilledRevenue = workEntries
      .filter((e) => e.billing_status !== "Billed" && !e.included_in_contract)
      .reduce((sum, e) => sum + (e.total_direct_cost ?? 0), 0);

    const accountsReceivable = invoices.reduce(
      (sum, i) => sum + (i.remaining_balance ?? 0),
      0,
    );

    const totalPayments = payments.reduce(
      (sum, p) => sum + (p.payment_amount ?? 0),
      0,
    );

    const directLabor = workEntries.reduce(
      (sum, e) => sum + (e.labor_cost ?? 0),
      0,
    );

    const passThroughCosts = workEntries.reduce(
      (sum, e) =>
        sum +
        (e.software_cost ?? 0) +
        (e.equipment_cost ?? 0) +
        (e.parts_cost ?? 0),
      0,
    );

    return {
      recurringRevenue,
      additionalRevenue,
      unbilledRevenue,
      accountsReceivable,
      totalPayments,
      directLabor,
      passThroughCosts,
    };
  }, [contracts, workEntries, invoices, payments]);

  const contractProfitability = useMemo(() => {
    return contracts.map((contract) => {
      const costs = workEntries
        .filter((e) => e.contract_id === contract.id)
        .reduce((sum, e) => sum + (e.total_direct_cost ?? 0), 0);
      const monthHours = workEntries
        .filter((e) => e.contract_id === contract.id && isThisMonth(e.work_date))
        .reduce((sum, e) => sum + (e.hours_worked ?? 0), 0);
      const revenue = contract.monthly_recurring_fee ?? 0;
      const profit = calcContractProfit(revenue, costs);
      const margin = calcProfitMargin(revenue, costs);
      const overHours =
        (contract.included_support_hours ?? 0) > 0 &&
        monthHours > (contract.included_support_hours ?? 0);

      return {
        id: contract.id,
        name: contract.contract_name,
        revenue,
        costs,
        profit,
        margin,
        overHours,
        lowMargin: margin != null && margin < 10,
        negative: profit < 0,
      };
    });
  }, [contracts, workEntries]);

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
        title="Management reports"
        description="Accounting summaries and contract profitability with explanatory guidance."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TooltipStat
          title="Recurring service revenue"
          value={formatCurrency(summary.recurringRevenue)}
          tooltip={ACCOUNTING_TOOLTIPS.recurringRevenue}
        />
        <TooltipStat
          title="Additional billable revenue"
          value={formatCurrency(summary.additionalRevenue)}
          tooltip={ACCOUNTING_TOOLTIPS.additionalRevenue}
        />
        <TooltipStat
          title="Earned, unbilled revenue"
          value={formatCurrency(summary.unbilledRevenue)}
          tooltip={ACCOUNTING_TOOLTIPS.unbilledRevenue}
        />
        <TooltipStat
          title="Accounts receivable"
          value={formatCurrency(summary.accountsReceivable)}
          tooltip={ACCOUNTING_TOOLTIPS.accountsReceivable}
        />
        <TooltipStat
          title="Customer payments"
          value={formatCurrency(summary.totalPayments)}
          tooltip={ACCOUNTING_TOOLTIPS.payments}
        />
        <TooltipStat
          title="Direct labor cost"
          value={formatCurrency(summary.directLabor)}
          tooltip={ACCOUNTING_TOOLTIPS.directLabor}
        />
        <TooltipStat
          title="Software & equipment costs"
          value={formatCurrency(summary.passThroughCosts)}
          tooltip={ACCOUNTING_TOOLTIPS.passThrough}
        />
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Contract profitability</h2>
          <p className="text-sm text-base-content/70" title={ACCOUNTING_TOOLTIPS.profitability}>
            Revenue minus direct costs by contract. Hover stat labels for accounting guidance.
          </p>

          {contractProfitability.length === 0 ? (
            <EmptyState
              title="No contract data"
              description="Profitability analysis will appear once contracts and work entries exist."
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
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {contractProfitability.map((row) => (
                    <tr key={row.id}>
                      <td className="font-medium">{row.name}</td>
                      <td>{formatCurrency(row.revenue)}</td>
                      <td>{formatCurrency(row.costs)}</td>
                      <td className={row.negative ? "text-error font-medium" : ""}>
                        {formatCurrency(row.profit)}
                      </td>
                      <td>
                        {row.margin != null ? formatPercent(row.margin) : "—"}
                      </td>
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
    </div>
  );
}

function TooltipStat({
  title,
  value,
  tooltip,
}: {
  title: string;
  value: string;
  tooltip: string;
}) {
  return (
    <div className="tooltip tooltip-bottom w-full" data-tip={tooltip}>
      <div>
        <StatCard title={title} value={value} />
      </div>
    </div>
  );
}
