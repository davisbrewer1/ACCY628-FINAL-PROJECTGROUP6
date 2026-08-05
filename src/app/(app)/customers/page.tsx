"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createCustomer } from "@/app/actions/customers";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Customer, Invoice, ServiceTicket } from "@/lib/types";

interface CustomerRow extends Customer {
  activeContracts: number;
  openTickets: number;
  outstandingBalance: number;
}

const OPEN_STATUSES = new Set([
  "New",
  "Assigned",
  "In Progress",
  "Waiting on Customer",
  "Waiting on Vendor",
  "Waiting on Approval",
  "Escalated",
]);

export default function CustomersPage() {
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData() {
    const supabase = createClient();
    const [c, co, t, i] = await Promise.all([
      supabase.from("customers").select("*").order("customer_name"),
      supabase.from("contracts").select("*"),
      supabase.from("service_tickets").select("*"),
      supabase.from("invoices").select("*"),
    ]);
    setCustomers(c.data ?? []);
    setContracts(co.data ?? []);
    setTickets(t.data ?? []);
    setInvoices(i.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const rows: CustomerRow[] = useMemo(() => {
    return customers.map((customer) => ({
      ...customer,
      activeContracts: contracts.filter(
        (c) => c.customer_id === customer.id && c.contract_status === "Active",
      ).length,
      openTickets: tickets.filter(
        (t) =>
          t.customer_id === customer.id && OPEN_STATUSES.has(t.status ?? ""),
      ).length,
      outstandingBalance: invoices
        .filter((inv) => inv.customer_id === customer.id)
        .reduce((sum, inv) => sum + (inv.remaining_balance ?? 0), 0),
    }));
  }, [customers, contracts, tickets, invoices]);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createCustomer(formData);
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
        title="Customer management"
        description="View business customers, contacts, and account summaries."
        action={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => dialogRef.current?.showModal()}
          >
            <Plus className="size-4" />
            Add Customer
          </button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add your first business customer to begin managing contracts and service work."
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => dialogRef.current?.showModal()}
            >
              Add Customer
            </button>
          }
        />
      ) : (
        <div className="card border bg-base-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Industry</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th className="text-right">Contracts</th>
                  <th className="text-right">Open tickets</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">{row.customer_name}</td>
                    <td>{row.industry ?? "—"}</td>
                    <td>
                      <div>{row.primary_contact_name ?? "—"}</div>
                      <div className="text-xs text-base-content/60">
                        {row.contact_email ?? "—"}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={row.status ?? "Unknown"} />
                    </td>
                    <td>
                      {[row.city, row.state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="text-right">{row.activeContracts}</td>
                    <td className="text-right">{row.openTickets}</td>
                    <td className="text-right">
                      {formatCurrency(row.outstandingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-2xl">
          <h3 className="text-lg font-bold">Add Customer</h3>
          {error ? (
            <div className="alert alert-error mt-4 text-sm">
              <span>{error}</span>
            </div>
          ) : null}
          <form action={handleSubmit} className="form-grid mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label="Customer name" htmlFor="customer_name" required className="sm:col-span-2">
              <input id="customer_name" name="customer_name" className="input input-bordered w-full" required />
            </FormField>
            <FormField label="Industry" htmlFor="industry">
              <input id="industry" name="industry" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Status" htmlFor="status">
              <select id="status" name="status" className="select select-bordered w-full" defaultValue="Active">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Prospect">Prospect</option>
              </select>
            </FormField>
            <FormField label="Primary contact" htmlFor="primary_contact_name">
              <input id="primary_contact_name" name="primary_contact_name" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Contact email" htmlFor="contact_email">
              <input id="contact_email" name="contact_email" type="email" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Contact phone" htmlFor="contact_phone">
              <input id="contact_phone" name="contact_phone" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Address" htmlFor="address" className="sm:col-span-2">
              <input id="address" name="address" className="input input-bordered w-full" />
            </FormField>
            <FormField label="City" htmlFor="city">
              <input id="city" name="city" className="input input-bordered w-full" />
            </FormField>
            <FormField label="State" htmlFor="state">
              <input id="state" name="state" className="input input-bordered w-full" />
            </FormField>
            <FormField label="ZIP code" htmlFor="zip_code">
              <input id="zip_code" name="zip_code" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Notes" htmlFor="notes" className="sm:col-span-2">
              <textarea id="notes" name="notes" className="textarea textarea-bordered w-full" rows={3} />
            </FormField>
            <div className="modal-action sm:col-span-2">
              <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <span className="loading loading-spinner loading-sm" /> : "Save Customer"}
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
