"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  cancelClientContractPlanChangeRequest,
  requestClientContractPlanChange,
} from "@/app/actions/portal-contracts";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PortalPageHeader } from "@/components/end-user/PortalPageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  formatLateFeePolicy,
  planRecognizedMonthly,
  snapshotBillingFrequency,
  snapshotSetupFee,
} from "@/lib/plan-pricing";
import { createClient } from "@/lib/supabase/client";
import type {
  Contract,
  ContractPlanChangeRequest,
  Profile,
  ServicePlan,
} from "@/lib/types";

function yesNo(value: boolean | null | undefined): string {
  if (value == null) return "—";
  return value ? "Yes" : "No";
}

function planPriceLabel(plan: ServicePlan): string {
  if (plan.pricing_model === "Yearly") {
    return `${formatCurrency(plan.base_price)}/yr`;
  }
  if (plan.pricing_model === "Up-front") {
    return `${formatCurrency(plan.base_price)} up front`;
  }
  return `${formatCurrency(plan.base_price)}/mo`;
}

export default function EndUserContractsPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [requests, setRequests] = useState<ContractPlanChangeRequest[]>([]);
  const [planDrafts, setPlanDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  async function loadData(customerId: string) {
    const supabase = createClient();
    const [contractsRes, plansRes, requestsRes] = await Promise.all([
      supabase
        .from("contracts")
        .select("*")
        .eq("customer_id", customerId)
        .order("start_date", { ascending: false }),
      supabase
        .from("service_plans")
        .select("*")
        .eq("active", true)
        .order("base_price", { ascending: true }),
      supabase
        .from("contract_plan_change_requests")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ]);

    const nextContracts = (contractsRes.data ?? []) as Contract[];
    setContracts(nextContracts);
    setPlans((plansRes.data ?? []) as ServicePlan[]);
    setRequests((requestsRes.data ?? []) as ContractPlanChangeRequest[]);
    setPlanDrafts(
      Object.fromEntries(
        nextContracts.map((contract) => [contract.id, contract.plan_id ?? ""]),
      ),
    );
  }

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
        await loadData(profileData.customer_id);
      }

      setLoading(false);
    }
    init();
  }, []);

  const activeContracts = useMemo(
    () => contracts.filter((c) => c.contract_status === "Active"),
    [contracts],
  );

  const pendingByContractId = useMemo(() => {
    const map = new Map<string, ContractPlanChangeRequest>();
    for (const request of requests) {
      if (request.status === "Pending") {
        map.set(request.contract_id, request);
      }
    }
    return map;
  }, [requests]);

  const planById = useMemo(
    () => new Map(plans.map((plan) => [plan.id, plan])),
    [plans],
  );

  function handleRequestPlanChange(contract: Contract) {
    const planId = planDrafts[contract.id] ?? "";
    setPlanErrors((prev) => {
      const next = { ...prev };
      delete next[contract.id];
      return next;
    });

    startTransition(async () => {
      const result = await requestClientContractPlanChange({
        contractId: contract.id,
        planId,
        note: noteDrafts[contract.id],
      });
      if (result.success) {
        showToast(result.message);
        setNoteDrafts((prev) => ({ ...prev, [contract.id]: "" }));
        if (profile?.customer_id) {
          await loadData(profile.customer_id);
        }
      } else {
        setPlanErrors((prev) => ({ ...prev, [contract.id]: result.message }));
      }
    });
  }

  function handleCancelRequest(requestId: string) {
    startTransition(async () => {
      const result = await cancelClientContractPlanChangeRequest(requestId);
      if (result.success) {
        showToast(result.message);
        if (profile?.customer_id) {
          await loadData(profile.customer_id);
        }
      } else {
        showToast(result.message);
      }
    });
  }

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
      <PortalPageHeader
        title="My contracts"
        description="View signed agreements, request a plan change, or request Cancel Plan. Management must approve before anything changes."
      />

      <div className="alert alert-info text-sm">
        <span>
          Plan options and billing terms come from the Nexus service plan catalog
          (Essentials, Silver, Gold, and any other active plans). You can also choose Cancel Plan.
          Requests go to management for approval — your contract does not change until approved.
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
          {contracts.map((contract) => {
            const selectedPlanId = planDrafts[contract.id] ?? contract.plan_id ?? "";
            const selectedPlan = planById.get(selectedPlanId);
            const currentCatalogPlan = contract.plan_id
              ? planById.get(contract.plan_id)
              : undefined;
            const pendingRequest = pendingByContractId.get(contract.id);
            const isPendingTermination =
              pendingRequest?.request_type === "termination";
            const pendingRequestedPlan =
              pendingRequest?.requested_plan_id
                ? planById.get(pendingRequest.requested_plan_id)
                : undefined;
            const canRequestPlan = contract.contract_status === "Active" && !pendingRequest;
            const isTerminateSelected = selectedPlanId === "__terminate__";
            const planChanged =
              Boolean(selectedPlanId) &&
              (isTerminateSelected || selectedPlanId !== (contract.plan_id ?? ""));
            const previewMonthly =
              selectedPlan && !isTerminateSelected
                ? planRecognizedMonthly(
                    selectedPlan,
                    contract.start_date,
                    contract.end_date,
                  )
                : null;

            return (
              <div key={contract.id} className="card border bg-base-100 shadow-sm">
                <div className="card-body gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="card-title text-base">{contract.contract_name}</h2>
                      <p className="text-sm text-base-content/60">
                        Current plan: {contract.service_plan_name ?? "Service agreement"}
                        {currentCatalogPlan
                          ? ` · Catalog ${planPriceLabel(currentCatalogPlan)}`
                          : ""}
                      </p>
                    </div>
                    <StatusBadge status={contract.contract_status ?? "Unknown"} />
                  </div>

                  {pendingRequest ? (
                    <div className="rounded-box border border-warning/40 bg-warning/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-warning">
                        Pending management review
                      </p>
                      <p className="mt-1 text-sm text-base-content/80">
                        {isPendingTermination ? (
                          <>
                            Requested:{" "}
                            <span className="font-medium">Cancel Plan</span>
                          </>
                        ) : (
                          <>
                            Requested plan:{" "}
                            <span className="font-medium">
                              {pendingRequestedPlan?.name ?? "Selected plan"}
                            </span>
                            {pendingRequestedPlan
                              ? ` · ${planPriceLabel(pendingRequestedPlan)} · ${pendingRequestedPlan.included_support_hours} hrs`
                              : ""}
                          </>
                        )}
                      </p>
                      {pendingRequest.client_note ? (
                        <p className="mt-1 text-sm text-base-content/70">
                          Your note: {pendingRequest.client_note}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-base-content/60">
                        Submitted {formatDate(pendingRequest.created_at)}. Your current plan and
                        billing stay in place until management approves.
                      </p>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm mt-3"
                        disabled={isPending}
                        onClick={() => handleCancelRequest(pendingRequest.id)}
                      >
                        Cancel request
                      </button>
                    </div>
                  ) : null}

                  {canRequestPlan ? (
                    <div className="rounded-box border border-primary/30 bg-primary/5 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Request plan change or Cancel Plan
                      </p>
                      <p className="mt-1 text-sm text-base-content/75">
                        Choose a different catalog plan, or select Cancel Plan. This sends a request
                        to management — it does not change your contract immediately.
                      </p>
                      <FormField
                        label="Available plans (from catalog)"
                        htmlFor={`plan-${contract.id}`}
                        className="mt-3"
                      >
                        <select
                          id={`plan-${contract.id}`}
                          className="select select-bordered w-full max-w-md"
                          value={selectedPlanId}
                          onChange={(event) =>
                            setPlanDrafts((prev) => ({
                              ...prev,
                              [contract.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select a plan</option>
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name} · {planPriceLabel(plan)} ·{" "}
                              {plan.included_support_hours} hrs ·{" "}
                              {snapshotBillingFrequency(plan)} billing
                            </option>
                          ))}
                          <option value="__terminate__">Cancel Plan</option>
                        </select>
                      </FormField>

                      {isTerminateSelected ? (
                        <div className="mt-3 rounded-box border border-error/30 bg-error/5 p-3 text-sm">
                          <p className="font-medium text-error">Cancel Plan</p>
                          <p className="mt-1 text-base-content/75">
                            Management will review your request. If approved, this contract is
                            cancelled and recurring coverage ends. Open tickets and past invoices
                            are not deleted.
                          </p>
                        </div>
                      ) : null}

                      {selectedPlan && !isTerminateSelected ? (
                        <div className="mt-3 rounded-box border border-base-300 bg-base-100 p-3 text-sm">
                          <p className="font-medium">{selectedPlan.name} billing preview</p>
                          <p className="mt-1 text-base-content/75">
                            {selectedPlan.description ?? "Catalog plan terms apply after approval."}
                          </p>
                          <ul className="mt-2 grid gap-1 text-xs text-base-content/70 sm:grid-cols-2">
                            <li>Recognized monthly: {formatCurrency(previewMonthly)}</li>
                            <li>Billing cadence: {snapshotBillingFrequency(selectedPlan)}</li>
                            <li>Setup / up-front: {formatCurrency(snapshotSetupFee(selectedPlan))}</li>
                            <li>
                              Included hours: {selectedPlan.included_support_hours}
                            </li>
                            <li>
                              Overage rate: {formatCurrency(selectedPlan.additional_hourly_rate)}/hr
                            </li>
                            <li>Payment terms: {selectedPlan.payment_terms ?? "—"}</li>
                            <li>
                              Late fees:{" "}
                              {formatLateFeePolicy(
                                selectedPlan.late_fee_percent,
                                selectedPlan.late_fee_period_days,
                              )}
                            </li>
                            <li>Invoice due: {selectedPlan.invoice_due_days ?? 30} days</li>
                          </ul>
                        </div>
                      ) : null}

                      <FormField
                        label="Note to management (optional)"
                        htmlFor={`note-${contract.id}`}
                        className="mt-3"
                      >
                        <textarea
                          id={`note-${contract.id}`}
                          className="textarea textarea-bordered w-full max-w-xl"
                          rows={2}
                          value={noteDrafts[contract.id] ?? ""}
                          onChange={(event) =>
                            setNoteDrafts((prev) => ({
                              ...prev,
                              [contract.id]: event.target.value,
                            }))
                          }
                          placeholder={
                            isTerminateSelected
                              ? "Example: We are consolidating vendors and want to cancel this plan."
                              : "Example: We need more included support hours next quarter."
                          }
                        />
                      </FormField>

                      {planErrors[contract.id] ? (
                        <p className="mt-2 text-sm text-error">{planErrors[contract.id]}</p>
                      ) : null}

                      <button
                        type="button"
                        className={`btn btn-sm mt-3 ${
                          isTerminateSelected ? "btn-error" : "btn-primary"
                        }`}
                        disabled={isPending || !planChanged}
                        onClick={() => handleRequestPlanChange(contract)}
                      >
                        {isPending
                          ? "Sending..."
                          : isTerminateSelected
                            ? "Request Cancel Plan"
                            : "Request plan change"}
                      </button>
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      ["Approval status", contract.approval_status ?? "—"],
                      ["Billing frequency", contract.billing_frequency ?? "—"],
                      ["Start date", formatDate(contract.start_date)],
                      ["End date", formatDate(contract.end_date)],
                      ["Renewal date", formatDate(contract.renewal_date)],
                      ["Automatic renewal", yesNo(contract.automatic_renewal)],
                      [
                        "Monthly recurring fee",
                        formatCurrency(contract.monthly_recurring_fee),
                      ],
                      ["Setup fee", formatCurrency(contract.setup_fee)],
                      [
                        "Included support hours",
                        String(contract.included_support_hours ?? "—"),
                      ],
                      ["Support coverage", contract.support_coverage ?? "—"],
                      [
                        "Additional hourly rate",
                        formatCurrency(contract.additional_hourly_rate),
                      ],
                      [
                        "Emergency support rate",
                        formatCurrency(contract.emergency_support_rate),
                      ],
                      [
                        "Onsite support rate",
                        formatCurrency(contract.onsite_support_rate),
                      ],
                      ["Payment terms", contract.payment_terms ?? "—"],
                      [
                        "Invoice due days",
                        String(contract.invoice_due_days ?? "—"),
                      ],
                      [
                        "Late fee policy",
                        contract.late_fee_percent != null &&
                        contract.late_fee_period_days != null
                          ? `${contract.late_fee_percent}% every ${contract.late_fee_period_days} days past due`
                          : (contract.late_fee_policy ?? "—"),
                      ],
                      [
                        "Remote support included",
                        yesNo(contract.remote_support_included),
                      ],
                      [
                        "Onsite support included",
                        yesNo(contract.onsite_support_included),
                      ],
                      [
                        "Critical response (hrs)",
                        String(contract.critical_response_target_hours ?? "—"),
                      ],
                      [
                        "High response (hrs)",
                        String(contract.high_response_target_hours ?? "—"),
                      ],
                      [
                        "Standard response (hrs)",
                        String(contract.standard_response_target_hours ?? "—"),
                      ],
                      [
                        "Resolution target (hrs)",
                        String(contract.resolution_target_hours ?? "—"),
                      ],
                      [
                        "Preventive maintenance",
                        contract.preventive_maintenance_frequency ?? "—",
                      ],
                      [
                        "Pass-through charges",
                        yesNo(contract.pass_through_charges_allowed),
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-box border border-base-300 bg-base-200/30 p-3"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-medium leading-snug">{value}</p>
                      </div>
                    ))}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
