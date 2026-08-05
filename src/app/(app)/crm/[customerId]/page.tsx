"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  createCrmContact,
  createCrmNote,
  createCrmOpportunity,
  deleteCrmContact,
  saveCrmFieldValues,
  updateCrmOpportunityStage,
  upsertCrmAccountMeta,
} from "@/app/actions/crm";
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
  CrmContact,
  CrmFieldDefinition,
  CrmFieldValue,
  CrmNote,
  CrmOpportunity,
  Customer,
  Invoice,
  ServiceTicket,
} from "@/lib/types";
import {
  CRM_CONTACT_ROLES,
  CRM_INDUSTRY_TEMPLATES,
  CRM_OPP_STAGES,
} from "@/lib/types";

const MANAGER_ROLES = new Set([
  "administrator",
  "service_manager",
  "account_manager",
]);

function fieldOptions(def: CrmFieldDefinition): string[] {
  const raw = def.options;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return String(raw)
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export default function CrmAccountDetailPage() {
  const params = useParams<{ customerId: string }>();
  const customerId = params.customerId;
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const contactDialogRef = useRef<HTMLDialogElement>(null);
  const noteDialogRef = useRef<HTMLDialogElement>(null);
  const oppDialogRef = useRef<HTMLDialogElement>(null);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [meta, setMeta] = useState<CrmAccountMeta | null>(null);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [fieldDefs, setFieldDefs] = useState<CrmFieldDefinition[]>([]);
  const [fieldValues, setFieldValues] = useState<CrmFieldValue[]>([]);
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [opportunities, setOpportunities] = useState<CrmOpportunity[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canManage = MANAGER_ROLES.has(activeRole);

  async function loadData() {
    if (!customerId) return;
    const supabase = createClient();
    const [
      custRes,
      metaRes,
      contactRes,
      defRes,
      valRes,
      noteRes,
      oppRes,
      contractRes,
      ticketRes,
      invoiceRes,
    ] = await Promise.all([
      supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
      supabase
        .from("crm_account_meta")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle(),
      supabase
        .from("crm_contacts")
        .select("*")
        .eq("customer_id", customerId)
        .order("is_primary", { ascending: false })
        .order("full_name"),
      supabase
        .from("crm_field_definitions")
        .select("*")
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("crm_field_values")
        .select("*")
        .eq("customer_id", customerId),
      supabase
        .from("crm_notes")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase
        .from("crm_opportunities")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase.from("contracts").select("*").eq("customer_id", customerId),
      supabase.from("service_tickets").select("*").eq("customer_id", customerId),
      supabase.from("invoices").select("*").eq("customer_id", customerId),
    ]);

    if (!custRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setCustomer(custRes.data as Customer);
    setMeta((metaRes.data as CrmAccountMeta) ?? null);
    setContacts((contactRes.data as CrmContact[]) ?? []);
    setFieldDefs((defRes.data as CrmFieldDefinition[]) ?? []);
    setFieldValues((valRes.data as CrmFieldValue[]) ?? []);
    setNotes((noteRes.data as CrmNote[]) ?? []);
    setOpportunities((oppRes.data as CrmOpportunity[]) ?? []);
    setContracts(contractRes.data ?? []);
    setTickets(ticketRes.data ?? []);
    setInvoices(invoiceRes.data ?? []);
    setNotFound(false);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const health = useMemo(
    () =>
      customer
        ? computeCrmAccountHealth(customer.id, contracts, tickets, invoices)
        : null,
    [customer, contracts, tickets, invoices],
  );

  const templateId = meta?.industry_template ?? "";

  const applicableFields = useMemo(
    () =>
      fieldDefs.filter(
        (d) => !d.industry_template || d.industry_template === templateId,
      ),
    [fieldDefs, templateId],
  );

  const valueMap = useMemo(
    () => new Map(fieldValues.map((v) => [v.field_definition_id, v.value_text ?? ""])),
    [fieldValues],
  );

  function runAction(
    action: () => Promise<{ success: boolean; message: string }>,
    onSuccess?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.success) {
        showToast(result.message);
        onSuccess?.();
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

  if (notFound || !customer || !health) {
    return (
      <EmptyState
        title="Account not found"
        description="This customer record does not exist or is not visible."
        action={
          <Link href="/crm" className="btn btn-primary btn-sm">
            Back to CRM
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/crm" className="btn btn-ghost btn-sm mb-2 gap-1 px-0">
          <ArrowLeft className="size-4" />
          All accounts
        </Link>
        <PageHeader
          title={customer.customer_name}
          description={`${customer.industry ?? "IT account"} · Manage contacts, custom fields, notes, and expansion opportunities.`}
          action={<StatusBadge status={health.scoreLabel} />}
        />
      </div>

      {error ? (
        <div className="alert alert-error text-sm">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">MRR</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(health.mrr)}</p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">Open tickets</p>
          <p className="mt-1 text-2xl font-semibold">{health.openTickets}</p>
          <p className="text-xs text-base-content/60">
            {health.criticalTickets} critical · {health.slaAtRisk} SLA risk
          </p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">AR balance</p>
          <p className="mt-1 text-2xl font-semibold">{formatCurrency(health.arBalance)}</p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">Next renewal</p>
          <p className="mt-1 text-2xl font-semibold">{formatDate(health.nextRenewal)}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {health.riskFlags.map((flag) => (
              <span key={flag} className="badge badge-warning badge-xs">
                {flag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/service-tickets?customer=${customer.id}`} className="btn btn-outline btn-sm">
          Service tickets
        </Link>
        <Link href="/customers" className="btn btn-outline btn-sm">
          Customer directory
        </Link>
        <Link href="/contracts" className="btn btn-outline btn-sm">
          Contracts
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Profile */}
        <section className="card border bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <h2 className="card-title text-base">Account profile</h2>
            <form
              className="grid gap-3"
              action={(fd) => runAction(() => upsertCrmAccountMeta(fd))}
            >
              <input type="hidden" name="customer_id" value={customer.id} />
              <FormField label="Industry template" htmlFor="industry_template">
                <select
                  id="industry_template"
                  name="industry_template"
                  className="select select-bordered w-full"
                  defaultValue={meta?.industry_template ?? ""}
                >
                  {CRM_INDUSTRY_TEMPLATES.map((t) => (
                    <option key={t.id || "general"} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Tags (comma-separated)" htmlFor="tags">
                <input
                  id="tags"
                  name="tags"
                  className="input input-bordered w-full"
                  defaultValue={(meta?.tags ?? []).join(", ")}
                  placeholder="vip, multi-site, iso"
                />
              </FormField>
              <FormField label="Relationship notes" htmlFor="relationship_notes">
                <textarea
                  id="relationship_notes"
                  name="relationship_notes"
                  className="textarea textarea-bordered min-h-24 w-full"
                  defaultValue={meta?.relationship_notes ?? ""}
                />
              </FormField>
              <button type="submit" className="btn btn-primary btn-sm w-fit" disabled={isPending}>
                Save profile
              </button>
            </form>
          </div>
        </section>

        {/* Custom fields */}
        <section className="card border bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <h2 className="card-title text-base">Custom fields</h2>
            <p className="text-sm text-base-content/70">
              Showing global fields
              {templateId
                ? ` plus ${CRM_INDUSTRY_TEMPLATES.find((t) => t.id === templateId)?.label ?? templateId} template fields`
                : ""}
              .
            </p>
            {applicableFields.length === 0 ? (
              <EmptyState
                title="No custom fields yet"
                description="Add fields from the CRM list page, or pick an industry template with seeded fields."
              />
            ) : (
              <form
                className="grid gap-3"
                action={(fd) => runAction(() => saveCrmFieldValues(fd))}
              >
                <input type="hidden" name="customer_id" value={customer.id} />
                {applicableFields.map((def) => {
                  const name = `field_${def.id}`;
                  const current = valueMap.get(def.id) ?? "";
                  const opts = fieldOptions(def);
                  return (
                    <FormField key={def.id} label={def.label} htmlFor={name}>
                      {def.field_type === "dropdown" ? (
                        <select
                          id={name}
                          name={name}
                          className="select select-bordered w-full"
                          defaultValue={current}
                        >
                          <option value="">—</option>
                          {opts.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : def.field_type === "checkbox" ? (
                        <select
                          id={name}
                          name={name}
                          className="select select-bordered w-full"
                          defaultValue={current || "false"}
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : (
                        <input
                          id={name}
                          name={name}
                          type={
                            def.field_type === "number"
                              ? "number"
                              : def.field_type === "date"
                                ? "date"
                                : "text"
                          }
                          className="input input-bordered w-full"
                          defaultValue={current}
                        />
                      )}
                    </FormField>
                  );
                })}
                <button type="submit" className="btn btn-primary btn-sm w-fit" disabled={isPending}>
                  Save fields
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Contacts */}
        <section className="card border bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="card-title text-base">Contacts</h2>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setError(null);
                  contactDialogRef.current?.showModal();
                }}
              >
                <Plus className="size-4" />
                Add
              </button>
            </div>
            {contacts.length === 0 ? (
              <EmptyState
                title="No contacts yet"
                description="Add decision makers, IT leads, and billing contacts for this account."
              />
            ) : (
              <ul className="divide-y divide-base-300">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">
                        {c.full_name}
                        {c.is_primary ? (
                          <span className="badge badge-primary badge-xs ml-2">Primary</span>
                        ) : null}
                      </p>
                      <p className="text-sm text-base-content/70">
                        {[c.role_label, c.job_title].filter(Boolean).join(" · ") || "Contact"}
                      </p>
                      <p className="text-xs text-base-content/60">
                        {[c.email, c.phone].filter(Boolean).join(" · ") || "No email/phone"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      disabled={isPending}
                      onClick={() =>
                        runAction(() => deleteCrmContact(c.id, customer.id))
                      }
                      aria-label={`Delete ${c.full_name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Opportunities */}
        <section className="card border bg-base-100 shadow-sm">
          <div className="card-body gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="card-title text-base">Opportunities</h2>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setError(null);
                  oppDialogRef.current?.showModal();
                }}
              >
                <Plus className="size-4" />
                Add
              </button>
            </div>
            {opportunities.length === 0 ? (
              <EmptyState
                title="No opportunities"
                description="Track expansion, renewals, and new service lines without leaving the account."
              />
            ) : (
              <ul className="space-y-3">
                {opportunities.map((opp) => (
                  <li
                    key={opp.id}
                    className="rounded-box border border-base-300 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{opp.title}</p>
                        <p className="text-xs text-base-content/60">
                          {opp.service_focus ?? "General"} · Est.{" "}
                          {formatCurrency(opp.estimated_mrr)} · Close{" "}
                          {formatDate(opp.expected_close_date)}
                        </p>
                      </div>
                      <StatusBadge status={opp.status} />
                    </div>
                    <label className="form-control mt-2 max-w-xs">
                      <span className="label-text text-xs">Stage</span>
                      <select
                        className="select select-bordered select-sm"
                        value={opp.stage}
                        disabled={isPending}
                        onChange={(e) =>
                          runAction(() =>
                            updateCrmOpportunityStage(
                              opp.id,
                              customer.id,
                              e.target.value,
                            ),
                          )
                        }
                      >
                        {CRM_OPP_STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Notes timeline */}
      <section className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="card-title text-base">Notes timeline</h2>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setError(null);
                noteDialogRef.current?.showModal();
              }}
            >
              <Plus className="size-4" />
              Add note
            </button>
          </div>
          {notes.length === 0 ? (
            <EmptyState
              title="No notes yet"
              description="Log QBR outcomes, renewal discussions, and relationship context here."
            />
          ) : (
            <ol className="relative space-y-4 border-l border-base-300 pl-4">
              {notes.map((note) => (
                <li key={note.id} className="relative">
                  <span className="absolute -left-[1.3rem] top-1 size-2.5 rounded-full bg-primary" />
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={note.note_type} />
                    <span className="text-xs text-base-content/60">
                      {formatDate(note.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{note.body}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* Contact dialog */}
      <dialog ref={contactDialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold">Add contact</h3>
          <form
            className="mt-4 grid gap-3"
            action={(fd) =>
              runAction(
                () => createCrmContact(fd),
                () => contactDialogRef.current?.close(),
              )
            }
          >
            <input type="hidden" name="customer_id" value={customer.id} />
            <FormField label="Full name" htmlFor="full_name" required>
              <input id="full_name" name="full_name" className="input input-bordered w-full" required />
            </FormField>
            <FormField label="Role" htmlFor="role_label">
              <select id="role_label" name="role_label" className="select select-bordered w-full" defaultValue="IT Lead">
                {CRM_CONTACT_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Job title" htmlFor="job_title">
              <input id="job_title" name="job_title" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Email" htmlFor="email">
              <input id="email" name="email" type="email" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Phone" htmlFor="phone">
              <input id="phone" name="phone" className="input input-bordered w-full" />
            </FormField>
            <label className="label cursor-pointer justify-start gap-2">
              <input type="checkbox" name="is_primary" value="true" className="checkbox checkbox-sm" />
              <span className="label-text">Primary contact</span>
            </label>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => contactDialogRef.current?.close()}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                Add contact
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      {/* Note dialog */}
      <dialog ref={noteDialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold">Add note</h3>
          <form
            className="mt-4 grid gap-3"
            action={(fd) =>
              runAction(
                () => createCrmNote(fd),
                () => noteDialogRef.current?.close(),
              )
            }
          >
            <input type="hidden" name="customer_id" value={customer.id} />
            <FormField label="Note type" htmlFor="note_type">
              <select id="note_type" name="note_type" className="select select-bordered w-full" defaultValue="general">
                <option value="general">General</option>
                <option value="call">Call</option>
                <option value="meeting">Meeting / QBR</option>
                <option value="renewal">Renewal</option>
                <option value="escalation">Escalation</option>
              </select>
            </FormField>
            <FormField label="Note" htmlFor="body" required>
              <textarea
                id="body"
                name="body"
                className="textarea textarea-bordered min-h-28 w-full"
                required
              />
            </FormField>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => noteDialogRef.current?.close()}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                Save note
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      {/* Opportunity dialog */}
      <dialog ref={oppDialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold">Add opportunity</h3>
          <form
            className="mt-4 grid gap-3"
            action={(fd) =>
              runAction(
                () => createCrmOpportunity(fd),
                () => oppDialogRef.current?.close(),
              )
            }
          >
            <input type="hidden" name="customer_id" value={customer.id} />
            <FormField label="Title" htmlFor="title" required>
              <input id="title" name="title" className="input input-bordered w-full" required />
            </FormField>
            <FormField label="Service focus" htmlFor="service_focus">
              <input
                id="service_focus"
                name="service_focus"
                className="input input-bordered w-full"
                placeholder="Managed IT, cybersecurity, cloud…"
              />
            </FormField>
            <FormField label="Stage" htmlFor="stage">
              <select id="stage" name="stage" className="select select-bordered w-full" defaultValue="Lead">
                {CRM_OPP_STAGES.filter((s) => s !== "Lost").map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Estimated MRR" htmlFor="estimated_mrr">
              <input
                id="estimated_mrr"
                name="estimated_mrr"
                type="number"
                step="0.01"
                className="input input-bordered w-full"
              />
            </FormField>
            <FormField label="Expected close" htmlFor="expected_close_date">
              <input
                id="expected_close_date"
                name="expected_close_date"
                type="date"
                className="input input-bordered w-full"
              />
            </FormField>
            <FormField label="Notes" htmlFor="notes">
              <textarea id="notes" name="notes" className="textarea textarea-bordered w-full" />
            </FormField>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => oppDialogRef.current?.close()}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                Create opportunity
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
