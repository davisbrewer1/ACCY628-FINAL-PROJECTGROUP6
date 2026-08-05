"use client";

import { FormField } from "@/components/FormField";
import { PriorityBadge } from "@/components/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import type { ServiceTicket } from "@/lib/types";
import { CirclePlay, Navigation, Pause, Square, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

export type WorkEntryModalPhase = "timer" | "form";

interface WorkEntryModalProps {
  open: boolean;
  onClose: () => void;
  tickets: ServiceTicket[];
  selectedTicketId: string;
  onSelectedTicketChange: (ticketId: string) => void;
  workDate: string;
  onWorkDateChange: (value: string) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  endTime: string;
  onEndTimeChange: (value: string) => void;
  hoursWorked: string;
  onHoursWorkedChange: (value: string) => void;
  workPerformed: string;
  onWorkPerformedChange: (value: string) => void;
  serviceMethod: string;
  onServiceMethodChange: (value: string) => void;
  ticketStatus: string;
  onTicketStatusChange: (value: string) => void;
  error: string | null;
  isPending: boolean;
  onSubmit: (formData: FormData) => void;
  mode?: "create" | "edit";
  title?: string;
  phase: WorkEntryModalPhase;
  onPhaseChange: (phase: WorkEntryModalPhase) => void;
  onEnRoute: () => void;
  onStartOnSite: () => void;
  onPauseJob: () => void;
  onResumeJob: () => void;
  onEndJob: () => void;
  sessionEnRoute: boolean;
  sessionPaused: boolean;
  /** Active (non-paused) seconds already banked + current segment start epoch ms */
  bankedWorkedSeconds: number;
  segmentStartedAt: number | null;
  pauseCount: number;
}

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function WorkEntryModal({
  open,
  onClose,
  tickets,
  selectedTicketId,
  onSelectedTicketChange,
  workDate,
  onWorkDateChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  hoursWorked,
  onHoursWorkedChange,
  workPerformed,
  onWorkPerformedChange,
  serviceMethod,
  onServiceMethodChange,
  ticketStatus,
  onTicketStatusChange,
  error,
  isPending,
  onSubmit,
  mode = "create",
  title,
  phase,
  onPhaseChange,
  onEnRoute,
  onStartOnSite,
  onPauseJob,
  onResumeJob,
  onEndJob,
  sessionEnRoute,
  sessionPaused,
  bankedWorkedSeconds,
  segmentStartedAt,
  pauseCount,
}: WorkEntryModalProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId);
  const sessionActive = Boolean(startTime) && !endTime;


  useEffect(() => {
    if (!open) {
      setElapsedSeconds(0);
      return;
    }

    if (endTime) {
      setElapsedSeconds(bankedWorkedSeconds);
      return;
    }

    if (!sessionActive) {
      setElapsedSeconds(0);
      return;
    }

    function tick() {
      let total = bankedWorkedSeconds;
      if (!sessionPaused && segmentStartedAt != null) {
        total += Math.max(
          0,
          Math.floor((Date.now() - segmentStartedAt) / 1000),
        );
      }
      setElapsedSeconds(total);
    }

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [
    open,
    sessionActive,
    sessionPaused,
    bankedWorkedSeconds,
    segmentStartedAt,
    endTime,
  ]);

  if (!open) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("ticket_id", selectedTicketId);
    formData.set("work_performed", workPerformed);
    formData.set("service_method", serviceMethod);
    formData.set("ticket_status", ticketStatus);
    onSubmit(formData);
  }

  const heading =
    title ??
    (mode === "edit"
      ? "Edit work entry"
      : phase === "timer"
        ? "On-site session"
        : "Record work entry");

  const subtitle =
    mode === "edit"
      ? "Update logged time, notes, or ticket status for this entry."
      : phase === "timer"
        ? "Mark On the way before arrival, Start when on site, Pause if you leave, then End when complete."
        : "Review times and finish the work notes before saving.";

  const statusLabel = endTime
    ? "Session ended"
    : sessionPaused
      ? "Paused — away from job"
      : sessionActive
        ? "On site"
        : sessionEnRoute
          ? "On the way"
          : "Ready to start";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
        aria-label="Close work entry dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-entry-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-cyan-500/30 bg-slate-900 p-5 shadow-2xl shadow-cyan-950/40"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="work-entry-title" className="text-lg font-semibold text-white">
              {heading}
            </h2>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square text-slate-300"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {error ? (
          <div className="alert alert-error mb-4 text-sm">
            <span>{error}</span>
          </div>
        ) : null}

        {phase === "timer" && mode === "create" ? (
          <div className="space-y-5">
            {selectedTicket ? (
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm text-cyan-300">
                    {selectedTicket.ticket_number}
                  </p>
                  <PriorityBadge priority={selectedTicket.priority} />
                  <StatusBadge status={selectedTicket.status} />
                </div>
                <p className="mt-2 text-base font-medium text-white">
                  {selectedTicket.title}
                </p>
                {selectedTicket.description ? (
                  <p className="mt-2 line-clamp-3 text-sm text-slate-400">
                    {selectedTicket.description}
                  </p>
                ) : null}
              </div>
            ) : (
              <FormField label="Ticket" htmlFor="timer_ticket_id" required>
                <select
                  id="timer_ticket_id"
                  className="select select-bordered w-full border-slate-600 bg-slate-950"
                  required
                  value={selectedTicketId}
                  onChange={(e) => onSelectedTicketChange(e.target.value)}
                >
                  <option value="" disabled>
                    Select ticket
                  </option>
                  {tickets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.ticket_number} — {t.title}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <div
              className={`rounded-xl border p-5 text-center ${
                sessionPaused
                  ? "border-amber-400/35 bg-gradient-to-br from-slate-950 to-amber-950/40"
                  : sessionEnRoute && !sessionActive
                    ? "border-sky-400/35 bg-gradient-to-br from-slate-950 to-sky-950/40"
                    : "border-cyan-500/25 bg-gradient-to-br from-slate-950 to-cyan-950/40"
              }`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                  sessionPaused
                    ? "text-amber-200/90"
                    : sessionEnRoute && !sessionActive
                      ? "text-sky-200/90"
                      : "text-cyan-200/80"
                }`}
              >
                {statusLabel}
              </p>
              <p className="mt-3 font-mono text-4xl tracking-tight text-white">
                {sessionActive || (startTime && endTime)
                  ? formatElapsed(elapsedSeconds)
                  : sessionEnRoute
                    ? "En route"
                    : "00:00:00"}
              </p>
              <div className="mt-3 space-y-1 text-sm text-slate-400">
                <p>Date: {workDate || "—"}</p>
                <p>
                  Start: {startTime || "—"}
                  {endTime ? ` · End: ${endTime}` : ""}
                </p>
                {pauseCount > 0 ? (
                  <p>
                    Pauses: {pauseCount}
                    {sessionPaused ? " · timer frozen while away" : ""}
                  </p>
                ) : null}
                {hoursWorked ? <p>Hours: {hoursWorked}</p> : null}
              </div>
            </div>

            {!sessionActive && !endTime ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="btn h-12 border-0 bg-sky-500 text-slate-950 hover:bg-sky-400"
                  disabled={!selectedTicketId || sessionEnRoute || isPending}
                  onClick={onEnRoute}
                >
                  <Navigation className="size-5" />
                  On the way
                </button>
                <button
                  type="button"
                  className="btn h-12 border-0 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                  disabled={!selectedTicketId}
                  onClick={onStartOnSite}
                >
                  <CirclePlay className="size-5" />
                  Start — on site
                </button>
              </div>
            ) : null}

            {sessionActive ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {sessionPaused ? (
                  <button
                    type="button"
                    className="btn h-12 border-0 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                    onClick={onResumeJob}
                  >
                    <CirclePlay className="size-5" />
                    Resume — back on site
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn h-12 border-0 bg-amber-500 text-slate-950 hover:bg-amber-400"
                    onClick={onPauseJob}
                  >
                    <Pause className="size-5" />
                    Pause — leaving site
                  </button>
                )}
                <button
                  type="button"
                  className="btn h-12 border-0 bg-rose-500 text-white hover:bg-rose-400"
                  onClick={onEndJob}
                >
                  <Square className="size-4 fill-current" />
                  End — complete
                </button>
              </div>
            ) : null}

            {endTime ? (
              <button
                type="button"
                className="btn h-12 w-full border-0 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                onClick={() => onPhaseChange("form")}
              >
                Continue to work details
              </button>
            ) : null}

            <div className="flex flex-wrap justify-between gap-2 pt-1">
              <button
                type="button"
                className="btn btn-ghost btn-sm text-slate-400"
                onClick={() => onPhaseChange("form")}
              >
                Enter details manually
              </button>
              <button type="button" className="btn btn-ghost text-slate-300" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="form-grid grid gap-4">
            {mode === "create" && startTime && endTime ? (
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                Session recorded {startTime} – {endTime}
                {hoursWorked ? ` (${hoursWorked} hrs active)` : ""}
                {pauseCount > 0
                  ? ` · ${pauseCount} pause${pauseCount === 1 ? "" : "s"} excluded from hours`
                  : ""}
                . Add notes below and save.
              </div>
            ) : null}

            <FormField label="Ticket" htmlFor="ticket_id" required>
              <select
                id="ticket_id"
                className="select select-bordered w-full border-slate-600 bg-slate-950"
                required
                value={selectedTicketId}
                onChange={(e) => onSelectedTicketChange(e.target.value)}
              >
                <option value="" disabled>
                  Select ticket
                </option>
                {tickets.map((t) => (
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
                className="input input-bordered w-full border-slate-600 bg-slate-950"
                value={workDate}
                onChange={(e) => onWorkDateChange(e.target.value)}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Start time" htmlFor="start_time">
                <input
                  id="start_time"
                  name="start_time"
                  type="time"
                  className="input input-bordered w-full border-slate-600 bg-slate-950"
                  value={startTime}
                  onChange={(e) => onStartTimeChange(e.target.value)}
                />
              </FormField>
              <FormField label="End time" htmlFor="end_time">
                <input
                  id="end_time"
                  name="end_time"
                  type="time"
                  className="input input-bordered w-full border-slate-600 bg-slate-950"
                  value={endTime}
                  onChange={(e) => onEndTimeChange(e.target.value)}
                />
              </FormField>
            </div>
            <FormField
              label="Hours worked"
              htmlFor="hours_worked"
              hint="From active on-site time (pauses excluded) when using the timer."
            >
              <input
                id="hours_worked"
                name="hours_worked"
                type="number"
                min="0"
                step="0.25"
                className="input input-bordered w-full border-slate-600 bg-slate-950"
                value={hoursWorked}
                onChange={(e) => onHoursWorkedChange(e.target.value)}
              />
            </FormField>
            <FormField label="Work performed" htmlFor="work_performed">
              <textarea
                id="work_performed"
                name="work_performed"
                className="textarea textarea-bordered w-full border-slate-600 bg-slate-950"
                rows={2}
                value={workPerformed}
                onChange={(e) => onWorkPerformedChange(e.target.value)}
              />
            </FormField>
            <FormField label="Service method" htmlFor="service_method">
              <select
                id="service_method"
                name="service_method"
                className="select select-bordered w-full border-slate-600 bg-slate-950"
                value={serviceMethod}
                onChange={(e) => onServiceMethodChange(e.target.value)}
              >
                <option value="Remote">Remote</option>
                <option value="On-site">On-site</option>
                <option value="Phone">Phone</option>
                <option value="Email">Email</option>
              </select>
            </FormField>
            <FormField label="Update ticket status" htmlFor="ticket_status">
              <select
                id="ticket_status"
                name="ticket_status"
                className="select select-bordered w-full border-slate-600 bg-slate-950"
                value={ticketStatus}
                onChange={(e) => onTicketStatusChange(e.target.value)}
              >
                <option value="">Leave ticket status unchanged</option>
                <option value="In Progress">In Progress</option>
                <option value="Waiting on Customer">Waiting on Customer</option>
                <option value="Completed">Completed</option>
              </select>
            </FormField>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {mode === "create" ? (
                <button
                  type="button"
                  className="btn btn-ghost text-slate-300"
                  onClick={() => onPhaseChange("timer")}
                >
                  Back to timer
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost text-slate-300" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn border-0 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                disabled={isPending || !selectedTicketId}
              >
                {isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : mode === "edit" ? (
                  "Save changes"
                ) : (
                  "Save Work Entry"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
