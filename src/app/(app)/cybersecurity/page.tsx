"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatPercent } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Customer, SecurityAlert, SecurityScore } from "@/lib/types";

export default function CybersecurityPage() {
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<SecurityScore[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [s, a, c] = await Promise.all([
        supabase.from("security_scores").select("*").order("last_assessed_at", { ascending: false }),
        supabase.from("security_alerts").select("*").eq("status", "Open").order("detected_at", { ascending: false }),
        supabase.from("customers").select("*"),
      ]);
      setScores(s.data ?? []);
      setAlerts(a.data ?? []);
      setCustomers(c.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.customer_name])),
    [customers],
  );

  const latestByCustomer = useMemo(() => {
    const map = new Map<string, SecurityScore>();
    for (const score of scores) {
      if (!map.has(score.customer_id)) {
        map.set(score.customer_id, score);
      }
    }
    return Array.from(map.values());
  }, [scores]);

  const metricAverages = useMemo(() => {
    if (latestByCustomer.length === 0) return null;
    const avg = (key: keyof SecurityScore) => {
      const values = latestByCustomer
        .map((s) => s[key])
        .filter((v): v is number => typeof v === "number");
      if (values.length === 0) return null;
      return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    };
    return {
      endpoint: avg("endpoint_coverage_pct"),
      antivirus: avg("antivirus_current_pct"),
      patch: avg("patch_compliance_pct"),
      encryption: avg("encryption_coverage_pct"),
      mfa: avg("mfa_adoption_pct"),
    };
  }, [latestByCustomer]);

  const alertsBySeverity = useMemo(() => {
    const map = new Map<string, number>();
    for (const alert of alerts) {
      map.set(alert.severity, (map.get(alert.severity) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [alerts]);

  const coverageChart = useMemo(() => {
    if (!metricAverages) return [];
    return [
      { name: "Endpoint", value: metricAverages.endpoint ?? 0 },
      { name: "Antivirus", value: metricAverages.antivirus ?? 0 },
      { name: "Patch", value: metricAverages.patch ?? 0 },
      { name: "Encryption", value: metricAverages.encryption ?? 0 },
      { name: "MFA", value: metricAverages.mfa ?? 0 },
    ];
  }, [metricAverages]);

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
        title="Cybersecurity monitoring"
        description="Compliance metrics and actionable security alerts."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Customers assessed" value={latestByCustomer.length} tone="info" />
        <StatCard title="Open alerts" value={alerts.length} tone={alerts.length > 0 ? "warning" : "success"} />
        <StatCard
          title="Critical alerts"
          value={alerts.filter((a) => a.severity === "Critical").length}
          tone="danger"
        />
        <StatCard
          title="Patch compliance"
          value={metricAverages?.patch != null ? formatPercent(metricAverages.patch) : "—"}
        />
      </div>

      {metricAverages ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard title="Endpoint coverage" value={formatPercent(metricAverages.endpoint)} />
          <StatCard title="Antivirus current" value={formatPercent(metricAverages.antivirus)} />
          <StatCard title="Patch compliance" value={formatPercent(metricAverages.patch)} />
          <StatCard title="Encryption" value={formatPercent(metricAverages.encryption)} />
          <StatCard title="MFA adoption" value={formatPercent(metricAverages.mfa)} />
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Coverage metrics (avg.)">
          {coverageChart.length === 0 || coverageChart.every((d) => d.value === 0) ? (
            <EmptyState title="No metrics" description="Endpoint, patch, and MFA coverage will display here." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={coverageChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Open alerts by severity">
          {alertsBySeverity.length === 0 ? (
            <EmptyState title="No open alerts" description="Security alerts requiring attention will appear here." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={alertsBySeverity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Customer assessments</h2>
            {latestByCustomer.length === 0 ? (
              <EmptyState title="No assessments" description="Per-customer security assessments will display here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Firewall</th>
                      <th>Last assessed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestByCustomer.map((score) => (
                      <tr key={score.id}>
                        <td>{customerMap.get(score.customer_id) ?? "Unknown"}</td>
                        <td>{score.firewall_status ?? "—"}</td>
                        <td>{formatDate(score.last_assessed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h2 className="card-title text-base">Security alert recommendations</h2>
          {alerts.length === 0 ? (
            <EmptyState title="No open alerts" description="When risks are detected, recommendation cards will appear here with impact and remediation guidance." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {alerts.map((alert) => (
                <div key={alert.id} className="rounded-box border border-base-300 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-xs text-base-content/60">{alert.alert_type}</p>
                    </div>
                    <PriorityBadge priority={alert.severity} />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <StatusBadge status={alert.status} />
                    <span className="text-xs text-base-content/60">Detected {formatDate(alert.detected_at)}</span>
                  </div>
                  {alert.description ? (
                    <p className="mt-3 text-sm text-base-content/80">{alert.description}</p>
                  ) : null}
                  <dl className="mt-3 space-y-2 text-sm">
                    {alert.why_it_matters ? (
                      <div>
                        <dt className="font-medium text-base-content/70">Why it matters</dt>
                        <dd>{alert.why_it_matters}</dd>
                      </div>
                    ) : null}
                    {alert.recommended_solution ? (
                      <div>
                        <dt className="font-medium text-base-content/70">Recommended solution</dt>
                        <dd>{alert.recommended_solution}</dd>
                      </div>
                    ) : null}
                    {alert.estimated_impact ? (
                      <div>
                        <dt className="font-medium text-base-content/70">Estimated impact</dt>
                        <dd>{alert.estimated_impact}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </div>
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
