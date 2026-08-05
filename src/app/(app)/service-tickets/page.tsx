"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import {
  assignTickets,
  createServiceTicket,
  updateTicketBillingFlags,
  updateTicketPriority,
  updateTicketStatus,
} from "@/app/actions/tickets";
import { calcSlaStatus } from "@/lib/calculations";
import { isOpenTicket } from "@/lib/dashboard-stats";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatDateTime } from "@/lib/format";
import {
  FLEXIBLE_TICKET_CATEGORIES,
  TICKET_TYPES,
  billableLabel,
  computeSlaTargets,
  isSkillMatch,
  normalizePriority,
  parseCategoryLabel,
  priorityRank,
  rankTechniciansForTicket,
  resolutionHoursForPriority,
  responseHoursForPriority,
} from "@/lib/ticket-ops";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Customer, ServiceTicket, Technician, WorkEntry } from "@/lib/types";
import { TICKET_STATUSES } from "@/lib/types";

type SortMode = "priority" | "sla" | "newest";
type PriorityFilter = "all" | "Critical" | "High" | "Medium" | "Low";

interface TicketRow extends ServiceTicket {
  customerName: string;
  technicianName: string;
  contractName: string;
  slaStatus: ReturnType<typeof calcSlaStatus>;
  slaSort: number;
  billable: string;
  typeLabel: string;
  categoryLabel: string;
}

const MANAGER_ROLES = new Set([
  "administrator",
  "service_manager",
  "account_manager",
]);

