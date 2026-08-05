"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import {
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
} from "date-fns";
import { AlertTriangle, ChevronLeft, ChevronRight, Navigation, Shield } from "lucide-react";
import { PriorityBadge } from "@/components/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { getMonthGridDays } from "@/lib/technician-payroll";
import {
  buildOccupancyMap,
  buildSlotStart,
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

export type CalendarMode = "week" | "month";

type MovePayload = {
  ticketId: string;
  scheduledStart: string;
  scheduledWindow: string;
  swapTicketId?: string | null;
  swapScheduledStart?: string | null;
  swapScheduledWindow?: string | null;
};

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
}: TechnicianScheduleCalendarProps) {
  const days = mode === "week" ? getWorkWeekDays(anchor) : getMonthGridDays(anchor);
  const schedule = useMemo(
    () => scheduleTicketsForWeek(tickets, anchor),
    [tickets, anchor],
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [pendingWarning, setPendingWarning] = useState<PendingMoveWarning | null>(
    null,
  );
  // Capture the visible cell at drag-start so direction checks use the UI
  // origin, not a re-parsed scheduled_start that can shift by timezone.
  const dragOriginRef = useRef<{
    ticketId: string;
    dayKey: string;
    windowId: string;
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

    const parsed = parseScheduledSlot(ticket);
    const durationHours = scheduled?.durationHours ?? parsed?.durationHours ?? 1;
    const originWindow =
      getWindowById(origin?.windowId) ??
      scheduled?.window ??
      parsed?.window;
    const sourceDayKey =
      origin?.dayKey ??
      (scheduled ? format(scheduled.day, "yyyy-MM-dd") : null) ??
      (parsed ? format(parsed.day, "yyyy-MM-dd") : null);

    if (!sourceDayKey || !originWindow) return;

    // Dropping on the same start slot is a no-op.
    if (sourceDayKey === destDayKey && originWindow.id === windowId) {
      clearDragState();
      return;
    }

    const destSpan = getSpanWindows(window, durationHours);
    if (destSpan.length < durationHours) {
      // Would run past end of day.
      clearDragState();
      return;
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

    const originDay = dayKeyToLocalDate(sourceDayKey);
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
            originWindow,
          ).toISOString(),
          swapScheduledWindow: formatScheduledWindow(
            originWindow.id,
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
      sourceDayKey,
      originWindow,
      destDayKey,
      window,
    );

    if (warning) {
      setPendingWarning({
        payload,
        ticket,
        priority: ticket.priority ?? "Medium",
        fromLabel: slotLabelFromKey(sourceDayKey, originWindow),
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
            Drag tickets between windows · {rangeLabel}
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
          ? "One-hour windows · longer jobs span multiple hours. Drag from the first hour of a job. Completed work stays visible but cannot be moved."
          : "Month view shows ticket counts and PTO days. Switch to Week to drag tickets between windows."}
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
                onClick={() => applyMove(pendingWarning.payload)}
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
