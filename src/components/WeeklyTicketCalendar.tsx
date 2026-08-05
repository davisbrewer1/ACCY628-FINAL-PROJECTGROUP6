"use client";

import { useMemo, useState, useTransition, type DragEvent } from "react";
import {
  addDays,
  addWeeks,
  format,
  getHours,
  getMinutes,
  isSameDay,
  isSameWeek,
  parseISO,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { updateTicketSchedule } from "@/app/actions/tickets";
import { calcSlaStatus } from "@/lib/calculations";
import { InlineTicketActions } from "@/components/InlineTicketActions";
import { PriorityBadge } from "@/components/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatDateTime } from "@/lib/format";
import type { ServiceTicket } from "@/lib/types";

const DRAG_MIME = "application/x-nexus-ticket-id";

interface WeeklyTicketCalendarProps {
  tickets: ServiceTicket[];
  technicianId: string;
  onUpdated?: () => void | Promise<void>;
  onLogWork?: (ticketId: string) => void;
}

/** Pick the calendar day for a ticket. */
export function getTicketScheduleDate(
  ticket: ServiceTicket,
  overrides?: Record<string, string | null>,
): Date | null {
  const hasOverride = overrides != null && ticket.id in overrides;
  if (hasOverride) {
    const override = overrides![ticket.id];
    if (!override) return null;
    try {
      return parseISO(override);
    } catch {
      return null;
    }
  }

  if (!ticket.scheduled_start && ticket.scheduled_window === "Unscheduled") {
    return null;
  }

  const raw =
    ticket.scheduled_start ||
    ticket.target_resolution_at ||
    ticket.opened_at ||
    ticket.created_at;
  if (!raw) return null;
  try {
    return parseISO(raw);
  } catch {
    return null;
  }
}

function dayKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function buildScheduledStart(day: Date, previous: Date | null): string {
  const hours = previous ? getHours(previous) : 9;
  const minutes = previous ? getMinutes(previous) : 0;
  return setSeconds(
    setMinutes(setHours(startOfDay(day), hours), minutes),
    0,
  ).toISOString();
}

export function WeeklyTicketCalendar({
  tickets,
  technicianId,
  onUpdated,
  onLogWork,
}: WeeklyTicketCalendarProps) {
  const { showToast } = useToast();
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scheduleOverrides, setScheduleOverrides] = useState<
    Record<string, string | null>
  >({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const weekStart = useMemo(
    () => startOfWeek(weekAnchor, { weekStartsOn: 1 }),
    [weekAnchor],
  );

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const ticketsByDay = useMemo(() => {
    const map = new Map<string, ServiceTicket[]>();
    for (const day of days) {
      map.set(dayKey(day), []);
    }

    const unscheduled: ServiceTicket[] = [];

    for (const ticket of tickets) {
      const when = getTicketScheduleDate(ticket, scheduleOverrides);
      if (!when || !isSameWeek(when, weekStart, { weekStartsOn: 1 })) {
        unscheduled.push(ticket);
        continue;
      }
      const key = dayKey(when);
      const list = map.get(key);
      if (list) {
        list.push(ticket);
      } else {
        unscheduled.push(ticket);
      }
    }

    for (const list of map.values()) {
      list.sort((a, b) => {
        const aTime =
          getTicketScheduleDate(a, scheduleOverrides)?.getTime() ?? 0;
        const bTime =
          getTicketScheduleDate(b, scheduleOverrides)?.getTime() ?? 0;
        return aTime - bTime;
      });
    }

    return { map, unscheduled };
  }, [tickets, days, weekStart, scheduleOverrides]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) ?? null;
  const today = new Date();
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(
    addDays(weekStart, 6),
    "MMM d, yyyy",
  )}`;

  function moveTicket(ticketId: string, targetDayKey: string | null) {
    const ticket = tickets.find((item) => item.id === ticketId);
    if (!ticket) return;

    const previous = getTicketScheduleDate(ticket, scheduleOverrides);
    let nextStart: string | null = null;

    if (targetDayKey) {
      const day = days.find((item) => dayKey(item) === targetDayKey);
      if (!day) return;
      // Same day — nothing to do
      if (previous && dayKey(previous) === targetDayKey) return;
      nextStart = buildScheduledStart(day, previous);
    }

    const priorOverride = scheduleOverrides[ticketId];
    setScheduleOverrides((current) => ({
      ...current,
      [ticketId]: nextStart,
    }));

    startTransition(async () => {
      const result = await updateTicketSchedule({
        ticketId,
        scheduledStart: nextStart,
        scheduledWindow: nextStart
          ? ticket.scheduled_window === "Unscheduled"
            ? "Custom"
            : ticket.scheduled_window ?? "Custom"
          : "Unscheduled",
      });

      if (!result.success) {
        setScheduleOverrides((current) => {
          const copy = { ...current };
          if (priorOverride === undefined) {
            delete copy[ticketId];
          } else {
            copy[ticketId] = priorOverride;
          }
          return copy;
        });
        showToast(result.message, "error");
        return;
      }

      showToast(
        nextStart
          ? `Moved to ${format(parseISO(nextStart), "EEE, MMM d")}`
          : "Removed from this week",
      );
      await onUpdated?.();
    });
  }

  function onDragStart(event: DragEvent, ticketId: string) {
    event.dataTransfer.setData(DRAG_MIME, ticketId);
    event.dataTransfer.setData("text/plain", ticketId);
    event.dataTransfer.effectAllowed = "move";
    setDraggingId(ticketId);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  function onDragOverDay(event: DragEvent, key: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropTarget !== key) {
      setDropTarget(key);
    }
  }

  function onDropDay(event: DragEvent, key: string | null) {
    event.preventDefault();
    const ticketId =
      event.dataTransfer.getData(DRAG_MIME) ||
      event.dataTransfer.getData("text/plain");
    setDropTarget(null);
    setDraggingId(null);
    if (!ticketId) return;
    moveTicket(ticketId, key);
  }

  function TicketCard({
    ticket,
    compact = false,
  }: {
    ticket: ServiceTicket;
    compact?: boolean;
  }) {
    const active = selectedId === ticket.id;
    const dragging = draggingId === ticket.id;

    return (
      <div
        role="button"
        tabIndex={0}
        draggable
        onDragStart={(event) => onDragStart(event, ticket.id)}
        onDragEnd={onDragEnd}
        onClick={() =>
          setSelectedId((current) => (current === ticket.id ? null : ticket.id))
        }
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedId((current) =>
              current === ticket.id ? null : ticket.id,
            );
          }
        }}
        className={`w-full cursor-grab rounded-md border text-left transition active:cursor-grabbing ${
          compact ? "px-2.5 py-1.5 text-sm" : "px-1.5 py-1.5"
        } ${
          active
            ? "border-primary bg-primary/15"
            : "border-base-300 bg-base-200/60 hover:border-primary/50"
        } ${dragging ? "opacity-40" : ""} ${isPending ? "pointer-events-none" : ""}`}
      >
        <div className="flex items-start gap-1">
          <GripVertical
            className="mt-0.5 size-3.5 shrink-0 opacity-40"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p
              className={`font-medium leading-snug ${
                compact ? "" : "line-clamp-2 text-[11px]"
              }`}
            >
              {ticket.title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className="font-mono text-[10px] text-base-content/55">
                {ticket.ticket_number}
              </span>
              {!compact ? (
                <PriorityBadge priority={ticket.priority ?? "Medium"} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card border bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="card-title text-base">Assigned tickets</h2>
            <p className="text-sm text-base-content/60">
              Drag tickets between days to customize your week
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Previous week"
              onClick={() => setWeekAnchor((current) => subWeeks(current, 1))}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setWeekAnchor(new Date())}
            >
              Today
            </button>
            <span className="min-w-[10rem] text-center text-sm font-medium">
              {weekLabel}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Next week"
              onClick={() => setWeekAnchor((current) => addWeeks(current, 1))}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
          {days.map((day) => {
            const key = dayKey(day);
            const dayTickets = ticketsByDay.map.get(key) ?? [];
            const isToday = isSameDay(day, today);
            const isDropHover = dropTarget === key;

            return (
              <div
                key={key}
                onDragOver={(event) => onDragOverDay(event, key)}
                onDragLeave={() =>
                  setDropTarget((current) => (current === key ? null : current))
                }
                onDrop={(event) => onDropDay(event, key)}
                className={`min-h-[9rem] rounded-box border p-2 transition ${
                  isDropHover
                    ? "border-primary border-dashed bg-primary/10"
                    : isToday
                      ? "border-primary bg-primary/5"
                      : "border-base-300 bg-base-100"
                }`}
              >
                <div className="mb-2 flex items-baseline justify-between gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-base-content/55">
                    {format(day, "EEE")}
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      isToday ? "text-primary" : ""
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {dayTickets.length === 0 ? (
                    <p className="px-0.5 text-[11px] text-base-content/40">
                      {isDropHover ? "Drop here" : "—"}
                    </p>
                  ) : (
                    dayTickets.map((ticket) => (
                      <TicketCard key={ticket.id} ticket={ticket} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div
          onDragOver={(event) => onDragOverDay(event, "unscheduled")}
          onDragLeave={() =>
            setDropTarget((current) =>
              current === "unscheduled" ? null : current,
            )
          }
          onDrop={(event) => onDropDay(event, null)}
          className={`rounded-box border border-dashed p-3 transition ${
            dropTarget === "unscheduled"
              ? "border-primary bg-primary/10"
              : "border-base-300"
          }`}
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/55">
            Outside this week / unscheduled
          </p>
          <div className="flex flex-wrap gap-2">
            {ticketsByDay.unscheduled.length === 0 ? (
              <p className="text-xs text-base-content/45">
                Drag a ticket here to clear it from this week.
              </p>
            ) : (
              ticketsByDay.unscheduled.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} compact />
              ))
            )}
          </div>
        </div>

        {selected ? (
          <div className="rounded-box border border-base-300 bg-base-200/30 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{selected.title}</p>
                <p className="text-xs text-base-content/60">
                  {selected.ticket_number}
                  {(() => {
                    const when = getTicketScheduleDate(
                      selected,
                      scheduleOverrides,
                    );
                    return when
                      ? ` · Scheduled ${formatDateTime(when.toISOString())}`
                      : "";
                  })()}
                  {selected.scheduled_window
                    ? ` · ${selected.scheduled_window}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PriorityBadge priority={selected.priority ?? "Medium"} />
                <StatusBadge status={selected.status ?? "New"} />
                <StatusBadge
                  status={calcSlaStatus({
                    status: selected.status,
                    targetResolutionAt: selected.target_resolution_at,
                    completedAt: selected.completed_at,
                  })}
                />
              </div>
            </div>
            {(selected.cybersecurity_incident || selected.ai_involved) && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selected.cybersecurity_incident ? (
                  <span className="badge badge-warning badge-sm">Security</span>
                ) : null}
                {selected.ai_involved ? (
                  <span className="badge badge-info badge-sm">AI</span>
                ) : null}
              </div>
            )}
            {selected.description ? (
              <p className="mt-2 text-sm text-base-content/70">
                {selected.description}
              </p>
            ) : null}
            <InlineTicketActions
              ticketId={selected.id}
              currentStatus={selected.status ?? "Assigned"}
              technicianId={technicianId}
              customerId={selected.customer_id}
              contractId={selected.contract_id}
              cybersecurityIncident={selected.cybersecurity_incident}
              onUpdated={onUpdated}
              onLogWork={() => onLogWork?.(selected.id)}
            />
          </div>
        ) : (
          <p className="text-center text-sm text-base-content/50">
            Drag tickets to reschedule, or click one for details and actions.
          </p>
        )}
      </div>
    </div>
  );
}
