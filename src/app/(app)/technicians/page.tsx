"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  createTechnician,
  deleteTechnician,
} from "@/app/actions/technicians";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { isThisMonth } from "@/lib/dashboard-stats";
import { formatCurrency, formatHours, formatPercent } from "@/lib/format";
import { getOpenTickets } from "@/lib/manager-ops";
import { createClient } from "@/lib/supabase/client";
import type { ServiceTicket, Technician, WorkEntry } from "@/lib/types";

/** Standard available hours per month for utilization (8 hrs × 20 days). */
const MONTHLY_CAPACITY_HOURS = 160;

interface TechCard extends Technician {
  openLoad: number;
  criticalLoad: number;
  monthHours: number;
  utilizationRate: number;
}

const MANAGER_ROLES = new Set([
  "administrator",
  "service_manager",
  "account_manager",
]);

export default function TechniciansPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canManage = MANAGER_ROLES.has(activeRole);

  async function loadData() {
    const supabase = createClient();
    const [tech, t, w] = await Promise.all([
      supabase.from("technicians").select("*").order("technician_name"),
      supabase.from("service_tickets").select("*"),
      supabase.from("work_entries").select("*"),
    ]);
    setTechnicians(tech.data ?? []);
    setTickets(t.data ?? []);
    setWorkEntries(w.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const cards: TechCard[] = useMemo(() => {
    const open = getOpenTickets(tickets);
    return technicians.map((tech) => {
      const assigned = open.filter((t) => t.assigned_technician_id === tech.id);
      const monthHours = workEntries
        .filter(
          (e) => e.technician_id === tech.id && isThisMonth(e.work_date),
        )
        .reduce((sum, e) => sum + (e.hours_worked ?? 0), 0);
      const utilizationRate = Math.min(
        100,
        (monthHours / MONTHLY_CAPACITY_HOURS) * 100,
      );

      return {
        ...tech,
        openLoad: assigned.length,
        criticalLoad: assigned.filter((t) => t.priority === "Critical").length,
        monthHours,
        utilizationRate,
      };
    });
  }, [technicians, tickets, workEntries]);

  const unassignedCount = useMemo(
    () => getOpenTickets(tickets).filter((t) => !t.assigned_technician_id).length,
    [tickets],
  );

  const teamUtilization = useMemo(() => {
    const active = cards.filter((c) => c.active);
    if (active.length === 0) return null;
    return active.reduce((sum, c) => sum + c.utilizationRate, 0) / active.length;
  }, [cards]);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createTechnician(formData);
      if (result.success) {
        showToast(result.message);
        dialogRef.current?.close();
        await loadData();
      } else {
        setError(result.message);
      }
    });
  }

  function handleDelete(tech: TechCard) {
    if (
      !confirm(
        `Delete technician "${tech.technician_name}"?\n\nOpen tickets assigned to them will become unassigned. Past work history is kept.`,
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await deleteTechnician(tech.id);
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
        title="Technician capacity"
        description={`Open load, specialty, and utilization vs ${MONTHLY_CAPACITY_HOURS} available hours this month.`}
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
              Add Technician
            </button>
          ) : null
        }
      />

      {teamUtilization != null ? (
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-base-content/70">
                Team utilization (active technicians)
              </p>
              <p className="text-2xl font-semibold">
                {formatPercent(teamUtilization)}
              </p>
            </div>
            <p className="max-w-md text-xs text-base-content/60">
              Utilization = hours logged this month ÷ {MONTHLY_CAPACITY_HOURS} capacity hours.
              Over {formatPercent(85)} usually means the team is stretched.
            </p>
          </div>
        </div>
      ) : null}

      {unassignedCount > 0 ? (
        <div className="alert alert-warning text-sm">
          <span>
            {unassignedCount} unassigned open ticket{unassignedCount === 1 ? "" : "s"} in the backlog.{" "}
            <a href="/service-tickets?filter=unassigned" className="link font-medium">
              Assign now
            </a>
          </span>
        </div>
      ) : null}

      {cards.length === 0 ? (
        <EmptyState
          title="No technicians found"
          description="Add a technician to start assigning tickets and tracking utilization."
          action={
            canManage ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => dialogRef.current?.showModal()}
              >
                Add Technician
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((tech) => (
            <div key={tech.id} className="card border bg-base-100 shadow-sm">
              <div className="card-body">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="card-title text-base">{tech.technician_name}</h3>
                  <StatusBadge status={tech.active ? "Active" : "Inactive"} />
                </div>
                <p className="text-sm text-base-content/70">
                  Specialty: {tech.specialty ?? "General support"}
                </p>

                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-base-content/60">Utilization</span>
                    <span
                      className={`font-semibold ${
                        tech.utilizationRate >= 100
                          ? "text-error"
                          : tech.utilizationRate >= 85
                            ? "text-warning"
                            : "text-success"
                      }`}
                    >
                      {formatPercent(tech.utilizationRate)}
                    </span>
                  </div>
                  <progress
                    className={`progress w-full ${
                      tech.utilizationRate >= 100
                        ? "progress-error"
                        : tech.utilizationRate >= 85
                          ? "progress-warning"
                          : "progress-success"
                    }`}
                    value={tech.utilizationRate}
                    max={100}
                  />
                  <p className="mt-1 text-xs text-base-content/60">
                    {formatHours(tech.monthHours)} logged this month
                  </p>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-box bg-base-200/60 p-2">
                    <div className="text-xs text-base-content/60">Open load</div>
                    <div className={`text-lg font-semibold ${tech.openLoad >= 5 ? "text-warning" : ""}`}>
                      {tech.openLoad}
                    </div>
                  </div>
                  <div className="rounded-box bg-base-200/60 p-2">
                    <div className="text-xs text-base-content/60">Critical</div>
                    <div className={`text-lg font-semibold ${tech.criticalLoad > 0 ? "text-error" : ""}`}>
                      {tech.criticalLoad}
                    </div>
                  </div>
                  <div className="rounded-box bg-base-200/60 p-2">
                    <div className="text-xs text-base-content/60">Int. rate</div>
                    <div className="text-sm font-semibold leading-7">
                      {formatCurrency(tech.internal_hourly_cost)}
                    </div>
                  </div>
                </div>

                {canManage ? (
                  <div className="card-actions mt-2 justify-end">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-error"
                      disabled={isPending}
                      onClick={() => handleDelete(tech)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold">Add Technician</h3>
          {error ? (
            <div className="alert alert-error mt-4 text-sm">
              <span>{error}</span>
            </div>
          ) : null}
          <form action={handleSubmit} className="form-grid mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="technician_name" required className="sm:col-span-2">
              <input
                id="technician_name"
                name="technician_name"
                className="input input-bordered w-full"
                required
              />
            </FormField>
            <FormField label="Specialty" htmlFor="specialty" className="sm:col-span-2">
              <input
                id="specialty"
                name="specialty"
                className="input input-bordered w-full"
                placeholder="Networking, Security, General support…"
              />
            </FormField>
            <FormField label="Internal hourly cost" htmlFor="internal_hourly_cost" required>
              <input
                id="internal_hourly_cost"
                name="internal_hourly_cost"
                type="number"
                min="0"
                step="0.01"
                className="input input-bordered w-full"
                required
                defaultValue={75}
              />
            </FormField>
            <FormField label="Billable hourly rate (optional)" htmlFor="hourly_rate">
              <input
                id="hourly_rate"
                name="hourly_rate"
                type="number"
                min="0"
                step="0.01"
                className="input input-bordered w-full"
              />
            </FormField>
            <FormField label="Status" htmlFor="active">
              <select
                id="active"
                name="active"
                className="select select-bordered w-full"
                defaultValue="true"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
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
                  "Save Technician"
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
