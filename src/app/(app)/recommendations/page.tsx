"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import {
  createRecommendation,
  updateRecommendationStatus,
} from "@/app/actions/recommendations";
import { createServiceTicket } from "@/app/actions/tickets";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import {
  buildRiskActionItems,
  defaultCategoriesForRole,
  RISK_CATEGORY_LABELS,
  type RiskActionItem,
  type RiskCategory,
} from "@/lib/risk-management";
import { createClient } from "@/lib/supabase/client";
import type {
  AiPlatform,
  AiRisk,
  Contract,
  Customer,
  Invoice,
  Recommendation,
  SecurityAlert,
  ServiceTicket,
  Technician,
  WorkEntry,
} from "@/lib/types";

const CAN_REVIEW_ROLES = new Set([
  "administrator",
  "executive",
  "service_manager",
  "account_manager",
  "client_admin",
]);

const SOURCE_AREAS = [
  "Operations",
  "Sales / Growth",
  "Billing",
  "Cybersecurity",
  "AI Governance",
  "Capacity",
] as const;

export default function RiskManagementPage() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter") ?? "all";
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [aiRisks, setAiRisks] = useState<AiRisk[]>([]);
  const [aiPlatforms, setAiPlatforms] = useState<AiPlatform[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<RiskCategory | "all">(
    "all",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canReview = CAN_REVIEW_ROLES.has(activeRole);

  async function loadData() {
    const supabase = createClient();
    const [c, co, t, i, w, tech, sa, ar, ap, r] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("contracts").select("*"),
      supabase.from("service_tickets").select("*"),
      supabase.from("invoices").select("*"),
      supabase.from("work_entries").select("*"),
      supabase.from("technicians").select("*"),
      supabase.from("security_alerts").select("*"),
      supabase.from("ai_risks").select("*"),
      supabase.from("ai_platforms").select("*"),
      supabase.from("recommendations").select("*").order("created_at", { ascending: false }),
    ]);
    setCustomers(c.data ?? []);
    setContracts(co.data ?? []);
    setTickets(t.data ?? []);
    setInvoices(i.data ?? []);
    setWorkEntries(w.data ?? []);
    setTechnicians(tech.data ?? []);
    setSecurityAlerts(sa.data ?? []);
    setAiRisks(ar.data ?? []);
    setAiPlatforms(ap.data ?? []);
    setRecommendations(r.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (filterParam === "new") {
      setCategoryFilter("growth");
    }
  }, [filterParam]);

  const items = useMemo(
    () =>
      buildRiskActionItems({
        customers,
        contracts,
        tickets,
        invoices,
        workEntries,
        technicians,
        securityAlerts,
        aiRisks,
        aiPlatforms,
        recommendations,
      }),
    [
      customers,
      contracts,
      tickets,
      invoices,
      workEntries,
      technicians,
      securityAlerts,
      aiRisks,
      aiPlatforms,
      recommendations,
    ],
  );

  const roleDefaults = defaultCategoriesForRole(activeRole);

  const visible = useMemo(() => {
    let list = items;
    if (categoryFilter !== "all") {
      list = list.filter((i) => i.category === categoryFilter);
    } else if (filterParam === "new") {
      list = list.filter((i) => i.source === "recommendation");
    }

    // Soft role preference: sort preferred categories slightly higher within same priority
    if (roleDefaults !== "all") {
      const preferred = new Set(roleDefaults);
      list = [...list].sort((a, b) => {
        const ap = preferred.has(a.category) ? 0 : 1;
        const bp = preferred.has(b.category) ? 0 : 1;
        return ap - bp;
      });
    }
    return list;
  }, [items, categoryFilter, filterParam, roleDefaults]);

  const summary = useMemo(() => {
    const critical = items.filter((i) => i.priority === "Critical").length;
    const high = items.filter((i) => i.priority === "High").length;
    const live = items.filter((i) => i.source === "live").length;
    const manual = items.filter((i) => i.source === "recommendation").length;
    return { critical, high, live, manual, total: items.length };
  }, [items]);

  function handleCreateTicket(item: RiskActionItem) {
    if (!item.ticketPrefill) return;
    const fd = new FormData();
    fd.set("customer_id", item.ticketPrefill.customerId);
    fd.set("title", item.ticketPrefill.title);
    fd.set("priority", item.ticketPrefill.priority);
    fd.set("description", item.ticketPrefill.description);
    fd.set("ticket_type", "Incident");
    fd.set("category", "Risk Management");
    if (item.contractId) fd.set("contract_id", item.contractId);

    startTransition(async () => {
      const result = await createServiceTicket(fd);
      if (result.success) {
        if (item.recommendationId) {
          await updateRecommendationStatus(item.recommendationId, "Approved");
        }
        showToast(`${result.message} Open Service Tickets to assign.`);
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    });
  }

  function handleRecStatus(id: string, status: string) {
    startTransition(async () => {
      const result = await updateRecommendationStatus(id, status);
      if (result.success) {
        showToast(result.message);
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    });
  }

  function handleCreateRecommendation(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createRecommendation(formData);
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
        title="Risk Management"
        description="Live risks and next actions from tickets, renewals, AR, capacity, and optional cyber/AI modules — plus manual growth ideas."
        action={
          canReview ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setError(null);
                dialogRef.current?.showModal();
              }}
            >
              <Plus className="size-4" />
              Add idea
            </button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">Open actions</p>
          <p className="mt-1 text-2xl font-semibold">{summary.total}</p>
          <p className="text-xs text-base-content/55">
            {summary.live} live · {summary.manual} manual
          </p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">Critical</p>
          <p className="mt-1 text-2xl font-semibold text-error">{summary.critical}</p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">High</p>
          <p className="mt-1 text-2xl font-semibold text-warning">{summary.high}</p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-xs uppercase tracking-wide text-base-content/60">Modules</p>
          <p className="mt-1 text-sm">
            <Link href="/cybersecurity" className="link link-hover">
              Cyber
            </Link>
            {" · "}
            <Link href="/ai-governance" className="link link-hover">
              AI
            </Link>
            {" · "}
            <Link href="/operations" className="link link-hover">
              Operations
            </Link>
          </p>
          <p className="mt-1 text-xs text-base-content/55">
            Security/AI actions appear only when those signals exist
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn btn-sm ${categoryFilter === "all" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setCategoryFilter("all")}
        >
          All
        </button>
        {(Object.keys(RISK_CATEGORY_LABELS) as RiskCategory[]).map((cat) => (
          <button
            key={cat}
            type="button"
            className={`btn btn-sm ${categoryFilter === cat ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setCategoryFilter(cat)}
          >
            {RISK_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No open risk actions in this filter"
          description="Live signals clear as tickets, AR, and renewals improve. Add a manual growth idea anytime."
          action={
            canReview ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => dialogRef.current?.showModal()}
              >
                Add idea
              </button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((item) => (
            <article
              key={item.id}
              className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={item.priority} />
                    <span className="badge badge-ghost badge-sm">
                      {RISK_CATEGORY_LABELS[item.category]}
                    </span>
                    <span className="badge badge-outline badge-sm">
                      {item.source === "live" ? "Live signal" : "Manual idea"}
                    </span>
                    {item.status ? <StatusBadge status={item.status} /> : null}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold">{item.title}</h2>
                  <p className="text-sm text-base-content/70">
                    {item.customerName ?? "Portfolio"}
                    {item.estimatedImpact ? ` · ${item.estimatedImpact}` : ""}
                  </p>
                  <p className="mt-2 text-sm">
                    <span className="font-medium">Evidence: </span>
                    {item.evidence}
                  </p>
                  <p className="mt-1 text-sm text-base-content/75">{item.why}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-base-300 pt-3">
                <Link href={item.href} className="btn btn-primary btn-sm">
                  {item.hrefLabel}
                </Link>
                {item.secondaryHref ? (
                  <Link href={item.secondaryHref} className="btn btn-outline btn-sm">
                    {item.secondaryLabel}
                  </Link>
                ) : null}
                {item.canCreateTicket && item.ticketPrefill && canReview ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={isPending}
                    onClick={() => handleCreateTicket(item)}
                  >
                    Create ticket
                  </button>
                ) : null}
                {item.recommendationId && canReview ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={isPending}
                      onClick={() => handleRecStatus(item.recommendationId!, "Reviewed")}
                    >
                      Mark reviewed
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={isPending}
                      onClick={() => handleRecStatus(item.recommendationId!, "Approved")}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-warning"
                      disabled={isPending}
                      onClick={() => handleRecStatus(item.recommendationId!, "Dismissed")}
                    >
                      Dismiss
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold">Add risk / growth idea</h3>
          <p className="mt-1 text-sm text-base-content/65">
            Use this for AM expansion ideas or risks that live signals don’t catch yet.
          </p>
          {error ? (
            <div className="alert alert-error mt-3 text-sm">
              <span>{error}</span>
            </div>
          ) : null}
          <form action={handleCreateRecommendation} className="mt-4 grid gap-3">
            <FormField label="Title" htmlFor="title" required>
              <input id="title" name="title" className="input input-bordered w-full" required />
            </FormField>
            <FormField label="Source area" htmlFor="source_area" required>
              <select
                id="source_area"
                name="source_area"
                className="select select-bordered w-full"
                defaultValue="Sales / Growth"
                required
              >
                {SOURCE_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Customer (optional)" htmlFor="customer_id">
              <select
                id="customer_id"
                name="customer_id"
                className="select select-bordered w-full"
                defaultValue=""
              >
                <option value="">All / portfolio</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Why it matters" htmlFor="why_it_matters">
              <textarea
                id="why_it_matters"
                name="why_it_matters"
                className="textarea textarea-bordered w-full"
                rows={2}
              />
            </FormField>
            <FormField label="Recommended solution" htmlFor="recommended_solution">
              <textarea
                id="recommended_solution"
                name="recommended_solution"
                className="textarea textarea-bordered w-full"
                rows={2}
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Priority" htmlFor="priority">
                <select
                  id="priority"
                  name="priority"
                  className="select select-bordered w-full"
                  defaultValue="Medium"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </FormField>
              <FormField label="Est. monthly revenue" htmlFor="estimated_monthly_revenue">
                <input
                  id="estimated_monthly_revenue"
                  name="estimated_monthly_revenue"
                  type="number"
                  min="0"
                  step="0.01"
                  className="input input-bordered w-full"
                />
              </FormField>
            </div>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                Save idea
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
