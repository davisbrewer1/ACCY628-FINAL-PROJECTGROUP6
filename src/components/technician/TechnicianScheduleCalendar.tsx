"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import {
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Navigation,
  Shield,
} from "lucide-react";
import { PriorityBadge } from "@/components/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { isOpenTicket } from "@/lib/dashboard-stats";
import { getMonthGridDays } from "@/lib/technician-payroll";
import {
  allowedScheduleDaysForTicket,
  buildOccupancyMap,
  buildSlotStart,
  formatLockedServiceDateLabel,
  formatScheduledWindow,
  formatWeekRange,
  getSpanWindows,
  getWindowById,
  getWorkWeekDays,
  parseScheduledSlot,
  scheduleTicketsForWeek,
  slotKey,
  WORK_WINDOWS,
  type ScheduledTicket,
  type WorkWindow,
} from "@/lib/technician-schedule";
import type { ServiceTicket } from "@/lib/types";

function dayKey(day: Date): string {
  return format(day, "yyyy-MM-dd");
}

export type CalendarMode = "week" | "month";

const UNSCHEDULED_ORIGIN = "unscheduled";

type MovePayload = {
  ticketId: string;
  scheduledStart: string;
  scheduledWindow: string;
  swapTicketId?: string | null;
  swapScheduledStart?: string | null;
  swapScheduledWindow?: string | null;
  /** Set when the tech confirmed "Move anyway" on a High/Critical postpone warning. */
  acknowledgedBackwardMoveWarning?: boolean;
  warningFromLabel?: string;
  warningToLabel?: string;
  warningPriority?: string;
};

function priorityRank(priority: string | null | undefined): number {
  switch (String(priority ?? "Medium").toLowerCase()) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    default:
      return 3;
  }
}

type PendingMoveWarning = {
  payload: MovePayload;
  ticket: ServiceTicket;
  priority: string;
  fromLabel: string;
  toLabel: string;
  message: string;
};

/**
 * Warn when High/Critical work is postponed ("moved back") on the schedule.
 * - Critical: any move to a later day or later window
 * - High: only when postponed by a full calendar day or more
 *
 * "Moved back" = later on the timeline (right on the week grid).
 * Moving earlier ("pulled forward") does not warn.
 */
function getMoveBackWarning(
  ticket: ServiceTicket,
  sourceDayKey: string,
  sourceWindow: WorkWindow,
  destDayKey: string,
  destWindow: WorkWindow,
): string | null {
  const priority = String(ticket.priority ?? "Medium").trim();

  const movedToLaterDay = destDayKey > sourceDayKey;
  const movedToLaterSlot =
    movedToLaterDay ||
    (destDayKey === sourceDayKey &&
      destWindow.startHour > sourceWindow.startHour);

  if (!movedToLaterSlot) return null;

  if (/^critical$/i.test(priority)) {
    return "Critical tickets should not be postponed. Moving this Critical assignment later may miss the SLA window.";
  }

  if (/^high$/i.test(priority) && movedToLaterDay) {
    return "High-priority tickets should not be moved back by a full day or more. Confirm only if the customer or manager requested this change.";
  }

  return null;
}

