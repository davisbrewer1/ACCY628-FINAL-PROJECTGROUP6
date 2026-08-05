"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus, Wallet } from "lucide-react";
import { createInvoice, recordPayment } from "@/app/actions/billing";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Customer, Invoice } from "@/lib/types";

interface InvoiceRow extends Invoice {
  customerName: string;
  contractName: string;
}

export default function BillingPage() {
  const { showToast } = useToast();
  const invoiceDialogRef = useRef<HTMLDialogElement>(null);
  const paymentDialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData() {
    const supabase = createClient();
    const [c, co, i] = await Promise.all([
      supabase.from("customers").select("*").order("customer_name"),
      supabase.from("contracts").select("*"),
      supabase.from("invoices").select("*").order("invoice_date", { ascending: false }),
    ]);
    setCustomers(c.data ?? []);
    setContracts(co.data ?? []);
    setInvoices(i.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const customerContracts = useMemo(
    () => contracts.filter((c) => c.customer_id === selectedCustomer),
    [contracts, selectedCustomer],
  );

  const rows: InvoiceRow[] = useMemo(() => {
    const customerMap = new Map(customers.map((c) => [c.id, c.customer_name]));
    const contractMap = new Map(contracts.map((c) => [c.id, c.contract_name]));
    return invoices.map((inv) => ({
      ...inv,
      customerName: customerMap.get(inv.customer_id) ?? "Unknown",
      contractName: inv.contract_id
        ? contractMap.get(inv.contract_id) ?? "—"
        : "—",
    }));
  }, [invoices, customers, contracts]);

  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId);

  function handleCreateInvoice(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createInvoice(formData);
      if (result.success) {
        showToast(result.message);
        invoiceDialogRef.current?.close();
        await loadData();
      } else {
        setError(result.message);
      }
    });
  }

  function handlePayment(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await recordPayment(formData);
      if (result.success) {
        showToast(result.message);
        paymentDialogRef.current?.close();
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
        title="Billing & accounts receivable"
        description="Review invoices, balances, and record simulated payments."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => invoiceDialogRef.current?.showModal()}>
              <Plus className="size-4" />
              Create Invoice
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => paymentDialogRef.current?.showModal()}>
              <Wallet className="size-4" />
              Record Payment
            </button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No invoices"
          description="Create an invoice to track recurring fees and additional billable charges."
          action={
            <button type="button" className="btn btn-primary" onClick={() => invoiceDialogRef.current?.showModal()}>
              Create Invoice
            </button>
          }
        />
      ) : (
        <div className="card border bg-base-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Contract</th>
                  <th>Date</th>
                  <th>Due</th>
                  <th>Recurring</th>
                  <th>Additional</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono text-sm">{row.invoice_number}</td>
                    <td>{row.customerName}</td>
                    <td>{row.contractName}</td>
                    <td>{formatDate(row.invoice_date)}</td>
                    <td>{formatDate(row.due_date)}</td>
                    <td>{formatCurrency(row.recurring_service_fee)}</td>
                    <td>{formatCurrency(row.additional_support_charges)}</td>
                    <td className="font-medium">{formatCurrency(row.total_amount)}</td>
                    <td>{formatCurrency(row.amount_paid)}</td>
                    <td>{formatCurrency(row.remaining_balance)}</td>
                    <td><StatusBadge status={row.status ?? "Draft"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <dialog ref={invoiceDialogRef} className="modal">
        <div className="modal-box max-w-2xl">
          <h3 className="text-lg font-bold">Create Invoice</h3>
          {error ? <div className="alert alert-error mt-4 text-sm"><span>{error}</span></div> : null}
          <form action={handleCreateInvoice} className="form-grid mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label="Invoice number" htmlFor="invoice_number" required>
              <input id="invoice_number" name="invoice_number" className="input input-bordered w-full" placeholder={`INV-${Date.now().toString().slice(-6)}`} required />
            </FormField>
            <FormField label="Status" htmlFor="status">
              <select id="status" name="status" className="select select-bordered w-full" defaultValue="Draft">
                <option value="Draft">Draft</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Issued">Issued</option>
              </select>
            </FormField>
            <FormField label="Customer" htmlFor="customer_id" required>
              <select id="customer_id" name="customer_id" className="select select-bordered w-full" required value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}>
                <option value="" disabled>Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.customer_name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Contract" htmlFor="contract_id" required>
              <select id="contract_id" name="contract_id" className="select select-bordered w-full" required defaultValue="">
                <option value="" disabled>Select contract</option>
                {customerContracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.contract_name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Invoice date" htmlFor="invoice_date">
              <input id="invoice_date" name="invoice_date" type="date" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Due date" htmlFor="due_date">
              <input id="due_date" name="due_date" type="date" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Recurring service fee" htmlFor="recurring_service_fee">
              <input id="recurring_service_fee" name="recurring_service_fee" type="number" min="0" step="0.01" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Additional support charges" htmlFor="additional_support_charges">
              <input id="additional_support_charges" name="additional_support_charges" type="number" min="0" step="0.01" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Software charges" htmlFor="software_charges">
              <input id="software_charges" name="software_charges" type="number" min="0" step="0.01" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Equipment charges" htmlFor="equipment_charges">
              <input id="equipment_charges" name="equipment_charges" type="number" min="0" step="0.01" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Other charges" htmlFor="other_charges" className="sm:col-span-2">
              <input id="other_charges" name="other_charges" type="number" min="0" step="0.01" className="input input-bordered w-full" />
            </FormField>
            <div className="modal-action sm:col-span-2">
              <button type="button" className="btn" onClick={() => invoiceDialogRef.current?.close()}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <span className="loading loading-spinner loading-sm" /> : "Create Invoice"}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button type="submit">close</button></form>
      </dialog>

      <dialog ref={paymentDialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold">Record Simulated Payment</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Payments reduce accounts receivable. No actual payment processing occurs.
          </p>
          {error ? <div className="alert alert-error mt-4 text-sm"><span>{error}</span></div> : null}
          <form action={handlePayment} className="form-grid mt-4 grid gap-4">
            <FormField label="Invoice" htmlFor="invoice_id" required>
              <select
                id="invoice_id"
                name="invoice_id"
                className="select select-bordered w-full"
                required
                value={selectedInvoiceId}
                onChange={(e) => setSelectedInvoiceId(e.target.value)}
              >
                <option value="" disabled>Select invoice</option>
                {invoices
                  .filter((i) => (i.remaining_balance ?? 0) > 0)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.invoice_number} — Balance {formatCurrency(i.remaining_balance)}
                    </option>
                  ))}
              </select>
            </FormField>
            {selectedInvoice ? (
              <div className="alert alert-info text-sm">
                <span>Remaining balance: {formatCurrency(selectedInvoice.remaining_balance)}</span>
              </div>
            ) : null}
            <FormField label="Payment date" htmlFor="payment_date">
              <input id="payment_date" name="payment_date" type="date" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Payment amount" htmlFor="payment_amount" required>
              <input id="payment_amount" name="payment_amount" type="number" min="0.01" step="0.01" className="input input-bordered w-full" required />
            </FormField>
            <FormField label="Payment method" htmlFor="payment_method">
              <input id="payment_method" name="payment_method" className="input input-bordered w-full" placeholder="Check, ACH, Wire, etc." />
            </FormField>
            <FormField label="Reference number" htmlFor="reference_number">
              <input id="reference_number" name="reference_number" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Notes" htmlFor="notes">
              <textarea id="notes" name="notes" className="textarea textarea-bordered w-full" rows={2} />
            </FormField>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => paymentDialogRef.current?.close()}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <span className="loading loading-spinner loading-sm" /> : "Record Payment"}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button type="submit">close</button></form>
      </dialog>
    </div>
  );
}
