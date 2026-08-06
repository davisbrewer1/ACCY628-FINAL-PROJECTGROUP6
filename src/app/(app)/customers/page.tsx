"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createCustomer, deleteCustomer } from "@/app/actions/customers";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getPastDueInvoices,
  getRenewalsInDays,
} from "@/lib/manager-ops";
import { isOpenTicket, isThisMonth } from "@/lib/dashboard-stats";
import { contractsUnlockPortal } from "@/lib/customer-access";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Customer, Invoice, Profile, ServiceTicket, WorkEntry } from "@/lib/types";
import { differenceInCalendarDays, parseISO } from "date-fns";

interface CustomerRow extends Customer {
  mrr: number;
  openTickets: number;
  outstandingBalance: number;
  oldestArDays: number | null;
  nextRenewal: string | null;
  accountManagerName: string;
  portalEmail: string | null;
  hasActiveContract: boolean;
  riskFlags: string[];
}

const MANAGER_ROLES = new Set([
  "administrator",
  "service_manager",
  "account_manager",
]);

export default function CustomersPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const canManage = MANAGER_ROLES.has(activeRole);

  async function loadData() {
    const supabase = createClient();
    const [c, co, t, i, w, p] = await Promise.all([
      supabase.from("customers").select("*").order("customer_name"),
      supabase.from("contracts").select("*"),
      supabase.from("service_tickets").select("*"),
      supabase.from("invoices").select("*"),
      supabase.from("work_entries").select("*"),
      supabase.from("profiles").select("*"),
    ]);
    setCustomers(c.data ?? []);
    setContracts(co.data ?? []);
    setTickets(t.data ?? []);
    setInvoices(i.data ?? []);
    setWorkEntries(w.data ?? []);
    setProfiles(p.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const rows: CustomerRow[] = useMemo(() => {
    const profileMap = new Map(profiles.map((p) => [p.id, p.full_name ?? p.email ?? "—"]));
    const portalByCustomer = new Map<string, string>();
    for (const profile of profiles) {
      if (
        profile.customer_id &&
        (profile.role === "client_admin" || profile.role === "client_user") &&
        profile.email
      ) {
        if (!portalByCustomer.has(profile.customer_id)) {
          portalByCustomer.set(profile.customer_id, profile.email);
        }
      }
    }
    const pastDueCustomers = new Set(getPastDueInvoices(invoices).map((i) => i.customer_id));
    const renewingSoon = new Set(getRenewalsInDays(contracts, 30).map((c) => c.customer_id));

    return customers.map((customer) => {
      const activeContracts = contracts.filter(
        (c) => c.customer_id === customer.id && c.contract_status === "Active",
      );
      const mrr = activeContracts.reduce(
        (sum, c) => sum + (c.monthly_recurring_fee ?? 0),
        0,
      );
      const custInvoices = invoices.filter((inv) => inv.customer_id === customer.id);
      const outstandingBalance = custInvoices.reduce(
        (sum, inv) => sum + (inv.remaining_balance ?? 0),
        0,
      );

      let oldestArDays: number | null = null;
      for (const inv of custInvoices) {
        if ((inv.remaining_balance ?? 0) <= 0) continue;
        if (!inv.due_date) continue;
        const due = parseISO(inv.due_date);
        const days = differenceInCalendarDays(new Date(), due);
        if (days > 0 && (oldestArDays == null || days > oldestArDays)) {
          oldestArDays = days;
        }
      }

      const included = activeContracts.reduce(
        (sum, c) => sum + (c.included_support_hours ?? 0),
        0,
      );
      const used = workEntries
        .filter(
          (e) =>
            e.customer_id === customer.id &&
            isThisMonth(e.work_date) &&
            activeContracts.some((c) => c.id === e.contract_id),
        )
        .reduce((sum, e) => sum + (e.hours_worked ?? 0), 0);

      const nextRenewal =
        activeContracts
          .map((c) => c.renewal_date)
          .filter((d): d is string => Boolean(d))
          .sort()[0] ?? null;

      const customerContracts = contracts.filter(
        (c) => c.customer_id === customer.id,
      );
      const hasActiveContract = contractsUnlockPortal(customerContracts);

      const riskFlags: string[] = [];
      if (!hasActiveContract) riskFlags.push("No active contract");
      if (pastDueCustomers.has(customer.id)) riskFlags.push("Past due");
      if (renewingSoon.has(customer.id)) riskFlags.push("Renewing soon");
      if (included > 0 && used > included) riskFlags.push("Over hours");

      return {
        ...customer,
        mrr,
        openTickets: tickets.filter(
          (t) => t.customer_id === customer.id && isOpenTicket(t.status),
        ).length,
        outstandingBalance,
        oldestArDays,
        nextRenewal,
        accountManagerName: customer.account_manager_id
          ? profileMap.get(customer.account_manager_id) ?? "Assigned"
          : "Unassigned",
        portalEmail:
          portalByCustomer.get(customer.id) ?? customer.contact_email ?? null,
        hasActiveContract,
        riskFlags,
      };
    });
  }, [customers, contracts, tickets, invoices, workEntries, profiles]);

  function handleSubmit(formData: FormData) {
    setError(null);
    setCreatedCreds(null);
    startTransition(async () => {
      const result = await createCustomer(formData);
      if (result.success) {
        showToast(result.message);
        if (result.portalEmail && result.portalPassword) {
          setCreatedCreds({
            email: result.portalEmail,
            password: result.portalPassword,
          });
        }
        dialogRef.current?.close();
        await loadData();
      } else {
        setError(result.message);
      }
    });
  }

  function handleDelete(customer: CustomerRow) {
    if (
      !confirm(
        `Delete customer "${customer.customer_name}"?\n\nThis removes their contracts, tickets, invoices, and related records. Portal logins for this customer will be deactivated.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await deleteCustomer(customer.id);
      if (result.success) {
        showToast(result.message);
        await loadData();
      } else {
        showToast(result.message, "error");
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
        title="Customer accounts"
        description="Managers approve new customers and create their portal login. Only management-created accounts should access the client portal."
        action={
          canManage ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setError(null);
                dialogRef.current?.showModal();
              }}
            >
              <Plus className="size-4" />
              Add Customer
            </button>
          ) : null
        }
      />

      {createdCreds ? (
        <div className="alert alert-success text-sm">
          <div>
            <p className="font-semibold">Portal login ready</p>
            <p>
              Email: <span className="font-mono">{createdCreds.email}</span>
            </p>
            <p>
              Password: <span className="font-mono">{createdCreds.password}</span>
            </p>
            <p className="mt-1 opacity-80">
              Share these with the customer contact. They can sign in at Portal sign-in as Client Admin.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreatedCreds(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add and approve your first business customer to create their login."
          action={
            canManage ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => dialogRef.current?.showModal()}
              >
                Add Customer
              </button>
            ) : null
          }
        />
      ) : (
        <div className="card border bg-base-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Portal login</th>
                  <th>Account manager</th>
                  <th className="text-right">MRR</th>
                  <th>Next renewal</th>
                  <th className="text-right">Open tickets</th>
                  <th className="text-right">AR / age</th>
                  <th>Flags</th>
                  {canManage ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="font-medium">{row.customer_name}</div>
                      <div className="text-xs text-base-content/60">
                        {row.primary_contact_name ?? "No contact"}
                        {row.industry ? ` · ${row.industry}` : ""}
                      </div>
                      {!row.hasActiveContract ? (
                        <div className="mt-1">
                          <StatusBadge status="No active contract" />
                        </div>
                      ) : null}
                    </td>
                    <td className="font-mono text-xs">
                      {row.portalEmail ?? "—"}
                    </td>
                    <td>{row.accountManagerName}</td>
                    <td className="text-right">{formatCurrency(row.mrr)}</td>
                    <td>
                      {formatDate(row.nextRenewal)}
                      {row.riskFlags.includes("Renewing soon") ? (
                        <div className="text-xs text-warning">Within 30 days</div>
                      ) : null}
                    </td>
                    <td className="text-right">{row.openTickets}</td>
                    <td className="text-right">
                      <div>{formatCurrency(row.outstandingBalance)}</div>
                      <div className="text-xs text-base-content/60">
                        {row.oldestArDays != null
                          ? `${row.oldestArDays}d oldest`
                          : "Current"}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge status={row.status ?? "Unknown"} />
                        {row.riskFlags.map((flag) => (
                          <span key={flag} className={riskFlagBadgeClass(flag)}>
                            {flag}
                          </span>
                        ))}
                      </div>
                    </td>
                    {canManage ? (
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-error"
                          disabled={isPending}
                          onClick={() => handleDelete(row)}
                          aria-label={`Delete ${row.customer_name}`}
                        >
                          <Trash2 className="size-3.5" />
                          Delete
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-2xl">
          <h3 className="text-lg font-bold">Approve &amp; add customer</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Creates the customer record and a Client Admin portal login (password{" "}
            <span className="font-mono">DemoPass123!</span>). The portal stays
            locked until you add an Active service contract on the Contracts page.
          </p>
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
            <FormField label="Portal / contact email" htmlFor="contact_email" required>
              <input
                id="contact_email"
                name="contact_email"
                type="email"
                className="input input-bordered w-full"
                required
                placeholder="customer@company.com"
              />
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
                {isPending ? <span className="loading loading-spinner loading-sm" /> : "Approve & create login"}
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

function riskFlagBadgeClass(flag: string): string {
  const base = "badge badge-sm border-0 font-medium";
  switch (flag) {
    case "Past due":
      return `${base} bg-[#9f1239] text-white`;
    case "Renewing soon":
      return `${base} bg-[#ea580c] text-white`;
    case "Low health":
      return `${base} bg-[#eab308] text-[#422006]`;
    case "No active contract":
      return `${base} bg-[#c2410c] text-white`;
    case "Over hours":
      return `${base} bg-[#b45309] text-white`;
    default:
      return `${base} badge-ghost`;
  }
}
