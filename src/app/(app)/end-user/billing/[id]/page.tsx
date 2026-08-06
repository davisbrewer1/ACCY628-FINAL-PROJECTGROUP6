"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { syncBillingCadence } from "@/app/actions/billing";
import { recordClientPortalPayment } from "@/app/actions/portal-payments";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { toClientInvoiceStatus } from "@/lib/client-billing";
import { getInvoiceCategory } from "@/lib/device-utils";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import { buildPortalInvoiceLineItems } from "@/lib/portal-billing";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Invoice, Payment, Profile, WorkEntry } from "@/lib/types";

const PAYMENT_METHODS = [
  "Credit Card",
  "ACH / Bank Transfer",
  "Check",
  "Wire Transfer",
] as const;

export default function EndUserInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [payReference, setPayReference] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [cardDetails, setCardDetails] =
    useState<SimulatedCardDetails>(EMPTY_CARD_DETAILS);
  const [payError, setPayError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadInvoice(customerId: string, id: string) {
    const supabase = createClient();
    const { data: invoiceData } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (!invoiceData) {
      setNotFound(true);
      setInvoice(null);
      return;
    }

    setInvoice(invoiceData);
    setNotFound(false);
    setPayAmount(String(invoiceData.remaining_balance ?? ""));

    const [contractResult, paymentResult, workResult] = await Promise.all([
      invoiceData.contract_id
        ? supabase
            .from("contracts")
            .select("*")
            .eq("id", invoiceData.contract_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("payments")
        .select("*")
        .eq("invoice_id", id)
        .order("payment_date", { ascending: false }),
      supabase
        .from("work_entries")
        .select("*")
        .eq("invoice_id", id)
        .order("work_date", { ascending: false }),
    ]);

    setContract(contractResult.data);
    setPayments(paymentResult.data ?? []);
    setWorkEntries(workResult.data ?? []);
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

      if (!profileData?.customer_id || !invoiceId) {
        setLoading(false);
        setNotFound(true);
        return;
      }

      await syncBillingCadence();
      await loadInvoice(profileData.customer_id, invoiceId);
      setLoading(false);
    }

    void init();
  }, [invoiceId]);

  const lineItems = useMemo(
    () => (invoice ? buildPortalInvoiceLineItems(invoice, contract) : []),
    [invoice, contract],
  );

  const clientStatus = toClientInvoiceStatus(
    invoice?.status,
    invoice?.amount_paid,
    invoice?.remaining_balance,
  );
  const invoiceCategory = invoice ? getInvoiceCategory(invoice) : "Services";
  const linkedHours = workEntries.reduce(
    (sum, entry) => sum + (entry.hours_worked ?? 0),
    0,
  );
  const coveredHours = workEntries
    .filter((entry) => entry.included_in_contract)
    .reduce((sum, entry) => sum + (entry.hours_worked ?? 0), 0);
  const overageHours = workEntries
    .filter((entry) => entry.included_in_contract === false)
    .reduce((sum, entry) => sum + (entry.hours_worked ?? 0), 0);
  const canPay =
    Boolean(invoice) &&
    clientStatus !== "Paid" &&
    clientStatus !== "Canceled" &&
    (invoice?.remaining_balance ?? 0) > 0;

  function handleSubmitPayment() {
    if (!invoice) return;
    setPayError(null);
    startTransition(async () => {
      const result = await recordClientPortalPayment({
        invoiceId: invoice.id,
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
          await loadInvoice(profile.customer_id, invoice.id);
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
        message="Switch to the Client End User demo role to review invoice details."
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

  if (notFound || !invoice) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="Invoice not found"
          description="This invoice is unavailable or does not belong to your customer account."
          action={
            <Link href="/end-user/billing" className="btn btn-primary btn-sm">
              Back to Billing
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title={`Invoice ${invoice.invoice_number}`}
        description="Plan-aligned charges, included vs overage hours, fleet hardware lines, and the client payment portal for this invoice."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/end-user/billing" className="btn btn-outline btn-sm">
              Back to Billing
            </Link>
            <Link href="/end-user/billing#payment-portal" className="btn btn-ghost btn-sm">
              Payment portal
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={clientStatus} />
        <span className="badge badge-sm badge-outline">{invoiceCategory}</span>
        <span className="text-sm text-base-content/60">
          Issued {formatDate(invoice.invoice_date)} · Due {formatDate(invoice.due_date)}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Invoice total" value={formatCurrency(invoice.total_amount)} />
        <StatCard title="Amount paid" value={formatCurrency(invoice.amount_paid)} tone="success" />
        <StatCard
          title="Remaining balance"
          value={formatCurrency(invoice.remaining_balance)}
          tone={(invoice.remaining_balance ?? 0) > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Support plan"
          value={contract?.service_plan_name ?? contract?.contract_name ?? "—"}
          hint={
            contract?.included_support_hours != null
              ? `${formatHours(contract.included_support_hours)} included / month`
              : undefined
          }
        />
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h3 className="card-title text-base">Charge line items</h3>
          <p className="text-sm text-base-content/70">
            Recurring plan fees cover included hours. Additional support is only for hours beyond
            that allotment. Hardware lines represent organizational/fleet purchases.
          </p>

          {lineItems.length === 0 ? (
            <EmptyState
              title="No line items"
              description="This invoice has no categorized charges yet."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Charge</th>
                    <th>Explanation</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.key}>
                      <td className="font-medium whitespace-nowrap">{item.label}</td>
                      <td className="text-sm text-base-content/75">{item.explanation}</td>
                      <td className="text-right font-medium whitespace-nowrap">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} className="font-semibold">
                      Invoice total
                    </td>
                    <td className="text-right font-semibold">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {workEntries.length > 0 ? (
        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body gap-3">
            <h3 className="card-title text-base">Support hours on this invoice</h3>
            <p className="text-sm text-base-content/70">
              {formatHours(linkedHours)} total · {formatHours(coveredHours)} covered by included
              plan hours
              {overageHours > 0
                ? ` · ${formatHours(overageHours)} billed as overage at ${formatCurrency(contract?.additional_hourly_rate)}/hr`
                : ""}
              .
            </p>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Work performed</th>
                    <th>Billing treatment</th>
                  </tr>
                </thead>
                <tbody>
                  {workEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.work_date)}</td>
                      <td>{formatHours(entry.hours_worked)}</td>
                      <td className="max-w-md text-sm">
                        {entry.work_performed ?? "Support work"}
                      </td>
                      <td className="text-sm text-base-content/70">
                        {entry.included_in_contract
                          ? "Covered by included plan hours (no extra hourly charge)"
                          : `Additional billable hours beyond included allotment${
                              contract?.additional_hourly_rate
                                ? ` @ ${formatCurrency(contract.additional_hourly_rate)}/hr`
                                : ""
                            }`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {canPay ? (
        <div className="card border border-primary/30 bg-base-100 shadow-sm">
          <div className="card-body gap-3">
            <h3 className="card-title text-base">Pay this invoice</h3>
            <p className="text-sm text-base-content/70">
              Simulated client payment portal. Remaining balance:{" "}
              {formatCurrency(invoice.remaining_balance)}.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Amount" htmlFor="invoice-pay-amount">
                <input
                  id="invoice-pay-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="input input-bordered w-full"
                  value={payAmount}
                  onChange={(event) => setPayAmount(event.target.value)}
                />
              </FormField>
              <FormField label="Payment method" htmlFor="invoice-pay-method">
                <select
                  id="invoice-pay-method"
                  className="select select-bordered w-full"
                  value={payMethod}
                  onChange={(event) => setPayMethod(event.target.value)}
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
                  idPrefix="invoice-pay"
                  values={cardDetails}
                  onChange={setCardDetails}
                />
              ) : (
                <FormField label="Reference # (optional)" htmlFor="invoice-pay-ref">
                  <input
                    id="invoice-pay-ref"
                    className="input input-bordered w-full"
                    value={payReference}
                    onChange={(event) => setPayReference(event.target.value)}
                  />
                </FormField>
              )}
              <FormField label="Notes (optional)" htmlFor="invoice-pay-notes">
                <input
                  id="invoice-pay-notes"
                  className="input input-bordered w-full"
                  value={payNotes}
                  onChange={(event) => setPayNotes(event.target.value)}
                />
              </FormField>
            </div>
            {payError ? <p className="text-sm text-error">{payError}</p> : null}
            <button
              type="button"
              className="btn btn-primary btn-sm w-fit"
              disabled={isPending}
              onClick={handleSubmitPayment}
            >
              {isPending ? "Processing..." : "Submit payment"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h3 className="card-title text-base">Payment history</h3>
          <p className="text-sm text-base-content/70">
            Includes payments submitted from this portal (simulated) and any other recorded
            payments on the invoice.
          </p>

          {payments.length === 0 ? (
            <EmptyState
              title="No payments recorded"
              description="Use the payment portal above when a balance remains."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.payment_date)}</td>
                      <td className="font-medium">
                        {formatCurrency(payment.payment_amount)}
                      </td>
                      <td>{payment.payment_method ?? "—"}</td>
                      <td className="font-mono text-xs">
                        {payment.reference_number ?? "—"}
                      </td>
                      <td className="text-sm text-base-content/70">
                        {payment.notes ?? "—"}
                      </td>
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
