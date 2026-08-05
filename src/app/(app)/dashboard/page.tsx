"use client";

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
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  CHART_COLORS,
  computeDashboardStats,
  profitabilityByCustomer,
  sortAlerts,
} from "@/lib/dashboard-stats";
import { calcSlaStatus } from "@/lib/calculations";
import { formatCurrency, formatPercent } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type {
  AiPlatform,
  AiRisk,
  Alert,
  Contract,
  Customer,
  HardwareAsset,
  Invoice,
  Recommendation,
  SecurityAlert,
  SecurityScore,
  ServiceTicket,
  WorkEntry,
} from "@/lib/types";

export default function ExecutiveDashboardPage() {
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [hardware, setHardware] = useState<HardwareAsset[]>([]);
  const [securityScores, setSecurityScores] = useState<SecurityScore[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [aiPlatforms, setAiPlatforms] = useState<AiPlatform[]>([]);
  const [aiRisks, setAiRisks] = useState<AiRisk[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [
        c,
        co,
        t,
        w,
        i,
        a,
        h,
        ss,
        sa,
        ai,
        risks,
        recs,
      ] = await Promise.all([
        supabase.from("customers").select("*"),
        supabase.from("contracts").select("*"),
        supabase.from("service_tickets").select("*"),
        supabase.from("work_entries").select("*"),
        supabase.from("invoices").select("*"),
        supabase.from("alerts").select("*").eq("resolved", false),
        supabase.from("hardware_assets").select("*"),
        supabase.from("security_scores").select("*"),
        supabase.from("security_alerts").select("*").eq("status", "Open"),
        supabase.from("ai_platforms").select("*"),
        supabase.from("ai_risks").select("*").eq("status", "Open"),
        supabase.from("recommendations").select("*").in("status", ["New", "Reviewed"]),
      ]);
      setCustomers(c.data ?? []);
      setContracts(co.data ?? []);
      setTickets(t.data ?? []);
      setWorkEntries(w.data ?? []);
      setInvoices(i.data ?? []);
      setAlerts(a.data ?? []);
      setHardware(h.data ?? []);
      setSecurityScores(ss.data ?? []);
      setSecurityAlerts(sa.data ?? []);
      setAiPlatforms(ai.data ?? []);
      setAiRisks(risks.data ?? []);
      setRecommendations(recs.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(
    () => computeDashboardStats(customers, contracts, tickets, workEntries, invoices),
    [customers, contracts, tickets, workEntries, invoices],
  );

  const inventoryValue = useMemo(
    () => hardware.reduce((sum, asset) => sum + Number(asset.current_value ?? 0), 0),
    [hardware],
  );

  const avgCyber = useMemo(() => {
    if (securityScores.length === 0) return null;
    return (
      securityScores.reduce((sum, s) => sum + Number(s.health_score ?? 0), 0) /
      securityScores.length
    );
  }, [securityScores]);

  const avgAiSecurity = useMemo(() => {
    if (aiPlatforms.length === 0) return null;
    return (
      aiPlatforms.reduce((sum, p) => sum + Number(p.compliance_score ?? 0), 0) /
      aiPlatforms.length
    );
  }, [aiPlatforms]);

  const aiAdoption = useMemo(() => {
    const licensed = aiPlatforms.reduce((sum, p) => sum + (p.licensed_users ?? 0), 0);
    const active = aiPlatforms.reduce((sum, p) => sum + (p.active_users ?? 0), 0);
    if (licensed === 0) return null;
    return (active / licensed) * 100;
  }, [aiPlatforms]);

  const renewalsSoon = useMemo(() => {
    const horizon = Date.now() + 60 * 24 * 60 * 60 * 1000;
    return contracts.filter((c) => {
      if (!c.renewal_date || c.contract_status !== "Active") return false;
      const d = new Date(c.renewal_date).getTime();
      return d <= horizon;
    }).length;
  }, [contracts]);

  const slaCompliance = useMemo(() => {
    const completed = tickets.filter(
      (t) => t.status === "Completed" || t.status === "Closed",
    );
    if (completed.length === 0) return null;
    const onTime = completed.filter((t) => {
      const sla = calcSlaStatus({
        status: t.status,
        targetResolutionAt: t.target_resolution_at,
        completedAt: t.completed_at,
      });
      return sla === "Completed on Time";
    }).length;
    return (onTime / completed.length) * 100;
  }, [tickets]);

  const criticalIncidents =
    tickets.filter((t) => t.priority === "Critical" && t.status !== "Closed" && t.status !== "Completed").length +
    securityAlerts.filter((a) => a.severity === "Critical").length;

  const profitData = useMemo(
    () => profitabilityByCustomer(customers, contracts, workEntries),
    [customers, contracts, workEntries],
  );

  const serviceFamilyPlaceholder = useMemo(() => {
    // Approximate revenue by service plan name grouping for V1 charts
    const map = new Map<string, number>();
    for (const c of contracts.filter((x) => x.contract_status === "Active")) {
      const key = c.service_plan_name || "Managed Services";
      map.set(key, (map.get(key) ?? 0) + Number(c.monthly_recurring_fee ?? 0));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [contracts]);

  const sortedAlerts = useMemo(() => sortAlerts(alerts), [alerts]);

  if (activeRole !== "administrator" && activeRole !== "executive") {
    return (
      <AlertBanner
        tone="warning"
        title="Executive dashboard"
        message="This high-level view is designed for executive leadership. Use Manager Command Center or your role home for day-to-day work."
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
        title="Executive overview"
        description="MRR, profitability, inventory, AI adoption, cyber posture, SLA, renewals, and risk — without operational ticket assignment."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Est. MRR" value={formatCurrency(stats.mrr)} tone="info" />
        <StatCard title="Active contracts" value={stats.activeContracts} />
        <StatCard
          title="Avg. profit margin"
          value={stats.avgMargin != null ? formatPercent(stats.avgMargin) : "—"}
          hint="Revenue minus direct costs; — if revenue is zero"
        />
        <StatCard
          title="Hardware inventory value"
          value={formatCurrency(inventoryValue)}
          tone="info"
        />
        <StatCard
          title="AI adoption"
          value={aiAdoption != null ? formatPercent(aiAdoption) : "—"}
          hint="Active users ÷ licensed seats"
        />
        <StatCard
          title="AI security / compliance"
          value={avgAiSecurity != null ? avgAiSecurity.toFixed(0) : "—"}
          hint="Average platform compliance score"
        />
        <StatCard
          title="Cyber posture"
          value={avgCyber != null ? avgCyber.toFixed(0) : "—"}
          hint="Average customer security health score"
          tone={avgCyber != null && avgCyber < 70 ? "warning" : "success"}
        />
        <StatCard
          title="Critical incidents"
          value={criticalIncidents}
          tone={criticalIncidents > 0 ? "danger" : "success"}
        />
        <StatCard
          title="SLA compliance"
          value={slaCompliance != null ? formatPercent(slaCompliance) : "—"}
          hint="Completed tickets finished on time"
        />
        <StatCard
          title="Renewals (60 days)"
          value={renewalsSoon}
          tone={renewalsSoon > 0 ? "warning" : undefined}
        />
        <StatCard title="Open AI risks" value={aiRisks.length} tone="warning" />
        <StatCard
          title="Open recommendations"
          value={recommendations.length}
          hint="New or reviewed suggestions"
        />
      </div>

      {sortedAlerts.length > 0 || securityAlerts.length > 0 || aiRisks.length > 0 ? (
        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">Risk and alert indicators</h2>
            <div className="space-y-2">
              {securityAlerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className="flex flex-col gap-2 rounded-box border border-base-300 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-xs text-base-content/60">Cyber · {alert.alert_type}</p>
                  </div>
                  <StatusBadge status={alert.severity} />
                </div>
              ))}
              {aiRisks.slice(0, 3).map((risk) => (
                <div
                  key={risk.id}
                  className="flex flex-col gap-2 rounded-box border border-base-300 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{risk.title}</p>
                    <p className="text-xs text-base-content/60">AI · {risk.risk_type}</p>
                  </div>
                  <StatusBadge status={risk.severity} />
                </div>
              ))}
              {sortedAlerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  className="flex flex-col gap-2 rounded-box border border-base-300 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{alert.alert_message}</p>
                    <p className="text-xs text-base-content/60">{alert.alert_type}</p>
                  </div>
                  <StatusBadge status={alert.severity ?? "Info"} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No active risk indicators"
          description="Operational, cyber, and AI alerts will appear here when attention is needed."
        />
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Revenue by service plan (MRR)">
          {serviceFamilyPlaceholder.length === 0 ? (
            <EmptyState title="No contract revenue" description="Active contract fees will chart here." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={serviceFamilyPlaceholder}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {serviceFamilyPlaceholder.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Profitability by customer">
          {profitData.length === 0 ? (
            <EmptyState
              title="No profitability data"
              description="Customer profitability appears once contracts and costs are recorded."
            />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={profitData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="revenue" fill="#059669" name="Revenue" />
                <Bar dataKey="costs" fill="#dc2626" name="Costs" />
                <Bar dataKey="profit" fill="#0e7490" name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card border bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-base">{title}</h2>
        <div className="min-h-[280px]">{children}</div>
      </div>
    </div>
  );
}
