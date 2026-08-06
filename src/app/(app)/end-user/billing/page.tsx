"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { syncBillingCadence } from "@/app/actions/billing";
import { recordClientPortalPayment } from "@/app/actions/portal-payments";
import Link from "next/link";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import {
  EMPTY_CARD_DETAILS,
  isCardPaymentMethod,
  SimulatedCardPaymentFields,
  type SimulatedCardDetails,
} from "@/components/SimulatedCardPaymentFields";
import { PortalPageHeader } from "@/components/end-user/PortalPageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { useToast } from "@/components/Toast";
import {
  formatPayableInvoiceOption,
  getInvoicePurpose,
  sumOutstandingBalance,
  toClientInvoiceStatus,
} from "@/lib/client-billing";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import {
  buildPortalPlanBillingSummary,
  payableInvoices,
} from "@/lib/portal-billing";
import { createClient } from "@/lib/supabase/client";
import type {
  Contract,
  HardwareAsset,
  Invoice,
  Profile,
  ServicePlan,
  WorkEntry,
} from "@/lib/types";

const PAYMENT_METHODS = [
  "Credit Card",
  "ACH / Bank Transfer",
  "Check",
  "Wire Transfer",
] as const;

export default function EndUserBillingPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [assets, setAssets] = useState<HardwareAsset[]>([]);
  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [payReference, setPayReference] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [cardDetails, setCardDetails] =
    useState<SimulatedCardDetails>(EMPTY_CARD_DETAILS);
  const [payError, setPayError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadBilling(customerId: string) {
    const supabase = createClient();
    const [co, inv, work, assetRes, planRes] = await Promise.all([
      supabase
        .from("contracts")
        .select("*")
        .eq("customer_id", customerId)
        .order("contract_status"),
      supabase
        .from("invoices")
        .select("*")
        .eq("customer_id", customerId)
        .order("invoice_date", { ascending: false }),
      supabase
        .from("work_entries")
        .select("*")
        .eq("customer_id", customerId)
        .order("work_date", { ascending: false }),
      supabase
        .from("hardware_assets")
        .select("*")
        .eq("customer_id", customerId)
        .order("asset_number"),
      supabase
        .from("service_plans")
        .select("*")
        .eq("active", true)
        .order("base_price", { ascending: true }),
    ]);

    const nextInvoices = (inv.data ?? []) as Invoice[];
    setContracts((co.data ?? []) as Contract[]);
    setInvoices(nextInvoices);
    setWorkEntries((work.data ?? []) as WorkEntry[]);
    setAssets((assetRes.data ?? []) as HardwareAsset[]);
    setPlans((planRes.data ?? []) as ServicePlan[]);

    const payable = payableInvoices(nextInvoices);
    if (payable.length > 0) {
      const first = payable[0];
      setPayInvoiceId((current) =>
        current && payable.some((item) => item.id === current)
          ? current
          : first.id,
      );
      setPayAmount((current) =>
        current ? current : String(first.remaining_balance ?? ""),
      );
    } else {
      setPayInvoiceId("");
      setPayAmount("");
    }
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

      if (!profileData?.customer_id) {
        setLoading(false);
        return;
      }

      await syncBillingCadence();
      await loadBilling(profileData.customer_id);
      setLoading(false);
    }

    void init();
  }, []);

  const activeContract = useMemo(
    () =>
      contracts.find((contract) => contract.contract_status === "Active") ??
      contracts[0],
    [contracts],
  );

  const linkedPlan = useMemo(() => {
    if (!activeContract?.plan_id) {
      return (
        plans.find((plan) => plan.name === activeContract?.service_plan_name) ??
        null
      );
    }
    return plans.find((plan) => plan.id === activeContract.plan_id) ?? null;
  }, [activeContract, plans]);

  const usage = useMemo(
    () =>
      buildPortalPlanBillingSummary({
        contract: activeContract,
        plan: linkedPlan,
        workEntries,
        assets,
        invoices,
      }),
    [activeContract, linkedPlan, workEntries, assets, invoices],
  );

  const outstandingBalance = sumOutstandingBalance(invoices);
  const unpaidInvoices = useMemo(() => payableInvoices(invoices), [invoices]);
  const selectedPayInvoice = useMemo(
    () => unpaidInvoices.find((invoice) => invoice.id === payInvoiceId) ?? null,
    [unpaidInvoices, payInvoiceId],
  );

  const serviceInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const purpose = getInvoicePurpose(invoice);
        return purpose !== "Hardware overbilling";
      }),
    [invoices],
  );
  const hardwareInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const purpose = getInvoicePurpose(invoice);
        return (
          purpose === "Hardware overbilling" || purpose === "Mixed charges"
        );
      }),
    [invoices],
  );

  function handleSelectPayInvoice(invoiceId: string) {
    setPayInvoiceId(invoiceId);
    setPayError(null);
    const invoice = unpaidInvoices.find((item) => item.id === invoiceId);
    if (invoice) {
      setPayAmount(String(invoice.remaining_balance ?? ""));
    }
  }

  function openPaymentPortal(invoiceId?: string) {
    if (invoiceId) {
      handleSelectPayInvoice(invoiceId);
    }
    window.requestAnimationFrame(() => {
      document.getElementById("payment-portal")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function handleSubmitPayment() {
    if (!selectedPayInvoice) {
      setPayError("Select an invoice to pay.");
      return;
    }
    setPayError(null);
    startTransition(async () => {
      const result = await recordClientPortalPayment({
        invoiceId: selectedPayInvoice.id,
        amount: Number(payAmount),
        paymentMethod: payMethod,
        referenceNumber: payReference,
        notes: payNotes,
        cardholderName: cardDetails.cardholderName,
        cardNumber: cardDetails.cardNumber,
        cardExp: cardDetails.cardExp,
        cardCvv: cardDetails.cardCvv,
        billingZip: cardDetails.billingZip,
      });
      if (result.success) {
        showToast(result.message);
        setPayReference("");
        setPayNotes("");
        setCardDetails(EMPTY_CARD_DETAILS);
        if (profile?.customer_id) {
          await loadBilling(profile.customer_id);
        }
      } else {
        setPayError(result.message);
      }
    });
  }

  if (activeRole !== "client_user" && activeRole !== "administrator") {
    return (
      <AlertBanner
        tone="info"
        title="Client billing view"
        message="Switch to the Client End User demo role to review support-agreement billing."
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
        title="No customer linked"
        description="Your profile is not linked to a customer account, so billing is unavailable."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Billing"
        description="Mid-size company billing for your Nexus managed-service plan: included support hours, overage charges, fleet hardware purchases, and a simulated payment portal."
        action={
          <Link href="/end-user" className="btn btn-ghost btn-sm">
            Back to Client Home
          </Link>
        }
      />

      <div className="alert alert-info text-sm">
        <span>
          Billing follows the shared Nexus plan catalog (Essentials / Silver / Gold): recurring plan
          fee covers included support hours; extra hours bill at your plan overage rate; hardware is
          typically purchased in fleet quantities for the organization, not as one-off single PCs.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Outstanding balance"
          value={formatCurrency(outstandingBalance)}
          hint={
            unpaidInvoices.length > 0
              ? `${unpaidInvoices.length} invoice${unpaidInvoices.length === 1 ? "" : "s"} payable`
              : "All invoices are current"
          }
          tone={outstandingBalance > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Plan recurring fee"
          value={formatCurrency(usage.monthlyFee)}
          hint={`${usage.planName} · ${usage.billingFrequency}`}
          tone="info"
        />
        <StatCard
          title="Included hours / month"
          value={formatHours(usage.includedHours)}
          hint={`Covered work this month: ${formatHours(usage.coveredHours)}`}
        />
        <StatCard
          title="Hours used this month"
          value={formatHours(usage.monthHours)}
          hint={
            usage.overageHours > 0
              ? `${formatHours(usage.overageHours)} overage · est. ${formatCurrency(usage.estimatedOverageCharge)}`
              : `${formatHours(usage.remainingHours)} remaining in plan`
          }
          tone={usage.overageHours > 0 ? "warning" : "default"}
        />
        <StatCard
          title="Active devices in fleet"
          value={usage.activeAssetCount}
          hint={`Hardware billed ${formatCurrency(usage.hardwareSpend)}`}
          tone={usage.activeAssetCount > 1 ? "info" : "default"}
        />
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h3 className="card-title text-base">Plan usage & how you are billed</h3>
          <p className="text-sm text-base-content/70">
            Your active plan includes a monthly block of support hours. Time within that block is
            covered by the recurring fee. Time beyond the block is billed as additional support at
            the plan overage rate so invoices match the catalog terms.
          </p>

          {plans.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent =
                  plan.id === activeContract?.plan_id ||
                  plan.name === activeContract?.service_plan_name;
                return (
                  <div
                    key={plan.id}
                    className={`rounded-box border p-4 ${
                      isCurrent
                        ? "border-primary/40 bg-primary/5"
                        : "border-base-300 bg-base-200/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{plan.name}</p>
                      {isCurrent ? (
                        <span className="badge badge-primary badge-sm">Your plan</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-lg font-bold">
                      {formatCurrency(plan.base_price)}
                      <span className="text-sm font-normal text-base-content/60">/mo</span>
                    </p>
                    <ul className="mt-3 space-y-1 text-sm text-base-content/75">
                      <li>{formatHours(plan.included_support_hours)} included</li>
                      <li>{formatCurrency(plan.additional_hourly_rate)}/hr overage</li>
                      <li>{formatCurrency(plan.included_asset_budget)} asset budget</li>
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-box border border-base-300 bg-base-200/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Current agreement
              </p>
              <p className="mt-1 font-medium">{usage.planName}</p>
              <p className="text-sm text-base-content/70">
                {usage.billingFrequency} · {usage.paymentTerms}
              </p>
              <p className="mt-2 text-sm">
                Recurring fee:{" "}
                <span className="font-medium">{formatCurrency(usage.monthlyFee)}</span>
              </p>
            </div>
            <div className="rounded-box border border-base-300 bg-base-200/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Support hours this month
              </p>
              <p className="mt-1 font-medium">
                {formatHours(usage.monthHours)} / {formatHours(usage.includedHours)}
              </p>
              <progress
                className={`progress mt-2 w-full ${
                  usage.overageHours > 0 ? "progress-warning" : "progress-primary"
                }`}
                value={
                  usage.includedHours > 0
                    ? Math.min(usage.monthHours, usage.includedHours)
                    : 0
                }
                max={usage.includedHours > 0 ? usage.includedHours : 1}
              />
              <p className="mt-2 text-sm text-base-content/75">
                {usage.overageHours > 0
                  ? `Overage ${formatHours(usage.overageHours)} × ${formatCurrency(usage.overageRate)}/hr ≈ ${formatCurrency(usage.estimatedOverageCharge)} on the next invoice.`
                  : `All current usage fits inside your included ${formatHours(usage.includedHours)} allotment.`}
              </p>
            </div>
            <div className="rounded-box border border-base-300 bg-base-200/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Fleet hardware (mid-size)
              </p>
              <p className="mt-1 font-medium">
                {usage.activeAssetCount} active device
                {usage.activeAssetCount === 1 ? "" : "s"}
              </p>
              <p className="mt-2 text-sm text-base-content/75">
                Hardware invoices reflect organizational fleet buys (multiple endpoints), not a
                single computer. Plan asset budget:{" "}
                {formatCurrency(usage.assetBudget)}. Billed to date:{" "}
                {formatCurrency(usage.hardwareSpend)}.
                {usage.assetBudget > 0
                  ? ` Remaining budget signal: ${formatCurrency(usage.remainingAssetBudget)}.`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        id="payment-portal"
        className="card border border-primary/30 bg-base-100 shadow-sm"
      >
        <div className="card-body gap-4">
          <div>
            <h3 className="card-title text-base">Payment portal</h3>
            <p className="text-sm text-base-content/70">
              Choose an invoice from the list, then enter payment details below. Simulated payments
              update your balance and history — no real card charges are processed.
            </p>
          </div>

          {unpaidInvoices.length === 0 ? (
            <EmptyState
              title="Nothing due right now"
              description="When an unpaid or partially paid invoice is issued, you can pay it from this portal."
            />
          ) : (
            <div className="mx-auto w-full max-w-xl space-y-4 rounded-box border border-base-300 bg-base-200/30 p-4">
              <FormField label="Select invoice to pay" htmlFor="portal-pay-invoice" required>
                <select
                  id="portal-pay-invoice"
                  className="select select-bordered w-full"
                  value={payInvoiceId}
                  onChange={(event) => handleSelectPayInvoice(event.target.value)}
                >
                  <option value="">Choose an invoice</option>
                  {unpaidInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {formatPayableInvoiceOption(
                        invoice,
                        formatDate(invoice.due_date),
                        formatCurrency(invoice.remaining_balance),
                      )}
                    </option>
                  ))}
                </select>
              </FormField>

              {selectedPayInvoice ? (
                <div className="rounded-box border border-base-300 bg-base-100 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{selectedPayInvoice.invoice_number}</p>
                      <p className="text-xs text-base-content/60">
                        {getInvoicePurpose(selectedPayInvoice)}
                        {selectedPayInvoice.billing_period
                          ? ` - Period ${selectedPayInvoice.billing_period}`
                          : ""}{" "}
                        - Due {formatDate(selectedPayInvoice.due_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-base-content/50">
                        Remaining balance
                      </p>
                      <p className="font-semibold">
                        {formatCurrency(selectedPayInvoice.remaining_balance)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-base-content/60">
                    Invoice total {formatCurrency(selectedPayInvoice.total_amount)} · you may pay
                    in full or partially
                  </p>
                </div>
              ) : null}

              <FormField label="Amount" htmlFor="portal-pay-amount" required>
                <input
                  id="portal-pay-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="input input-bordered w-full"
                  value={payAmount}
                  onChange={(event) => setPayAmount(event.target.value)}
                  disabled={!selectedPayInvoice}
                />
              </FormField>
              <FormField label="Payment method" htmlFor="portal-pay-method">
                <select
                  id="portal-pay-method"
                  className="select select-bordered w-full"
                  value={payMethod}
                  onChange={(event) => setPayMethod(event.target.value)}
                  disabled={!selectedPayInvoice}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </FormField>
              {isCardPaymentMethod(payMethod) ? (
                <SimulatedCardPaymentFields
                  idPrefix="portal-pay"
                  values={cardDetails}
                  onChange={setCardDetails}
                  disabled={!selectedPayInvoice}
                />
              ) : (
                <FormField label="Reference # (optional)" htmlFor="portal-pay-ref">
                  <input
                    id="portal-pay-ref"
                    className="input input-bordered w-full"
                    value={payReference}
                    onChange={(event) => setPayReference(event.target.value)}
                    placeholder="Confirmation or check number"
                    disabled={!selectedPayInvoice}
                  />
                </FormField>
              )}
              <FormField label="Notes (optional)" htmlFor="portal-pay-notes">
                <textarea
                  id="portal-pay-notes"
                  className="textarea textarea-bordered w-full"
                  rows={2}
                  value={payNotes}
                  onChange={(event) => setPayNotes(event.target.value)}
                  disabled={!selectedPayInvoice}
                />
              </FormField>

              {payError ? <p className="text-sm text-error">{payError}</p> : null}

              <button
                type="button"
                className="btn btn-primary"
                disabled={isPending || !selectedPayInvoice}
                onClick={handleSubmitPayment}
              >
                {isPending ? "Processing..." : "Submit payment"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="card-title text-base">Invoices</h3>
            <p className="text-sm text-base-content/60">
              {serviceInvoices.length} service · {hardwareInvoices.length} hardware / mixed
            </p>
          </div>

          {invoices.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              description="When Nexus issues invoices for your managed plan, overage hours, or fleet hardware purchases, they will appear here."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {invoices.map((invoice) => {
                const clientStatus = toClientInvoiceStatus(
                  invoice.status,
                  invoice.amount_paid,
                  invoice.remaining_balance,
                );
                const purpose = getInvoicePurpose(invoice);
                const serviceAmount =
                  (invoice.recurring_service_fee ?? 0) +
                  (invoice.additional_support_charges ?? 0) +
                  (invoice.software_charges ?? 0) +
                  (invoice.other_charges ?? 0) +
                  (invoice.late_fee_amount ?? 0);
                const canPay =
                  clientStatus !== "Paid" &&
                  clientStatus !== "Canceled" &&
                  (invoice.remaining_balance ?? 0) > 0;
                return (
                  <div
                    key={invoice.id}
                    className="rounded-box border border-base-300 bg-base-200/20 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-sm font-semibold">
                          {invoice.invoice_number}
                        </p>
                        <p className="mt-1 text-xs text-base-content/60">
                          Issued {formatDate(invoice.invoice_date)} · Due{" "}
                          {formatDate(invoice.due_date)}
                          {invoice.billing_period
                            ? ` · Period ${invoice.billing_period}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`badge badge-sm ${
                            purpose === "Hardware overbilling"
                              ? "badge-info"
                              : purpose === "Mixed charges"
                                ? "badge-secondary"
                                : "badge-ghost"
                          }`}
                        >
                          {purpose}
                        </span>
                        <StatusBadge status={clientStatus} />
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-base-content/50">
                          Plan / services
                        </dt>
                        <dd className="font-medium">{formatCurrency(serviceAmount)}</dd>
                        {(invoice.additional_support_charges ?? 0) > 0 ? (
                          <dd className="text-xs text-warning">Includes overage hours</dd>
                        ) : null}
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-base-content/50">
                          Fleet hardware
                        </dt>
                        <dd className="font-medium">
                          {formatCurrency(invoice.equipment_charges)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-base-content/50">
                          Total
                        </dt>
                        <dd className="font-semibold">
                          {formatCurrency(invoice.total_amount)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-base-content/50">
                          Balance
                        </dt>
                        <dd className="font-semibold">
                          {formatCurrency(invoice.remaining_balance)}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {canPay ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => openPaymentPortal(invoice.id)}
                        >
                          Pay
                        </button>
                      ) : null}
                      <Link
                        href={`/end-user/billing/${invoice.id}`}
                        className="btn btn-outline btn-sm"
                      >
                        View details
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
