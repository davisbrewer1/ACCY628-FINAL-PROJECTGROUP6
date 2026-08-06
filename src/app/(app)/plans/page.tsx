"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createPlan, deletePlan, updatePlan } from "@/app/actions/plans";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatHours } from "@/lib/format";
import {
  LATE_FEE_PERCENT_OPTIONS,
  LATE_FEE_PERIOD_OPTIONS,
  PLAN_PRICING_MODELS,
  REVENUE_RECOGNITION_GUIDANCE,
  formatLateFeePolicy,
} from "@/lib/plan-pricing";
import { createClient } from "@/lib/supabase/client";
import type { ServicePlan } from "@/lib/types";

const MANAGER_ROLES = new Set([
  "administrator",
  "service_manager",
  "account_manager",
]);

export default function PlansPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<ServicePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canManage = MANAGER_ROLES.has(activeRole);

  async function loadData() {
    const supabase = createClient();
    const { data } = await supabase
      .from("service_plans")
      .select("*")
      .order("active", { ascending: false })
      .order("base_price", { ascending: true });
    setPlans((data as ServicePlan[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const activePlans = useMemo(() => plans.filter((p) => p.active), [plans]);
  const retiredPlans = useMemo(() => plans.filter((p) => !p.active), [plans]);
  const isEditing = editingPlan != null;

  function openCreateDialog() {
    setEditingPlan(null);
    setError(null);
    dialogRef.current?.showModal();
  }

  function openEditDialog(plan: ServicePlan) {
    setEditingPlan(plan);
    setError(null);
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
    setEditingPlan(null);
    setError(null);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = isEditing
        ? await updatePlan(formData)
        : await createPlan(formData);
      if (result.success) {
        showToast(result.message);
        closeDialog();
        await loadData();
      } else {
        setError(result.message);
      }
    });
  }

  function handleDelete(plan: ServicePlan) {
    if (
      !window.confirm(
        `Mark "${plan.name}" as no longer in use? Existing contracts keep their snapshotted terms; new contracts cannot select this plan.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deletePlan(plan.id);
      if (result.success) {
        showToast(result.message);
        await loadData();
      } else {
        showToast(result.message);
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
        title="Plans"
        description="Define commercial offerings customers can sign under. Contracts snapshot these terms when created."
        action={
          canManage ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={openCreateDialog}
            >
              <Plus className="size-4" />
              Add Plan
            </button>
          ) : null
        }
      />

      <div className="alert alert-info text-sm">
        <span>{REVENUE_RECOGNITION_GUIDANCE}</span>
      </div>

      {plans.length === 0 ? (
        <EmptyState
          title="No plans yet"
          description="Create Essentials, Silver, Gold, or custom tiers that managers select when adding contracts."
          action={
            canManage ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={openCreateDialog}
              >
                Add Plan
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <PlanTable
            title="Available plans"
            empty="No active plans."
            plans={activePlans}
            canManage={canManage}
            isPending={isPending}
            onEdit={openEditDialog}
            onDelete={handleDelete}
          />
          {retiredPlans.length > 0 ? (
            <PlanTable
              title="No longer in use"
              empty=""
              plans={retiredPlans}
              canManage={canManage}
              isPending={isPending}
              onEdit={openEditDialog}
              onDelete={handleDelete}
              retired
            />
          ) : null}
        </>
      )}

      <dialog
        ref={dialogRef}
        className="modal"
        onClose={() => {
          setEditingPlan(null);
          setError(null);
        }}
      >
        <div className="modal-box max-h-[90vh] max-w-3xl overflow-y-auto">
          <h3 className="text-lg font-bold">
            {isEditing ? `Edit ${editingPlan.name}` : "Add Plan"}
          </h3>
          {isEditing ? (
            <p className="mt-1 text-sm text-base-content/70">
              Changes apply to new contracts only. Existing contracts keep the
              terms snapshotted when they were created.
            </p>
          ) : null}
          {error ? (
            <div className="alert alert-error mt-4 text-sm">
              <span>{error}</span>
            </div>
          ) : null}
          <form
            key={editingPlan?.id ?? "new"}
            action={handleSubmit}
            className="mt-4 space-y-6"
          >
            {isEditing ? (
              <input type="hidden" name="plan_id" value={editingPlan.id} />
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Plan name"
                htmlFor="name"
                required
                className="sm:col-span-2"
              >
                <input
                  id="name"
                  name="name"
                  className="input input-bordered w-full"
                  required
                  placeholder="Gold"
                  defaultValue={editingPlan?.name ?? ""}
                />
              </FormField>
              <FormField
                label="Description"
                htmlFor="description"
                className="sm:col-span-2"
              >
                <textarea
                  id="description"
                  name="description"
                  className="textarea textarea-bordered w-full"
                  rows={2}
                  defaultValue={editingPlan?.description ?? ""}
                />
              </FormField>
              <FormField label="Pricing model" htmlFor="pricing_model" required>
                <select
                  id="pricing_model"
                  name="pricing_model"
                  className="select select-bordered w-full"
                  defaultValue={editingPlan?.pricing_model ?? "Monthly"}
                >
                  {PLAN_PRICING_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Base price" htmlFor="base_price" required>
                <input
                  id="base_price"
                  name="base_price"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input input-bordered w-full"
                  required
                  placeholder="Monthly, yearly, or up-front amount"
                  defaultValue={editingPlan?.base_price ?? ""}
                />
              </FormField>
              <FormField
                label="Included service hours / month"
                htmlFor="included_support_hours"
              >
                <input
                  id="included_support_hours"
                  name="included_support_hours"
                  type="number"
                  min="0"
                  step="0.5"
                  className="input input-bordered w-full"
                  defaultValue={editingPlan?.included_support_hours ?? 0}
                />
              </FormField>
              <FormField
                label="Asset deployment budget (contract length)"
                htmlFor="included_asset_budget"
              >
                <input
                  id="included_asset_budget"
                  name="included_asset_budget"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input input-bordered w-full"
                  defaultValue={editingPlan?.included_asset_budget ?? 0}
                />
              </FormField>
              <FormField
                label="Additional service hour rate"
                htmlFor="additional_hourly_rate"
              >
                <input
                  id="additional_hourly_rate"
                  name="additional_hourly_rate"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input input-bordered w-full"
                  defaultValue={editingPlan?.additional_hourly_rate ?? 0}
                />
              </FormField>
              <FormField
                label="Additional asset rate ($ per $1 over budget)"
                htmlFor="additional_asset_rate"
              >
                <input
                  id="additional_asset_rate"
                  name="additional_asset_rate"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input input-bordered w-full"
                  defaultValue={editingPlan?.additional_asset_rate ?? 1}
                />
              </FormField>
            </div>

            <div className="rounded-box border border-base-300 p-4">
              <h4 className="mb-3 font-semibold">Billing details</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Billing frequency label"
                  htmlFor="billing_frequency"
                >
                  <select
                    id="billing_frequency"
                    name="billing_frequency"
                    className="select select-bordered w-full"
                    defaultValue={editingPlan?.billing_frequency ?? "Monthly"}
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Annual">Annual</option>
                    <option value="Up-front">Up-front</option>
                  </select>
                </FormField>
                <FormField label="Payment terms" htmlFor="payment_terms">
                  <input
                    id="payment_terms"
                    name="payment_terms"
                    className="input input-bordered w-full"
                    placeholder="Net 30"
                    defaultValue={editingPlan?.payment_terms ?? "Net 30"}
                  />
                </FormField>
                <FormField label="Invoice due days" htmlFor="invoice_due_days">
                  <input
                    id="invoice_due_days"
                    name="invoice_due_days"
                    type="number"
                    min="0"
                    className="input input-bordered w-full"
                    defaultValue={editingPlan?.invoice_due_days ?? 30}
                  />
                </FormField>
                <FormField label="Setup fee" htmlFor="setup_fee">
                  <input
                    id="setup_fee"
                    name="setup_fee"
                    type="number"
                    min="0"
                    step="0.01"
                    className="input input-bordered w-full"
                    defaultValue={editingPlan?.setup_fee ?? 0}
                  />
                </FormField>
                <FormField label="Late fee percent" htmlFor="late_fee_percent">
                  <select
                    id="late_fee_percent"
                    name="late_fee_percent"
                    className="select select-bordered w-full"
                    defaultValue={String(editingPlan?.late_fee_percent ?? 1.5)}
                  >
                    {LATE_FEE_PERCENT_OPTIONS.map((pct) => (
                      <option key={pct} value={pct}>
                        {pct === 0 ? "None (0%)" : `${pct}%`}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  label="Late fee timeframe"
                  htmlFor="late_fee_period_days"
                >
                  <select
                    id="late_fee_period_days"
                    name="late_fee_period_days"
                    className="select select-bordered w-full"
                    defaultValue={String(
                      editingPlan?.late_fee_period_days ?? 30,
                    )}
                  >
                    {LATE_FEE_PERIOD_OPTIONS.map((option) => (
                      <option key={option.days} value={option.days}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  label="Revenue recognition method"
                  htmlFor="revenue_recognition_method"
                  className="sm:col-span-2"
                >
                  <input
                    id="revenue_recognition_method"
                    name="revenue_recognition_method"
                    className="input input-bordered w-full"
                    defaultValue={
                      editingPlan?.revenue_recognition_method ??
                      "Monthly over service period"
                    }
                  />
                </FormField>
              </div>
            </div>

            <div className="modal-action">
              <button type="button" className="btn" onClick={closeDialog}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isPending}
              >
                {isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : isEditing ? (
                  "Save changes"
                ) : (
                  "Save Plan"
                )}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </div>
  );
}

function PlanTable({
  title,
  empty,
  plans,
  canManage,
  isPending,
  onEdit,
  onDelete,
  retired = false,
}: {
  title: string;
  empty: string;
  plans: ServicePlan[];
  canManage: boolean;
  isPending: boolean;
  onEdit: (plan: ServicePlan) => void;
  onDelete: (plan: ServicePlan) => void;
  retired?: boolean;
}) {
  if (plans.length === 0) {
    return empty ? (
      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">{title}</h2>
          <p className="text-sm text-base-content/60">{empty}</p>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="card border bg-base-100 shadow-sm">
      <div className="card-body gap-3">
        <h2 className="card-title text-base">{title}</h2>
        <div className="overflow-x-auto">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Pricing</th>
                <th className="text-right">Base price</th>
                <th>Hours / mo</th>
                <th className="text-right">Asset budget</th>
                <th className="text-right">Extra hour</th>
                <th className="text-right">Extra asset</th>
                <th>Late fee</th>
                <th>Status</th>
                {canManage ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr
                  key={plan.id}
                  className={retired ? "opacity-70" : undefined}
                >
                  <td>
                    <div className="font-medium">{plan.name}</div>
                    {plan.description ? (
                      <div className="max-w-xs text-xs text-base-content/60">
                        {plan.description}
                      </div>
                    ) : null}
                  </td>
                  <td>{plan.pricing_model}</td>
                  <td className="text-right">
                    {formatCurrency(plan.base_price)}
                  </td>
                  <td>{formatHours(plan.included_support_hours)}</td>
                  <td className="text-right">
                    {formatCurrency(plan.included_asset_budget)}
                  </td>
                  <td className="text-right">
                    {formatCurrency(plan.additional_hourly_rate)}
                  </td>
                  <td className="text-right">
                    {Number(plan.additional_asset_rate).toFixed(2)}×
                  </td>
                  <td className="text-sm">
                    {formatLateFeePolicy(
                      plan.late_fee_percent,
                      plan.late_fee_period_days,
                    )}
                  </td>
                  <td>
                    {retired ? (
                      <StatusBadge status="No longer in use" />
                    ) : (
                      <StatusBadge status="Active" />
                    )}
                  </td>
                  {canManage ? (
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          disabled={isPending}
                          onClick={() => onEdit(plan)}
                          aria-label={`Edit ${plan.name}`}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        {!retired ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-error"
                            disabled={isPending}
                            onClick={() => onDelete(plan)}
                            aria-label={`Retire ${plan.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
