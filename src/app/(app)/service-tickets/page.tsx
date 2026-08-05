"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { assignTickets, createServiceTicket } from "@/app/actions/tickets";
import { calcSlaStatus } from "@/lib/calculations";
import { isOpenTicket } from "@/lib/dashboard-stats";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Customer, ServiceTicket, Technician } from "@/lib/types";
import { TICKET_CATEGORIES } from "@/lib/types";

interface TicketRow extends ServiceTicket {
  customerName: string;
  technicianName: string;
  slaStatus: ReturnType<typeof calcSlaStatus>;
  slaSort: number;
}

export default function ServiceTicketsPage() {
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter") ?? "all";
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assignTechId, setAssignTechId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData() {
    const supabase = createClient();
    const [c, co, tech, t] = await Promise.all([
      supabase.from("customers").select("*").order("customer_name"),
      supabase.from("contracts").select("*"),
      supabase.from("technicians").select("*").eq("active", true),
      supabase.from("service_tickets").select("*").order("opened_at", { ascending: false }),
    ]);
    setCustomers(c.data ?? []);
    setContracts(co.data ?? []);
    setTechnicians(tech.data ?? []);
    setTickets(t.data ?? []);
    setSelectedIds([]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const customerContracts = useMemo(
    () => contracts.filter((c) => c.customer_id === selectedCustomer),
    [contracts, selectedCustomer],
  );

  const rows: TicketRow[] = useMemo(() => {
    const customerMap = new Map(customers.map((c) => [c.id, c.customer_name]));
    const techMap = new Map(technicians.map((t) => [t.id, t.technician_name]));
    return tickets.map((ticket) => {
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
        slaStatus,
        slaSort: target,
      };
    });
  }, [tickets, customers, technicians]);

  const filteredRows = useMemo(() => {
    let list = [...rows];
    if (filter === "open") {
      list = list.filter((r) => isOpenTicket(r.status));
    } else if (filter === "critical") {
      list = list.filter((r) => isOpenTicket(r.status) && r.priority === "Critical");
    } else if (filter === "sla") {
      list = list.filter(
        (r) =>
          isOpenTicket(r.status) &&
          (r.slaStatus === "Approaching Deadline" || r.slaStatus === "Overdue"),
      );
    } else if (filter === "unassigned") {
      list = list.filter((r) => isOpenTicket(r.status) && !r.assigned_technician_id);
    }

    return list.sort((a, b) => {
      const aOpen = isOpenTicket(a.status) ? 0 : 1;
      const bOpen = isOpenTicket(b.status) ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      return a.slaSort - b.slaSort;
    });
  }, [rows, filter]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleAllVisible() {
    const ids = filteredRows.map((r) => r.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter((id) => !ids.includes(id)) : [
      ...new Set([...selectedIds, ...ids]),
    ]);
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

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  const filterLabels: Record<string, string> = {
    open: "Open tickets",
    critical: "Critical open tickets",
    sla: "SLA at risk",
    unassigned: "Unassigned tickets",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service tickets"
        description="Assign work, chase SLAs, and keep billable flags out of the way until needed."
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => dialogRef.current?.showModal()}>
            <Plus className="size-4" />
            Add Ticket
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {[
          ["all", "All"],
          ["open", "Open"],
          ["unassigned", "Unassigned"],
          ["sla", "SLA at risk"],
          ["critical", "Critical"],
        ].map(([value, label]) => (
          <a
            key={value}
            href={value === "all" ? "/service-tickets" : `/service-tickets?filter=${value}`}
            className={`btn btn-sm ${filter === value || (value === "all" && filter === "all") ? "btn-primary" : "btn-ghost"}`}
          >
            {label}
          </a>
        ))}
      </div>

      {filter !== "all" && filterLabels[filter] ? (
        <div className="alert alert-info text-sm py-2">
          <span>Filtered: {filterLabels[filter]} · Sorted by SLA deadline</span>
        </div>
      ) : null}

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
                <option key={t.id} value={t.id}>{t.technician_name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!assignTechId || isPending}
            onClick={handleBulkAssign}
          >
            {isPending ? <span className="loading loading-spinner loading-sm" /> : "Assign selected"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds([])}>
            Clear
          </button>
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <EmptyState
          title="No matching tickets"
          description="Create a ticket or clear the active filter."
          action={
            <button type="button" className="btn btn-primary" onClick={() => dialogRef.current?.showModal()}>
              Add Ticket
            </button>
          }
        />
      ) : (
        <div className="card border bg-base-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="table table-zebra">
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
                  <th>Ticket #</th>
                  <th>Customer</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Technician</th>
                  <th>Status</th>
                  <th>SLA deadline</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleSelected(row.id)}
                        aria-label={`Select ${row.ticket_number}`}
                      />
                    </td>
                    <td className="font-mono text-sm">
                      <div>{row.ticket_number}</div>
                      {(row.ai_involved || row.cybersecurity_incident) && (
                        <div className="mt-1 flex gap-1">
                          {row.ai_involved ? (
                            <span className="badge badge-ghost badge-xs">AI</span>
                          ) : null}
                          {row.cybersecurity_incident ? (
                            <span className="badge badge-ghost badge-xs">Security</span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td>{row.customerName}</td>
                    <td className="font-medium">
                      <div>{row.title}</div>
                      {row.location ? (
                        <div className="text-xs text-base-content/60">{row.location}</div>
                      ) : null}
                    </td>
                    <td><PriorityBadge priority={row.priority ?? "Medium"} /></td>
                    <td>{row.technicianName}</td>
                    <td><StatusBadge status={row.status ?? "New"} /></td>
                    <td>{formatDateTime(row.target_resolution_at)}</td>
                    <td><StatusBadge status={row.slaStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-h-[90vh] max-w-3xl overflow-y-auto">
          <h3 className="text-lg font-bold">Add Service Ticket</h3>
          {error ? <div className="alert alert-error mt-4 text-sm"><span>{error}</span></div> : null}
          <form action={handleSubmit} className="form-grid mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label="Title" htmlFor="title" required className="sm:col-span-2">
              <input id="title" name="title" className="input input-bordered w-full" required />
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
                <option value="" disabled>Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.customer_name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Contract" htmlFor="contract_id">
              <select id="contract_id" name="contract_id" className="select select-bordered w-full" defaultValue="">
                <option value="">None</option>
                {customerContracts.map((c) => (
                  <option key={c.id} value={c.id}>{c.contract_name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Category" htmlFor="category">
              <select id="category" name="category" className="select select-bordered w-full" defaultValue="">
                <option value="">Select category</option>
                {TICKET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Priority" htmlFor="priority">
              <select id="priority" name="priority" className="select select-bordered w-full" defaultValue="Medium">
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </FormField>
            <FormField label="Service method" htmlFor="service_method">
              <select id="service_method" name="service_method" className="select select-bordered w-full" defaultValue="Remote">
                <option value="Remote">Remote</option>
                <option value="On-site">On-site</option>
                <option value="Emergency">Emergency</option>
              </select>
            </FormField>
            <FormField label="Assigned technician" htmlFor="assigned_technician_id">
              <select id="assigned_technician_id" name="assigned_technician_id" className="select select-bordered w-full" defaultValue="">
                <option value="">Unassigned</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.technician_name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Location" htmlFor="location">
              <input id="location" name="location" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Requester" htmlFor="requester_name">
              <input id="requester_name" name="requester_name" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Status" htmlFor="status">
              <select id="status" name="status" className="select select-bordered w-full" defaultValue="New">
                <option value="New">New</option>
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
              </select>
            </FormField>
            <FormField label="Target resolution" htmlFor="target_resolution_at">
              <input id="target_resolution_at" name="target_resolution_at" type="datetime-local" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Description" htmlFor="description" className="sm:col-span-2">
              <textarea id="description" name="description" className="textarea textarea-bordered w-full" rows={3} />
            </FormField>
            <FormField label="AI involved" htmlFor="ai_involved">
              <select id="ai_involved" name="ai_involved" className="select select-bordered w-full" defaultValue="false">
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </FormField>
            <FormField label="Cybersecurity incident" htmlFor="cybersecurity_incident">
              <select id="cybersecurity_incident" name="cybersecurity_incident" className="select select-bordered w-full" defaultValue="false">
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </FormField>
            <div className="modal-action sm:col-span-2">
              <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <span className="loading loading-spinner loading-sm" /> : "Create Ticket"}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button type="submit">close</button></form>
      </dialog>
    </div>
  );
}
