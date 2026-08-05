"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createWorkEntry } from "@/app/actions/work-entries";
import { updateTicketStatus } from "@/app/actions/tickets";
import { calcSlaStatus, hoursBetween } from "@/lib/calculations";
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
import { formatDateTime, formatHours } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Profile, ServiceTicket, Technician, WorkEntry } from "@/lib/types";
import { endOfWeek, isWithinInterval, startOfWeek } from "date-fns";

export default function TechnicianWorkspacePage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hoursWorked, setHoursWorked] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    setProfile(profileData);

    const { data: techData } = await supabase
      .from("technicians")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();

    setTechnician(techData);

    if (techData) {
      const [t, w] = await Promise.all([
        supabase
          .from("service_tickets")
          .select("*")
          .eq("assigned_technician_id", techData.id)
          .order("opened_at", { ascending: false }),
        supabase
          .from("work_entries")
          .select("*")
          .eq("technician_id", techData.id)
          .order("work_date", { ascending: false }),
      ]);
      setTickets(t.data ?? []);
      setWorkEntries(w.data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  const assignedOpen = useMemo(
    () => tickets.filter((t) => isOpenTicket(t.status)),
    [tickets],
  );

  const criticalTickets = useMemo(
    () => assignedOpen.filter((t) => t.priority === "Critical"),
    [assignedOpen],
  );

  const slaAtRisk = useMemo(
    () =>
      assignedOpen.filter((t) => {
        const sla = calcSlaStatus({
          status: t.status,
          targetResolutionAt: t.target_resolution_at,
          completedAt: t.completed_at,
        });
        return sla === "Approaching Deadline" || sla === "Overdue";
      }),
    [assignedOpen],
  );

  const hoursThisWeek = useMemo(() => {
    const now = new Date();
    return workEntries
      .filter((e) => {
        if (!e.work_date) return false;
        const date = new Date(e.work_date);
        return isWithinInterval(date, {
          start: startOfWeek(now),
          end: endOfWeek(now),
        });
      })
      .reduce((sum, e) => sum + (e.hours_worked ?? 0), 0);
  }, [workEntries]);

  useEffect(() => {
    if (startTime && endTime) {
      const hours = hoursBetween(startTime, endTime);
      if (hours != null) {
        setHoursWorked(hours.toString());
      }
    }
  }, [startTime, endTime]);

  function handleWorkEntry(formData: FormData) {
    if (!technician || !selectedTicket) return;
    formData.set("technician_id", technician.id);
    formData.set("customer_id", selectedTicket.customer_id);
    formData.set("contract_id", selectedTicket.contract_id ?? "");
    formData.set("ticket_id", selectedTicket.id);

    setError(null);
    startTransition(async () => {
      const result = await createWorkEntry(formData);
      if (result.success) {
        showToast(result.message);
        setStartTime("");
        setEndTime("");
        setHoursWorked("");
        await loadData();
      } else {
        setError(result.message);
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

  if (activeRole !== "technician" && activeRole !== "administrator") {
    return (
      <AlertBanner
        tone="info"
        title="Technician workspace"
        message="This workspace is designed for technicians. Switch roles or use the Demo Role Switcher to preview this view."
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

  if (!technician) {
    return (
      <EmptyState
        title="No technician profile linked"
        description="Your account is not linked to a technician record. Contact an administrator to assign your technician profile."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? technician.technician_name}`}
        description="View assigned tickets, record work, and update ticket status."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Open assignments" value={assignedOpen.length} />
        <StatCard title="Critical tickets" value={criticalTickets.length} tone="danger" />
        <StatCard title="SLA at risk" value={slaAtRisk.length} tone="warning" />
        <StatCard title="Hours this week" value={hoursThisWeek.toFixed(1)} tone="info" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Assigned tickets</h2>
            {assignedOpen.length === 0 ? (
              <EmptyState title="No open tickets" description="Assigned tickets will appear here." />
            ) : (
              <div className="space-y-3">
                {assignedOpen.map((ticket) => (
                  <div key={ticket.id} className="rounded-box border border-base-300 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{ticket.title}</p>
                        <p className="text-xs text-base-content/60">{ticket.ticket_number}</p>
                      </div>
                      <PriorityBadge priority={ticket.priority ?? "Medium"} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge status={ticket.status ?? "New"} />
                      <StatusBadge
                        status={calcSlaStatus({
                          status: ticket.status,
                          targetResolutionAt: ticket.target_resolution_at,
                          completedAt: ticket.completed_at,
                        })}
                      />
                    </div>
                    <p className="mt-2 text-xs text-base-content/60">
                      Due: {formatDateTime(ticket.target_resolution_at)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <select
                        className="select select-bordered select-xs"
                        defaultValue={ticket.status ?? "New"}
                        onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                      >
                        <option value="Assigned">Assigned</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Waiting on Customer">Waiting on Customer</option>
                        <option value="Completed">Completed</option>
                      </select>
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        onClick={() => setSelectedTicketId(ticket.id)}
                      >
                        Log work
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Record work entry</h2>
            {error ? <div className="alert alert-error text-sm"><span>{error}</span></div> : null}
            <form action={handleWorkEntry} className="form-grid grid gap-4">
              <FormField label="Ticket" htmlFor="ticket_id" required>
                <select
                  id="ticket_id"
                  className="select select-bordered w-full"
                  required
                  value={selectedTicketId}
                  onChange={(e) => setSelectedTicketId(e.target.value)}
                >
                  <option value="" disabled>Select ticket</option>
                  {assignedOpen.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.ticket_number} — {t.title}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Work date" htmlFor="work_date">
                <input
                  id="work_date"
                  name="work_date"
                  type="date"
                  className="input input-bordered w-full"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Start time" htmlFor="start_time">
                  <input
                    id="start_time"
                    name="start_time"
                    type="time"
                    className="input input-bordered w-full"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </FormField>
                <FormField label="End time" htmlFor="end_time">
                  <input
                    id="end_time"
                    name="end_time"
                    type="time"
                    className="input input-bordered w-full"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </FormField>
              </div>
              <FormField label="Hours worked" htmlFor="hours_worked" hint="Auto-calculated from start/end times when available.">
                <input
                  id="hours_worked"
                  name="hours_worked"
                  type="number"
                  min="0"
                  step="0.25"
                  className="input input-bordered w-full"
                  value={hoursWorked}
                  onChange={(e) => setHoursWorked(e.target.value)}
                />
              </FormField>
              <FormField label="Work performed" htmlFor="work_performed">
                <textarea id="work_performed" name="work_performed" className="textarea textarea-bordered w-full" rows={2} />
              </FormField>
              <FormField label="Resolution notes" htmlFor="resolution_notes">
                <textarea id="resolution_notes" name="resolution_notes" className="textarea textarea-bordered w-full" rows={2} />
              </FormField>
              <FormField label="Service method" htmlFor="service_method">
                <select id="service_method" name="service_method" className="select select-bordered w-full" defaultValue="Remote">
                  <option value="Remote">Remote</option>
                  <option value="On-site">On-site</option>
                </select>
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Parts cost" htmlFor="parts_cost">
                  <input id="parts_cost" name="parts_cost" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                </FormField>
                <FormField label="Software cost" htmlFor="software_cost">
                  <input id="software_cost" name="software_cost" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                </FormField>
                <FormField label="Equipment cost" htmlFor="equipment_cost">
                  <input id="equipment_cost" name="equipment_cost" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                </FormField>
                <FormField label="Travel cost" htmlFor="travel_cost">
                  <input id="travel_cost" name="travel_cost" type="number" min="0" step="0.01" className="input input-bordered w-full" />
                </FormField>
              </div>
              <FormField label="Other direct cost" htmlFor="other_cost">
                <input id="other_cost" name="other_cost" type="number" min="0" step="0.01" className="input input-bordered w-full" />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Included in contract" htmlFor="included_in_contract">
                  <select id="included_in_contract" name="included_in_contract" className="select select-bordered w-full" defaultValue="true">
                    <option value="true">Yes</option>
                    <option value="false">No — billable</option>
                  </select>
                </FormField>
                <FormField label="Additional approval needed" htmlFor="additional_approval_required">
                  <select id="additional_approval_required" name="additional_approval_required" className="select select-bordered w-full" defaultValue="false">
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </FormField>
              </div>
              <FormField label="Update ticket status" htmlFor="ticket_status">
                <select id="ticket_status" name="ticket_status" className="select select-bordered w-full" defaultValue="In Progress">
                  <option value="In Progress">In Progress</option>
                  <option value="Waiting on Customer">Waiting on Customer</option>
                  <option value="Completed">Completed</option>
                </select>
              </FormField>
              <button type="submit" className="btn btn-primary" disabled={isPending || !selectedTicketId}>
                {isPending ? <span className="loading loading-spinner loading-sm" /> : "Save Work Entry"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {workEntries.length > 0 ? (
        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Recent work</h2>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Work performed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workEntries.slice(0, 8).map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.work_date ?? "—"}</td>
                      <td>{formatHours(entry.hours_worked)}</td>
                      <td>{entry.work_performed ?? "—"}</td>
                      <td>
                        <StatusBadge status={entry.included_in_contract ? "Included" : "Billable"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
