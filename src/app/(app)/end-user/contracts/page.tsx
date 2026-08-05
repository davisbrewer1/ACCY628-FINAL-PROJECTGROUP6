"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Profile } from "@/lib/types";

function yesNo(value: boolean | null | undefined): string {
  if (value == null) return "—";
  return value ? "Yes" : "No";
}

export default function EndUserContractsPage() {
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      setProfile(profileData);

      if (profileData?.customer_id) {
        const { data } = await supabase
          .from("contracts")
          .select("*")
          .eq("customer_id", profileData.customer_id)
          .order("start_date", { ascending: false });
        setContracts(data ?? []);
      }

      setLoading(false);
    }
    init();
  }, []);

  const activeContracts = useMemo(
    () => contracts.filter((c) => c.contract_status === "Active"),
    [contracts],
  );

  if (activeRole !== "client_user" && activeRole !== "administrator") {
    return (
      <AlertBanner
        tone="info"
        title="My contracts"
        message="This page is designed for client end users. Use the Demo Role Switcher to preview this view."
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

  if (!profile?.customer_id) {
    return (
      <EmptyState
        title="No organization linked"
        description="Your account is not linked to a customer organization. Contact your IT administrator."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My contracts"
        description="View signed business agreements with Nexus Technology Solutions. Contract terms are read-only."
      />

      <div className="alert alert-info text-sm">
        <span>
          These agreements have already been signed. Client users can view details only and cannot
          edit contract terms.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total contracts" value={contracts.length} />
        <StatCard
          title="Active contracts"
          value={activeContracts.length}
          tone={activeContracts.length > 0 ? "success" : "default"}
        />
        <StatCard
          title="Monthly commitment"
          value={formatCurrency(
            activeContracts.reduce((sum, c) => sum + (c.monthly_recurring_fee ?? 0), 0),
          )}
          tone="info"
        />
      </div>

      {contracts.length === 0 ? (
        <EmptyState
          title="No contracts on file"
          description="When your organization signs a service agreement with Nexus, it will appear here."
        />
      ) : (
        <div className="space-y-4">
          {contracts.map((contract) => (
            <div key={contract.id} className="card border bg-base-100 shadow-sm">
              <div className="card-body gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="card-title text-base">{contract.contract_name}</h2>
                    <p className="text-sm text-base-content/60">
                      {contract.service_plan_name ?? "Service agreement"}
                    </p>
                  </div>
                  <StatusBadge status={contract.contract_status ?? "Unknown"} />
                </div>

                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <tbody>
                      <tr>
                        <th className="w-48">Approval status</th>
                        <td>{contract.approval_status ?? "—"}</td>
                        <th className="w-48">Billing frequency</th>
                        <td>{contract.billing_frequency ?? "—"}</td>
                      </tr>
                      <tr>
                        <th>Start date</th>
                        <td>{formatDate(contract.start_date)}</td>
                        <th>End date</th>
                        <td>{formatDate(contract.end_date)}</td>
                      </tr>
                      <tr>
                        <th>Renewal date</th>
                        <td>{formatDate(contract.renewal_date)}</td>
                        <th>Automatic renewal</th>
                        <td>{yesNo(contract.automatic_renewal)}</td>
                      </tr>
                      <tr>
                        <th>Monthly recurring fee</th>
                        <td>{formatCurrency(contract.monthly_recurring_fee)}</td>
                        <th>Setup fee</th>
                        <td>{formatCurrency(contract.setup_fee)}</td>
                      </tr>
                      <tr>
                        <th>Included support hours</th>
                        <td>{contract.included_support_hours ?? "—"}</td>
                        <th>Support coverage</th>
                        <td>{contract.support_coverage ?? "—"}</td>
                      </tr>
                      <tr>
                        <th>Additional hourly rate</th>
                        <td>{formatCurrency(contract.additional_hourly_rate)}</td>
                        <th>Emergency support rate</th>
                        <td>{formatCurrency(contract.emergency_support_rate)}</td>
                      </tr>
                      <tr>
                        <th>Onsite support rate</th>
                        <td>{formatCurrency(contract.onsite_support_rate)}</td>
                        <th>Payment terms</th>
                        <td>{contract.payment_terms ?? "—"}</td>
                      </tr>
                      <tr>
                        <th>Invoice due days</th>
                        <td>{contract.invoice_due_days ?? "—"}</td>
                        <th>Late fee policy</th>
                        <td>{contract.late_fee_policy ?? "—"}</td>
                      </tr>
                      <tr>
                        <th>Remote support included</th>
                        <td>{yesNo(contract.remote_support_included)}</td>
                        <th>Onsite support included</th>
                        <td>{yesNo(contract.onsite_support_included)}</td>
                      </tr>
                      <tr>
                        <th>Critical response (hrs)</th>
                        <td>{contract.critical_response_target_hours ?? "—"}</td>
                        <th>High response (hrs)</th>
                        <td>{contract.high_response_target_hours ?? "—"}</td>
                      </tr>
                      <tr>
                        <th>Standard response (hrs)</th>
                        <td>{contract.standard_response_target_hours ?? "—"}</td>
                        <th>Resolution target (hrs)</th>
                        <td>{contract.resolution_target_hours ?? "—"}</td>
                      </tr>
                      <tr>
                        <th>Preventive maintenance</th>
                        <td>{contract.preventive_maintenance_frequency ?? "—"}</td>
                        <th>Pass-through charges</th>
                        <td>{yesNo(contract.pass_through_charges_allowed)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {contract.notes ? (
                  <div className="rounded-box border border-base-300 bg-base-200/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                      Agreement notes
                    </p>
                    <p className="mt-1 text-sm text-base-content/80">{contract.notes}</p>
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
