"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  buildClientHealthInsights,
  buildProfitLeakageSignals,
  computeContractHoursBurns,
  computeTechnicianLoads,
  getLateTickets,
  getOpenArInvoices,
  getOpenTickets,
  getPendingApprovalEntries,
  getRenewalsInDays,
  getSlaAtRiskTickets,
  getUnassignedTickets,
  getUnprofitableContracts,
} from "@/lib/manager-ops";
import { createClient } from "@/lib/supabase/client";
import type {
  Contract,
  Customer,
  Invoice,
  ServiceTicket,
  Technician,
  WorkEntry,
} from "@/lib/types";

type Tone = "default" | "success" | "warning" | "danger" | "info";

export default function OperationsPage() {
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [c, co, t, w, i, tech] = await Promise.all([
        supabase.from("customers").select("*"),
        supabase.from("contracts").select("*"),
        supabase
          .from("service_tickets")
          .select("*")
          .order("opened_at", { ascending: false }),
        supabase.from("work_entries").select("*"),
        supabase.from("invoices").select("*"),
        supabase.from("technicians").select("*").eq("active", true),
      ]);
      setCustomers(c.data ?? []);
      setContracts(co.data ?? []);
      setTickets(t.data ?? []);
      setWorkEntries(w.data ?? []);
      setInvoices(i.data ?? []);
      setTechnicians(tech.data ?? []);
      setLoading(false);
    }
    void load();
  }, []);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.customer_name])),
    [customers],
  );
  const contractMap = useMemo(
    () => new Map(contracts.map((c) => [c.id, c])),
    [contracts],
  );
  const techMap = useMemo(
    () => new Map(technicians.map((t) => [t.id, t.technician_name])),
    [technicians],
  );

  const openTickets = useMemo(() => getOpenTickets(tickets), [tickets]);
  const criticalOpen = useMemo(
    () => openTickets.filter((t) => t.priority === "Critical"),
    [openTickets],
  );
  const slaAtRisk = useMemo(() => getSlaAtRiskTickets(tickets), [tickets]);
  const lateTickets = useMemo(() => getLateTickets(tickets), [tickets]);
  const unassigned = useMemo(() => getUnassignedTickets(tickets), [tickets]);
  const pendingApprovals = useMemo(
    () => getPendingApprovalEntries(workEntries),
    [workEntries],
  );
  const openAr = useMemo(() => getOpenArInvoices(invoices), [invoices]);
  const openArTotal = useMemo(
    () => openAr.reduce((sum, i) => sum + (i.remaining_balance ?? 0), 0),
    [openAr],
  );
  const burns = useMemo(
    () => computeContractHoursBurns(contracts, workEntries),
    [contracts, workEntries],
  );
  const overHours = useMemo(() => burns.filter((b) => b.isOver), [burns]);
  const techLoads = useMemo(
    () => computeTechnicianLoads(technicians, tickets),
    [technicians, tickets],
  );
  const overloadedTechs = useMemo(
    () => techLoads.filter((row) => row.openTickets >= 5 || row.criticalTickets >= 2),
    [techLoads],
  );
  const renewals30 = useMemo(() => getRenewalsInDays(contracts, 30), [contracts]);
  const unprofitable = useMemo(
    () => getUnprofitableContracts(contracts, workEntries),
    [contracts, workEntries],
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
  const atRiskAccounts = useMemo(
    () => accountHealth.filter((row) => row.riskFlags.length > 0).slice(0, 8),
    [accountHealth],
  );
  const clientHealthInsights = useMemo(
    () =>
      buildClientHealthInsights(
        customers,
        contracts,
        tickets,
        workEntries,
        invoices,
      ),
    [customers, contracts, tickets, workEntries, invoices],
  );
  const profitLeaks = useMemo(
    () =>
      buildProfitLeakageSignals(customers, contracts, workEntries, invoices),
    [customers, contracts, workEntries, invoices],
  );
  const watchlistAccounts = useMemo(
    () => clientHealthInsights.filter((row) => row.score < 85).slice(0, 6),
    [clientHealthInsights],
  );
  const avgHealthScore = useMemo(() => {
    if (clientHealthInsights.length === 0) return null;
    const total = clientHealthInsights.reduce((sum, row) => sum + row.score, 0);
    return total / clientHealthInsights.length;
  }, [clientHealthInsights]);
  const leakageTotal = useMemo(
    () => profitLeaks.reduce((sum, row) => sum + row.amountAtRisk, 0),
    [profitLeaks],
  );

  const actNowCount =
    unassigned.length +
    slaAtRisk.length +
    criticalOpen.length +
    pendingApprovals.length;
  const deliveryCount =
    lateTickets.length + overHours.length + overloadedTechs.length;

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

  return (
    <div className="space-y-10">
      <PageHeader
        title="Manager command center"
        description="Service delivery control board. Every tile opens the queue where you can resolve the issue."
      />

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-base-content/65">
        <span>
          <strong className="text-base-content">{actNowCount}</strong> need action now
        </span>
        <span>
          <strong className="text-base-content">{watchlistAccounts.length}</strong> accounts on watchlist
        </span>
        <span>
          <strong className="text-base-content">{formatCurrency(leakageTotal)}</strong> profit leakage
        </span>
        <span>
          <strong className="text-base-content">{deliveryCount}</strong> delivery watches
        </span>
        <span>
          <strong className="text-base-content">{renewals30.length}</strong> renewals in 30 days
        </span>
      </div>

      {/* ---------- Act now ---------- */}
      <CommandZone
        id="act-now"
        eyebrow="Zone 1"
        title="Act now"
        summary="Operational risks that stall delivery today. Assign work, clear SLA pressure, and approve logged time."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Unassigned tickets"
            value={unassigned.length}
            hint="Open tickets with no owner"
            tone={toneForCount(unassigned.length, "danger")}
            href="/service-tickets?filter=unassigned"
          />
          <StatCard
            title="SLA at risk"
            value={slaAtRisk.length}
            hint="Approaching deadline or overdue"
            tone={toneForCount(slaAtRisk.length, "warning")}
            href="/service-tickets?filter=sla"
          />
          <StatCard
            title="Critical open"
            value={criticalOpen.length}
            hint="Highest priority delivery work"
            tone={toneForCount(criticalOpen.length, "danger")}
            href="/service-tickets?filter=critical"
          />
          <StatCard
            title="Unapproved work"
            value={pendingApprovals.length}
            hint="Technician time waiting on you"
            tone={toneForCount(pendingApprovals.length, "warning")}
            href="/time-costs?filter=queue"
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <TraceQueue
            title="Assign these tickets"
            href="/service-tickets?filter=unassigned"
            emptyTitle="Assignment backlog clear"
            emptyDescription="Every open ticket has an owner."
            items={unassigned.slice(0, 5).map((ticket) => ({
              id: ticket.id,
              href: "/service-tickets?filter=unassigned",
              primary: ticket.title,
              secondary: `${ticket.ticket_number} · ${customerMap.get(ticket.customer_id) ?? "Customer"}`,
              meta: <PriorityBadge priority={ticket.priority ?? "Medium"} />,
            }))}
          />
          <TraceQueue
            title="Approve technician time"
            href="/time-costs?filter=queue"
            emptyTitle="No pending approvals"
            emptyDescription="Nothing waiting in Work & Billing."
            items={pendingApprovals.slice(0, 5).map((entry) => ({
              id: entry.id,
              href: "/time-costs?filter=queue",
              primary: entry.work_performed || "Work entry",
              secondary: `${formatDate(entry.work_date)} · ${formatHours(entry.hours_worked)} · ${techMap.get(entry.technician_id) ?? "Technician"}`,
              meta: <StatusBadge status={entry.approval_status ?? "Pending"} />,
            }))}
          />
        </div>
      </CommandZone>

      {/* ---------- Client health + profit leakage ---------- */}
      <div className="grid gap-8 xl:grid-cols-2">
        <CommandZone
          id="client-health"
          eyebrow="Zone 2"
          title="Client health score"
          summary="One score per account from SLA, AR, hour burn, criticals, and renewals — with the next best manager action."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              title="Portfolio average"
              value={avgHealthScore == null ? "—" : Math.round(avgHealthScore)}
              hint="Across scored active accounts"
              tone={
                avgHealthScore == null
                  ? "default"
                  : avgHealthScore >= 80
                    ? "success"
                    : avgHealthScore >= 65
                      ? "warning"
                      : "danger"
              }
            />
            <StatCard
              title="Watchlist"
              value={watchlistAccounts.length}
              hint="Accounts scoring under 85"
              tone={toneForCount(watchlistAccounts.length, "warning")}
              href="/customers"
            />
            <StatCard
              title="Needs action now"
              value={clientHealthInsights.filter((r) => r.score < 70).length}
              hint="Score under 70"
              tone={toneForCount(
                clientHealthInsights.filter((r) => r.score < 70).length,
                "danger",
              )}
              href="/service-tickets?filter=sla"
            />
          </div>

          <div className="mt-4 space-y-3">
            {watchlistAccounts.length === 0 ? (
              <EmptyState
                title="Portfolio healthy"
                description="No accounts currently score under 85."
              />
            ) : (
              watchlistAccounts.map((row) => (
                <article
                  key={row.customerId}
                  className="rounded-box border border-base-300 bg-base-100 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base-content">
                        {row.customerName}
                      </h3>
                      <p className="mt-0.5 text-xs text-base-content/60">
                        {formatCurrency(row.mrr)} MRR · {row.openTickets} open ·{" "}
                        {formatCurrency(row.arBalance)} AR
                      </p>
                    </div>
                    <HealthScorePill score={row.score} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {row.drivers.slice(0, 4).map((driver) => (
                      <span key={driver} className="badge badge-ghost badge-sm">
                        {driver}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-base-300 pt-3">
                    <p className="text-sm text-base-content/80">
                      <span className="font-medium text-base-content">Recommended: </span>
                      {row.recommendedAction}
                    </p>
                    <Link
                      href={row.actionHref}
                      className="btn btn-primary btn-sm shrink-0"
                    >
                      Take action
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </CommandZone>

        <CommandZone
          id="profit-leakage"
          eyebrow="Zone 3"
          title="Profit-leakage radar"
          summary="Where money is escaping: unbilled work, overage not invoiced, contracts below MRR, and slow collections."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              title="At-risk total"
              value={formatCurrency(leakageTotal)}
              hint="Sum of leakage signals"
              tone={leakageTotal > 0 ? "danger" : "success"}
              href="/time-costs?filter=ready"
            />
            <StatCard
              title="Leak signals"
              value={profitLeaks.length}
              hint="Distinct money leaks found"
              tone={toneForCount(profitLeaks.length, "warning")}
            />
            <StatCard
              title="Largest leak"
              value={
                profitLeaks[0]
                  ? formatCurrency(profitLeaks[0].amountAtRisk)
                  : formatCurrency(0)
              }
              hint={profitLeaks[0]?.title ?? "No leaks detected"}
              tone={profitLeaks[0] ? "danger" : "success"}
              href={profitLeaks[0]?.href}
            />
          </div>

          <div className="mt-4 space-y-3">
            {profitLeaks.length === 0 ? (
              <EmptyState
                title="No leakage detected"
                description="Approved work is billed and contracts are holding margin this month."
              />
            ) : (
              profitLeaks.slice(0, 6).map((leak) => (
                <article
                  key={leak.id}
                  className="rounded-box border border-base-300 bg-base-100 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge badge-outline badge-sm">
                          {leakLabel(leak.kind)}
                        </span>
                        <h3 className="font-semibold text-base-content">{leak.title}</h3>
                      </div>
                      <p className="mt-1 text-xs text-base-content/60">{leak.detail}</p>
                    </div>
                    <p className="text-lg font-semibold text-error">
                      {formatCurrency(leak.amountAtRisk)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-base-300 pt-3">
                    <p className="text-sm text-base-content/80">
                      <span className="font-medium text-base-content">Recommended: </span>
                      {leak.recommendedAction}
                    </p>
                    <Link href={leak.href} className="btn btn-outline btn-sm shrink-0">
                      Fix leak
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </CommandZone>
      </div>

      {/* ---------- Delivery health ---------- */}
      <CommandZone
        id="delivery-health"
        eyebrow="Zone 4"
        title="Delivery health"
        summary="Capacity and overrun signals. Catch late tickets, contracts burning past included hours, and overloaded technicians."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Late projects"
            value={lateTickets.length}
            hint="Open tickets past SLA target"
            tone={toneForCount(lateTickets.length, "danger")}
            href="/service-tickets?filter=sla"
          />
          <StatCard
            title="Over-budget contracts"
            value={overHours.length}
            hint={`${formatCurrency(overHours.reduce((s, b) => s + b.overageEstimate, 0))} est. overage`}
            tone={toneForCount(overHours.length, "warning")}
            href="/contracts?filter=over-hours"
          />
          <StatCard
            title="Heavy tech load"
            value={overloadedTechs.length}
            hint="5+ open or 2+ critical assigned"
            tone={toneForCount(overloadedTechs.length, "warning")}
            href="/technicians"
          />
          <StatCard
            title="Open delivery load"
            value={openTickets.length}
            hint={`${formatHours(workEntries.filter((e) => isCurrentMonth(e.work_date)).reduce((s, e) => s + (e.hours_worked ?? 0), 0))} hrs logged MTD`}
            tone="info"
            href="/service-tickets?filter=open"
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <TraceQueue
            title="Late tickets to stabilize"
            href="/service-tickets?filter=sla"
            emptyTitle="No overdue tickets"
            emptyDescription="Nothing is past its resolution target."
            items={lateTickets.slice(0, 5).map((ticket) => ({
              id: ticket.id,
              href: "/service-tickets?filter=sla",
              primary: ticket.title,
              secondary: `${ticket.ticket_number} · due ${formatDateTime(ticket.target_resolution_at)}`,
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
          <TraceQueue
            title="Contracts over included hours"
            href="/contracts?filter=over-hours"
            emptyTitle="Within hour allotments"
            emptyDescription="No active contracts have burned past included hours this month."
            items={overHours.slice(0, 5).map((burn) => {
              const contract = contractMap.get(burn.contractId);
              return {
                id: burn.contractId,
                href: "/contracts?filter=over-hours",
                primary: contract?.contract_name ?? "Contract",
                secondary: `${customerMap.get(burn.customerId) ?? "Customer"} · ${formatHours(burn.hoursUsed)} / ${formatHours(burn.includedHours)}`,
                meta: (
                  <span className="text-xs font-semibold text-warning">
                    +{formatCurrency(burn.overageEstimate)}
                  </span>
                ),
              };
            })}
          />
        </div>
      </CommandZone>

      {/* ---------- Portfolio watch ---------- */}
      <CommandZone
        id="portfolio-watch"
        eyebrow="Zone 5"
        title="Portfolio watch"
        summary="Account and contract outlook. Renewals, margin pressure, and customers carrying risk flags."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Renewals (30 days)"
            value={renewals30.length}
            hint="Active contracts renewing soon"
            tone={toneForCount(renewals30.length, "warning")}
            href="/contracts?filter=renewals"
          />
          <StatCard
            title="Unprofitable contracts"
            value={unprofitable.length}
            hint="Month cost above MRR"
            tone={toneForCount(unprofitable.length, "warning")}
            href="/contracts"
          />
          <StatCard
            title="Accounts with risk flags"
            value={atRiskAccounts.length}
            hint="SLA, hours, AR, or renewal pressure"
            tone={toneForCount(atRiskAccounts.length, "warning")}
            href="/customers"
          />
          <StatCard
            title="Open AR"
            value={formatCurrency(openArTotal)}
            hint="Balances still owed"
            tone={openArTotal > 0 ? "info" : "success"}
            href="/billing?filter=action"
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <TraceQueue
            title="Upcoming renewals"
            href="/contracts?filter=renewals"
            emptyTitle="No renewals in 30 days"
            emptyDescription="Nothing needing a renewal conversation this month."
            items={renewals30.slice(0, 5).map((contract) => ({
              id: contract.id,
              href: "/contracts?filter=renewals",
              primary: contract.contract_name,
              secondary: `${customerMap.get(contract.customer_id) ?? "Customer"} · ${formatDate(contract.renewal_date)}`,
              meta: (
                <span className="badge badge-ghost badge-sm">
                  {contract.automatic_renewal ? "Auto" : "Manual"}
                </span>
              ),
            }))}
          />
          <TraceQueue
            title="Accounts to review"
            href="/customers"
            emptyTitle="No flagged accounts"
            emptyDescription="Account health looks stable across the portfolio."
            items={atRiskAccounts.map((row) => ({
              id: row.customerId,
              href: "/customers",
              primary: row.customerName,
              secondary: `${formatCurrency(row.arBalance)} AR · ${row.openTickets} open tickets · renews ${formatDate(row.nextRenewal)}`,
              meta: (
                <div className="flex flex-wrap justify-end gap-1">
                  {row.riskFlags.slice(0, 3).map((flag) => (
                    <span key={flag} className="badge badge-warning badge-sm">
                      {flag}
                    </span>
                  ))}
                </div>
              ),
            }))}
          />
        </div>

        {unprofitable.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-box border border-base-300">
            <table className="table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Customer</th>
                  <th className="text-right">MRR</th>
                  <th className="text-right">Month direct cost</th>
                  <th className="text-right">Shortfall</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {unprofitable.slice(0, 6).map((row) => (
                  <tr key={row.contractId}>
                    <td className="font-medium">{row.contractName}</td>
                    <td>{customerMap.get(row.customerId) ?? "—"}</td>
                    <td className="text-right">{formatCurrency(row.mrr)}</td>
                    <td className="text-right">
                      {formatCurrency(row.monthDirectCost)}
                    </td>
                    <td className="text-right font-semibold text-warning">
                      {formatCurrency(row.shortfall)}
                    </td>
                    <td className="text-right">
                      <Link href="/contracts" className="link link-primary text-sm">
                        Open contracts
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CommandZone>
    </div>
  );
}

function isCurrentMonth(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  );
}

function toneForCount(count: number, alertTone: Tone): Tone {
  return count > 0 ? alertTone : "success";
}

function HealthScorePill({ score }: { score: number }) {
  const tone =
    score >= 85 ? "badge-success" : score >= 70 ? "badge-warning" : "badge-error";
  return (
    <div className="text-right">
      <span className={`badge ${tone} badge-lg font-semibold tabular-nums`}>
        {score}
      </span>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-base-content/50">
        health
      </p>
    </div>
  );
}

function leakLabel(kind: string): string {
  switch (kind) {
    case "unbilled_work":
      return "Unbilled work";
    case "unbilled_overage":
      return "Overage";
    case "margin_shortfall":
      return "Margin";
    case "past_due_ar":
      return "Collections";
    case "awaiting_send":
      return "Draft invoices";
    default:
      return "Leak";
  }
}

function CommandZone({
  id,
  eyebrow,
  title,
  summary,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div className="max-w-3xl border-b border-base-300 pb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/50">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-base-content">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-base-content/65">
          {summary}
        </p>
      </div>
      {children}
    </section>
  );
}

function TraceQueue({
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
    href: string;
    primary: string;
    secondary: string;
    meta?: ReactNode;
  }>;
}) {
  return (
    <div className="rounded-box border border-base-300 bg-base-100">
      <div className="flex items-center justify-between gap-3 border-b border-base-300 px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Link href={href} className="text-xs font-medium text-primary hover:underline">
          Open full queue →
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="p-4">
          <EmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      ) : (
        <ul className="divide-y divide-base-300">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-base-200/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-base-content">
                    {item.primary}
                  </p>
                  <p className="mt-0.5 text-xs text-base-content/60">
                    {item.secondary}
                  </p>
                </div>
                <div className="shrink-0">{item.meta}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
