"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Wallet } from "lucide-react";
import { createInvoice, recordPayment, syncLateFees } from "@/app/actions/billing";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import {
  cashCollectedMtd,
  computeContractAssetBurns,
  computeContractHoursBurns,
  getArAgingBucket,
  getOpenArInvoices,
  getPastDueInvoices,
  summarizeArAging,
} from "@/lib/manager-ops";
import { createClient } from "@/lib/supabase/client";
import type {
  Contract,
  Customer,
  HardwareAsset,
  Invoice,
  Payment,
  WorkEntry,
} from "@/lib/types";

interface InvoiceRow extends Invoice {
  customerName: string;
  contractName: string;
  planName: string;
  aging: ReturnType<typeof getArAgingBucket>;
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter") ?? "all";
  const { showToast } = useToast();
  const invoiceDialogRef = useRef<HTMLDialogElement>(null);
  const paymentDialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [assets, setAssets] = useState<HardwareAsset[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [prefillAdditional, setPrefillAdditional] = useState("");
  const [prefillEquipment, setPrefillEquipment] = useState("");
  const [prefillContractId, setPrefillContractId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData() {
    await syncLateFees();
    const supabase = createClient();
    const [c, co, i, p, w, a] = await Promise.all([
      supabase.from("customers").select("*").order("customer_name"),
      supabase.from("contracts").select("*"),
      supabase.from("invoices").select("*").order("invoice_date", { ascending: false }),
      supabase.from("payments").select("*"),
      supabase.from("work_entries").select("*"),
      supabase.from("hardware_assets").select("*"),
    ]);
    setCustomers(c.data ?? []);
    setContracts(co.data ?? []);
    setInvoices(i.data ?? []);
    setPayments(p.data ?? []);
    setWorkEntries(w.data ?? []);
    setAssets((a.data as HardwareAsset[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const customerContracts = useMemo(
    () => contracts.filter((c) => c.customer_id === selectedCustomer),
    [contracts, selectedCustomer],
  );

  const aging = useMemo(() => summarizeArAging(invoices), [invoices]);
  const cashMtd = useMemo(() => cashCollectedMtd(payments), [payments]);
  const pastDue = useMemo(() => getPastDueInvoices(invoices), [invoices]);

  const overageOpportunities = useMemo(() => {
    return computeContractHoursBurns(contracts, workEntries)
      .filter((b) => b.isOver && b.overageEstimate > 0)
      .map((b) => {
        const contract = contracts.find((c) => c.id === b.contractId);
        const customer = customers.find((c) => c.id === b.customerId);
        return {
          ...b,
          contractName: contract?.contract_name ?? "Contract",
          customerName: customer?.customer_name ?? "Customer",
          customerId: b.customerId,
        };
      });
  }, [contracts, workEntries, customers]);

  const assetOverageOpportunities = useMemo(() => {
    return computeContractAssetBurns(contracts, assets)
      .filter((b) => b.isOver && b.overageEstimate > 0)
      .map((b) => {
        const contract = contracts.find((c) => c.id === b.contractId);
        const customer = customers.find((c) => c.id === b.customerId);
        return {
          ...b,
          contractName: contract?.contract_name ?? "Contract",
          customerName: customer?.customer_name ?? "Customer",
          customerId: b.customerId,
        };
      });
  }, [contracts, assets, customers]);

  const rows: InvoiceRow[] = useMemo(() => {
    const customerMap = new Map(customers.map((c) => [c.id, c.customer_name]));
    const contractMap = new Map(contracts.map((c) => [c.id, c]));
    return invoices.map((inv) => {
      const contract = inv.contract_id ? contractMap.get(inv.contract_id) : null;
      return {
        ...inv,
        customerName: customerMap.get(inv.customer_id) ?? "Unknown",
        contractName: contract?.contract_name ?? "—",
        planName: contract?.service_plan_name ?? contract?.billing_frequency ?? "—",
        aging: getArAgingBucket(inv),
      };
    });
  }, [invoices, customers, contracts]);

  const filteredRows = useMemo(() => {
    if (filter === "past-due") {
      const ids = new Set(pastDue.map((i) => i.id));
      return rows.filter((r) => ids.has(r.id));
    }
    if (filter === "action") {
      return rows.filter(
        (r) =>
          r.status === "Draft" ||
          r.status === "Pending Approval" ||
          ((r.remaining_balance ?? 0) > 0 &&
            (r.status === "Past Due" || r.aging !== "current")),
      );
    }
    if (filter === "cash") {
      return rows.filter((r) => (r.amount_paid ?? 0) > 0);
    }
    return rows;
  }, [rows, filter, pastDue]);

  const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId);

  function openOverageInvoice(item: (typeof overageOpportunities)[number]) {
    setSelectedCustomer(item.customerId);
    setPrefillContractId(item.contractId);
    setPrefillAdditional(item.overageEstimate.toFixed(2));
    setPrefillEquipment("");
    setError(null);
    invoiceDialogRef.current?.showModal();
  }

  function openAssetOverageInvoice(
    item: (typeof assetOverageOpportunities)[number],
  ) {
    setSelectedCustomer(item.customerId);
    setPrefillContractId(item.contractId);
    setPrefillAdditional("");
    setPrefillEquipment(item.overageEstimate.toFixed(2));
    setError(null);
    invoiceDialogRef.current?.showModal();
  }

  function handleCreateInvoice(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createInvoice(formData);
      if (result.success) {
        showToast(result.message);
        invoiceDialogRef.current?.close();
        setPrefillAdditional("");
        setPrefillEquipment("");
        setPrefillContractId("");
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
        title="Billing & AR"
        description="Aging, cash, and one-click overage invoices with contract context."
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Current" value={formatCurrency(aging.current)} />
        <StatCard title="1–30 days" value={formatCurrency(aging.d30)} tone={aging.d30 > 0 ? "warning" : "default"} />
        <StatCard title="31–60 days" value={formatCurrency(aging.d60)} tone={aging.d60 > 0 ? "warning" : "default"} />
        <StatCard title="61–90+ days" value={formatCurrency(aging.d90)} tone={aging.d90 > 0 ? "danger" : "default"} />
        <StatCard title="Cash collected (MTD)" value={formatCurrency(cashMtd)} tone="success" />
      </div>

      {overageOpportunities.length > 0 ? (
        <div className="card border border-warning/30 bg-warning/5 shadow-sm">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">Invoice from hour overages</h2>
            <p className="text-sm text-base-content/70">
              Active contracts over included hours this month — create an invoice with estimated overage charges.
            </p>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contract</th>
                    <th>Hours</th>
                    <th className="text-right">Est. overage</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {overageOpportunities.map((item) => (
                    <tr key={item.contractId}>
                      <td>{item.customerName}</td>
                      <td>{item.contractName}</td>
                      <td>
                        {formatHours(item.hoursUsed)} / {formatHours(item.includedHours)}
                      </td>
                      <td className="text-right font-medium">
                        {formatCurrency(item.overageEstimate)}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          onClick={() => openOverageInvoice(item)}
                        >
                          Create invoice
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {assetOverageOpportunities.length > 0 ? (
        <div className="card border border-warning/30 bg-warning/5 shadow-sm">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">Invoice from asset budget overages</h2>
            <p className="text-sm text-base-content/70">
              Deployed hardware purchase cost exceeds the plan asset budget for the contract term —
              prefills equipment charges using the plan&apos;s additional asset rate.
            </p>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contract</th>
                    <th>Asset spend</th>
                    <th className="text-right">Est. overage</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {assetOverageOpportunities.map((item) => (
                    <tr key={`asset-${item.contractId}`}>
                      <td>{item.customerName}</td>
                      <td>{item.contractName}</td>
                      <td>
                        {formatCurrency(item.assetSpend)} /{" "}
                        {formatCurrency(item.includedBudget)}
                      </td>
                      <td className="text-right font-medium">
                        {formatCurrency(item.overageEstimate)}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          onClick={() => openAssetOverageInvoice(item)}
                        >
                          Create invoice
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {filter !== "all" ? (
        <div className="alert alert-info text-sm py-2">
          <span>Filtered billing view: {filter}</span>
          <a href="/billing" className="link">Clear</a>
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <EmptyState
          title="No invoices in this view"
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
                  <th>Customer / contract</th>
                  <th>Due</th>
                  <th>Aging</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono text-sm">{row.invoice_number}</td>
                    <td>
                      <div className="font-medium">{row.customerName}</div>
                      <div className="text-xs text-base-content/60">
                        {row.contractName} · {row.planName}
                      </div>
                    </td>
                    <td>
                      <div>{formatDate(row.due_date)}</div>
                      <div className="text-xs text-base-content/60">
                        Issued {formatDate(row.invoice_date)}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-outline badge-sm uppercase">
                        {row.aging === "current" ? "Current" : row.aging.replace("d", "") + "d"}
                      </span>
                    </td>
                    <td className="text-right">{formatCurrency(row.total_amount)}</td>
                    <td className="text-right font-medium">
                      {formatCurrency(row.remaining_balance)}
                    </td>
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
              <select
                id="contract_id"
                name="contract_id"
                className="select select-bordered w-full"
                required
                value={prefillContractId}
                onChange={(e) => setPrefillContractId(e.target.value)}
              >
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
              <input
                id="additional_support_charges"
                name="additional_support_charges"
                type="number"
                min="0"
                step="0.01"
                className="input input-bordered w-full"
                value={prefillAdditional}
                onChange={(e) => setPrefillAdditional(e.target.value)}
              />
            </FormField>
            <FormField label="Software charges" htmlFor="software_charges">
              <input id="software_charges" name="software_charges" type="number" min="0" step="0.01" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Equipment charges" htmlFor="equipment_charges">
              <input
                id="equipment_charges"
                name="equipment_charges"
                type="number"
                min="0"
                step="0.01"
                className="input input-bordered w-full"
                value={prefillEquipment}
                onChange={(e) => setPrefillEquipment(e.target.value)}
              />
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
                {getOpenArInvoices(invoices).map((i) => (
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
