"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { HealthScoreLegend } from "@/components/HealthScoreLegend";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { calcSlaStatus } from "@/lib/calculations";
import { computeCrmAccountHealth } from "@/lib/crm";
import { isOpenTicket } from "@/lib/dashboard-stats";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Customer, Invoice, ServiceTicket } from "@/lib/types";

const MANAGER_ROLES = new Set([
  "administrator",
  "service_manager",
  "account_manager",
]);

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "#dc2626",
  High: "#ea580c",
  Medium: "#d97706",
  Low: "#64748b",
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-base-content/80">
        {title}
      </h2>
      <div className="min-h-[240px]">{children}</div>
    </div>
  );
}

export default function AccountHealthDetailPage() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;
  const { activeRole } = useDemoRole();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const canManage = MANAGER_ROLES.has(activeRole);

  useEffect(() => {
    async function load() {
      if (!customerId) return;
      const supabase = createClient();
      const [custRes, contractRes, ticketRes, invoiceRes] = await Promise.all([
        supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
        supabase.from("contracts").select("*").eq("customer_id", customerId),
        supabase.from("service_tickets").select("*").eq("customer_id", customerId),
        supabase.from("invoices").select("*").eq("customer_id", customerId),
      ]);

      if (!custRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setCustomer(custRes.data as Customer);
      setContracts(contractRes.data ?? []);
      setTickets(ticketRes.data ?? []);
      setInvoices(invoiceRes.data ?? []);
      setNotFound(false);
      setLoading(false);
    }
    load();
  }, [customerId]);

  const health = useMemo(
    () =>
      customer
        ? computeCrmAccountHealth(customer.id, contracts, tickets, invoices)
        : null,
    [customer, contracts, tickets, invoices],
  );

  const openTickets = useMemo(
    () => tickets.filter((t) => isOpenTicket(t.status)),
    [tickets],
  );

  const priorityChart = useMemo(() => {
    const counts: Record<string, number> = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
    };
    for (const t of openTickets) {
      const priority = t.priority ?? "Low";
      const key = priority in counts ? priority : "Low";
      counts[key] += 1;
    }
    return Object.entries(counts)
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [openTickets]);

  const slaChart = useMemo(() => {
    const counts = {
      "On Track": 0,
      "Approaching Deadline": 0,
      Overdue: 0,
    };
    for (const t of openTickets) {
      const sla = calcSlaStatus({
        status: t.status,
        targetResolutionAt: t.target_resolution_at,
        completedAt: t.completed_at,
      });
      if (sla === "Approaching Deadline" || sla === "Overdue" || sla === "On Track") {
        counts[sla] += 1;
      }
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [openTickets]);

  const moneyChart = useMemo(
    () => [
      { name: "MRR", amount: health?.mrr ?? 0 },
      { name: "Open AR", amount: health?.arBalance ?? 0 },
    ],
    [health],
  );

  const invoiceAging = useMemo(() => {
    const buckets = [
      { name: "Current", amount: 0 },
      { name: "1–30", amount: 0 },
      { name: "31–60", amount: 0 },
      { name: "61+", amount: 0 },
    ];
    const now = Date.now();
    for (const inv of invoices) {
      const bal = inv.remaining_balance ?? 0;
      if (bal <= 0 || !inv.due_date) continue;
      const days = Math.floor(
        (now - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (days <= 0) buckets[0].amount += bal;
      else if (days <= 30) buckets[1].amount += bal;
      else if (days <= 60) buckets[2].amount += bal;
      else buckets[3].amount += bal;
    }
    return buckets;
  }, [invoices]);

  if (!canManage) {
    return (
      <AlertBanner
        tone="info"
        title="Account Health"
        message="Account health is for managers. Switch to a manager demo role to use it."
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

  if (notFound || !customer || !health) {
    return (
      <EmptyState
        title="Account not found"
        description="This customer record does not exist or is not visible."
        action={
          <Link href="/crm" className="btn btn-primary btn-sm">
            Back to Account Health
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/crm" className="btn btn-ghost btn-sm mb-2 gap-1 px-0">
          <ArrowLeft className="size-4" />
          Portfolio
        </Link>
        <PageHeader
          title={customer.customer_name}
          description={`${customer.industry ?? "IT account"} · ${health.scoreReason}`}
          action={<StatusBadge status={health.scoreLabel} />}
        />
      </div>

      <HealthScoreLegend />

      <section className="rounded-box border border-base-300 bg-base-100 p-4">
        <h2 className="text-sm font-semibold tracking-wide text-base-content/80">
          This account&apos;s score drivers
        </h2>
        <p className="mt-1 text-sm text-base-content/65">{health.scoreReason}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {health.signals.map((signal) => (
            <div
              key={signal.id}
              className={`rounded-lg border p-3 ${
                signal.active
                  ? "border-warning/40 bg-warning/10"
                  : "border-base-300 bg-base-200/40"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{signal.label}</p>
                <span
                  className={`badge badge-sm ${
                    signal.active ? "badge-warning" : "badge-success"
                  }`}
                >
                  {signal.active ? "Contributing to score" : "Not flagged"}
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold">{signal.evidence}</p>
              <p className="mt-1 text-sm text-base-content/70">{signal.detail}</p>
              <Link
                href={signal.sourceHref}
                className="link link-hover mt-2 inline-block text-xs"
              >
                Open source: {signal.source}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">
            MRR · active contracts
          </p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(health.mrr)}</p>
          <p className="text-xs text-base-content/55">
            Sum of monthly_recurring_fee on Active contracts
          </p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">
            Open tickets · service tickets
          </p>
          <p className="mt-1 text-2xl font-semibold">{health.openTickets}</p>
          <p className="text-xs text-base-content/55">
            {health.criticalTickets} critical · {health.slaAtRisk} approaching/overdue SLA
          </p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">
            AR balance · invoices
          </p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(health.arBalance)}</p>
          <p className="text-xs text-base-content/55">Sum of remaining_balance</p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">
            Next renewal · contracts
          </p>
          <p className="mt-1 text-2xl font-semibold">{formatDate(health.nextRenewal)}</p>
          <p className="text-xs text-base-content/55">
            {health.renewingSoon
              ? "Inside 90-day renewal window"
              : "Outside 90-day renewal window"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/service-tickets" className="btn btn-outline btn-sm">
          Service tickets
        </Link>
        <Link href="/billing" className="btn btn-outline btn-sm">
          Billing
        </Link>
        <Link href="/contracts" className="btn btn-outline btn-sm">
          Contracts
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Open tickets by priority">
          <p className="mb-2 text-xs text-base-content/55">
            Source: open service_tickets for this customer, grouped by priority
          </p>
          {priorityChart.length === 0 ? (
            <EmptyState title="No open tickets" description="Priority mix appears when tickets are open." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={priorityChart}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                >
                  {priorityChart.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={PRIORITY_COLORS[entry.name] ?? "#64748b"}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="SLA posture (open work)">
          <p className="mb-2 text-xs text-base-content/55">
            Source: open tickets vs target_resolution_at (On Track / Approaching / Overdue)
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={slaChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Tickets" radius={[6, 6, 0, 0]}>
                {slaChart.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={
                      entry.name === "Overdue"
                        ? "#dc2626"
                        : entry.name === "Approaching Deadline"
                          ? "#d97706"
                          : "#059669"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="MRR vs open AR">
          <p className="mb-2 text-xs text-base-content/55">
            Source: Active contract fees vs invoice remaining_balance
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={moneyChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="amount" name="Amount" radius={[6, 6, 0, 0]}>
                <Cell fill="#0e7490" />
                <Cell fill="#dc2626" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="AR aging">
          <p className="mb-2 text-xs text-base-content/55">
            Source: invoices with remaining_balance, bucketed by days past due_date
          </p>
          {invoiceAging.every((b) => b.amount === 0) ? (
            <EmptyState title="No open AR" description="Invoice aging shows when balances remain." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={invoiceAging}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="amount" name="Balance" fill="#ea580c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <section className="rounded-box border border-base-300 bg-base-100 p-4">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-base-content/80">
          Highest-priority open tickets
        </h2>
        {openTickets.length === 0 ? (
          <EmptyState
            title="Inbox clear"
            description="No open tickets for this account right now."
          />
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {[...openTickets]
              .sort((a, b) => {
                const order: Record<string, number> = {
                  Critical: 0,
                  High: 1,
                  Medium: 2,
                  Low: 3,
                };
                return (
                  (order[a.priority ?? "Low"] ?? 9) -
                  (order[b.priority ?? "Low"] ?? 9)
                );
              })
              .slice(0, 6)
              .map((ticket) => {
                const sla = calcSlaStatus({
                  status: ticket.status,
                  targetResolutionAt: ticket.target_resolution_at,
                  completedAt: ticket.completed_at,
                });
                return (
                  <div
                    key={ticket.id}
                    className="rounded-lg border border-base-300 bg-base-200/40 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={ticket.priority ?? "Low"} />
                      <StatusBadge status={sla} />
                    </div>
                    <p className="mt-1 text-sm font-medium">{ticket.title}</p>
                    <p className="text-xs text-base-content/60">
                      {ticket.status} · Target {formatDate(ticket.target_resolution_at)}
                    </p>
                  </div>
                );
              })}
          </div>
        )}
      </section>
    </div>
  );
}
