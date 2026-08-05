"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { updateRecommendationStatus } from "@/app/actions/recommendations";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Customer, Recommendation } from "@/lib/types";

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
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isPending, startTransition] = useTransition();

  const canReview = CAN_REVIEW_ROLES.has(activeRole);

  async function loadData() {
    const supabase = createClient();
    const [r, c] = await Promise.all([
      supabase.from("recommendations").select("*").order("created_at", { ascending: false }),
      supabase.from("customers").select("*"),
    ]);
    setRecommendations(r.data ?? []);
    setCustomers(c.data ?? []);
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
        title="Recommendations"
        description="Actionable insights with risk context, business impact, and approval workflow."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No recommendations"
          description="Recommendations from cybersecurity, AI governance, and operations will appear here."
        />
      ) : (
        <div className="grid gap-4">
          {rows.map((rec) => (
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
                      <dt className="text-xs font-medium uppercase tracking-wide text-base-content/60">Risk exists</dt>
                      <dd className="mt-1 text-sm">{rec.risk_exists}</dd>
                    </div>
                  ) : null}
                  {rec.why_it_matters ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-base-content/60">Why it matters</dt>
                      <dd className="mt-1 text-sm">{rec.why_it_matters}</dd>
                    </div>
                  ) : null}
                  {rec.recommended_solution ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-base-content/60">Recommended solution</dt>
                      <dd className="mt-1 text-sm">{rec.recommended_solution}</dd>
                    </div>
                  ) : null}
                  {rec.estimated_impact ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-base-content/60">Estimated impact</dt>
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
