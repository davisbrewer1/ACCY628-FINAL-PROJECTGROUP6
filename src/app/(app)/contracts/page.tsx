"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createContract } from "@/app/actions/contracts";
import { calcProfitMargin } from "@/lib/calculations";
import { isThisMonth } from "@/lib/dashboard-stats";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Customer, WorkEntry } from "@/lib/types";

interface ContractRow extends Contract {
  customerName: string;
  hoursUsed: number;
  profitMargin: number | null;
}

export default function ContractsPage() {
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData() {
    const supabase = createClient();
    const [c, co, w] = await Promise.all([
      supabase.from("customers").select("*").order("customer_name"),
      supabase.from("contracts").select("*").order("created_at", { ascending: false }),
      supabase.from("work_entries").select("*"),
    ]);
    setCustomers(c.data ?? []);
    setContracts(co.data ?? []);
    setWorkEntries(w.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const rows: ContractRow[] = useMemo(() => {
    const customerMap = new Map(customers.map((c) => [c.id, c.customer_name]));
    return contracts.map((contract) => {
      const hoursUsed = workEntries
        .filter((e) => e.contract_id === contract.id && isThisMonth(e.work_date))
        .reduce((sum, e) => sum + (e.hours_worked ?? 0), 0);
      const costs = workEntries
        .filter((e) => e.contract_id === contract.id)
        .reduce((sum, e) => sum + (e.total_direct_cost ?? 0), 0);
      const revenue = contract.monthly_recurring_fee ?? 0;
      return {
        ...contract,
        customerName: customerMap.get(contract.customer_id) ?? "Unknown",
        hoursUsed,
        profitMargin: calcProfitMargin(revenue, costs),
      };
    });
  }, [contracts, customers, workEntries]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contract management"
        description="Managed-services agreements, service plans, SLAs, and billing terms."
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => dialogRef.current?.showModal()}>
            <Plus className="size-4" />
            Add Contract
          </button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No contracts yet"
          description="Create a managed-services contract and connect it to a customer."
          action={
            <button type="button" className="btn btn-primary" onClick={() => dialogRef.current?.showModal()}>
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
                  <th>Monthly fee</th>
                  <th>Included hrs</th>
                  <th>Used (month)</th>
                  <th>Dates</th>
                  <th>Renewal</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">{row.contract_name}</td>
                    <td>{row.customerName}</td>
                    <td>
                      <StatusBadge status={row.contract_status ?? "Unknown"} />
                    </td>
                    <td>{formatCurrency(row.monthly_recurring_fee)}</td>
                    <td>{row.included_support_hours ?? "—"}</td>
                    <td>{row.hoursUsed.toFixed(1)}</td>
                    <td>
                      {formatDate(row.start_date)} – {formatDate(row.end_date)}
                    </td>
                    <td>
                      {row.automatic_renewal ? "Auto" : "Manual"}
                      <div className="text-xs text-base-content/60">
                        {formatDate(row.renewal_date)}
                      </div>
                    </td>
                    <td>
                      {row.profitMargin != null ? formatPercent(row.profitMargin) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-h-[90vh] max-w-4xl overflow-y-auto">
          <h3 className="text-lg font-bold">Add Contract</h3>
          {error ? (
            <div className="alert alert-error mt-4 text-sm"><span>{error}</span></div>
          ) : null}
          <form action={handleSubmit} className="form-grid mt-4 space-y-6">
            <Section title="Contract identification">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Contract name" htmlFor="contract_name" required className="sm:col-span-2">
                  <input id="contract_name" name="contract_name" className="input input-bordered w-full" required />
                </FormField>
                <FormField label="Customer" htmlFor="customer_id" required>
                  <select id="customer_id" name="customer_id" className="select select-bordered w-full" required defaultValue="">
                    <option value="" disabled>Select customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.customer_name}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Contract status" htmlFor="contract_status">
                  <select id="contract_status" name="contract_status" className="select select-bordered w-full" defaultValue="Draft">
                    <option value="Draft">Draft</option>
                    <option value="Pending Approval">Pending Approval</option>
                    <option value="Active">Active</option>
                    <option value="Expired">Expired</option>
                  </select>
                </FormField>
                <FormField label="Start date" htmlFor="start_date" required>
                  <input id="start_date" name="start_date" type="date" className="input input-bordered w-full" required />
                </FormField>
                <FormField label="End date" htmlFor="end_date" required>
                  <input id="end_date" name="end_date" type="date" className="input input-bordered w-full" required />
                </FormField>
                <FormField label="Renewal date" htmlFor="renewal_date">
                  <input id="renewal_date" name="renewal_date" type="date" className="input input-bordered w-full" />
                </FormField>
                <FormField label="Automatic renewal" htmlFor="automatic_renewal">
                  <select id="automatic_renewal" name="automatic_renewal" className="select select-bordered w-full" defaultValue="true">
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </FormField>
              </div>
            </Section>

            <Section title="Service plan">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Service plan name" htmlFor="service_plan_name">
                  <input id="service_plan_name" name="service_plan_name" className="input input-bordered w-full" />
                </FormField>
                <FormField label="Monthly recurring fee" htmlFor="monthly_recurring_fee">
                  <input id="monthly_recurring_fee" name="monthly_recurring_fee" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                </FormField>
                <FormField label="Included support hours" htmlFor="included_support_hours">
                  <input id="included_support_hours" name="included_support_hours" type="number" min="0" step="0.5" className="input input-bordered w-full" />
                </FormField>
                <FormField label="Additional hourly rate" htmlFor="additional_hourly_rate">
                  <input id="additional_hourly_rate" name="additional_hourly_rate" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                </FormField>
                <FormField label="Emergency support rate" htmlFor="emergency_support_rate">
                  <input id="emergency_support_rate" name="emergency_support_rate" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                </FormField>
                <FormField label="On-site support rate" htmlFor="onsite_support_rate">
                  <input id="onsite_support_rate" name="onsite_support_rate" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                </FormField>
                <FormField label="Remote support included" htmlFor="remote_support_included">
                  <select id="remote_support_included" name="remote_support_included" className="select select-bordered w-full" defaultValue="true">
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </FormField>
                <FormField label="On-site support included" htmlFor="onsite_support_included">
                  <select id="onsite_support_included" name="onsite_support_included" className="select select-bordered w-full" defaultValue="false">
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </FormField>
                <FormField label="Preventive maintenance" htmlFor="preventive_maintenance_frequency" className="sm:col-span-2">
                  <input id="preventive_maintenance_frequency" name="preventive_maintenance_frequency" className="input input-bordered w-full" placeholder="Monthly, Quarterly, etc." />
                </FormField>
              </div>
            </Section>

            <Section title="Service-level commitments">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Critical response (hours)" htmlFor="critical_response_target_hours">
                  <input id="critical_response_target_hours" name="critical_response_target_hours" type="number" min="0" className="input input-bordered w-full" />
                </FormField>
                <FormField label="High priority response (hours)" htmlFor="high_response_target_hours">
                  <input id="high_response_target_hours" name="high_response_target_hours" type="number" min="0" className="input input-bordered w-full" />
                </FormField>
                <FormField label="Standard response (hours)" htmlFor="standard_response_target_hours">
                  <input id="standard_response_target_hours" name="standard_response_target_hours" type="number" min="0" className="input input-bordered w-full" />
                </FormField>
                <FormField label="Resolution target (hours)" htmlFor="resolution_target_hours">
                  <input id="resolution_target_hours" name="resolution_target_hours" type="number" min="0" className="input input-bordered w-full" />
                </FormField>
                <FormField label="Support coverage" htmlFor="support_coverage" className="sm:col-span-2">
                  <input id="support_coverage" name="support_coverage" className="input input-bordered w-full" placeholder="Business hours, 24/7, etc." />
                </FormField>
              </div>
            </Section>

            <Section title="Billing terms">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Billing frequency" htmlFor="billing_frequency">
                  <select id="billing_frequency" name="billing_frequency" className="select select-bordered w-full" defaultValue="Monthly">
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Annual">Annual</option>
                  </select>
                </FormField>
                <FormField label="Payment terms" htmlFor="payment_terms">
                  <input id="payment_terms" name="payment_terms" className="input input-bordered w-full" placeholder="Net 30" />
                </FormField>
                <FormField label="Invoice due days" htmlFor="invoice_due_days">
                  <input id="invoice_due_days" name="invoice_due_days" type="number" min="0" className="input input-bordered w-full" defaultValue={30} />
                </FormField>
                <FormField label="Setup fee" htmlFor="setup_fee">
                  <input id="setup_fee" name="setup_fee" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                </FormField>
                <FormField label="Late fee policy" htmlFor="late_fee_policy" className="sm:col-span-2">
                  <input id="late_fee_policy" name="late_fee_policy" className="input input-bordered w-full" />
                </FormField>
                <FormField label="Pass-through charges allowed" htmlFor="pass_through_charges_allowed">
                  <select id="pass_through_charges_allowed" name="pass_through_charges_allowed" className="select select-bordered w-full" defaultValue="true">
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </FormField>
              </div>
            </Section>

            <Section title="Accounting and operational">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Revenue recognition" htmlFor="revenue_recognition_method">
                  <input id="revenue_recognition_method" name="revenue_recognition_method" className="input input-bordered w-full" placeholder="Monthly over service period" />
                </FormField>
                <FormField label="Approval status" htmlFor="approval_status">
                  <select id="approval_status" name="approval_status" className="select select-bordered w-full" defaultValue="Pending">
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </FormField>
                <FormField label="Notes" htmlFor="notes" className="sm:col-span-2">
                  <textarea id="notes" name="notes" className="textarea textarea-bordered w-full" rows={3} />
                </FormField>
              </div>
            </Section>

            <div className="alert alert-info text-sm">
              <span>Contracts can only become Active when approval status is Approved. End date must be on or after start date.</span>
            </div>

            <div className="modal-action">
              <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <span className="loading loading-spinner loading-sm" /> : "Save Contract"}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button type="submit">close</button></form>
      </dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-box border border-base-300 p-4">
      <h4 className="mb-3 font-semibold">{title}</h4>
      {children}
    </div>
  );
}
