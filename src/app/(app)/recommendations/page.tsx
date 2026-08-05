"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { updateRecommendationStatus } from "@/app/actions/recommendations";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type {
  AiPlatform,
  AiRisk,
  Customer,
  Recommendation,
  SecurityAlert,
} from "@/lib/types";

const CAN_REVIEW_ROLES = new Set([
  "administrator",
  "executive",
  "service_manager",
  "account_manager",
  "client_admin",
]);

interface RecommendationRow extends Recommendation {
  customerName: string;
}

export default function RecommendationsPage() {
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter") ?? "all";
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [aiRisks, setAiRisks] = useState<AiRisk[]>([]);
  const [aiPlatforms, setAiPlatforms] = useState<AiPlatform[]>([]);
  const [isPending, startTransition] = useTransition();

  const canReview = CAN_REVIEW_ROLES.has(activeRole);
  const isManager =
    activeRole === "service_manager" ||
    activeRole === "account_manager" ||
    activeRole === "administrator" ||
    activeRole === "executive";

  async function loadData() {
    const supabase = createClient();
    const [r, c, sa, ar, ap] = await Promise.all([
      supabase.from("recommendations").select("*").order("created_at", { ascending: false }),
      supabase.from("customers").select("*"),
      supabase.from("security_alerts").select("*").eq("status", "Open"),
      supabase.from("ai_risks").select("*"),
      supabase.from("ai_platforms").select("*"),
    ]);
    setRecommendations(r.data ?? []);
    setCustomers(c.data ?? []);
    setSecurityAlerts(sa.data ?? []);
    setAiRisks(ar.data ?? []);
    setAiPlatforms(ap.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.customer_name])),
    [customers],
  );

  const rows: RecommendationRow[] = useMemo(
    () =>
      recommendations.map((rec) => ({
        ...rec,
        customerName: rec.customer_id
          ? customerMap.get(rec.customer_id) ?? "Unknown"
          : "All customers",
      })),
    [recommendations, customerMap],
  );

  const filteredRows = useMemo(() => {
    if (filter === "new") {
      return rows.filter((r) => r.status === "New");
    }
    return rows;
  }, [rows, filter]);

  const riskSummary = useMemo(() => {
    const openAiRisks = aiRisks.filter(
      (r) => r.status !== "Closed" && r.status !== "Resolved",
    );
    const criticalAlerts = securityAlerts.filter(
      (a) => a.severity === "Critical" || a.severity === "High",
    );
    const monthlyAiSpend = aiPlatforms.reduce(
      (sum, p) =>
        sum + (p.monthly_subscription_cost ?? 0) + (p.monthly_api_cost ?? 0),
      0,
    );
    return {
      openSecurity: securityAlerts.length,
      criticalAlerts: criticalAlerts.length,
      openAiRisks: openAiRisks.length,
      monthlyAiSpend,
      newRecs: rows.filter((r) => r.status === "New").length,
    };
  }, [securityAlerts, aiRisks, aiPlatforms, rows]);

  function handleStatusUpdate(id: string, status: string) {
    startTransition(async () => {
      const result = await updateRecommendationStatus(id, status);
      if (result.success) {
        showToast(result.message);
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    });
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
        title="Recommendations & risk"
        description="Approve growth and risk recommendations. Cyber and AI detail stayed out of daily manager nav — summarized here."
      />

      {isManager ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-base-content/60">
            Monthly risk summary
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Open security alerts"
              value={riskSummary.openSecurity}
              hint={`${riskSummary.criticalAlerts} critical/high`}
              tone={riskSummary.criticalAlerts > 0 ? "danger" : "default"}
            />
            <StatCard
              title="Open AI risks"
              value={riskSummary.openAiRisks}
              tone={riskSummary.openAiRisks > 0 ? "warning" : "success"}
            />
            <StatCard
              title="Monthly AI spend"
              value={formatCurrency(riskSummary.monthlyAiSpend)}
              tone="info"
            />
            <StatCard
              title="Recs awaiting approve"
              value={riskSummary.newRecs}
              tone={riskSummary.newRecs > 0 ? "info" : "success"}
              href="/recommendations?filter=new"
            />
          </div>
          {(activeRole === "administrator" || activeRole === "executive") && (
            <p className="text-xs text-base-content/60">
              Full detail:{" "}
              <Link href="/cybersecurity" className="link">
                Cybersecurity
              </Link>{" "}
              ·{" "}
              <Link href="/ai-governance" className="link">
                AI Governance
              </Link>
            </p>
          )}
        </section>
      ) : null}

      {filter === "new" ? (
        <div className="alert alert-info text-sm py-2">
          <span>Showing recommendations awaiting review</span>
          <a href="/recommendations" className="link">
            Show all
          </a>
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <EmptyState
          title="No recommendations"
          description="Recommendations from cybersecurity, AI governance, and operations will appear here."
        />
      ) : (
        <div className="grid gap-4">
          {filteredRows.map((rec) => (
            <div key={rec.id} className="card border bg-base-100 shadow-sm">
              <div className="card-body gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{rec.title}</h2>
                    <p className="text-sm text-base-content/60">
                      {rec.source_area} · {rec.customerName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PriorityBadge priority={rec.priority} />
                    <StatusBadge status={rec.status} />
                  </div>
                </div>

                <dl className="grid gap-3 sm:grid-cols-2">
                  {rec.risk_exists ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                        Risk exists
                      </dt>
                      <dd className="mt-1 text-sm">{rec.risk_exists}</dd>
                    </div>
                  ) : null}
                  {rec.why_it_matters ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                        Why it matters
                      </dt>
                      <dd className="mt-1 text-sm">{rec.why_it_matters}</dd>
                    </div>
                  ) : null}
                  {rec.recommended_solution ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                        Recommended solution
                      </dt>
                      <dd className="mt-1 text-sm">{rec.recommended_solution}</dd>
                    </div>
                  ) : null}
                  {rec.estimated_impact ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                        Estimated impact
                      </dt>
                      <dd className="mt-1 text-sm">{rec.estimated_impact}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="flex flex-wrap gap-4 text-sm">
                  {rec.estimated_monthly_savings != null ? (
                    <span className="text-success">
                      Potential savings: {formatCurrency(rec.estimated_monthly_savings)}/mo
                    </span>
                  ) : null}
                  {rec.estimated_monthly_revenue != null ? (
                    <span className="text-info">
                      Revenue opportunity: {formatCurrency(rec.estimated_monthly_revenue)}/mo
                    </span>
                  ) : null}
                </div>

                {canReview && rec.status === "New" ? (
                  <div className="flex flex-wrap gap-2 border-t border-base-300 pt-3">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={isPending}
                      onClick={() => handleStatusUpdate(rec.id, "Reviewed")}
                    >
                      Mark Reviewed
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={isPending}
                      onClick={() => handleStatusUpdate(rec.id, "Approved")}
                    >
                      Approve
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
