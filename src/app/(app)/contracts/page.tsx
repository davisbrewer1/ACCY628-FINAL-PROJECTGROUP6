"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { createContract } from "@/app/actions/contracts";
import { calcProfitMargin } from "@/lib/calculations";
import { isThisMonth } from "@/lib/dashboard-stats";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate, formatHours, formatPercent } from "@/lib/format";
import {
  computeContractAssetBurns,
  computeContractHoursBurns,
  getRenewalsInDays,
  nextInvoiceDateHint,
} from "@/lib/manager-ops";
import {
  formatLateFeePolicy,
  planRecognizedMonthly,
  REVENUE_RECOGNITION_GUIDANCE,
} from "@/lib/plan-pricing";
import { createClient } from "@/lib/supabase/client";
import type {
  Contract,
  Customer,
  HardwareAsset,
  Profile,
  ServicePlan,
  WorkEntry,
} from "@/lib/types";

interface ContractRow extends Contract {
  customerName: string;
  hoursUsed: number;
  burnPercent: number | null;
  overageEstimate: number;
  isOver: boolean;
  assetSpend: number;
  assetBurnPercent: number | null;
  assetOverageEstimate: number;
  assetIsOver: boolean;
  profitMargin: number | null;
  ownerName: string;
  planRetired: boolean;
  nextInvoiceHint: string | null;
}

