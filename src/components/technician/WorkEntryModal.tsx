"use client";

import { FormField } from "@/components/FormField";
import { PriorityBadge } from "@/components/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import type { PartUsageInput } from "@/lib/autoCostCalculator";
import { formatCurrency } from "@/lib/format";
import type { InventoryPart, ServiceTicket } from "@/lib/types";
import {
  CirclePlay,
  Navigation,
  Pause,
  Plus,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

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
  inventoryParts: InventoryPart[];
  partsUsed: PartUsageInput[];
  onPartsUsedChange: (parts: PartUsageInput[]) => void;
  /** Quantities already deducted for this entry (edit) — count as available again. */
  partsStockCredit?: PartUsageInput[];
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

/** Light readable controls on technician fulfilled-ticket / work-entry forms. */
const FIELD =
  "border-slate-300 bg-white text-[#0B1220] placeholder:text-slate-500";
const INPUT = `input input-bordered w-full ${FIELD}`;
const SELECT = `select select-bordered w-full ${FIELD}`;
const TEXTAREA = `textarea textarea-bordered w-full ${FIELD}`;
const INPUT_SM = `input input-bordered input-sm ${FIELD}`;
const SELECT_SM = `select select-bordered select-sm ${FIELD}`;

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
  inventoryParts,
  partsUsed,
  onPartsUsedChange,
  partsStockCredit = [],
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
  const [selectedPartId, setSelectedPartId] = useState("");
  const [partQty, setPartQty] = useState("1");
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId);
  const sessionActive = Boolean(startTime) && !endTime;
  const isRemoteJob =
    (selectedTicket?.service_method ?? "").trim().toLowerCase() === "remote" ||
    serviceMethod.trim().toLowerCase() === "remote";

  const stockCreditById = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of partsStockCredit) {
      map.set(item.partId, (map.get(item.partId) ?? 0) + item.quantity);
    }
    return map;
  }, [partsStockCredit]);

  function maxAvailable(part: InventoryPart) {
    return Number(part.quantity) + (stockCreditById.get(part.id) ?? 0);
  }

  const availableParts = useMemo(() => {
    return inventoryParts.filter((part) => {
      if (part.active === false) return false;
      const credit = stockCreditById.get(part.id) ?? 0;
      const max = Number(part.quantity) + credit;
      return max > 0 || partsUsed.some((used) => used.partId === part.id);
    });
  }, [inventoryParts, partsUsed, stockCreditById]);

  const partsCostTotal = useMemo(
    () =>
      partsUsed.reduce((sum, part) => sum + part.unitCost * part.quantity, 0),
    [partsUsed],
  );

  useEffect(() => {
    if (!open) return;
    if (
      selectedPartId &&
      availableParts.some((part) => part.id === selectedPartId)
    ) {
      return;
    }
    setSelectedPartId(availableParts[0]?.id ?? "");
  }, [open, availableParts, selectedPartId]);


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

  function addPart() {
    const part = availableParts.find((item) => item.id === selectedPartId);
    if (!part) return;
    const quantity = Math.max(1, Math.floor(Number(partQty) || 1));
    const alreadyUsed =
      partsUsed.find((item) => item.partId === part.id)?.quantity ?? 0;
    if (alreadyUsed + quantity > maxAvailable(part)) {
      return;
    }
    onPartsUsedChange(
      (() => {
        const existing = partsUsed.find((item) => item.partId === part.id);
        if (existing) {
          return partsUsed.map((item) =>
            item.partId === part.id
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          );
        }
        return [
          ...partsUsed,
          {
            partId: part.id,
            partName: part.part_name,
            unitCost: Number(part.unit_cost) || 0,
            quantity,
          },
        ];
      })(),
    );
    setPartQty("1");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("ticket_id", selectedTicketId);
    formData.set("work_performed", workPerformed);
    formData.set("service_method", serviceMethod);
    formData.set("ticket_status", ticketStatus);
    formData.set("parts_used", JSON.stringify(partsUsed));
    formData.set("parts_cost", String(partsCostTotal));
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
        ? isRemoteJob
          ? "Start the timer when you begin remote work, Pause if you step away, then End when complete."
          : "Mark On the way before arrival, Start when on site, Pause if you leave, then End when complete."
        : "Review times and finish the work notes before saving.";

  const statusLabel = endTime
    ? "Session ended"
    : sessionPaused
      ? isRemoteJob
        ? "Paused"
        : "Paused — away from job"
      : sessionActive
        ? isRemoteJob
          ? "Timer running"
          : "On site"
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
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-300 bg-[#e8eef5] p-5 text-[#0B1220] shadow-2xl [&_.label-text]:text-[#0B1220] [&_.label-text-alt]:text-slate-600"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="work-entry-title" className="text-lg font-semibold text-[#0B1220]">
              {heading}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-square text-slate-700"
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
              <div className="rounded-xl border border-slate-300 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm text-teal-700">
                    {selectedTicket.ticket_number}
                  </p>
                  <PriorityBadge priority={selectedTicket.priority ?? "Medium"} />
                  <StatusBadge status={selectedTicket.status ?? "New"} />
                </div>
                <p className="mt-2 text-base font-medium text-[#0B1220]">
                  {selectedTicket.title}
                </p>
                {selectedTicket.description ? (
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600">
                    {selectedTicket.description}
                  </p>
                ) : null}
              </div>
            ) : (
              <FormField label="Ticket" htmlFor="timer_ticket_id" required>
                <select
                  id="timer_ticket_id"
                  className={SELECT}
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
                  ? "border-amber-300 bg-amber-50"
                  : sessionEnRoute && !sessionActive
                    ? "border-sky-300 bg-sky-50"
                    : "border-slate-300 bg-white"
              }`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-[0.16em] ${
                  sessionPaused
                    ? "text-amber-800"
                    : sessionEnRoute && !sessionActive
                      ? "text-sky-800"
                      : "text-teal-800"
                }`}
              >
                {statusLabel}
              </p>
              <p className="mt-3 font-mono text-4xl tracking-tight text-[#0B1220]">
                {sessionActive || (startTime && endTime)
                  ? formatElapsed(elapsedSeconds)
                  : sessionEnRoute
                    ? "En route"
                    : "00:00:00"}
              </p>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
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
              isRemoteJob ? (
                <button
                  type="button"
                  className="btn h-12 w-full border-0 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                  disabled={!selectedTicketId}
                  onClick={onStartOnSite}
                >
                  <CirclePlay className="size-5" />
                  Start timer
                </button>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className="btn h-12 border-0 bg-teal-400 text-[#0B1220] hover:bg-sky-400"
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
              )
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
                    {isRemoteJob ? "Resume timer" : "Resume — back on site"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn h-12 border-0 bg-amber-500 text-slate-950 hover:bg-amber-400"
                    onClick={onPauseJob}
                  >
                    <Pause className="size-5" />
                    {isRemoteJob ? "Pause timer" : "Pause — leaving site"}
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
                className="btn h-12 w-full btn-primary border-0"
                onClick={() => onPhaseChange("form")}
              >
                Continue to work details
              </button>
            ) : null}

            <div className="flex flex-wrap justify-between gap-2 pt-1">
              <button
                type="button"
                className="btn btn-ghost btn-sm text-slate-700"
                onClick={() => onPhaseChange("form")}
              >
                Enter details manually
              </button>
              <button type="button" className="btn btn-ghost text-slate-700" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="form-grid grid gap-4">
            {mode === "create" && startTime && endTime ? (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
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
                className={SELECT}
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
                className={INPUT}
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
                  className={INPUT}
                  value={startTime}
                  onChange={(e) => onStartTimeChange(e.target.value)}
                />
              </FormField>
              <FormField label="End time" htmlFor="end_time">
                <input
                  id="end_time"
                  name="end_time"
                  type="time"
                  className={INPUT}
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
                className={INPUT}
                value={hoursWorked}
                onChange={(e) => onHoursWorkedChange(e.target.value)}
              />
            </FormField>
            <FormField label="Work performed" htmlFor="work_performed">
              <textarea
                id="work_performed"
                name="work_performed"
                className={TEXTAREA}
                rows={2}
                value={workPerformed}
                onChange={(e) => onWorkPerformedChange(e.target.value)}
              />
            </FormField>
            <FormField label="Service method" htmlFor="service_method">
              <select
                id="service_method"
                name="service_method"
                className={SELECT}
                value={serviceMethod}
                onChange={(e) => onServiceMethodChange(e.target.value)}
              >
                <option value="Remote">Remote</option>
                <option value="On-site">In-person</option>
                <option value="Phone">Phone</option>
                <option value="Email">Email</option>
              </select>
            </FormField>
            <div className="rounded-xl border border-slate-300 bg-white p-3">
              <p className="text-sm font-medium text-[#0B1220]">Parts used</p>
              <p className="mt-1 text-xs text-slate-600">
                Selecting parts deducts stock from Hardware Assets when you save.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  className={`${SELECT_SM} min-w-40 flex-1`}
                  value={selectedPartId}
                  onChange={(e) => setSelectedPartId(e.target.value)}
                  disabled={availableParts.length === 0}
                >
                  {availableParts.length === 0 ? (
                    <option value="">No parts in stock</option>
                  ) : (
                    availableParts.map((part) => {
                      const used =
                        partsUsed.find((item) => item.partId === part.id)
                          ?.quantity ?? 0;
                      const remaining = Math.max(0, maxAvailable(part) - used);
                      return (
                        <option
                          key={part.id}
                          value={part.id}
                          disabled={remaining <= 0}
                        >
                          {part.part_name} · {remaining} available ·{" "}
                          {formatCurrency(part.unit_cost)}
                        </option>
                      );
                    })
                  )}
                </select>
                <input
                  type="number"
                  min="1"
                  className={`${INPUT_SM} w-20`}
                  value={partQty}
                  onChange={(e) => setPartQty(e.target.value)}
                  aria-label="Part quantity"
                />
                <button
                  type="button"
                  className="btn btn-sm btn-primary border-0"
                  onClick={addPart}
                  disabled={!selectedPartId || availableParts.length === 0}
                >
                  <Plus className="size-4" />
                  Add
                </button>
              </div>
              {partsUsed.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {partsUsed.map((part) => (
                    <li
                      key={part.partId}
                      className="flex items-center justify-between gap-2 text-sm text-[#0B1220]"
                    >
                      <span>
                        {part.partName ?? "Part"} × {part.quantity}
                      </span>
                      <span className="flex items-center gap-2">
                        {formatCurrency(part.unitCost * part.quantity)}
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square text-slate-600 hover:text-rose-600"
                          aria-label={`Remove ${part.partName ?? "part"}`}
                          onClick={() =>
                            onPartsUsedChange(
                              partsUsed.filter(
                                (item) => item.partId !== part.partId,
                              ),
                            )
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                  <li className="flex justify-between border-t border-slate-300 pt-2 text-sm font-medium text-teal-800">
                    <span>Parts total</span>
                    <span>{formatCurrency(partsCostTotal)}</span>
                  </li>
                </ul>
              ) : (
                <p className="mt-3 text-xs text-slate-500">No parts selected.</p>
              )}
            </div>
            <FormField label="Update ticket status" htmlFor="ticket_status">
              <select
                id="ticket_status"
                name="ticket_status"
                className={SELECT}
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
                  className="btn btn-ghost text-slate-700"
                  onClick={() => onPhaseChange("timer")}
                >
                  Back to timer
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost text-slate-700" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary border-0"
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
