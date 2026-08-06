"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { formatCurrency, formatPercent } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type {
  AiPlatform,
  AiPolicy,
  AiRisk,
  AiUserCompliance,
  Customer,
} from "@/lib/types";

export default function AiGovernancePage() {
  const [loading, setLoading] = useState(true);
  const [platforms, setPlatforms] = useState<AiPlatform[]>([]);
  const [policies, setPolicies] = useState<AiPolicy[]>([]);
  const [risks, setRisks] = useState<AiRisk[]>([]);
  const [compliance, setCompliance] = useState<AiUserCompliance[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [p, pol, r, c, cust] = await Promise.all([
        supabase.from("ai_platforms").select("*").order("platform_name"),
        supabase.from("ai_policies").select("*").order("policy_name"),
        supabase.from("ai_risks").select("*").eq("status", "Open").order("detected_at", { ascending: false }),
        supabase.from("ai_user_compliance").select("*"),
        supabase.from("customers").select("*"),
      ]);
      setPlatforms(p.data ?? []);
      setPolicies(pol.data ?? []);
      setRisks(r.data ?? []);
      setCompliance(c.data ?? []);
      setCustomers(cust.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.customer_name])),
    [customers],
  );

  const totalMonthlyCost = useMemo(
    () =>
      platforms.reduce(
        (sum, p) =>
          sum + (p.monthly_subscription_cost ?? 0) + (p.monthly_api_cost ?? 0),
        0,
      ),
    [platforms],
  );

  const avgUtilization = useMemo(() => {
    const withUtil = platforms.filter((p) => p.utilization_pct != null);
    if (withUtil.length === 0) return null;
    return Math.round(
      withUtil.reduce((s, p) => s + (p.utilization_pct ?? 0), 0) / withUtil.length,
    );
  }, [platforms]);

  const complianceRate = useMemo(() => {
    if (compliance.length === 0) return null;
    const acknowledged = compliance.filter(
      (c) => c.acknowledgment_status === "Acknowledged" || c.acknowledgment_status === "Complete",
    ).length;
    return Math.round((acknowledged / compliance.length) * 100);
  }, [compliance]);

  const costByPlatform = useMemo(
    () =>
      platforms.map((p) => ({
        name: p.platform_name.length > 16 ? `${p.platform_name.slice(0, 14)}…` : p.platform_name,
        subscription: p.monthly_subscription_cost ?? 0,
        api: p.monthly_api_cost ?? 0,
      })),
    [platforms],
  );

  const utilizationChart = useMemo(
    () =>
      platforms
        .filter((p) => p.utilization_pct != null)
        .map((p) => ({
          name: p.platform_name.length > 14 ? `${p.platform_name.slice(0, 12)}…` : p.platform_name,
          utilization: p.utilization_pct ?? 0,
        })),
    [platforms],
  );

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
        title="AI governance"
        description="Monitor approved AI platforms, policies, utilization, costs, and compliance — no live API calls."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="AI platforms" value={platforms.length} tone="info" />
        <StatCard title="Active policies" value={policies.filter((p) => p.status === "Active").length} />
        <StatCard title="Open risks" value={risks.length} tone={risks.length > 0 ? "warning" : "success"} />
        <StatCard title="Monthly AI spend" value={formatCurrency(totalMonthlyCost)} />
        <StatCard
          title="Avg. utilization"
          value={avgUtilization != null ? formatPercent(avgUtilization) : "—"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Policy compliance"
          value={complianceRate != null ? formatPercent(complianceRate) : "—"}
          hint={`${compliance.length} employees tracked`}
          tone={complianceRate != null && complianceRate < 80 ? "warning" : "success"}
        />
        <StatCard
          title="Security alerts (platforms)"
          value={platforms.reduce((s, p) => s + p.security_alert_count, 0)}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Monthly cost by platform">
          {costByPlatform.length === 0 ? (
            <EmptyState title="No platforms" description="AI platform cost breakdown will appear once platforms are registered." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={costByPlatform}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Legend />
                <Bar dataKey="subscription" fill="#2563eb" name="Subscription" stackId="cost" />
                <Bar dataKey="api" fill="#0891b2" name="API" stackId="cost" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Utilization by platform">
          {utilizationChart.length === 0 ? (
            <EmptyState title="No utilization data" description="Platform utilization percentages will display here." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={utilizationChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="utilization" fill="#059669" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">AI platforms</h2>
          {platforms.length === 0 ? (
            <EmptyState title="No AI platforms" description="Registered AI tools and their licensing will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Customer</th>
                    <th>Department</th>
                    <th>Licensed</th>
                    <th>Active</th>
                    <th>Utilization</th>
                    <th>Monthly cost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="font-medium">{p.platform_name}</div>
                        <div className="text-xs text-base-content/60">{p.vendor ?? "—"}</div>
                      </td>
                      <td>{customerMap.get(p.customer_id) ?? "—"}</td>
                      <td>{p.department ?? "—"}</td>
                      <td>{p.licensed_users}</td>
                      <td>{p.active_users}</td>
                      <td>{p.utilization_pct != null ? formatPercent(p.utilization_pct) : "—"}</td>
                      <td>
                        {formatCurrency(
                          (p.monthly_subscription_cost ?? 0) + (p.monthly_api_cost ?? 0),
                        )}
                      </td>
                      <td><StatusBadge status={p.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Policies</h2>
            {policies.length === 0 ? (
              <EmptyState title="No policies" description="AI usage policies and approved platform lists will appear here." />
            ) : (
              <div className="space-y-3">
                {policies.map((policy) => (
                  <div key={policy.id} className="rounded-box border border-base-300 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{policy.policy_name}</p>
                        <p className="text-xs text-base-content/60">{policy.policy_type}</p>
                      </div>
                      <StatusBadge status={policy.status} />
                    </div>
                    {policy.description ? (
                      <p className="mt-2 text-sm text-base-content/80">{policy.description}</p>
                    ) : null}
                    {policy.approved_platforms ? (
                      <p className="mt-1 text-xs"><span className="font-medium">Approved:</span> {policy.approved_platforms}</p>
                    ) : null}
                    {policy.restricted_platforms ? (
                      <p className="mt-1 text-xs"><span className="font-medium">Restricted:</span> {policy.restricted_platforms}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Open risks</h2>
            {risks.length === 0 ? (
              <EmptyState title="No open risks" description="AI governance risks will appear when detected." />
            ) : (
              <div className="space-y-3">
                {risks.map((risk) => (
                  <div key={risk.id} className="rounded-box border border-base-300 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{risk.title}</p>
                        <p className="text-xs text-base-content/60">{risk.risk_type}</p>
                      </div>
                      <PriorityBadge priority={risk.severity} />
                    </div>
                    {risk.description ? (
                      <p className="mt-2 text-sm text-base-content/80">{risk.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">User compliance</h2>
          {compliance.length === 0 ? (
            <EmptyState title="No compliance records" description="Employee policy acknowledgments and training status will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Acknowledgment</th>
                    <th>Training</th>
                    <th>Last acknowledged</th>
                  </tr>
                </thead>
                <tbody>
                  {compliance.slice(0, 20).map((row) => (
                    <tr key={row.id}>
                      <td>{row.employee_name}</td>
                      <td>{row.department ?? "—"}</td>
                      <td><StatusBadge status={row.acknowledgment_status} /></td>
                      <td><StatusBadge status={row.training_status} /></td>
                      <td>{row.last_acknowledged_at?.slice(0, 10) ?? "—"}</td>
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
