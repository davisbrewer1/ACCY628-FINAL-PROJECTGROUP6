"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import {
  buildContractProfitabilityRows,
  buildRevenueExpenseTotals,
} from "@/lib/revenue-expenses";
import { createClient } from "@/lib/supabase/client";
import type {
  Contract,
  Customer,
  Invoice,
  ServiceTicket,
  Technician,
  TicketExpense,
  WorkEntry,
} from "@/lib/types";

const MANAGER_ROLES = new Set(["administrator", "service_manager"]);

export default function RevenueExpensesPage() {
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [ticketExpenses, setTicketExpenses] = useState<TicketExpense[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [revenueOpen, setRevenueOpen] = useState(false);
  const [fulfillmentOpen, setFulfillmentOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [c, ct, i, w, e, t, tech] = await Promise.all([
        supabase.from("customers").select("*").order("customer_name"),
        supabase.from("contracts").select("*").order("contract_name"),
        supabase
          .from("invoices")
          .select("*")
          .order("invoice_date", { ascending: false }),
        supabase
          .from("work_entries")
          .select("*")
          .order("work_date", { ascending: false }),
        supabase
          .from("ticket_expenses")
          .select("*")
          .order("date", { ascending: false }),
        supabase
          .from("service_tickets")
          .select("id, ticket_number, title, contract_id"),
        supabase.from("technicians").select("*").eq("active", true),
      ]);
      setCustomers(c.data ?? []);
      setContracts(ct.data ?? []);
      setInvoices(i.data ?? []);
      setWorkEntries(w.data ?? []);
      setTicketExpenses((e.data as TicketExpense[]) ?? []);
      setTickets((t.data as ServiceTicket[]) ?? []);
      setTechnicians((tech.data as Technician[]) ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  const customerMap = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer.customer_name])),
    [customers],
  );
  const ticketMap = useMemo(
    () => new Map(tickets.map((ticket) => [ticket.id, ticket])),
    [tickets],
  );
  const ticketContractById = useMemo(
    () =>
      new Map(
        tickets.map((ticket) => [ticket.id, ticket.contract_id] as const),
      ),
    [tickets],
  );

  const totals = useMemo(
    () =>
      buildRevenueExpenseTotals(invoices, workEntries, ticketExpenses, {
        activeTechCount: technicians.length,
      }),
    [invoices, workEntries, ticketExpenses, technicians.length],
  );

  const contractProfit = useMemo(
    () =>
      buildContractProfitabilityRows(
        contracts,
        invoices,
        workEntries,
        ticketExpenses,
        ticketContractById,
      ),
    [contracts, invoices, workEntries, ticketExpenses, ticketContractById],
  );

  const payroll = totals.technicianPayroll;
  const payPeriodLabel = `${formatDate(payroll.payPeriod.start.toISOString())} – ${formatDate(payroll.payPeriod.end.toISOString())}`;

  if (!MANAGER_ROLES.has(activeRole)) {
    return (
      <AlertBanner
        tone="info"
        title="Revenue and expenses"
        message="This page is for service managers. Switch to a manager account to review revenue and costs."
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
        title="Revenue & Expenses"
        description="Invoice revenue, ticket fulfillment costs, and internal operating expenses — each total links back to source records."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Revenue (invoiced)"
          value={formatCurrency(totals.revenue)}
          hint="Issued, Past Due, Partially Paid, Paid"
          tone="success"
          href="/billing"
        />
        <StatCard
          title="Ticket fulfillment"
          value={formatCurrency(totals.fulfillment)}
          hint={`${formatCurrency(totals.fulfillmentWork)} work + ${formatCurrency(totals.fulfillmentBillable)} billable expenses`}
          tone={totals.fulfillment > 0 ? "warning" : "default"}
          href="/time-costs?filter=ready"
        />
        <StatCard
          title="Operating expenses"
          value={formatCurrency(totals.operating)}
          hint={`${formatCurrency(totals.operatingTracked)} internal + ${formatCurrency(payroll.payrollCost)} tech payroll`}
          tone={totals.operating > 0 ? "info" : "default"}
          href="/time-costs?filter=expenses"
        />
        <StatCard
          title="Contribution"
          value={formatCurrency(totals.contribution)}
          hint="Revenue minus fulfillment and opex"
          tone={totals.contribution >= 0 ? "success" : "danger"}
        />
      </div>

      <section className="rounded-box border border-base-300 bg-base-100 shadow-sm">
        <div className="border-b border-base-300 px-5 py-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">Contract profitability</h2>
              <p className="mt-1 text-sm text-base-content/70">
                Recognized invoice revenue vs fulfillment costs attributed to each
                open contract.
              </p>
            </div>
            <Link href="/contracts" className="link text-sm">
              Open Contracts
            </Link>
          </div>
        </div>
        {contractProfit.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No open contracts"
              description="Active or pending contracts appear here with invoice revenue and fulfillment costs."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Fulfillment</th>
                  <th className="text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {contractProfit.map((row) => (
                  <tr key={row.contractId} className="hover">
                    <td>
                      <Link
                        href={`/contracts?contract=${row.contractId}`}
                        className="link link-hover font-medium"
                      >
                        {row.contractName}
                      </Link>
                      <div className="mt-0.5">
                        <Link
                          href={`/service-tickets?contract=${row.contractId}`}
                          className="link link-hover text-xs text-base-content/60"
                        >
                          Related tickets
                        </Link>
                      </div>
                    </td>
                    <td>{customerMap.get(row.customerId) ?? "Unknown"}</td>
                    <td>
                      <StatusBadge status={row.status ?? "Active"} />
                    </td>
                    <td className="text-right font-medium">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="text-right">
                      {formatCurrency(row.fulfillment)}
                      <div className="text-xs text-base-content/55">
                        {formatCurrency(row.fulfillmentWork)} work ·{" "}
                        {formatCurrency(row.fulfillmentBillable)} expenses
                      </div>
                    </td>
                    <td
                      className={`text-right font-semibold ${
                        row.margin >= 0 ? "text-success" : "text-error"
                      }`}
                    >
                      {formatCurrency(row.margin)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 shadow-sm">
        <div className="border-b border-base-300 px-5 py-4">
          <h2 className="text-base font-semibold">Operating expenses</h2>
          <p className="mt-1 text-sm text-base-content/70">
            Current-period technician salaried payroll (same rules as My Work), plus{" "}
            {formatCurrency(totals.operatingTracked)} accepted Internal Company
            Expense tracker spend.
          </p>
        </div>
        <div className="p-5">
          <div className="rounded-box border border-base-300 bg-base-200/30 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  Technician paid hours (this pay period)
                </p>
                <p className="mt-1 text-xs text-base-content/60">
                  {payroll.activeTechCount} active tech
                  {payroll.activeTechCount === 1 ? "" : "s"} ×{" "}
                  {payroll.paidHoursPerTech} paid hours ×{" "}
                  {formatCurrency(payroll.hourlyRate)}/hr · Period {payPeriodLabel}
                </p>
              </div>
              <p className="text-lg font-semibold">
                {formatCurrency(payroll.payrollCost)}
              </p>
            </div>
            <p className="mt-2 text-xs text-base-content/55">
              <Link href="/my-work" className="link">
                My Work
              </Link>{" "}
              pay uses 8 salaried hours per weekday; billable delivery costs stay
              under fulfillment. Internal tracker expenses open in{" "}
              <Link href="/time-costs?filter=expenses" className="link">
                Work &amp; Billing
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <CollapsibleSection
        title="Revenue from invoices"
        summary={`${totals.recognizedInvoices.length} invoices · ${formatCurrency(totals.revenue)}`}
        description={
          <>
            Recognized invoice totals. Open a row to inspect it in{" "}
            <Link href="/billing" className="link">
              Billing
            </Link>
            .
          </>
        }
        open={revenueOpen}
        onToggle={() => setRevenueOpen((value) => !value)}
      >
        {totals.recognizedInvoices.length === 0 ? (
          <EmptyState
            title="No recognized invoices yet"
            description="Issued and paid invoices appear here after billing cadence or manual invoice creation."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {totals.recognizedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover">
                    <td>
                      <Link
                        href={`/billing?invoice=${invoice.id}`}
                        className="link link-hover font-mono text-xs font-semibold"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td>
                      {customerMap.get(invoice.customer_id) ?? "Unknown"}
                    </td>
                    <td className="capitalize">
                      {(invoice.invoice_source ?? "manual").replaceAll("_", " ")}
                    </td>
                    <td>
                      <StatusBadge status={invoice.status ?? "Issued"} />
                    </td>
                    <td>{formatDate(invoice.invoice_date)}</td>
                    <td className="text-right font-medium">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Ticket fulfillment expenses"
        summary={`${formatCurrency(totals.fulfillment)} total`}
        description="Direct costs to deliver tickets: work-entry labor and pass-through, plus accepted billable ticket expenses."
        open={fulfillmentOpen}
        onToggle={() => setFulfillmentOpen((value) => !value)}
      >
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-sm font-semibold">
                Work entries ({formatCurrency(totals.fulfillmentWork)})
              </h3>
              <Link href="/time-costs?filter=ready" className="link text-sm">
                Open Work &amp; Billing
              </Link>
            </div>
            {workEntries.length === 0 ? (
              <p className="text-sm text-base-content/60">No work entries logged.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Date</th>
                      <th>Hours</th>
                      <th>Method</th>
                      <th className="text-right">Direct cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workEntries.slice(0, 40).map((entry) => {
                      const ticket = ticketMap.get(entry.ticket_id);
                      return (
                        <tr key={entry.id} className="hover">
                          <td>
                            <Link
                              href={`/service-tickets?ticket=${entry.ticket_id}`}
                              className="link link-hover font-mono text-xs"
                            >
                              {ticket?.ticket_number ?? "Ticket"}
                            </Link>
                            <div className="mt-0.5">
                              <Link
                                href={`/time-costs?entry=${entry.id}`}
                                className="link link-hover text-xs text-base-content/60"
                              >
                                View work entry
                              </Link>
                            </div>
                          </td>
                          <td>{formatDate(entry.work_date)}</td>
                          <td>{formatHours(entry.hours_worked)}</td>
                          <td>
                            {entry.service_method === "On-site"
                              ? "In-person"
                              : entry.service_method ?? "-"}
                          </td>
                          <td className="text-right font-medium">
                            {formatCurrency(entry.total_direct_cost)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {workEntries.length > 40 ? (
                  <p className="mt-2 text-xs text-base-content/55">
                    Showing latest 40 of {workEntries.length} work entries. Full list
                    lives in Work &amp; Billing.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-sm font-semibold">
                Billable ticket expenses (
                {formatCurrency(totals.fulfillmentBillable)})
              </h3>
              <Link
                href="/time-costs?filter=expenses"
                className="link text-sm"
              >
                Open expense tracker
              </Link>
            </div>
            {totals.billableExpenses.length === 0 ? (
              <p className="text-sm text-base-content/60">
                No accepted billable ticket expenses.
              </p>
            ) : (
              <ExpenseTable
                expenses={totals.billableExpenses}
                ticketMap={ticketMap}
              />
            )}
          </div>
        </div>
      </CollapsibleSection>

      <div className="rounded-box border border-base-300 bg-base-200/40 px-5 py-4 text-sm text-base-content/75">
        <p className="font-medium text-base-content">How these connect</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Expand Revenue or Ticket fulfillment below for source rows that open{" "}
            <Link href="/billing" className="link">
              Billing
            </Link>{" "}
            and{" "}
            <Link href="/time-costs" className="link">
              Work &amp; Billing
            </Link>
            .
          </li>
          <li>
            Contract profitability compares recognized invoice revenue to
            contract-linked fulfillment costs.
          </li>
          <li>
            Operating expenses include current biweekly technician salaried payroll
            plus accepted Internal Company Expense totals. Client billable hours and
            expenses stay under fulfillment and invoices.
          </li>
        </ul>
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  summary,
  description,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  description: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-box border border-base-300 bg-base-100 shadow-sm">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left hover:bg-base-200/40"
        onClick={onToggle}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-base-content/70">{description}</p>
          {!open ? (
            <p className="mt-2 text-xs font-medium text-base-content/55">
              {summary} · Click to expand
            </p>
          ) : null}
        </div>
        <span
          className="mt-0.5 shrink-0 text-base-content/50"
          aria-hidden="true"
        >
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-base-300 p-5">{children}</div>
      ) : null}
    </section>
  );
}

function ExpenseTable({
  expenses,
  ticketMap,
}: {
  expenses: TicketExpense[];
  ticketMap: Map<string, ServiceTicket>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Type</th>
            <th>Tag</th>
            <th>Status</th>
            <th>Date</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {expenses.slice(0, 40).map((expense) => {
            const ticket = ticketMap.get(expense.ticket_id);
            return (
              <tr key={expense.id} className="hover">
                <td>
                  <Link
                    href={`/service-tickets?ticket=${expense.ticket_id}`}
                    className="link link-hover font-mono text-xs"
                  >
                    {ticket?.ticket_number ?? "Ticket"}
                  </Link>
                  <div className="mt-0.5">
                    <Link
                      href={`/time-costs?filter=expenses&expense=${expense.id}`}
                      className="link link-hover text-xs text-base-content/60"
                    >
                      View expense
                    </Link>
                  </div>
                </td>
                <td>{expense.type}</td>
                <td className="text-xs">{expense.expense_tag}</td>
                <td>
                  <StatusBadge status={expense.approval_status ?? "Accepted"} />
                </td>
                <td>{formatDate(expense.date)}</td>
                <td className="text-right font-medium">
                  {formatCurrency(expense.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {expenses.length > 40 ? (
        <p className="mt-2 text-xs text-base-content/55">
          Showing latest 40 of {expenses.length}. Full detail is in Work &amp;
          Billing.
        </p>
      ) : null}
    </div>
  );
}