export default function ServiceTicketsPage() {
  const searchParams = useSearchParams();
  const urlFilter = searchParams.get("filter") ?? "all";
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);

  const [queueFilter, setQueueFilter] = useState(urlFilter);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [search, setSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignTechId, setAssignTechId] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("High");
  const [selectedCategory, setSelectedCategory] = useState("Software");
  const [selectedType, setSelectedType] = useState("Incident");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canManage = MANAGER_ROLES.has(activeRole);

  useEffect(() => {
    setQueueFilter(urlFilter);
  }, [urlFilter]);

  async function loadData() {
    const supabase = createClient();
    const [c, co, tech, t, w] = await Promise.all([
      supabase.from("customers").select("*").order("customer_name"),
      supabase.from("contracts").select("*"),
      supabase.from("technicians").select("*").eq("active", true),
      supabase.from("service_tickets").select("*").order("opened_at", { ascending: false }),
      supabase.from("work_entries").select("*"),
    ]);
    setCustomers(c.data ?? []);
    setContracts(co.data ?? []);
    setTechnicians(tech.data ?? []);
    setTickets(t.data ?? []);
    setWorkEntries(w.data ?? []);
    setSelectedIds([]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const customerContracts = useMemo(
    () =>
      contracts.filter(
        (c) =>
          c.customer_id === selectedCustomer &&
          (c.contract_status === "Active" || c.contract_status === "Draft"),
      ),
    [contracts, selectedCustomer],
  );

  const activeContract = useMemo(() => {
    if (selectedContractId) {
      return contracts.find((c) => c.id === selectedContractId) ?? null;
    }
    return (
      customerContracts.find((c) => c.contract_status === "Active") ??
      customerContracts[0] ??
      null
    );
  }, [contracts, selectedContractId, customerContracts]);

  const slaPreview = useMemo(
    () =>
      computeSlaTargets({
        contract: activeContract,
        priority: selectedPriority,
      }),
    [activeContract, selectedPriority],
  );

  const rankedTechs = useMemo(
    () => rankTechniciansForTicket(technicians, selectedCategory),
    [technicians, selectedCategory],
  );

  const rows: TicketRow[] = useMemo(() => {
    const customerMap = new Map(customers.map((c) => [c.id, c.customer_name]));
    const techMap = new Map(technicians.map((t) => [t.id, t.technician_name]));
    const contractMap = new Map(contracts.map((c) => [c.id, c.contract_name]));

    return tickets.map((ticket) => {
      const parsed = parseCategoryLabel(ticket.category);
      const slaStatus = calcSlaStatus({
        status: ticket.status,
        targetResolutionAt: ticket.target_resolution_at,
        completedAt: ticket.completed_at,
      });
      const target = ticket.target_resolution_at
        ? new Date(ticket.target_resolution_at).getTime()
        : Number.MAX_SAFE_INTEGER;

      return {
        ...ticket,
        customerName: customerMap.get(ticket.customer_id) ?? "Unknown",
        technicianName: ticket.assigned_technician_id
          ? techMap.get(ticket.assigned_technician_id) ?? "Unassigned"
          : "Unassigned",
        contractName: ticket.contract_id
          ? contractMap.get(ticket.contract_id) ?? "—"
          : "—",
        slaStatus,
        slaSort: target,
        billable: billableLabel(ticket),
        typeLabel: parsed.type || "Ticket",
        categoryLabel: parsed.category || ticket.category || "General",
      };
    });
  }, [tickets, customers, technicians, contracts]);

  const priorityCounts = useMemo(() => {
    const open = rows.filter((r) => isOpenTicket(r.status));
    return {
      Critical: open.filter((r) => r.priority === "Critical").length,
      High: open.filter((r) => r.priority === "High").length,
      Medium: open.filter((r) => r.priority === "Medium").length,
      Low: open.filter((r) => r.priority === "Low").length,
      sla: open.filter(
        (r) => r.slaStatus === "Approaching Deadline" || r.slaStatus === "Overdue",
      ).length,
      unassigned: open.filter((r) => !r.assigned_technician_id).length,
      billableReview: open.filter(
        (r) =>
          r.billable === "Billable overage" || r.billable === "Review billable",
      ).length,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    let list = [...rows];

    if (queueFilter === "open") {
      list = list.filter((r) => isOpenTicket(r.status));
    } else if (queueFilter === "critical") {
      list = list.filter((r) => isOpenTicket(r.status) && r.priority === "Critical");
    } else if (queueFilter === "sla") {
      list = list.filter(
        (r) =>
          isOpenTicket(r.status) &&
          (r.slaStatus === "Approaching Deadline" || r.slaStatus === "Overdue"),
      );
    } else if (queueFilter === "unassigned") {
      list = list.filter((r) => isOpenTicket(r.status) && !r.assigned_technician_id);
    } else if (queueFilter === "billable") {
      list = list.filter(
        (r) =>
          r.billable === "Billable overage" ||
          r.billable === "Review billable" ||
          r.billable === "Ready to invoice",
      );
    }

    if (priorityFilter !== "all") {
      list = list.filter((r) => r.priority === priorityFilter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.ticket_number.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.technicianName.toLowerCase().includes(q) ||
          r.categoryLabel.toLowerCase().includes(q),
      );
    }

    return list.sort((a, b) => {
      if (sortMode === "newest") {
        return (
          new Date(b.opened_at ?? 0).getTime() - new Date(a.opened_at ?? 0).getTime()
        );
      }
      if (sortMode === "sla") {
        const aOpen = isOpenTicket(a.status) ? 0 : 1;
        const bOpen = isOpenTicket(b.status) ? 0 : 1;
        if (aOpen !== bOpen) return aOpen - bOpen;
        return a.slaSort - b.slaSort;
      }
      // priority (default): open first, then priority, then SLA
      const aOpen = isOpenTicket(a.status) ? 0 : 1;
      const bOpen = isOpenTicket(b.status) ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      const pr = priorityRank(a.priority) - priorityRank(b.priority);
      if (pr !== 0) return pr;
      return a.slaSort - b.slaSort;
    });
  }, [rows, queueFilter, priorityFilter, search, sortMode]);

  const selectedTicket = useMemo(
    () => rows.find((r) => r.id === selectedTicketId) ?? null,
    [rows, selectedTicketId],
  );

  const selectedTicketWork = useMemo(
    () =>
      workEntries
        .filter((e) => e.ticket_id === selectedTicketId)
        .sort((a, b) =>
          (b.work_date ?? "").localeCompare(a.work_date ?? ""),
        ),
    [workEntries, selectedTicketId],
  );

  useEffect(() => {
    if (!selectedCustomer) {
      setSelectedContractId("");
      return;
    }
    const preferred =
      customerContracts.find((c) => c.contract_status === "Active") ??
      customerContracts[0];
    setSelectedContractId(preferred?.id ?? "");
  }, [selectedCustomer, customerContracts]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAllVisible() {
    const ids = filteredRows.map((r) => r.id);
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds(
      allSelected
        ? selectedIds.filter((id) => !ids.includes(id))
        : [...new Set([...selectedIds, ...ids])],
    );
  }

  function handleBulkAssign() {
    startTransition(async () => {
      const result = await assignTickets(selectedIds, assignTechId);
      if (result.success) {
        showToast(result.message);
        setAssignTechId("");
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createServiceTicket(formData);
      if (result.success) {
        showToast(result.message);
        dialogRef.current?.close();
        await loadData();
      } else {
        setError(result.message);
      }
    });
  }

  function handlePriorityChange(ticketId: string, priority: string) {
    startTransition(async () => {
      const result = await updateTicketPriority(ticketId, priority);
      if (result.success) {
        showToast(result.message);
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    });
  }

  function handleStatusChange(ticketId: string, status: string) {
    startTransition(async () => {
      const result = await updateTicketStatus(ticketId, status);
      if (result.success) {
        showToast(result.message);
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    });
  }

  function handleBillingUpdate(
    ticketId: string,
    mode: "covered" | "review" | "billable" | "ready",
  ) {
    startTransition(async () => {
      const result = await updateTicketBillingFlags(ticketId, {
        additional_work_suspected: mode === "review",
        additional_billable_work: mode === "billable" || mode === "ready",
        invoice_status: mode === "ready" ? "Ready to Invoice" : null,
      });
      if (result.success) {
        showToast(result.message);
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    });
  }

  if (!canManage) {
    return (
      <AlertBanner
        tone="info"
        title="Manager ticket console"
        message="This service ticket workspace is designed for managers. Switch to Service Delivery Manager or Account Manager to use priority queues and dispatch tools."
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
        title="Service tickets"
        description="Priority-first dispatch for any IT MSP — auto SLA from contracts, skill-matched assignment, and clear billing status."
        action={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setError(null);
              setSelectedPriority("High");
              dialogRef.current?.showModal();
            }}
          >
            <Plus className="size-4" />
            New ticket
          </button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Critical open"
          value={priorityCounts.Critical}
          tone={priorityCounts.Critical > 0 ? "danger" : "success"}
          hint="Handle first"
        />
        <StatCard
          title="High open"
          value={priorityCounts.High}
          tone={priorityCounts.High > 0 ? "warning" : "default"}
        />
        <StatCard title="Medium open" value={priorityCounts.Medium} />
        <StatCard
          title="SLA at risk"
          value={priorityCounts.sla}
          tone={priorityCounts.sla > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Unassigned"
          value={priorityCounts.unassigned}
          tone={priorityCounts.unassigned > 0 ? "danger" : "success"}
        />
      </section>

      <div className="flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            ["all", "All"],
            ["open", "Open"],
            ["unassigned", "Unassigned"],
            ["sla", "SLA risk"],
            ["billable", "Billing review"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`btn btn-sm ${queueFilter === value ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setQueueFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="input input-bordered input-sm flex items-center gap-2">
            <Search className="size-3.5 opacity-60" />
            <input
              type="search"
              className="grow"
              placeholder="Search tickets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            className="select select-bordered select-sm"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
          >
            <option value="priority">Sort: Priority</option>
            <option value="sla">Sort: SLA deadline</option>
            <option value="newest">Sort: Newest</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
          Priority
        </span>
        {(["all", "Critical", "High", "Medium", "Low"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`btn btn-xs ${priorityFilter === value ? "btn-secondary" : "btn-outline"}`}
            onClick={() => setPriorityFilter(value)}
          >
            {value === "all" ? "All priorities" : value}
            {value !== "all" ? (
              <span className="opacity-70">
                {priorityCounts[value as keyof typeof priorityCounts]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-box border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">{selectedIds.length} selected</p>
          <label className="form-control w-full max-w-xs">
            <span className="label-text text-xs">Assign to technician</span>
            <select
              className="select select-bordered select-sm"
              value={assignTechId}
              onChange={(e) => setAssignTechId(e.target.value)}
            >
              <option value="">Select technician</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.technician_name}
                  {t.specialty ? ` · ${t.specialty}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!assignTechId || isPending}
            onClick={handleBulkAssign}
          >
            {isPending ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Assign selected"
            )}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSelectedIds([])}
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          {filteredRows.length === 0 ? (
            <EmptyState
              title="No matching tickets"
              description="Adjust filters or create a new priority-ranked ticket."
              action={
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => dialogRef.current?.showModal()}
                >
                  New ticket
                </button>
              }
            />
          ) : (
            <div className="card border bg-base-100 shadow-sm">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={
                            filteredRows.length > 0 &&
                            filteredRows.every((r) => selectedIds.includes(r.id))
                          }
                          onChange={toggleAllVisible}
                          aria-label="Select all visible tickets"
                        />
                      </th>
                      <th>Priority</th>
                      <th>Ticket</th>
                      <th>Customer</th>
                      <th>Type / category</th>
                      <th>Technician</th>
                      <th>Billing</th>
                      <th>SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const tone =
                        row.priority === "Critical"
                          ? "border-l-4 border-l-error"
                          : row.priority === "High"
                            ? "border-l-4 border-l-warning"
                            : "border-l-4 border-l-transparent";
                      const selected = selectedTicketId === row.id;

                      return (
                        <tr
                          key={row.id}
                          className={`cursor-pointer hover:bg-base-200/60 ${tone} ${selected ? "bg-primary/5" : ""}`}
                          onClick={() => setSelectedTicketId(row.id)}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={selectedIds.includes(row.id)}
                              onChange={() => toggleSelected(row.id)}
                              aria-label={`Select ${row.ticket_number}`}
                            />
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <select
                              className="select select-bordered select-xs max-w-[7.5rem]"
                              value={normalizePriority(row.priority)}
                              disabled={isPending}
                              onChange={(e) =>
                                handlePriorityChange(row.id, e.target.value)
                              }
                              aria-label={`Priority for ${row.ticket_number}`}
                            >
                              <option value="Critical">Critical</option>
                              <option value="High">High</option>
                              <option value="Medium">Medium</option>
                              <option value="Low">Low</option>
                            </select>
                          </td>
                          <td>
                            <div className="font-mono text-xs">{row.ticket_number}</div>
                            <div className="font-medium">{row.title}</div>
                            <StatusBadge status={row.status ?? "New"} />
                          </td>
                          <td>{row.customerName}</td>
                          <td>
                            <div className="text-sm">{row.typeLabel}</div>
                            <div className="text-xs text-base-content/60">
                              {row.categoryLabel}
                            </div>
                          </td>
                          <td>{row.technicianName}</td>
                          <td>
                            <span className="badge badge-ghost badge-sm">
                              {row.billable}
                            </span>
                          </td>
                          <td>
                            <StatusBadge status={row.slaStatus} />
                            <div className="mt-1 text-xs text-base-content/60">
                              {formatDateTime(row.target_resolution_at)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <aside className="card h-fit border bg-base-100 shadow-sm xl:sticky xl:top-4">
          <div className="card-body gap-3">
            <div className="flex items-start justify-between gap-2">
              <h2 className="card-title text-base">Ticket detail</h2>
              {selectedTicket ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setSelectedTicketId(null)}
                  aria-label="Close detail"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            {!selectedTicket ? (
              <EmptyState
                title="Select a ticket"
                description="Click any row to review priority, SLA, billing, and work history."
              />
            ) : (
              <>
                <div>
                  <div className="font-mono text-xs text-base-content/60">
                    {selectedTicket.ticket_number}
                  </div>
                  <h3 className="text-lg font-semibold">{selectedTicket.title}</h3>
                  <p className="text-sm text-base-content/70">
                    {selectedTicket.customerName} · {selectedTicket.contractName}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <PriorityBadge
                    priority={normalizePriority(selectedTicket.priority)}
                  />
                  <StatusBadge status={selectedTicket.status ?? "New"} />
                  <span className="badge badge-outline badge-sm">
                    {selectedTicket.billable}
                  </span>
                </div>

                <p className="text-sm text-base-content/80">
                  {selectedTicket.description || "No description provided."}
                </p>

                <dl className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-base-content/60">Type</dt>
                    <dd>{selectedTicket.typeLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-base-content/60">Category</dt>
                    <dd>{selectedTicket.categoryLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-base-content/60">Technician</dt>
                    <dd>{selectedTicket.technicianName}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-base-content/60">Opened</dt>
                    <dd>{formatDateTime(selectedTicket.opened_at)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-base-content/60">SLA due</dt>
                    <dd>{formatDateTime(selectedTicket.target_resolution_at)}</dd>
                  </div>
                </dl>

                <label className="form-control w-full">
                  <span className="label-text text-xs">Update status</span>
                  <select
                    className="select select-bordered select-sm"
                    value={selectedTicket.status ?? "New"}
                    disabled={isPending}
                    onChange={(e) =>
                      handleStatusChange(selectedTicket.id, e.target.value)
                    }
                  >
                    {TICKET_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-control w-full">
                  <span className="label-text text-xs">Billing treatment</span>
                  <select
                    className="select select-bordered select-sm"
                    value={
                      selectedTicket.billable === "Ready to invoice"
                        ? "ready"
                        : selectedTicket.billable === "Billable overage"
                          ? "billable"
                          : selectedTicket.billable === "Review billable"
                            ? "review"
                            : "covered"
                    }
                    disabled={isPending}
                    onChange={(e) =>
                      handleBillingUpdate(
                        selectedTicket.id,
                        e.target.value as "covered" | "review" | "billable" | "ready",
                      )
                    }
                  >
                    <option value="covered">Covered by contract</option>
                    <option value="review">Needs billable review</option>
                    <option value="billable">Billable overage / T&M</option>
                    <option value="ready">Ready to invoice</option>
                  </select>
                </label>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Recent work log</h4>
                  {selectedTicketWork.length === 0 ? (
                    <p className="text-xs text-base-content/60">
                      No time entries yet. Technicians log work from My Work.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {selectedTicketWork.slice(0, 5).map((entry) => (
                        <li
                          key={entry.id}
                          className="rounded-box border border-base-300 p-2 text-xs"
                        >
                          <div className="font-medium">
                            {entry.hours_worked ?? 0} hrs ·{" "}
                            {entry.included_in_contract ? "Included" : "Billable"}
                          </div>
                          <div className="text-base-content/60">
                            {entry.work_performed || "Work logged"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-h-[90vh] max-w-2xl overflow-y-auto">
          <h3 className="text-lg font-bold">New service ticket</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Set priority first. SLA response and resolution targets are calculated from the customer&apos;s contract.
          </p>
          {error ? (
            <div className="alert alert-error mt-4 text-sm">
              <span>{error}</span>
            </div>
          ) : null}

          <form action={handleSubmit} className="form-grid mt-4 grid gap-4 sm:grid-cols-2">
            <fieldset className="rounded-box border border-warning/40 bg-warning/5 p-3 sm:col-span-2">
              <legend className="px-1 text-sm font-semibold">Priority</legend>
              <div className="grid gap-2 sm:grid-cols-4">
                {(["Critical", "High", "Medium", "Low"] as const).map((level) => (
                  <label
                    key={level}
                    className={`cursor-pointer rounded-box border p-3 text-center text-sm font-medium transition ${
                      selectedPriority === level
                        ? "border-primary bg-primary/10"
                        : "border-base-300 bg-base-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name="priority"
                      value={level}
                      className="sr-only"
                      checked={selectedPriority === level}
                      onChange={() => setSelectedPriority(level)}
                    />
                    <PriorityBadge priority={level} />
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-base-content/70">
                Est. response{" "}
                <strong>
                  {responseHoursForPriority(activeContract, selectedPriority)}h
                </strong>
                {" · "}
                resolution{" "}
                <strong>
                  {resolutionHoursForPriority(activeContract, selectedPriority)}h
                </strong>
                {activeContract
                  ? ` from ${activeContract.contract_name}`
                  : " (default targets — pick a contract when possible)"}
              </p>
              <input
                type="hidden"
                name="target_response_at"
                value={slaPreview.targetResponseAt}
              />
              <input
                type="hidden"
                name="target_resolution_at"
                value={slaPreview.targetResolutionAt}
              />
            </fieldset>

            <FormField label="Title" htmlFor="title" required className="sm:col-span-2">
              <input id="title" name="title" className="input input-bordered w-full" required placeholder="Brief problem statement" />
            </FormField>

            <FormField label="Customer" htmlFor="customer_id" required>
              <select
                id="customer_id"
                name="customer_id"
                className="select select-bordered w-full"
                required
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
              >
                <option value="" disabled>
                  Select customer
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Contract (SLA source)" htmlFor="contract_id">
              <select
                id="contract_id"
                name="contract_id"
                className="select select-bordered w-full"
                value={selectedContractId}
                onChange={(e) => setSelectedContractId(e.target.value)}
              >
                <option value="">Auto / none</option>
                {customerContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contract_name}
                    {c.contract_status === "Active" ? "" : ` (${c.contract_status})`}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Ticket type" htmlFor="ticket_type">
              <select
                id="ticket_type"
                name="ticket_type"
                className="select select-bordered w-full"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                {TICKET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Category" htmlFor="category">
              <select
                id="category"
                name="category"
                className="select select-bordered w-full"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {FLEXIBLE_TICKET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Service method" htmlFor="service_method">
              <select
                id="service_method"
                name="service_method"
                className="select select-bordered w-full"
                defaultValue="Remote"
              >
                <option value="Remote">Remote</option>
                <option value="On-site">On-site</option>
                <option value="Emergency">Emergency</option>
              </select>
            </FormField>

            <FormField label="Assign technician (skill-ranked)" htmlFor="assigned_technician_id">
              <select
                id="assigned_technician_id"
                name="assigned_technician_id"
                className="select select-bordered w-full"
                defaultValue=""
              >
                <option value="">Unassigned — triage later</option>
                {rankedTechs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.technician_name}
                    {t.specialty ? ` · ${t.specialty}` : ""}
                    {isSkillMatch(t, selectedCategory) ? " · best match" : ""}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Requester" htmlFor="requester_name">
              <input
                id="requester_name"
                name="requester_name"
                className="input input-bordered w-full"
                placeholder="Who reported this?"
              />
            </FormField>

            <FormField label="Location (optional)" htmlFor="location">
              <input
                id="location"
                name="location"
                className="input input-bordered w-full"
                placeholder="Site, office, remote"
              />
            </FormField>

            <FormField label="Description" htmlFor="description" className="sm:col-span-2">
              <textarea
                id="description"
                name="description"
                className="textarea textarea-bordered w-full"
                rows={3}
                placeholder="Impact, urgency context, what already tried…"
              />
            </FormField>

            <FormField label="Billing expectation" htmlFor="additional_billable_work">
              <select
                id="additional_billable_work"
                name="additional_billable_work"
                className="select select-bordered w-full"
                defaultValue="false"
              >
                <option value="false">Covered / unknown</option>
                <option value="true">Likely billable overage</option>
              </select>
            </FormField>

            <FormField label="Needs review" htmlFor="additional_work_suspected">
              <select
                id="additional_work_suspected"
                name="additional_work_suspected"
                className="select select-bordered w-full"
                defaultValue="false"
              >
                <option value="false">No</option>
                <option value="true">Flag for billable review</option>
              </select>
            </FormField>

            <div className="modal-action sm:col-span-2">
              <button
                type="button"
                className="btn"
                onClick={() => dialogRef.current?.close()}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Create ticket"
                )}
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
