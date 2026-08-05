"use client";

import { useEffect, useMemo, useState } from "react";
import { syncBillingCadence } from "@/app/actions/billing";
import Link from "next/link";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import {
  sumOutstandingBalance,
  toClientInvoiceStatus,
} from "@/lib/client-billing";
import { getInvoiceCategory } from "@/lib/device-utils";
import { isThisMonth } from "@/lib/dashboard-stats";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Invoice, Profile, WorkEntry } from "@/lib/types";

export default function EndUserBillingPage() {
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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

      if (!profileData?.customer_id) {
        setLoading(false);
        return;
      }

      await syncBillingCadence();

      const customerId = profileData.customer_id;
      const [co, inv, work] = await Promise.all([
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
      ]);

      setContracts(co.data ?? []);
      setInvoices(inv.data ?? []);
      setWorkEntries(work.data ?? []);
      setLoading(false);
    }

    void init();
  }, []);

  const activeContract = useMemo(
    () => contracts.find((contract) => contract.contract_status === "Active") ?? contracts[0],
    [contracts],
  );

  const monthHours = useMemo(
    () =>
      workEntries
        .filter((entry) => isThisMonth(entry.work_date))
        .reduce((sum, entry) => sum + (entry.hours_worked ?? 0), 0),
    [workEntries],
  );

  const includedHours = activeContract?.included_support_hours ?? 0;
  const remainingHours = Math.max(0, includedHours - monthHours);
  const overageHours = Math.max(0, monthHours - includedHours);
  const outstandingBalance = sumOutstandingBalance(invoices);
  const unpaidCount = invoices.filter(
    (invoice) =>
      toClientInvoiceStatus(
        invoice.status,
        invoice.amount_paid,
        invoice.remaining_balance,
      ) === "Unpaid",
  ).length;
  const partialCount = invoices.filter(
    (invoice) =>
      toClientInvoiceStatus(
        invoice.status,
        invoice.amount_paid,
        invoice.remaining_balance,
      ) === "Partial",
  ).length;

  const serviceInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const category = getInvoiceCategory(invoice);
        return category === "Services" || category === "Mixed";
      }),
    [invoices],
  );
  const hardwareInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        const category = getInvoiceCategory(invoice);
        return category === "Hardware purchase" || category === "Mixed";
      }),
    [invoices],
  );
  const hardwareSpend = useMemo(
    () =>
      invoices.reduce((sum, invoice) => sum + (invoice.equipment_charges ?? 0), 0),
    [invoices],
  );

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
      <PageHeader
        title="Billing"
        description="Review service invoices, hardware purchase invoices, payments, support-hour usage, and outstanding balances. Payments are simulated — no real payment processing."
        action={
          <Link href="/end-user" className="btn btn-ghost btn-sm">
            Back to End User Portal
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Outstanding balance"
          value={formatCurrency(outstandingBalance)}
          hint={
            outstandingBalance > 0
              ? `${unpaidCount} unpaid · ${partialCount} partial`
              : "All invoices are current"
          }
          tone={outstandingBalance > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Service invoices"
          value={serviceInvoices.length}
          hint="Recurring support and billable work"
        />
        <StatCard
          title="Hardware invoices"
          value={hardwareInvoices.length}
          hint={`Equipment billed ${formatCurrency(hardwareSpend)}`}
          tone={hardwareSpend > 0 ? "info" : "default"}
        />
        <StatCard
          title="Included support hours"
          value={formatHours(includedHours)}
          hint={activeContract?.service_plan_name ?? activeContract?.contract_name ?? "No active plan"}
        />
        <StatCard
          title="Hours used this month"
          value={formatHours(monthHours)}
          hint={
            overageHours > 0
              ? `${formatHours(overageHours)} beyond included limit`
              : `${formatHours(remainingHours)} remaining`
          }
          tone={overageHours > 0 ? "warning" : "default"}
        />
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h3 className="card-title text-base">Support agreement usage</h3>
          <p className="text-sm text-base-content/70">
            Your plan includes a set number of support hours each month. Work within that allotment
            is covered by the recurring fee. Hours above the limit appear as{" "}
            <span className="font-medium">Additional billable work</span> on invoices.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-box border border-base-300 bg-base-200/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Contract
              </p>
              <p className="mt-1 font-medium">
                {activeContract?.contract_name ?? "No contract on file"}
              </p>
              <p className="text-sm text-base-content/70">
                {activeContract?.billing_frequency ?? "—"} · terms{" "}
                {activeContract?.payment_terms ?? "—"}
              </p>
            </div>
            <div className="rounded-box border border-base-300 bg-base-200/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Usage vs included
              </p>
              <p className="mt-1 font-medium">
                {formatHours(monthHours)} / {formatHours(includedHours)}
              </p>
              <progress
                className={`progress mt-2 w-full ${overageHours > 0 ? "progress-warning" : "progress-primary"}`}
                value={includedHours > 0 ? Math.min(monthHours, includedHours) : 0}
                max={includedHours > 0 ? includedHours : 1}
              />
            </div>
            <div className="rounded-box border border-base-300 bg-base-200/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                How overages are billed
              </p>
              <p className="mt-1 text-sm text-base-content/80">
                Additional support hours beyond the included limit are billed at{" "}
                {formatCurrency(activeContract?.additional_hourly_rate)} / hour on the next invoice.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="card-title text-base">Invoices</h3>
            <p className="text-sm text-base-content/60">
              Includes managed-service billing and hardware purchase invoices.
            </p>
          </div>

          {invoices.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              description="When Nexus issues invoices for services or hardware purchases, they will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Due</th>
                    <th>Services</th>
                    <th>Hardware</th>
                    <th>Total</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const clientStatus = toClientInvoiceStatus(
                      invoice.status,
                      invoice.amount_paid,
                      invoice.remaining_balance,
                    );
                    const category = getInvoiceCategory(invoice);
                    const serviceAmount =
                      (invoice.recurring_service_fee ?? 0) +
                      (invoice.additional_support_charges ?? 0) +
                      (invoice.software_charges ?? 0) +
                      (invoice.other_charges ?? 0) +
                      (invoice.late_fee_amount ?? 0);
                    return (
                      <tr key={invoice.id}>
                        <td className="font-mono text-sm">{invoice.invoice_number}</td>
                        <td>
                          <span
                            className={`badge badge-sm ${
                              category === "Hardware purchase"
                                ? "badge-info"
                                : category === "Mixed"
                                  ? "badge-secondary"
                                  : "badge-ghost"
                            }`}
                          >
                            {category}
                          </span>
                        </td>
                        <td>{formatDate(invoice.invoice_date)}</td>
                        <td>{formatDate(invoice.due_date)}</td>
                        <td>{formatCurrency(serviceAmount)}</td>
                        <td>{formatCurrency(invoice.equipment_charges)}</td>
                        <td className="font-medium">
                          {formatCurrency(invoice.total_amount)}
                        </td>
                        <td>{formatCurrency(invoice.remaining_balance)}</td>
                        <td>
                          <StatusBadge status={clientStatus} />
                        </td>
                        <td className="text-right">
                          <Link
                            href={`/end-user/billing/${invoice.id}`}
                            className="btn btn-ghost btn-xs"
                          >
                            View details
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
