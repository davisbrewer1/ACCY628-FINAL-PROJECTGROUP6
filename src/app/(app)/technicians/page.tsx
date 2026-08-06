"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
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
import { formatCurrency, formatDate, formatHours, formatPercent } from "@/lib/format";
import { getOpenTickets } from "@/lib/manager-ops";
import { createClient } from "@/lib/supabase/client";
import {
  computeTechnicianPerformance,
  formatResponseDuration,
  formatStarRating,
} from "@/lib/technician-metrics";
import type { ServiceTicket, Technician, TicketRating, WorkEntry } from "@/lib/types";

/** Standard available hours per month for utilization (8 hrs × 20 days). */
const MONTHLY_CAPACITY_HOURS = 160;

interface TechCard extends Technician {
  openLoad: number;
  criticalLoad: number;
  monthHours: number;
  utilizationRate: number;
  avgRating: number | null;
  avgResponseHours: number | null;
  responseSampleSize: number;
  ratingSampleSize: number;
  recentComments: Array<{ rating: number; comment: string; at: string }>;
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
  const [ticketRatings, setTicketRatings] = useState<TicketRating[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canManage = MANAGER_ROLES.has(activeRole);

  async function loadData() {
    const supabase = createClient();
    const [tech, t, w, ratingsRes] = await Promise.all([
      supabase.from("technicians").select("*").order("technician_name"),
      supabase.from("service_tickets").select("*"),
      supabase.from("work_entries").select("*"),
      supabase
        .from("ticket_ratings")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    setTechnicians(tech.data ?? []);
    setTickets(t.data ?? []);
    setWorkEntries(w.data ?? []);
    setTicketRatings((ratingsRes.data ?? []) as TicketRating[]);
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
      const performance = computeTechnicianPerformance(
        tech.id,
        tickets,
        ticketRatings,
      );
      const recentComments = ticketRatings
        .filter(
          (item) =>
            item.technician_id === tech.id &&
            Boolean(item.comment?.trim()),
        )
        .slice(0, 2)
        .map((item) => ({
          rating: item.rating,
          comment: item.comment!.trim(),
          at: item.created_at,
        }));

      return {
        ...tech,
        openLoad: assigned.length,
        criticalLoad: assigned.filter((t) => t.priority === "Critical").length,
        monthHours,
        utilizationRate,
        avgRating: performance.avgRating,
        avgResponseHours: performance.avgResponseHours,
        responseSampleSize: performance.responseSampleSize,
        ratingSampleSize: performance.ratingSampleSize,
        recentComments,
      };
    });
  }, [technicians, tickets, workEntries, ticketRatings]);

  const unassignedCount = useMemo(
    () => getOpenTickets(tickets).filter((t) => !t.assigned_technician_id).length,
    [tickets],
  );

  const teamUtilization = useMemo(() => {
    const active = cards.filter((c) => c.active);
    if (active.length === 0) return null;
    return active.reduce((sum, c) => sum + c.utilizationRate, 0) / active.length;
  }, [cards]);

  const teamAvgRating = useMemo(() => {
    const activeIds = new Set(
      cards.filter((c) => c.active).map((c) => c.id),
    );
    const scores = ticketRatings
      .filter((item) => item.technician_id && activeIds.has(item.technician_id))
      .map((item) => item.rating)
      .filter((score) => Number.isFinite(score));
    if (scores.length === 0) return null;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }, [cards, ticketRatings]);

  const teamRatingCount = useMemo(() => {
    const activeIds = new Set(
      cards.filter((c) => c.active).map((c) => c.id),
    );
    return ticketRatings.filter(
      (item) => item.technician_id && activeIds.has(item.technician_id),
    ).length;
  }, [cards, ticketRatings]);

  const teamAvgResponse = useMemo(() => {
    const withResp = cards.filter((c) => c.active && c.avgResponseHours != null);
    if (withResp.length === 0) return null;
    return (
      withResp.reduce((sum, c) => sum + (c.avgResponseHours ?? 0), 0) /
      withResp.length
    );
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
        description="Open load, utilization, client portal star ratings, and average ticket response time."
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

      <div className="grid gap-3 sm:grid-cols-3">
        {teamUtilization != null ? (
          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <p className="text-sm font-medium text-base-content/70">
              Team utilization
            </p>
            <p className="text-2xl font-semibold">{formatPercent(teamUtilization)}</p>
            <p className="mt-1 text-xs text-base-content/60">
              Hours logged ÷ {MONTHLY_CAPACITY_HOURS} capacity hours
            </p>
          </div>
        ) : null}
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-sm font-medium text-base-content/70">
            Team avg rating
          </p>
          <p className="text-2xl font-semibold">{formatStarRating(teamAvgRating)}</p>
          <p className="mt-1 text-xs text-base-content/60">
            {teamRatingCount > 0
              ? `From ${teamRatingCount} client rating${teamRatingCount === 1 ? "" : "s"} on closed tickets`
              : "No client ratings submitted yet"}
          </p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <p className="text-sm font-medium text-base-content/70">
            Team avg response
          </p>
          <p className="text-2xl font-semibold">
            {formatResponseDuration(teamAvgResponse)}
          </p>
          <p className="mt-1 text-xs text-base-content/60">
            Opened → first response (responded_at) on assigned tickets
          </p>
        </div>
      </div>

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

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-box border border-base-300 bg-base-200/50 p-3">
                    <div className="flex items-center gap-1 text-xs text-base-content/60">
                      <Star className="size-3.5 fill-warning text-warning" />
                      Avg rating
                    </div>
                    <p className="mt-1 text-xl font-semibold">
                      {formatStarRating(tech.avgRating)}
                    </p>
                    <p className="text-[11px] text-base-content/50">
                      {tech.ratingSampleSize > 0
                        ? `Based on ${tech.ratingSampleSize} client rating${tech.ratingSampleSize === 1 ? "" : "s"}`
                        : "No client ratings yet"}
                    </p>
                  </div>
                  <div className="rounded-box border border-base-300 bg-base-200/50 p-3">
                    <div className="text-xs text-base-content/60">Avg response</div>
                    <p className="mt-1 text-xl font-semibold">
                      {formatResponseDuration(tech.avgResponseHours)}
                    </p>
                    <p className="text-[11px] text-base-content/50">
                      {tech.responseSampleSize > 0
                        ? `Avg of ${tech.responseSampleSize} responded ticket${tech.responseSampleSize === 1 ? "" : "s"}`
                        : "No responded_at timestamps yet"}
                    </p>
                  </div>
                </div>

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

                {tech.recentComments.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-base-content/55">
                      Recent client feedback
                    </p>
                    {tech.recentComments.map((item) => (
                      <div
                        key={`${item.at}-${item.comment.slice(0, 24)}`}
                        className="rounded-box border border-base-300 bg-base-200/40 px-3 py-2"
                      >
                        <p className="text-xs text-base-content/55">
                          {item.rating}/5 · {formatDate(item.at)}
                        </p>
                        <p className="mt-0.5 text-sm text-base-content/80">
                          “{item.comment}”
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

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