function dayKeyToLocalDate(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function slotLabelFromKey(dayKey: string, window: WorkWindow): string {
  return `${format(dayKeyToLocalDate(dayKey), "EEE, MMM d")} · ${window.label}`;
}

interface TechnicianScheduleCalendarProps {
  tickets: ServiceTicket[];
  anchor: Date;
  mode: CalendarMode;
  onAnchorChange: (next: Date) => void;
  onModeChange: (mode: CalendarMode) => void;
  onSelectTicket?: (ticketId: string) => void;
  selectedTicketId?: string;
  onMoveTicket: (input: MovePayload) => void;
  ptoDates?: Set<string>;
  busy?: boolean;
  enRouteTicketId?: string | null;
  /** Ticket IDs with a Pending manager hour-extension request. */
  pendingHourExtensionTicketIds?: Set<string>;
  onRequestHourExtension?: (input: {
    ticketId: string;
    requestedHours: number;
    reason?: string;
  }) => void;
  /** Assigned technician id — used to enforce customer locked-day rules. */
  technicianId?: string | null;
}

export function TechnicianScheduleCalendar({
  tickets,
  anchor,
  mode,
  onAnchorChange,
  onModeChange,
  onSelectTicket,
  selectedTicketId,
  onMoveTicket,
  ptoDates = new Set(),
  busy = false,
  enRouteTicketId = null,
  pendingHourExtensionTicketIds = new Set(),
  onRequestHourExtension,
  technicianId = null,
}: TechnicianScheduleCalendarProps) {
  const days = mode === "week" ? getWorkWeekDays(anchor) : getMonthGridDays(anchor);
  const schedule = useMemo(
    () => scheduleTicketsForWeek(tickets, anchor),
    [tickets, anchor],
  );
  const unscheduledTickets = useMemo(
    () =>
      tickets
        .filter((ticket) => isOpenTicket(ticket.status) && !ticket.scheduled_start)
        .sort(
          (a, b) =>
            priorityRank(a.priority) - priorityRank(b.priority) ||
            String(a.ticket_number).localeCompare(String(b.ticket_number)),
        ),
    [tickets],
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [pendingWarning, setPendingWarning] = useState<PendingMoveWarning | null>(
    null,
  );
  const [trayDurations, setTrayDurations] = useState<Record<string, number>>({});
  // Capture the visible cell at drag-start so direction checks use the UI
  // origin, not a re-parsed scheduled_start that can shift by timezone.
  const dragOriginRef = useRef<{
    ticketId: string;
    dayKey: string;
    windowId: string;
    durationHours?: number;
  } | null>(null);

  function shift(direction: -1 | 1) {
    if (mode === "week") {
      const next = new Date(anchor);
      next.setDate(next.getDate() + direction * 7);
      onAnchorChange(next);
      return;
    }
    onAnchorChange(addMonths(anchor, direction));
  }

  function clearDragState() {
    setDraggingId(null);
    setDropTarget(null);
    dragOriginRef.current = null;
  }

  function applyMove(payload: MovePayload) {
    onMoveTicket(payload);
    clearDragState();
    setPendingWarning(null);
  }

  function handleDragStart(ticketId: string, day: Date, windowId: string) {
    setDraggingId(ticketId);
    dragOriginRef.current = {
      ticketId,
      dayKey: format(day, "yyyy-MM-dd"),
      windowId,
    };
  }

  function handleDragStartFromTray(ticketId: string, durationHours: number) {
    setDraggingId(ticketId);
    dragOriginRef.current = {
      ticketId,
      dayKey: "",
      windowId: UNSCHEDULED_ORIGIN,
      durationHours,
    };
  }

  function handleDrop(day: Date, windowId: string) {
    const origin = dragOriginRef.current;
    const ticketId = origin?.ticketId ?? draggingId;
    if (!ticketId || busy) return;
    const window = WORK_WINDOWS.find((item) => item.id === windowId);
    if (!window) return;

    const destDayKey = format(day, "yyyy-MM-dd");
    const weekSchedule = scheduleTicketsForWeek(tickets, day);
    const occupancy = buildOccupancyMap(weekSchedule);

    const scheduled = weekSchedule.find((item) => item.ticket.id === ticketId);
    const ticket = scheduled?.ticket ?? tickets.find((item) => item.id === ticketId);
    if (!ticket) return;

    const fromTray = origin?.windowId === UNSCHEDULED_ORIGIN;
    const parsed = parseScheduledSlot(ticket);
    const maxAllowed = Math.min(
      WORK_WINDOWS.length,
      Math.max(1, Number(ticket.max_hours) || WORK_WINDOWS.length),
    );
    const trayHours =
      origin?.durationHours ??
      trayDurations[ticketId] ??
      (Number(ticket.max_hours) > 0 ? Number(ticket.max_hours) : 1);
    const durationHours = Math.min(
      maxAllowed,
      Math.max(
        1,
        fromTray
          ? trayHours
          : (scheduled?.durationHours ?? parsed?.durationHours ?? 1),
      ),
    );
    const originWindow = fromTray
      ? null
      : getWindowById(origin?.windowId) ??
        scheduled?.window ??
        parsed?.window;
    const sourceDayKey = fromTray
      ? null
      : origin?.dayKey ||
        (scheduled ? format(scheduled.day, "yyyy-MM-dd") : null) ||
        (parsed ? format(parsed.day, "yyyy-MM-dd") : null);

    if (!fromTray && (!sourceDayKey || !originWindow)) return;

    // Dropping on the same start slot is a no-op.
    if (
      !fromTray &&
      sourceDayKey === destDayKey &&
      originWindow!.id === windowId
    ) {
      clearDragState();
      return;
    }

    const destSpan = getSpanWindows(window, durationHours);
    if (destSpan.length < durationHours) {
      // Would run past end of day.
      clearDragState();
      return;
    }

    // Customer-locked day: only that day, or the next business day when the
    // locked day has no opening for this technician at the needed duration.
    if (technicianId && ticket.locked_service_date && !ticket.is_asap) {
      const allowed = allowedScheduleDaysForTicket(
        ticket,
        tickets,
        technicianId,
        durationHours,
      );
      if (allowed) {
        const destKey = dayKey(day);
        const ok = allowed.allowedDays.some(
          (allowedDay) => dayKey(allowedDay) === destKey,
        );
        if (!ok) {
          clearDragState();
          return;
        }
      }
    }

    // Collision: any covered hour occupied by a different ticket.
    const blocking = destSpan
      .map((spanWindow) => occupancy.get(slotKey(day, spanWindow.id)))
      .filter(
        (item): item is ScheduledTicket =>
          Boolean(item && item.ticket.id !== ticketId),
      );
    const uniqueBlockers = [
      ...new Map(blocking.map((item) => [item.ticket.id, item])).values(),
    ];

    // Initial placement from the tray requires an open span (no swap).
    if (fromTray) {
      if (uniqueBlockers.length > 0) {
        clearDragState();
        return;
      }
      applyMove({
        ticketId,
        scheduledStart: buildSlotStart(day, window).toISOString(),
        scheduledWindow: formatScheduledWindow(window.id, durationHours),
      });
      return;
    }

    // Only support simple swap when dropping onto a single-hour job start of equal size.
    const occupant =
      uniqueBlockers.length === 1 &&
      uniqueBlockers[0].window.id === windowId &&
      uniqueBlockers[0].durationHours === durationHours
        ? uniqueBlockers[0]
        : null;

    if (uniqueBlockers.length > 0 && !occupant) {
      clearDragState();
      return;
    }

    const originDay = dayKeyToLocalDate(sourceDayKey!);
    const scheduledWindow = formatScheduledWindow(window.id, durationHours);
    const scheduledStart = buildSlotStart(day, window).toISOString();
    const payload: MovePayload = occupant
      ? {
          ticketId,
          scheduledStart,
          scheduledWindow,
          swapTicketId: occupant.ticket.id,
          swapScheduledStart: buildSlotStart(
            originDay,
            originWindow!,
          ).toISOString(),
          swapScheduledWindow: formatScheduledWindow(
            originWindow!.id,
            occupant.durationHours,
          ),
        }
      : {
          ticketId,
          scheduledStart,
          scheduledWindow,
        };

    const warning = getMoveBackWarning(
      ticket,
      sourceDayKey!,
      originWindow!,
      destDayKey,
      window,
    );

    if (warning) {
      setPendingWarning({
        payload,
        ticket,
        priority: ticket.priority ?? "Medium",
        fromLabel: slotLabelFromKey(sourceDayKey!, originWindow!),
        toLabel: slotLabelFromKey(destDayKey, window),
        message: warning,
      });
      clearDragState();
      return;
    }

    applyMove(payload);
  }

  const rangeLabel =
    mode === "week"
      ? formatWeekRange(getWorkWeekDays(anchor))
      : format(anchor, "MMMM yyyy");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-cyan-200/80">
            Schedule calendar
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            Place new assignments, then drag between windows · {rangeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="join border border-slate-600">
            <button
              type="button"
              className={`btn btn-sm join-item border-0 ${
                mode === "week"
                  ? "bg-cyan-500 text-slate-950"
                  : "bg-slate-900 text-slate-200"
              }`}
              onClick={() => onModeChange("week")}
            >
              Week
            </button>
            <button
              type="button"
              className={`btn btn-sm join-item border-0 ${
                mode === "month"
                  ? "bg-cyan-500 text-slate-950"
                  : "bg-slate-900 text-slate-200"
              }`}
              onClick={() => onModeChange("month")}
            >
              Month
            </button>
          </div>
          <button
            type="button"
            className="btn btn-sm border-slate-600 bg-slate-900 text-slate-100 hover:border-cyan-500/50 hover:bg-slate-800"
            onClick={() => shift(-1)}
            aria-label={mode === "week" ? "Previous week" : "Previous month"}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            className="btn btn-sm border-slate-600 bg-slate-900 text-slate-100 hover:border-cyan-500/50 hover:bg-slate-800"
            onClick={() => onAnchorChange(new Date())}
          >
            Today
          </button>
          <button
            type="button"
            className="btn btn-sm border-slate-600 bg-slate-900 text-slate-100 hover:border-cyan-500/50 hover:bg-slate-800"
            onClick={() => shift(1)}
            aria-label={mode === "week" ? "Next week" : "Next month"}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <UnscheduledTray
        tickets={unscheduledTickets}
        selectedTicketId={selectedTicketId}
        draggingId={draggingId}
        busy={busy}
        weekMode={mode === "week"}
        durations={trayDurations}
        pendingHourExtensionTicketIds={pendingHourExtensionTicketIds}
        onRequestHourExtension={onRequestHourExtension}
        onDurationChange={(ticketId, hours) => {
          setTrayDurations((current) => ({ ...current, [ticketId]: hours }));
        }}
        onSelectTicket={onSelectTicket}
        onDragStart={handleDragStartFromTray}
        onDragEnd={() => {
          setDraggingId(null);
          setDropTarget(null);
        }}
        onSwitchToWeek={() => onModeChange("week")}
      />

      {mode === "week" ? (
        <WeekGrid
          days={days}
          schedule={schedule}
          selectedTicketId={selectedTicketId}
          onSelectTicket={onSelectTicket}
          draggingId={draggingId}
          dropTarget={dropTarget}
          busy={busy}
          ptoDates={ptoDates}
          enRouteTicketId={enRouteTicketId}
          onDragStart={handleDragStart}
          onDragEnd={() => {
            // Keep dragOriginRef until handleDrop reads it; only clear UI highlight.
            setDraggingId(null);
            setDropTarget(null);
          }}
          onDragOverCell={setDropTarget}
          onDropCell={handleDrop}
        />
      ) : (
        <MonthGrid
          days={days}
          anchor={anchor}
          tickets={tickets}
          schedule={schedule}
          selectedTicketId={selectedTicketId}
          onSelectTicket={onSelectTicket}
          ptoDates={ptoDates}
          onOpenWeek={(day) => {
            onAnchorChange(day);
            onModeChange("week");
          }}
        />
      )}

      <p className="text-xs text-slate-500">
        {mode === "week"
          ? "Set hours on Needs scheduling (capped by the manager max), then drag onto an open hour. Request more hours if the job needs it — managers approve those on Technicians. Completed work stays visible but cannot be moved."
          : "Month view shows ticket counts and PTO days. Switch to Week to place unscheduled assignments and drag tickets between windows."}
      </p>

      {pendingWarning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="move-back-warning-title"
            className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-slate-900 p-5 shadow-2xl shadow-black/40"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-amber-500/15 p-2 text-amber-300">
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4
                  id="move-back-warning-title"
                  className="text-base font-semibold text-slate-50"
                >
                  Moving {pendingWarning.priority} ticket later
                </h4>
                <p className="mt-2 text-sm text-slate-300">
                  {pendingWarning.message}
                </p>
                <div className="mt-3 space-y-1 text-sm text-slate-400">
                  <p>
                    <span className="text-slate-500">Ticket:</span>{" "}
                    {pendingWarning.ticket.ticket_number} —{" "}
                    {pendingWarning.ticket.title}
                  </p>
                  <p>
                    <span className="text-slate-500">From:</span>{" "}
                    {pendingWarning.fromLabel}
                  </p>
                  <p>
                    <span className="text-slate-500">To:</span>{" "}
                    {pendingWarning.toLabel}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-sm border border-slate-600 bg-slate-800 text-slate-200"
                onClick={() => setPendingWarning(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm border-0 bg-amber-500 text-slate-950 hover:bg-amber-400"
                disabled={busy}
                onClick={() =>
                  applyMove({
                    ...pendingWarning.payload,
                    acknowledgedBackwardMoveWarning: true,
                    warningFromLabel: pendingWarning.fromLabel,
                    warningToLabel: pendingWarning.toLabel,
                    warningPriority: pendingWarning.priority,
                  })
                }
              >
                Move anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UnscheduledTray({
  tickets,
  selectedTicketId,
  draggingId,
  busy,
  weekMode,
  durations,
  pendingHourExtensionTicketIds,
  onRequestHourExtension,
  onDurationChange,
  onSelectTicket,
  onDragStart,
  onDragEnd,
  onSwitchToWeek,
}: {
  tickets: ServiceTicket[];
  selectedTicketId?: string;
  draggingId: string | null;
  busy: boolean;
  weekMode: boolean;
  durations: Record<string, number>;
  pendingHourExtensionTicketIds: Set<string>;
  onRequestHourExtension?: (input: {
    ticketId: string;
    requestedHours: number;
    reason?: string;
  }) => void;
  onDurationChange: (ticketId: string, hours: number) => void;
  onSelectTicket?: (ticketId: string) => void;
  onDragStart: (ticketId: string, durationHours: number) => void;
  onDragEnd: () => void;
  onSwitchToWeek: () => void;
}) {
  const [extendTicketId, setExtendTicketId] = useState<string | null>(null);
  const [extendHours, setExtendHours] = useState("2");
  const [extendReason, setExtendReason] = useState("");

  function hoursFor(ticket: ServiceTicket) {
    const maxAllowed = Math.min(
      WORK_WINDOWS.length,
      Math.max(1, Number(ticket.max_hours) || WORK_WINDOWS.length),
    );
    const preferred =
      durations[ticket.id] ??
      (Number(ticket.max_hours) > 0 ? Number(ticket.max_hours) : 1);
    return Math.min(maxAllowed, Math.max(1, preferred));
  }

  return (
    <div className="rounded-xl border border-amber-400/25 bg-amber-500/5 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-amber-100">
            Needs scheduling
            {tickets.length > 0 ? (
              <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-100">
                {tickets.length}
              </span>
            ) : null}
          </h4>
          <p className="mt-1 text-xs text-slate-400">
            {weekMode
              ? "Pick hours (up to the manager max), then drag onto the customer’s locked day (or the next business day if that day is full for you). Rescheduled tickets are marked."
              : "Manager assignments waiting for a time slot. Switch to Week view to place them."}
          </p>
        </div>
        {!weekMode && tickets.length > 0 ? (
          <button
            type="button"
            className="btn btn-sm border-0 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            onClick={onSwitchToWeek}
          >
            Open week view
          </button>
        ) : null}
      </div>

      {tickets.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No unscheduled assignments. New tickets from your manager will show up here.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {tickets.map((ticket) => {
            const selected = selectedTicketId === ticket.id;
            const dragging = draggingId === ticket.id;
            const hours = hoursFor(ticket);
            const maxAllowed = Math.min(
              WORK_WINDOWS.length,
              Math.max(1, Number(ticket.max_hours) || WORK_WINDOWS.length),
            );
            const currentMax = Number(ticket.max_hours);
            const hasMaxCap =
              Number.isInteger(currentMax) && currentMax >= 1 && currentMax <= 9;
            const canRequestMore =
              Boolean(onRequestHourExtension) &&
              hasMaxCap &&
              currentMax < 9 &&
              !pendingHourExtensionTicketIds.has(ticket.id);
            const pendingExtend = pendingHourExtensionTicketIds.has(ticket.id);
            const extending = extendTicketId === ticket.id;
            const minRequest = currentMax + 1;

            return (
              <li key={ticket.id} className="max-w-sm">
                <div
                  className={`flex flex-col gap-2 rounded-lg border px-2.5 py-2 transition ${
                    dragging
                      ? "opacity-50"
                      : selected
                        ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
                        : "border-amber-400/30 bg-slate-950/70"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      draggable={weekMode && !busy}
                      onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                        if (!weekMode || busy) {
                          event.preventDefault();
                          return;
                        }
                        event.dataTransfer.setData("text/plain", ticket.id);
                        event.dataTransfer.effectAllowed = "move";
                        onDragStart(ticket.id, hours);
                      }}
                      onDragEnd={onDragEnd}
                      onClick={() => onSelectTicket?.(ticket.id)}
                      className={`flex min-w-0 flex-1 items-start gap-2 text-left ${
                        weekMode
                          ? "cursor-grab active:cursor-grabbing"
                          : "cursor-pointer"
                      }`}
                      title={
                        weekMode
                          ? "Drag onto an open hour"
                          : "Open week view to schedule"
                      }
                    >
                      <GripVertical
                        className="mt-0.5 size-4 shrink-0 text-amber-300/80"
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">
                          {ticket.title}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1">
                          <span className="font-mono text-[11px] text-slate-400">
                            {ticket.ticket_number}
                          </span>
                          <PriorityBadge
                            priority={ticket.priority ?? "Medium"}
                            className="badge-xs"
                          />
                          <StatusBadge
                            status={ticket.status ?? "Assigned"}
                            className="badge-xs"
                          />
                          {ticket.max_hours ? (
                            <span className="text-[11px] text-amber-200/80">
                              max {ticket.max_hours}h
                            </span>
                          ) : null}
                          {ticket.is_asap ? (
                            <span className="badge badge-xs badge-error">
                              ASAP
                            </span>
                          ) : ticket.locked_service_date ? (
                            <span className="badge badge-xs badge-info">
                              {formatLockedServiceDateLabel(
                                ticket.locked_service_date,
                              )}
                            </span>
                          ) : null}
                          {ticket.customer_rescheduled ? (
                            <span className="badge badge-xs badge-warning">
                              Rescheduled
                            </span>
                          ) : null}
                          {pendingExtend ? (
                            <span className="badge badge-xs badge-warning">
                              hours pending
                            </span>
                          ) : null}
                          {ticket.cybersecurity_incident ? (
                            <span className="badge badge-xs badge-error gap-1">
                              <Shield className="size-3" aria-hidden="true" />
                              Security
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                    <label className="flex shrink-0 flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        Hours
                      </span>
                      <select
                        className="select select-bordered select-xs w-[4.5rem] border-slate-600 bg-slate-950"
                        value={hours}
                        disabled={busy}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          event.stopPropagation();
                          onDurationChange(
                            ticket.id,
                            Math.min(
                              maxAllowed,
                              Math.max(1, Number(event.target.value) || 1),
                            ),
                          );
                        }}
                        aria-label={`Hours to schedule for ${ticket.ticket_number}`}
                      >
                        {Array.from({ length: maxAllowed }, (_, i) => i + 1).map(
                          (value) => (
                            <option key={value} value={value}>
                              {value}h
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>

                  {canRequestMore && !extending ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs h-7 justify-start gap-1 px-1 text-amber-200/90 hover:bg-amber-500/10"
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        setExtendTicketId(ticket.id);
                        setExtendHours(String(Math.min(9, minRequest)));
                        setExtendReason("");
                      }}
                    >
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                      Need more than {currentMax}h?
                    </button>
                  ) : null}

                  {extending && onRequestHourExtension ? (
                    <div
                      className="space-y-2 rounded-md border border-amber-400/20 bg-slate-950/80 p-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <p className="text-[11px] text-slate-400">
                        Request manager approval to raise the hour cap (currently{" "}
                        {currentMax}h).
                      </p>
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col gap-0.5">
                          <span className="text-[10px] uppercase text-slate-500">
                            Request
                          </span>
                          <select
                            className="select select-bordered select-xs w-[4.5rem] border-slate-600 bg-slate-950"
                            value={extendHours}
                            onChange={(e) => setExtendHours(e.target.value)}
                          >
                            {Array.from(
                              { length: 9 - currentMax },
                              (_, i) => currentMax + 1 + i,
                            ).map((value) => (
                              <option key={value} value={value}>
                                {value}h
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="min-w-[10rem] flex-1">
                          <span className="sr-only">Reason</span>
                          <input
                            className="input input-bordered input-xs w-full border-slate-600 bg-slate-950"
                            placeholder="Why more hours?"
                            value={extendReason}
                            onChange={(e) => setExtendReason(e.target.value)}
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-xs border-0 bg-amber-400 text-slate-950 hover:bg-amber-300"
                          disabled={busy}
                          onClick={() => {
                            onRequestHourExtension({
                              ticketId: ticket.id,
                              requestedHours: Number(extendHours),
                              reason: extendReason.trim() || undefined,
                            });
                            setExtendTicketId(null);
                            setExtendReason("");
                          }}
                        >
                          Submit request
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-slate-400"
                          onClick={() => setExtendTicketId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function WeekGrid({
  days,
  schedule,
  selectedTicketId,
  onSelectTicket,
  draggingId,
  dropTarget,
  busy,
  ptoDates,
  enRouteTicketId,
  onDragStart,
  onDragEnd,
  onDragOverCell,
  onDropCell,
}: {
  days: Date[];
  schedule: ScheduledTicket[];
  selectedTicketId?: string;
  onSelectTicket?: (ticketId: string) => void;
  draggingId: string | null;
  dropTarget: string | null;
  busy: boolean;
  ptoDates: Set<string>;
  enRouteTicketId?: string | null;
  onDragStart: (ticketId: string, day: Date, windowId: string) => void;
  onDragEnd: () => void;
  onDragOverCell: (key: string | null) => void;
  onDropCell: (day: Date, windowId: string) => void;
}) {
  const occupancy = useMemo(() => buildOccupancyMap(schedule), [schedule]);
  const rowCount = WORK_WINDOWS.length;
  // Equal-height hour rows — sized so a 1-hour card can show a full title + meta.
  const hourRowSize = "8.25rem";
  const templateRows = `auto repeat(${rowCount}, ${hourRowSize})`;

  return (
    <div className="overflow-x-auto rounded-xl border border-cyan-500/20 bg-slate-950/60">
      <div
        className="grid min-w-[820px] grid-cols-[6.5rem_repeat(5,minmax(0,1fr))]"
        style={{ gridTemplateRows: templateRows }}
      >
        <div className="sticky left-0 z-10 border-b border-r border-cyan-500/15 bg-slate-900/90 p-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Hour
        </div>
        {days.map((day, dayIndex) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const onPto = ptoDates.has(dateKey);
          return (
            <div
              key={dateKey}
              style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
              className={`border-b border-cyan-500/15 p-2 text-center ${
                onPto ? "bg-violet-500/15" : isToday(day) ? "bg-cyan-500/10" : "bg-slate-900/80"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200/70">
                {format(day, "EEE")}
              </p>
              <p className="text-sm font-medium text-white">{format(day, "MMM d")}</p>
              {onPto ? (
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                  PTO
                </p>
              ) : null}
            </div>
          );
        })}

        {WORK_WINDOWS.map((window, windowIndex) => (
          <div
            key={`label-${window.id}`}
            style={{ gridColumn: 1, gridRow: windowIndex + 2 }}
            className="sticky left-0 z-10 flex h-full items-center border-b border-r border-cyan-500/10 bg-slate-900/80 px-2 text-sm font-medium text-slate-300"
          >
            {window.label}
          </div>
        ))}

        {days.map((day, dayIndex) =>
          WORK_WINDOWS.map((window, windowIndex) => {
            const key = slotKey(day, window.id);
            const occupant = occupancy.get(key);
            const isStart =
              Boolean(occupant) && occupant!.window.id === window.id;
            const isContinuation =
              Boolean(occupant) && occupant!.window.id !== window.id;

            // Continuation hours are covered by the starting cell's row span.
            if (isContinuation) return null;

            const span = occupant?.durationHours ?? 1;
            const isDropTarget = dropTarget === key && Boolean(draggingId);
            const isDone =
              occupant?.ticket.status === "Completed" ||
              occupant?.ticket.status === "Closed";
            const isEnRoute = Boolean(
              occupant &&
                enRouteTicketId &&
                occupant.ticket.id === enRouteTicketId,
            );

            return (
              <div
                key={key}
                style={{
                  gridColumn: dayIndex + 2,
                  gridRow: `${windowIndex + 2} / span ${span}`,
                }}
                className={`h-full border-b border-l border-cyan-500/10 p-1 transition ${
                  isToday(day) ? "bg-cyan-950/20" : "bg-slate-950/40"
                } ${isDropTarget ? "bg-cyan-500/20 ring-1 ring-inset ring-cyan-400/60" : ""}`}
                onDragOver={(event: DragEvent<HTMLDivElement>) => {
                  event.preventDefault();
                  onDragOverCell(key);
                }}
                onDragLeave={() => {
                  if (dropTarget === key) onDragOverCell(null);
                }}
                onDrop={(event: DragEvent<HTMLDivElement>) => {
                  event.preventDefault();
                  onDropCell(day, window.id);
                }}
              >
                {occupant && isStart ? (
                  <button
                    type="button"
                    draggable={!busy && !isDone}
                    onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                      if (isDone) {
                        event.preventDefault();
                        return;
                      }
                      event.dataTransfer.setData(
                        "text/plain",
                        occupant.ticket.id,
                      );
                      event.dataTransfer.effectAllowed = "move";
                      onDragStart(occupant.ticket.id, day, window.id);
                    }}
                    onDragEnd={onDragEnd}
                    onClick={() => {
                      if (isDone) return;
                      onSelectTicket?.(occupant.ticket.id);
                    }}
                    className={`flex h-full min-h-0 w-full flex-col gap-1.5 overflow-hidden rounded-lg border p-2.5 text-left transition ${
                      isDone
                        ? "cursor-default border-emerald-500/25 bg-emerald-950/30 opacity-80"
                        : isEnRoute
                          ? "cursor-grab border-sky-400/50 bg-sky-500/15 active:cursor-grabbing"
                          : `cursor-grab active:cursor-grabbing ${
                              draggingId === occupant.ticket.id
                                ? "opacity-50"
                                : ""
                            } ${
                              selectedTicketId === occupant.ticket.id
                                ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]"
                                : "border-slate-600/80 bg-slate-900/90 hover:border-cyan-500/50 hover:bg-slate-800"
                            }`
                    }`}
                  >
                    <p
                      className={`min-h-0 flex-1 text-sm font-semibold leading-snug ${
                        span === 1 ? "line-clamp-3" : "line-clamp-4"
                      } ${
                        isDone
                          ? "text-emerald-100/90 line-through decoration-emerald-500/50"
                          : "text-white"
                      }`}
                      title={occupant.ticket.title}
                    >
                      {occupant.ticket.title}
                    </p>
                    <div className="shrink-0 space-y-1">
                      <p className="truncate font-mono text-xs text-slate-400">
                        {occupant.ticket.ticket_number}
                        {occupant.durationHours > 1
                          ? ` · ${occupant.durationHours}h`
                          : ""}
                      </p>
                      <div className="flex flex-nowrap items-center gap-1 overflow-hidden">
                        <PriorityBadge
                          priority={occupant.ticket.priority ?? "Medium"}
                          className="badge-xs"
                        />
                        <StatusBadge
                          status={occupant.ticket.status ?? "New"}
                          className="badge-xs"
                        />
                        {isEnRoute ? (
                          <span className="badge badge-xs gap-1 border-0 bg-sky-500 text-slate-950">
                            <Navigation className="size-3" aria-hidden="true" />
                            En route
                          </span>
                        ) : null}
                        {occupant.ticket.cybersecurity_incident ? (
                          <span className="badge badge-xs badge-error gap-1">
                            <Shield className="size-3" aria-hidden="true" />
                            Security
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-700/60 text-[10px] uppercase tracking-wide text-slate-600">
                    Drop
                  </div>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

function MonthGrid({
  days,
  anchor,
  tickets,
  schedule,
  selectedTicketId,
  onSelectTicket,
  ptoDates,
  onOpenWeek,
}: {
  days: Date[];
  anchor: Date;
  tickets: ServiceTicket[];
  schedule: ScheduledTicket[];
  selectedTicketId?: string;
  onSelectTicket?: (ticketId: string) => void;
  ptoDates: Set<string>;
  onOpenWeek: (day: Date) => void;
}) {
  const ticketsByDay = useMemo(() => {
    const map = new Map<string, ServiceTicket[]>();
    for (const ticket of tickets) {
      const parsed = parseScheduledSlot(ticket);
      const day =
        parsed?.day ??
        schedule.find((item) => item.ticket.id === ticket.id)?.day;
      if (!day) continue;
      const key = format(day, "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(ticket);
      map.set(key, list);
    }
    return map;
  }, [tickets, schedule]);

  return (
    <div className="overflow-hidden rounded-xl border border-cyan-500/20 bg-slate-950/60">
      <div className="grid grid-cols-7 border-b border-cyan-500/15 bg-slate-900/80">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <div
            key={label}
            className="p-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, anchor);
          const dayTickets = ticketsByDay.get(key) ?? [];
          const onPto = ptoDates.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onOpenWeek(day)}
              className={`min-h-[6.5rem] border-b border-r border-cyan-500/10 p-2 text-left transition hover:bg-cyan-500/10 ${
                inMonth ? "bg-slate-950/40" : "bg-slate-950/20 opacity-50"
              } ${isToday(day) ? "ring-1 ring-inset ring-cyan-400/40" : ""} ${
                onPto ? "bg-violet-500/10" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-sm font-medium ${inMonth ? "text-white" : "text-slate-500"}`}>
                  {format(day, "d")}
                </span>
                {onPto ? (
                  <span className="text-[10px] font-semibold uppercase text-violet-300">PTO</span>
                ) : null}
              </div>
              <div className="mt-2 space-y-1">
                {dayTickets.slice(0, 3).map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`truncate rounded px-1.5 py-0.5 text-[10px] ${
                      selectedTicketId === ticket.id
                        ? "bg-cyan-500/30 text-cyan-50"
                        : ticket.cybersecurity_incident
                          ? "bg-rose-500/25 text-rose-100"
                          : "bg-slate-800 text-slate-200"
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectTicket?.(ticket.id);
                    }}
                  >
                    {ticket.cybersecurity_incident ? "SEC · " : ""}
                    {ticket.title}
                  </div>
                ))}
                {dayTickets.length > 3 ? (
                  <p className="text-[10px] text-slate-500">+{dayTickets.length - 3} more</p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
