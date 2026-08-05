"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { computeCrmAccountHealth } from "@/lib/crm";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Customer, Invoice, ServiceTicket } from "@/lib/types";

const MANAGER_ROLES = new Set([
  "administrator",
  "service_manager",
  "account_manager",
]);

const HEALTH_COLORS: Record<string, string> = {
  Healthy: "#059669",
  Watch: "#d97706",
  "At risk": "#dc2626",
};

const CHART_COLORS = ["#0e7490", "#2563eb", "#059669", "#d97706", "#dc2626", "#64748b"];

interface AccountRow {
  customer: Customer;
  health: ReturnType<typeof computeCrmAccountHealth>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-base-content/80">
        {title}
      </h2>
      <div className="min-h-[260px]">{children}</div>
    </div>
  );
}

export default function AccountHealthPage() {
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [focus, setFocus] = useState<"all" | "Healthy" | "Watch" | "At risk">("all");

  const canManage = MANAGER_ROLES.has(activeRole);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [c, co, t, i] = await Promise.all([
        supabase.from("customers").select("*").order("customer_name"),
        supabase.from("contracts").select("*"),
        supabase.from("service_tickets").select("*"),
        supabase.from("invoices").select("*"),
      ]);
      setCustomers(c.data ?? []);
      setContracts(co.data ?? []);
      setTickets(t.data ?? []);
      setInvoices(i.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const rows: AccountRow[] = useMemo(
    () =>
      customers.map((customer) => ({
        customer,
        health: computeCrmAccountHealth(
          customer.id,
          contracts,
          tickets,
          invoices,
        ),
      })),
    [customers, contracts, tickets, invoices],
  );

  const ranked = useMemo(() => {
    const weight = { "At risk": 0, Watch: 1, Healthy: 2 } as const;
    return [...rows].sort((a, b) => {
      const byHealth =
        weight[a.health.scoreLabel] - weight[b.health.scoreLabel];
      if (byHealth !== 0) return byHealth;
      return b.health.mrr - a.health.mrr;
    });
  }, [rows]);

  const visible = useMemo(
    () =>
      focus === "all"
        ? ranked
        : ranked.filter((r) => r.health.scoreLabel === focus),
    [ranked, focus],
  );

  const healthDistribution = useMemo(() => {
    const counts = { Healthy: 0, Watch: 0, "At risk": 0 };
    for (const row of rows) counts[row.health.scoreLabel] += 1;
    return (Object.keys(counts) as Array<keyof typeof counts>).map((name) => ({
      name,
      value: counts[name],
    }));
  }, [rows]);

  const mrrByHealth = useMemo(() => {
    const totals = { Healthy: 0, Watch: 0, "At risk": 0 };
    for (const row of rows) totals[row.health.scoreLabel] += row.health.mrr;
    return (Object.keys(totals) as Array<keyof typeof totals>).map((name) => ({
      name,
      mrr: totals[name],
    }));
  }, [rows]);

  const topAr = useMemo(
    () =>
      [...rows]
        .filter((r) => r.health.arBalance > 0)
        .sort((a, b) => b.health.arBalance - a.health.arBalance)
        .slice(0, 6)
        .map((r) => ({
          name: r.customer.customer_name.split(" ")[0],
          fullName: r.customer.customer_name,
          ar: r.health.arBalance,
        })),
    [rows],
  );

  const ticketPressure = useMemo(
    () =>
      [...rows]
        .filter((r) => r.health.openTickets > 0)
        .sort((a, b) => b.health.openTickets - a.health.openTickets)
        .slice(0, 6)
        .map((r) => ({
          name: r.customer.customer_name.split(" ")[0],
          fullName: r.customer.customer_name,
          open: r.health.openTickets,
          critical: r.health.criticalTickets,
          sla: r.health.slaAtRisk,
        })),
    [rows],
  );

  const summary = useMemo(() => {
    const atRisk = rows.filter((r) => r.health.scoreLabel === "At risk").length;
    const watch = rows.filter((r) => r.health.scoreLabel === "Watch").length;
    const mrrAtRisk = rows
      .filter((r) => r.health.scoreLabel === "At risk")
      .reduce((sum, r) => sum + r.health.mrr, 0);
    const totalAr = rows.reduce((sum, r) => sum + r.health.arBalance, 0);
    return { atRisk, watch, mrrAtRisk, totalAr, total: rows.length };
  }, [rows]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Health"
        description="Visual portfolio of customer risk — tickets, SLA, AR, and renewals — without a CRM laundry list."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => setFocus("all")}
          className={`rounded-box border p-4 text-left transition ${
            focus === "all"
              ? "border-primary bg-primary/5"
              : "border-base-300 bg-base-100 hover:border-base-content/20"
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-base-content/60">Accounts</p>
          <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
        </button>
        <button
          type="button"
          onClick={() => setFocus("At risk")}
          className={`rounded-box border p-4 text-left transition ${
            focus === "At risk"
              ? "border-error bg-error/5"
              : "border-base-300 bg-base-100 hover:border-base-content/20"
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-base-content/60">At risk</p>
          <p className="mt-1 text-2xl font-semibold text-error">{summary.atRisk}</p>
          <p className="text-xs text-base-content/60">
            {formatCurrency(summary.mrrAtRisk)} MRR exposed
          </p>
        </button>
        <button
          type="button"
          onClick={() => setFocus("Watch")}
          className={`rounded-box border p-4 text-left transition ${
            focus === "Watch"
              ? "border-warning bg-warning/5"
              : "border-base-300 bg-base-100 hover:border-base-content/20"
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-base-content/60">Watch</p>
          <p className="mt-1 text-2xl font-semibold text-warning">{summary.watch}</p>
        </button>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">Open AR</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(summary.totalAr)}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Health mix">
          {rows.length === 0 ? (
            <EmptyState title="No accounts" description="Add customers to see health distribution." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={healthDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {healthDistribution.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={HEALTH_COLORS[entry.name] ?? "#64748b"}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="MRR by health band">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={mrrByHealth}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="mrr" name="MRR" radius={[6, 6, 0, 0]}>
                {mrrByHealth.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={HEALTH_COLORS[entry.name] ?? "#64748b"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Open AR concentration">
          {topAr.length === 0 ? (
            <EmptyState title="No open AR" description="Accounts with remaining balances will chart here." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={topAr} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} />
                <YAxis type="category" dataKey="name" width={72} />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v))}
                  labelFormatter={(_, payload) =>
                    String(payload?.[0]?.payload?.fullName ?? "")
                  }
                />
                <Bar dataKey="ar" name="AR" fill={CHART_COLORS[4]} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Ticket pressure">
          {ticketPressure.length === 0 ? (
            <EmptyState title="No open tickets" description="Accounts with open work will chart here." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ticketPressure}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip
                  labelFormatter={(_, payload) =>
                    String(payload?.[0]?.payload?.fullName ?? "")
                  }
                />
                <Legend />
                <Bar dataKey="open" name="Open" fill={CHART_COLORS[0]} stackId="t" />
                <Bar dataKey="critical" name="Critical" fill={CHART_COLORS[4]} stackId="c" />
                <Bar dataKey="sla" name="SLA risk" fill={CHART_COLORS[3]} stackId="s" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Accounts by urgency</h2>
            <p className="text-sm text-base-content/60">
              {focus === "all" ? "All accounts" : focus} · click a tile for detail
            </p>
          </div>
          {focus !== "all" ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFocus("all")}>
              Clear filter
            </button>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="Nothing in this band"
            description="Try another health filter or clear the selection."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((row) => (
              <Link
                key={row.customer.id}
                href={`/crm/${row.customer.id}`}
                className="group rounded-box border border-base-300 bg-base-100 p-4 transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold group-hover:text-primary">
                      {row.customer.customer_name}
                    </p>
                    <p className="text-xs text-base-content/60">
                      {row.customer.industry ?? "IT account"}
                    </p>
                  </div>
                  <StatusBadge status={row.health.scoreLabel} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-base-200/70 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-base-content/50">
                      MRR
                    </p>
                    <p className="text-sm font-semibold">
                      {formatCurrency(row.health.mrr)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-base-200/70 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-base-content/50">
                      Tickets
                    </p>
                    <p className="text-sm font-semibold">{row.health.openTickets}</p>
                  </div>
                  <div className="rounded-lg bg-base-200/70 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-base-content/50">
                      AR
                    </p>
                    <p className="text-sm font-semibold">
                      {formatCurrency(row.health.arBalance)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1">
                  {row.health.riskFlags.length === 0 ? (
                    <span className="text-xs text-success">No active risk flags</span>
                  ) : (
                    row.health.riskFlags.map((flag) => (
                      <span key={flag} className="badge badge-warning badge-xs">
                        {flag}
                      </span>
                    ))
                  )}
                </div>
                <p className="mt-2 text-xs text-base-content/50">
                  Renewal {formatDate(row.health.nextRenewal)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
