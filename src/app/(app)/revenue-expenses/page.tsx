"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import { buildRevenueExpenseTotals } from "@/lib/revenue-expenses";
import { createClient } from "@/lib/supabase/client";
import type {
  Customer,
  Invoice,
  ServiceTicket,
  TicketExpense,
  WorkEntry,
} from "@/lib/types";

const MANAGER_ROLES = new Set(["administrator", "service_manager"]);

export default function RevenueExpensesPage() {
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [ticketExpenses, setTicketExpenses] = useState<TicketExpense[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [c, i, w, e, t] = await Promise.all([
        supabase.from("customers").select("*").order("customer_name"),
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
        supabase.from("service_tickets").select("id, ticket_number, title"),
      ]);
      setCustomers(c.data ?? []);
      setInvoices(i.data ?? []);
      setWorkEntries(w.data ?? []);
      setTicketExpenses((e.data as TicketExpense[]) ?? []);
      setTickets((t.data as ServiceTicket[]) ?? []);
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

  const totals = useMemo(
    () => buildRevenueExpenseTotals(invoices, workEntries, ticketExpenses),
    [invoices, workEntries, ticketExpenses],
  );

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
          hint="Internal Company Expense tracker (accepted)"
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
          <h2 className="text-base font-semibold">Revenue from invoices</h2>
          <p className="mt-1 text-sm text-base-content/70">
            Recognized invoice totals. Open a row to inspect it in{" "}
            <Link href="/billing" className="link">
              Billing
            </Link>
            .
          </p>
        </div>
        {totals.recognizedInvoices.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No recognized invoices yet"
              description="Issued and paid invoices appear here after billing cadence or manual invoice creation."
            />
          </div>
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
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 shadow-sm">
        <div className="border-b border-base-300 px-5 py-4">
          <h2 className="text-base font-semibold">Ticket fulfillment expenses</h2>
          <p className="mt-1 text-sm text-base-content/70">
            Direct costs to deliver tickets: work-entry labor and pass-through, plus
            accepted billable ticket expenses. Does not change how client invoices or
            expense approvals work.
          </p>
        </div>

        <div className="space-y-6 p-5">
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
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 shadow-sm">
        <div className="border-b border-base-300 px-5 py-4">
          <h2 className="text-base font-semibold">Operating expenses</h2>
          <p className="mt-1 text-sm text-base-content/70">
            Accepted Internal Company Expense tracker spend (not billed to customers).
          </p>
        </div>
        <div className="p-5">
          {totals.operatingExpenses.length === 0 ? (
            <EmptyState
              title="No operating expenses yet"
              description="Internal Company Expense rows from the expense tracker appear here once accepted."
            />
          ) : (
            <ExpenseTable
              expenses={totals.operatingExpenses}
              ticketMap={ticketMap}
            />
          )}
        </div>
      </section>

      <div className="rounded-box border border-base-300 bg-base-200/40 px-5 py-4 text-sm text-base-content/75">
        <p className="font-medium text-base-content">How these connect</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Revenue rows open{" "}
            <Link href="/billing" className="link">
              Billing
            </Link>{" "}
            on that invoice.
          </li>
          <li>
            Work costs and expenses open{" "}
            <Link href="/time-costs" className="link">
              Work &amp; Billing
            </Link>{" "}
            / Expense Tracker, and tickets open{" "}
            <Link href="/service-tickets" className="link">
              Service Tickets
            </Link>
            .
          </li>
          <li>
            Technician pay on My Work stays separate (salaried weekdays). Client
            billable hours and expenses still drive contracts and invoices.
          </li>
        </ul>
      </div>
    </div>
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
