"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import {
  buildInvoiceLineItems,
  toClientInvoiceStatus,
} from "@/lib/client-billing";
import { getInvoiceCategory } from "@/lib/device-utils";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Invoice, Payment, Profile, WorkEntry } from "@/lib/types";

export default function EndUserInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);

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

      const { data: invoiceData } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .eq("customer_id", profileData.customer_id)
        .maybeSingle();

      if (!invoiceData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setInvoice(invoiceData);

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
          .eq("invoice_id", invoiceId)
          .order("payment_date", { ascending: false }),
        supabase
          .from("work_entries")
          .select("*")
          .eq("invoice_id", invoiceId)
          .order("work_date", { ascending: false }),
      ]);

      setContract(contractResult.data);
      setPayments(paymentResult.data ?? []);
      setWorkEntries(workResult.data ?? []);
      setLoading(false);
    }

    void init();
  }, [invoiceId]);

  const lineItems = useMemo(
    () => (invoice ? buildInvoiceLineItems(invoice) : []),
    [invoice],
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
      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        description="Line-item detail, charge explanations, and simulated payment history for this invoice."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/end-user/billing" className="btn btn-outline btn-sm">
              Back to Billing
            </Link>
            <Link href="/end-user" className="btn btn-ghost btn-sm">
              End User Portal
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
          title="Support agreement"
          value={contract?.service_plan_name ?? contract?.contract_name ?? "—"}
          hint={profile?.email ? `Account ${profile.email}` : undefined}
        />
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h3 className="card-title text-base">Charge line items</h3>
          <p className="text-sm text-base-content/70">
            Each line below explains what generated the charge. Clients can review details but cannot
            edit invoices, contract terms, or cost entries.
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
            <h3 className="card-title text-base">Related billable work</h3>
            <p className="text-sm text-base-content/70">
              Support activity linked to this invoice ({formatHours(linkedHours)} total).
            </p>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Work performed</th>
                    <th>Billing note</th>
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
                          ? "Covered by included support hours"
                          : "Additional support hours beyond included limit"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h3 className="card-title text-base">Payment history</h3>
          <p className="text-sm text-base-content/70">
            Simulated payments only — this portal does not process real payments or allow clients to
            modify balances.
          </p>

          {payments.length === 0 ? (
            <EmptyState
              title="No payments recorded"
              description="When a simulated payment is applied to this invoice, it will appear here."
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
