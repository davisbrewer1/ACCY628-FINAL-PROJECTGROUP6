"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus, Search } from "lucide-react";
import { createCrmFieldDefinition } from "@/app/actions/crm";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { computeCrmAccountHealth } from "@/lib/crm";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type {
  Contract,
  CrmAccountMeta,
  CrmFieldDefinition,
  CrmOpportunity,
  Customer,
  Invoice,
  ServiceTicket,
} from "@/lib/types";
import { CRM_INDUSTRY_TEMPLATES } from "@/lib/types";

const MANAGER_ROLES = new Set([
  "administrator",
  "service_manager",
  "account_manager",
]);

interface AccountRow {
  customer: Customer;
  meta: CrmAccountMeta | null;
  health: ReturnType<typeof computeCrmAccountHealth>;
  openOpps: number;
}

export default function CrmAccountsPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const fieldDialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<CrmAccountMeta[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([]);
  const [fieldDefs, setFieldDefs] = useState<CrmFieldDefinition[]>([]);
  const [search, setSearch] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [healthFilter, setHealthFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canManage = MANAGER_ROLES.has(activeRole);

  async function loadData() {
    const supabase = createClient();
    const [c, m, co, t, i, o, f] = await Promise.all([
      supabase.from("customers").select("*").order("customer_name"),
      supabase.from("crm_account_meta").select("*"),
      supabase.from("contracts").select("*"),
      supabase.from("service_tickets").select("*"),
      supabase.from("invoices").select("*"),
      supabase.from("crm_opportunities").select("*").eq("status", "open"),
      supabase
        .from("crm_field_definitions")
        .select("*")
        .eq("active", true)
        .order("sort_order"),
    ]);
    setCustomers(c.data ?? []);
    setMeta((m.data as CrmAccountMeta[]) ?? []);
    setContracts(co.data ?? []);
    setTickets(t.data ?? []);
    setInvoices(i.data ?? []);
    setOpportunities((o.data as CrmOpportunity[]) ?? []);
    setFieldDefs((f.data as CrmFieldDefinition[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const rows: AccountRow[] = useMemo(() => {
    const metaMap = new Map(meta.map((m) => [m.customer_id, m]));
    return customers.map((customer) => ({
      customer,
      meta: metaMap.get(customer.id) ?? null,
      health: computeCrmAccountHealth(
        customer.id,
        contracts,
        tickets,
        invoices,
      ),
      openOpps: opportunities.filter((o) => o.customer_id === customer.id).length,
    }));
  }, [customers, meta, contracts, tickets, invoices, opportunities]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const m of meta) {
      for (const tag of m.tags ?? []) tags.add(tag);
    }
    return Array.from(tags).sort();
  }, [meta]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (templateFilter) {
        if ((row.meta?.industry_template ?? "") !== templateFilter) return false;
      }
      if (tagFilter) {
        if (!(row.meta?.tags ?? []).includes(tagFilter)) return false;
      }
      if (healthFilter !== "all" && row.health.scoreLabel !== healthFilter) {
        return false;
      }
      if (!q) return true;
      return (
        row.customer.customer_name.toLowerCase().includes(q) ||
        (row.customer.industry ?? "").toLowerCase().includes(q) ||
        (row.meta?.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [rows, search, templateFilter, tagFilter, healthFilter]);

  function handleCreateField(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createCrmFieldDefinition(formData);
      if (result.success) {
        showToast(result.message);
        fieldDialogRef.current?.close();
        await loadData();
      } else {
        setError(result.message);
      }
    });
  }

  if (!canManage) {
    return (
      <AlertBanner
        tone="info"
        title="CRM / Accounts"
        message="This relationship workspace is for managers. Switch to a manager demo role to use it."
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM / Accounts"
        description="Flexible account hub for any IT MSP — contacts, custom fields, opportunities, and health tied to tickets and contracts."
        action={
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setError(null);
              fieldDialogRef.current?.showModal();
            }}
          >
            <Plus className="size-4" />
            Custom field
          </button>
        }
      />

      <div className="flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-3 lg:flex-row lg:flex-wrap lg:items-center">
        <label className="input input-bordered input-sm flex items-center gap-2 lg:min-w-[16rem]">
          <Search className="size-3.5 opacity-60" />
          <input
            type="search"
            className="grow"
            placeholder="Search accounts or tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          className="select select-bordered select-sm"
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
        >
          <option value="">All industry templates</option>
          {CRM_INDUSTRY_TEMPLATES.filter((t) => t.id).map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          className="select select-bordered select-sm"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
        >
          <option value="">All tags</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <select
          className="select select-bordered select-sm"
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value)}
        >
          <option value="all">All health</option>
          <option value="Healthy">Healthy</option>
          <option value="Watch">Watch</option>
          <option value="At risk">At risk</option>
        </select>
        <p className="text-xs text-base-content/60 lg:ml-auto">
          {fieldDefs.length} custom field{fieldDefs.length === 1 ? "" : "s"} configured
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching accounts"
          description="Adjust filters or add customers first, then open an account to complete CRM setup."
        />
      ) : (
        <div className="card border bg-base-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Template / tags</th>
                  <th>Health</th>
                  <th className="text-right">MRR</th>
                  <th className="text-right">Open tickets</th>
                  <th className="text-right">AR</th>
                  <th>Renewal</th>
                  <th className="text-right">Opps</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.customer.id} className="hover:bg-base-200/50">
                    <td>
                      <Link
                        href={`/crm/${row.customer.id}`}
                        className="link link-hover font-medium"
                      >
                        {row.customer.customer_name}
                      </Link>
                      <div className="text-xs text-base-content/60">
                        {row.customer.industry ?? "No industry set"}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">
                        {CRM_INDUSTRY_TEMPLATES.find(
                          (t) => t.id === (row.meta?.industry_template ?? ""),
                        )?.label ?? "General IT / MSP"}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(row.meta?.tags ?? []).length === 0 ? (
                          <span className="text-xs text-base-content/50">No tags</span>
                        ) : (
                          row.meta!.tags.map((tag) => (
                            <span key={tag} className="badge badge-ghost badge-xs">
                              {tag}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={row.health.scoreLabel} />
                      <div className="mt-1 flex flex-wrap gap-1">
                        {row.health.riskFlags.slice(0, 2).map((flag) => (
                          <span key={flag} className="badge badge-warning badge-xs">
                            {flag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-right">{formatCurrency(row.health.mrr)}</td>
                    <td className="text-right">
                      {row.health.openTickets}
                      {row.health.criticalTickets > 0 ? (
                        <div className="text-xs text-error">
                          {row.health.criticalTickets} critical
                        </div>
                      ) : null}
                    </td>
                    <td className="text-right">
                      {formatCurrency(row.health.arBalance)}
                    </td>
                    <td>{formatDate(row.health.nextRenewal)}</td>
                    <td className="text-right">{row.openOpps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <dialog ref={fieldDialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold">Add custom field</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Fields can be global or tied to an industry template so different IT clients see relevant data.
          </p>
          {error ? (
            <div className="alert alert-error mt-4 text-sm">
              <span>{error}</span>
            </div>
          ) : null}
          <form action={handleCreateField} className="mt-4 grid gap-3">
            <FormField label="Label" htmlFor="label" required>
              <input id="label" name="label" className="input input-bordered w-full" required />
            </FormField>
            <FormField label="Field type" htmlFor="field_type">
              <select id="field_type" name="field_type" className="select select-bordered w-full" defaultValue="text">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="dropdown">Dropdown</option>
                <option value="checkbox">Checkbox</option>
              </select>
            </FormField>
            <FormField label="Dropdown options (comma-separated)" htmlFor="options">
              <input
                id="options"
                name="options"
                className="input input-bordered w-full"
                placeholder="Yes, No, Pending"
              />
            </FormField>
            <FormField label="Industry template" htmlFor="industry_template">
              <select
                id="industry_template"
                name="industry_template"
                className="select select-bordered w-full"
                defaultValue=""
              >
                {CRM_INDUSTRY_TEMPLATES.map((t) => (
                  <option key={t.id || "general"} value={t.id}>
                    {t.id ? t.label : "Global (all accounts)"}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => fieldDialogRef.current?.close()}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <span className="loading loading-spinner loading-sm" /> : "Create field"}
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
