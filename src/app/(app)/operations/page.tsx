"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { calcSlaStatus } from "@/lib/calculations";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, formatDateTime, formatHours } from "@/lib/format";
import {
  buildAccountHealthRows,
  cashCollectedMtd,
  computeContractHoursBurns,
  getAwaitingSendInvoices,
  getNewRecommendations,
  getOpenArInvoices,
  getOpenTickets,
  getPastDueInvoices,
  getReadyToInvoiceEntries,
  getRenewalsInDays,
  getSlaAtRiskTickets,
  getUnassignedTickets,
} from "@/lib/manager-ops";
import { createClient } from "@/lib/supabase/client";
import type {
  Contract,
  Customer,
  Invoice,
  Payment,
  Recommendation,
  ServiceTicket,
  WorkEntry,
} from "@/lib/types";

export default function OperationsPage() {
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const isServiceManager = activeRole === "service_manager";
  const isAccountManager = activeRole === "account_manager";
  const isAdmin = activeRole === "administrator";

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [c, co, t, w, i, p, r] = await Promise.all([
        supabase.from("customers").select("*"),
        supabase.from("contracts").select("*"),
        supabase
          .from("service_tickets")
          .select("*")
          .order("opened_at", { ascending: false }),
        supabase.from("work_entries").select("*"),
        supabase.from("invoices").select("*"),
        supabase.from("payments").select("*"),
        supabase.from("recommendations").select("*"),
      ]);
      setCustomers(c.data ?? []);
      setContracts(co.data ?? []);
      setTickets(t.data ?? []);
      setWorkEntries(w.data ?? []);
      setInvoices(i.data ?? []);
      setPayments(p.data ?? []);
      setRecommendations(r.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.customer_name])),
    [customers],
  );
  const contractMap = useMemo(
    () => new Map(contracts.map((c) => [c.id, c])),
    [contracts],
  );

  const openTickets = useMemo(() => getOpenTickets(tickets), [tickets]);
  const criticalOpen = useMemo(
    () => openTickets.filter((t) => t.priority === "Critical"),
    [openTickets],
  );
  const slaAtRisk = useMemo(() => getSlaAtRiskTickets(tickets), [tickets]);
  const unassigned = useMemo(() => getUnassignedTickets(tickets), [tickets]);
  const renewals30 = useMemo(() => getRenewalsInDays(contracts, 30), [contracts]);
  const renewals90 = useMemo(() => getRenewalsInDays(contracts, 90), [contracts]);
  const burns = useMemo(
    () => computeContractHoursBurns(contracts, workEntries),
    [contracts, workEntries],
  );
  const overHours = useMemo(() => burns.filter((b) => b.isOver), [burns]);
  const readyToInvoice = useMemo(
    () => getReadyToInvoiceEntries(workEntries),
    [workEntries],
  );
  const readyToInvoiceAmount = useMemo(
    () =>
      readyToInvoice.reduce((sum, e) => {
        const contract = e.contract_id ? contractMap.get(e.contract_id) : null;
        const hours = e.hours_worked ?? 0;
        return (
          sum +
          hours * (contract?.additional_hourly_rate ?? 0) +
          (e.parts_cost ?? 0) +
          (e.software_cost ?? 0) +
          (e.equipment_cost ?? 0) +
          (e.travel_cost ?? 0) +
          (e.other_cost ?? 0)
        );
      }, 0),
    [readyToInvoice, contractMap],
  );
  const openAr = useMemo(() => getOpenArInvoices(invoices), [invoices]);
  const pastDue = useMemo(() => getPastDueInvoices(invoices), [invoices]);
  const awaitingSend = useMemo(
    () => getAwaitingSendInvoices(invoices),
    [invoices],
  );
  const openArTotal = useMemo(
    () => openAr.reduce((sum, i) => sum + (i.remaining_balance ?? 0), 0),
    [openAr],
  );
  const pastDueTotal = useMemo(
    () => pastDue.reduce((sum, i) => sum + (i.remaining_balance ?? 0), 0),
    [pastDue],
  );
  const cashMtd = useMemo(() => cashCollectedMtd(payments), [payments]);
  const newRecs = useMemo(
    () => getNewRecommendations(recommendations),
    [recommendations],
  );
  const accountHealth = useMemo(
    () =>
      buildAccountHealthRows(
        customers,
        contracts,
        tickets,
        workEntries,
        invoices,
      ),
    [customers, contracts, tickets, workEntries, invoices],
  );

  if (
    activeRole !== "administrator" &&
    activeRole !== "service_manager" &&
    activeRole !== "account_manager"
  ) {
    return (
      <AlertBanner
        tone="info"
        title="Manager command center"
        message="This dashboard is designed for service and account managers. Use the Demo Role Switcher to preview this view."
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

  const focusLabel = isAccountManager
    ? "Focus: renewals, overages, AR, and cash."
    : isServiceManager
      ? "Focus: SLA risk, assignments, hours burn, and delivery capacity."
      : "Admin view of delivery and contract-to-cash queues.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manager command center"
        description={`Contract-to-cash for MSP delivery. ${focusLabel}`}
      />

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-base-content/60">
            Contract-to-cash pipeline
          </h2>
          <p className="text-xs text-base-content/50">Click any tile to act</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Renewals due (30d)"
            value={renewals30.length}
            hint="Contracts needing attention"
            tone={renewals30.length > 0 ? "warning" : "success"}
            href="/contracts?filter=renewals"
          />
          <StatCard
            title="Hours over included"
            value={overHours.length}
            hint={`${formatCurrency(overHours.reduce((s, b) => s + b.overageEstimate, 0))} est. overage`}
            tone={overHours.length > 0 ? "warning" : "success"}
            href="/contracts?filter=over-hours"
          />
          <StatCard
            title="Ready to invoice"
            value={readyToInvoice.length}
            hint={formatCurrency(readyToInvoiceAmount)}
            tone={readyToInvoice.length > 0 ? "info" : "default"}
            href="/time-costs?filter=ready"
          />
          <StatCard
            title="Open AR / past due"
            value={formatCurrency(openArTotal)}
            hint={`${formatCurrency(pastDueTotal)} past due · ${awaitingSend.length} awaiting send`}
            tone={pastDueTotal > 0 ? "danger" : "default"}
            href="/billing?filter=past-due"
          />
          <StatCard
            title="Cash collected (MTD)"
            value={formatCurrency(cashMtd)}
            hint="Payments this month"
            tone="success"
            href="/billing?filter=cash"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-base-content/60">
          Today&apos;s delivery pulse
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Open tickets"
            value={openTickets.length}
            tone="warning"
            href="/service-tickets?filter=open"
          />
          <StatCard
            title="Critical open"
            value={criticalOpen.length}
            tone={criticalOpen.length > 0 ? "danger" : "success"}
            href="/service-tickets?filter=critical"
          />
          <StatCard
            title="SLA at risk"
            value={slaAtRisk.length}
            tone={slaAtRisk.length > 0 ? "warning" : "success"}
            href="/service-tickets?filter=sla"
          />
          <StatCard
            title="Unassigned"
            value={unassigned.length}
            tone={unassigned.length > 0 ? "danger" : "success"}
            href="/service-tickets?filter=unassigned"
          />
          <StatCard
            title="Recs to approve"
            value={newRecs.length}
            tone={newRecs.length > 0 ? "info" : "default"}
            href="/recommendations?filter=new"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {(isServiceManager || isAdmin) && (
          <>
            <ActionQueue
              title="Unassigned tickets"
              href="/service-tickets?filter=unassigned"
              emptyTitle="Inbox clear"
              emptyDescription="No unassigned open tickets."
              items={unassigned.slice(0, 6).map((ticket) => ({
                id: ticket.id,
                primary: ticket.title,
                secondary: `${ticket.ticket_number} · ${customerMap.get(ticket.customer_id) ?? "—"}`,
                meta: <PriorityBadge priority={ticket.priority ?? "Medium"} />,
              }))}
            />
            <ActionQueue
              title="SLA at risk"
              href="/service-tickets?filter=sla"
              emptyTitle="All on track"
              emptyDescription="No tickets approaching or past SLA."
              items={slaAtRisk.slice(0, 6).map((ticket) => ({
                id: ticket.id,
                primary: ticket.title,
                secondary: `Due ${formatDateTime(ticket.target_resolution_at)}`,
                meta: (
                  <StatusBadge
                    status={calcSlaStatus({
                      status: ticket.status,
                      targetResolutionAt: ticket.target_resolution_at,
                      completedAt: ticket.completed_at,
                    })}
                  />
                ),
              }))}
            />
          </>
        )}

        {(isAccountManager || isAdmin) && (
          <ActionQueue
            title="Invoices awaiting send / payment"
            href="/billing?filter=action"
            emptyTitle="Nothing waiting"
            emptyDescription="No draft, pending, or past-due invoices."
            items={[...awaitingSend, ...pastDue]
              .slice(0, 6)
              .map((inv) => ({
                id: inv.id,
                primary: inv.invoice_number,
                secondary: `${customerMap.get(inv.customer_id) ?? "—"} · ${formatCurrency(inv.remaining_balance ?? inv.total_amount)}`,
                meta: <StatusBadge status={inv.status ?? "Draft"} />,
              }))}
          />
        )}

        <ActionQueue
          title="Contracts renewing (90 days)"
          href="/contracts?filter=renewals"
          emptyTitle="No renewals soon"
          emptyDescription="Nothing renewing in the next 90 days."
          items={renewals90.slice(0, 6).map((contract) => ({
            id: contract.id,
            primary: contract.contract_name,
            secondary: `${customerMap.get(contract.customer_id) ?? "—"} · ${formatDate(contract.renewal_date)}`,
            meta: (
              <span className="badge badge-ghost badge-sm">
                {contract.automatic_renewal ? "Auto" : "Manual"}
              </span>
            ),
          }))}
        />

        <ActionQueue
          title="Over hours this month"
          href="/contracts?filter=over-hours"
          emptyTitle="Within allotments"
          emptyDescription="No active contracts over included hours."
          items={overHours.slice(0, 6).map((burn) => {
            const contract = contractMap.get(burn.contractId);
            return {
              id: burn.contractId,
              primary: contract?.contract_name ?? "Contract",
              secondary: `${customerMap.get(burn.customerId) ?? "—"} · ${formatHours(burn.hoursUsed)} / ${formatHours(burn.includedHours)}`,
              meta: (
                <span className="text-xs font-medium text-warning">
                  +{formatCurrency(burn.overageEstimate)}
                </span>
              ),
            };
          })}
        />

        <ActionQueue
          title="Recommendations needing approve"
          href="/recommendations?filter=new"
          emptyTitle="Queue clear"
          emptyDescription="No new recommendations waiting."
          items={newRecs.slice(0, 6).map((rec) => ({
            id: rec.id,
            primary: rec.title,
            secondary: `${rec.source_area} · ${rec.customer_id ? customerMap.get(rec.customer_id) ?? "Customer" : "All customers"}`,
            meta: <PriorityBadge priority={rec.priority} />,
          }))}
        />
      </section>

      <section className="card border bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="card-title text-base">Account health (top 10)</h2>
              <p className="text-sm text-base-content/70">
                Ranked by risk flags, then AR and MRR — who needs a call today.
              </p>
            </div>
            <Link href="/customers" className="btn btn-ghost btn-sm">
              All customers
            </Link>
          </div>

          {accountHealth.length === 0 ? (
            <EmptyState
              title="No active accounts"
              description="Account health appears once customers and contracts exist."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th className="text-right">MRR</th>
                    <th>Hours used vs included</th>
                    <th className="text-right">Open tickets</th>
                    <th className="text-right">AR balance</th>
                    <th>Renewal</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {accountHealth.map((row) => (
                    <tr key={row.customerId}>
                      <td>
                        <div className="font-medium">{row.customerName}</div>
                        {row.healthScore != null ? (
                          <div className="text-xs text-base-content/60">
                            Health {row.healthScore}
                          </div>
                        ) : null}
                      </td>
                      <td className="text-right">{formatCurrency(row.mrr)}</td>
                      <td>
                        {formatHours(row.hoursUsed)} / {formatHours(row.includedHours)}
                        {row.burnPercent != null ? (
                          <div className="text-xs text-base-content/60">
                            {row.burnPercent.toFixed(0)}% burn
                          </div>
                        ) : null}
                      </td>
                      <td className="text-right">{row.openTickets}</td>
                      <td className="text-right">{formatCurrency(row.arBalance)}</td>
                      <td>{formatDate(row.nextRenewal)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {row.riskFlags.length === 0 ? (
                            <span className="badge badge-success badge-sm">Stable</span>
                          ) : (
                            row.riskFlags.map((flag) => (
                              <span key={flag} className="badge badge-warning badge-sm">
                                {flag}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ActionQueue({
  title,
  href,
  emptyTitle,
  emptyDescription,
  items,
}: {
  title: string;
  href: string;
  emptyTitle: string;
  emptyDescription: string;
  items: Array<{
    id: string;
    primary: string;
    secondary: string;
    meta?: React.ReactNode;
  }>;
}) {
  return (
    <div className="card border bg-base-100 shadow-sm">
      <div className="card-body">
        <div className="flex items-center justify-between gap-2">
          <h2 className="card-title text-base">{title}</h2>
          <Link href={href} className="link link-primary text-xs">
            Open queue
          </Link>
        </div>
        {items.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <Link
                key={item.id}
                href={href}
                className="block rounded-box border border-base-300 p-3 transition hover:border-primary/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.primary}</p>
                    <p className="text-xs text-base-content/60">{item.secondary}</p>
                  </div>
                  {item.meta}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