export default function ContractsPage() {
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter") ?? "all";
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [assets, setAssets] = useState<HardwareAsset[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData() {
    const supabase = createClient();
    const [c, co, p, w, a, pr] = await Promise.all([
      supabase.from("customers").select("*").order("customer_name"),
      supabase.from("contracts").select("*").order("created_at", { ascending: false }),
      supabase.from("service_plans").select("*").order("base_price"),
      supabase.from("work_entries").select("*"),
      supabase.from("hardware_assets").select("*"),
      supabase.from("profiles").select("*"),
    ]);
    setCustomers(c.data ?? []);
    setContracts(co.data ?? []);
    setPlans((p.data as ServicePlan[]) ?? []);
    setWorkEntries(w.data ?? []);
    setAssets((a.data as HardwareAsset[]) ?? []);
    setProfiles(pr.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const activePlans = useMemo(() => plans.filter((plan) => plan.active), [plans]);
  const planById = useMemo(
    () => new Map(plans.map((plan) => [plan.id, plan])),
    [plans],
  );
  const selectedPlan = selectedPlanId
    ? planById.get(selectedPlanId) ?? null
    : null;
  const recognizedPreview =
    selectedPlan && startDate && endDate
      ? planRecognizedMonthly(selectedPlan, startDate, endDate)
      : selectedPlan
        ? planRecognizedMonthly(selectedPlan, null, null)
        : null;

  const renewals90Ids = useMemo(
    () => new Set(getRenewalsInDays(contracts, 90).map((c) => c.id)),
    [contracts],
  );

  const rows: ContractRow[] = useMemo(() => {
    const customerMap = new Map(customers.map((c) => [c.id, c.customer_name]));
    const profileMap = new Map(
      profiles.map((p) => [p.id, p.full_name ?? p.email ?? "—"]),
    );
    const burns = new Map(
      computeContractHoursBurns(contracts, workEntries).map((b) => [
        b.contractId,
        b,
      ]),
    );
    const assetBurns = new Map(
      computeContractAssetBurns(contracts, assets).map((b) => [
        b.contractId,
        b,
      ]),
    );

    return contracts.map((contract) => {
      const burn = burns.get(contract.id);
      const assetBurn = assetBurns.get(contract.id);
      const hoursUsed =
        burn?.hoursUsed ??
        workEntries
          .filter(
            (e) => e.contract_id === contract.id && isThisMonth(e.work_date),
          )
          .reduce((sum, e) => sum + (e.hours_worked ?? 0), 0);
      const costs = workEntries
        .filter((e) => e.contract_id === contract.id)
        .reduce((sum, e) => sum + (e.total_direct_cost ?? 0), 0);
      const revenue = contract.monthly_recurring_fee ?? 0;
      const linkedPlan = contract.plan_id
        ? planById.get(contract.plan_id)
        : undefined;

      return {
        ...contract,
        customerName: customerMap.get(contract.customer_id) ?? "Unknown",
        hoursUsed,
        burnPercent: burn?.burnPercent ?? null,
        overageEstimate: burn?.overageEstimate ?? 0,
        isOver: burn?.isOver ?? false,
        assetSpend: assetBurn?.assetSpend ?? 0,
        assetBurnPercent: assetBurn?.burnPercent ?? null,
        assetOverageEstimate: assetBurn?.overageEstimate ?? 0,
        assetIsOver: assetBurn?.isOver ?? false,
        profitMargin: calcProfitMargin(revenue, costs),
        ownerName: contract.contract_owner_id
          ? profileMap.get(contract.contract_owner_id) ?? "Assigned"
          : "Unassigned",
        planRetired: linkedPlan ? !linkedPlan.active : false,
        nextInvoiceHint: nextInvoiceDateHint(contract),
      };
    });
  }, [contracts, customers, workEntries, profiles, assets, planById]);

  const filteredRows = useMemo(() => {
    if (filter === "renewals") {
      return rows.filter((r) => renewals90Ids.has(r.id));
    }
    if (filter === "over-hours") {
      return rows.filter((r) => r.isOver);
    }
    return rows;
  }, [rows, filter, renewals90Ids]);

  function openCreateDialog() {
    setError(null);
    setSelectedPlanId(activePlans[0]?.id ?? "");
    setStartDate("");
    setEndDate("");
    dialogRef.current?.showModal();
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createContract(formData);
      if (result.success) {
        showToast(result.message);
        dialogRef.current?.close();
        await loadData();
      } else {
        setError(result.message);
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

  const filterLabel =
    filter === "renewals"
      ? "Showing renewals within 90 days"
      : filter === "over-hours"
        ? "Showing contracts over included hours"
        : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        description="Choose a plan, then set customer and term. Hours burn, asset budget, renewals, and recognized monthly revenue."
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreateDialog}>
            <Plus className="size-4" />
            Add Contract
          </button>
        }
      />

      <div className="alert alert-info text-sm">
        <span>{REVENUE_RECOGNITION_GUIDANCE}</span>
      </div>

      {filterLabel ? (
        <div className="alert alert-info text-sm">
          <span>{filterLabel}</span>
          <a href="/contracts" className="link">
            Clear filter
          </a>
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <EmptyState
          title="No contracts match"
          description="Create a managed-services contract from a plan, or clear the active filter."
          action={
            <button type="button" className="btn btn-primary" onClick={openCreateDialog}>
              Add Contract
            </button>
          }
        />
      ) : (
        <div className="card border bg-base-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Plan</th>
                  <th className="text-right">Recognized MRR</th>
                  <th>Hours burn</th>
                  <th>Asset budget</th>
                  <th className="text-right">Overage est.</th>
                  <th>Renewal owner</th>
                  <th>Next invoice</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      row.isOver || row.assetIsOver ? "bg-warning/5" : undefined
                    }
                  >
                    <td className="font-medium">{row.contract_name}</td>
                    <td>{row.customerName}</td>
                    <td>
                      <StatusBadge status={row.contract_status ?? "Unknown"} />
                    </td>
                    <td>
                      <div>{row.service_plan_name ?? "—"}</div>
                      {row.planRetired ? (
                        <div className="mt-1">
                          <StatusBadge status="Plan retired" />
                        </div>
                      ) : null}
                    </td>
                    <td className="text-right">
                      {formatCurrency(row.monthly_recurring_fee)}
                    </td>
                    <td>
                      <div>
                        {formatHours(row.hoursUsed)} /{" "}
                        {formatHours(row.included_support_hours)}
                      </div>
                      <div
                        className={`text-xs ${
                          row.isOver
                            ? "font-medium text-warning"
                            : "text-base-content/60"
                        }`}
                      >
                        {row.burnPercent != null
                          ? `${row.burnPercent.toFixed(0)}% used`
                          : "No allotment"}
                      </div>
                    </td>
                    <td>
                      <div>
                        {formatCurrency(row.assetSpend)} /{" "}
                        {formatCurrency(row.included_asset_budget ?? 0)}
                      </div>
                      <div
                        className={`text-xs ${
                          row.assetIsOver
                            ? "font-medium text-warning"
                            : "text-base-content/60"
                        }`}
                      >
                        {row.assetBurnPercent != null
                          ? `${row.assetBurnPercent.toFixed(0)}% used`
                          : "No budget"}
                      </div>
                    </td>
                    <td className="text-right">
                      {row.isOver || row.assetIsOver ? (
                        <div className="space-y-0.5">
                          {row.isOver ? (
                            <div title="Hours overage">
                              H: {formatCurrency(row.overageEstimate)}
                            </div>
                          ) : null}
                          {row.assetIsOver ? (
                            <div title="Asset overage">
                              A: {formatCurrency(row.assetOverageEstimate)}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <div>{row.ownerName}</div>
                      <div className="text-xs text-base-content/60">
                        {row.automatic_renewal ? "Auto" : "Manual"} ·{" "}
                        {formatDate(row.renewal_date)}
                      </div>
                    </td>
                    <td>{row.nextInvoiceHint ?? "—"}</td>
                    <td>
                      {row.profitMargin != null
                        ? formatPercent(row.profitMargin)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-h-[90vh] max-w-2xl overflow-y-auto">
          <h3 className="text-lg font-bold">Add Contract</h3>
          {error ? (
            <div className="alert alert-error mt-4 text-sm">
              <span>{error}</span>
            </div>
          ) : null}
          <form action={handleSubmit} className="mt-4 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Plan" htmlFor="plan_id" required className="sm:col-span-2">
                <select
                  id="plan_id"
                  name="plan_id"
                  className="select select-bordered w-full"
                  required
                  value={selectedPlanId}
                  onChange={(event) => setSelectedPlanId(event.target.value)}
                >
                  <option value="" disabled>
                    Select a plan
                  </option>
                  {activePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} · {plan.pricing_model} ·{" "}
                      {formatCurrency(plan.base_price)}
                    </option>
                  ))}
                </select>
              </FormField>

              {selectedPlan ? (
                <div className="sm:col-span-2 rounded-box border border-base-300 bg-base-200/40 p-4 text-sm">
                  <div className="font-medium">{selectedPlan.name} terms</div>
                  <ul className="mt-2 grid gap-1 text-base-content/80 sm:grid-cols-2">
                    <li>
                      Pricing: {selectedPlan.pricing_model} ·{" "}
                      {formatCurrency(selectedPlan.base_price)}
                    </li>
                    <li>
                      Recognized monthly:{" "}
                      {recognizedPreview != null
                        ? formatCurrency(recognizedPreview)
                        : "—"}
                    </li>
                    <li>
                      Included hours / mo:{" "}
                      {formatHours(selectedPlan.included_support_hours)}
                    </li>
                    <li>
                      Asset budget (term):{" "}
                      {formatCurrency(selectedPlan.included_asset_budget)}
                    </li>
                    <li>
                      Extra hour rate:{" "}
                      {formatCurrency(selectedPlan.additional_hourly_rate)}
                    </li>
                    <li>
                      Extra asset rate:{" "}
                      {Number(selectedPlan.additional_asset_rate).toFixed(2)}×
                    </li>
                    <li>
                      Payment terms: {selectedPlan.payment_terms ?? "—"}
                    </li>
                    <li>
                      Late fee:{" "}
                      {formatLateFeePolicy(
                        selectedPlan.late_fee_percent,
                        selectedPlan.late_fee_period_days,
                      )}
                    </li>
                    <li>
                      Due days: {selectedPlan.invoice_due_days ?? "—"}
                    </li>
                  </ul>
                </div>
              ) : null}

              <FormField
                label="Contract name"
                htmlFor="contract_name"
                required
                className="sm:col-span-2"
              >
                <input
                  id="contract_name"
                  name="contract_name"
                  className="input input-bordered w-full"
                  required
                />
              </FormField>
              <FormField label="Customer" htmlFor="customer_id" required>
                <select
                  id="customer_id"
                  name="customer_id"
                  className="select select-bordered w-full"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select customer
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Contract status" htmlFor="contract_status">
                <select
                  id="contract_status"
                  name="contract_status"
                  className="select select-bordered w-full"
                  defaultValue="Draft"
                >
                  <option value="Draft">Draft</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Active">Active</option>
                  <option value="Expired">Expired</option>
                </select>
              </FormField>
              <FormField label="Start date" htmlFor="start_date" required>
                <input
                  id="start_date"
                  name="start_date"
                  type="date"
                  className="input input-bordered w-full"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </FormField>
              <FormField label="End date" htmlFor="end_date" required>
                <input
                  id="end_date"
                  name="end_date"
                  type="date"
                  className="input input-bordered w-full"
                  required
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </FormField>
              <FormField label="Renewal date" htmlFor="renewal_date">
                <input
                  id="renewal_date"
                  name="renewal_date"
                  type="date"
                  className="input input-bordered w-full"
                />
              </FormField>
              <FormField label="Automatic renewal" htmlFor="automatic_renewal">
                <select
                  id="automatic_renewal"
                  name="automatic_renewal"
                  className="select select-bordered w-full"
                  defaultValue="true"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </FormField>
              <FormField label="Approval status" htmlFor="approval_status">
                <select
                  id="approval_status"
                  name="approval_status"
                  className="select select-bordered w-full"
                  defaultValue="Pending"
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </FormField>
              <FormField label="Notes" htmlFor="notes" className="sm:col-span-2">
                <textarea
                  id="notes"
                  name="notes"
                  className="textarea textarea-bordered w-full"
                  rows={2}
                />
              </FormField>
            </div>

            <div className="alert alert-info text-sm">
              <span>
                Commercial terms come from the selected plan and are snapshotted
                onto this contract. Active status requires Approved approval.
              </span>
            </div>

            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={() => dialogRef.current?.close()}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isPending || activePlans.length === 0}
              >
                {isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Save Contract"
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
