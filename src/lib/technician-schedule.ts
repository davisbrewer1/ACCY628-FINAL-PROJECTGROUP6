import {
  addDays,
  format,
  isSameDay,
  nextMonday,
  previousMonday,
  setHours,
  setMinutes,
  setSeconds,
  startOfWeek,
} from "date-fns";
import type { ServiceTicket } from "@/lib/types";

export interface WorkWindow {
  id: string;
  label: string;
  startHour: number;
  endHour: number;
}

/**
 * One-hour weekday work windows (8:00–5:00), including noon.
 * Longer jobs span multiple contiguous windows via scheduled_window "h08x3".
 */
export const WORK_WINDOWS: WorkWindow[] = [
  { id: "h08", label: "8:00–9:00", startHour: 8, endHour: 9 },
  { id: "h09", label: "9:00–10:00", startHour: 9, endHour: 10 },
  { id: "h10", label: "10:00–11:00", startHour: 10, endHour: 11 },
  { id: "h11", label: "11:00–12:00", startHour: 11, endHour: 12 },
  { id: "h12", label: "12:00–1:00", startHour: 12, endHour: 13 },
  { id: "h13", label: "1:00–2:00", startHour: 13, endHour: 14 },
  { id: "h14", label: "2:00–3:00", startHour: 14, endHour: 15 },
  { id: "h15", label: "3:00–4:00", startHour: 15, endHour: 16 },
  { id: "h16", label: "4:00–5:00", startHour: 16, endHour: 17 },
];

/** Default technician id (Terry Tech) — used for demo data, not portal auto-assign. */
export const DEFAULT_TECHNICIAN_ID = "33333333-3333-3333-3333-333333333301";

export interface ScheduledTicket {
  ticket: ServiceTicket;
  day: Date;
  /** First hour window of the job. */
  window: WorkWindow;
  /** Whole hours occupied on the grid (ceil of real duration, min 1). */
  durationHours: number;
  /** Contiguous windows covered. */
  spanWindows: WorkWindow[];
  persisted: boolean;
}

const LEGACY_WINDOW_MAP: Record<string, { startId: string; hours: number }> = {
  am1: { startId: "h08", hours: 2 },
  am2: { startId: "h10", hours: 2 },
  pm1: { startId: "h13", hours: 2 },
  pm2: { startId: "h15", hours: 2 },
  "morning window": { startId: "h08", hours: 2 },
  "afternoon window": { startId: "h13", hours: 2 },
  flexible: { startId: "h08", hours: 1 },
};

export function getWindowById(id: string | null | undefined): WorkWindow | undefined {
  if (!id) return undefined;
  const normalized = id.split("x")[0]?.toLowerCase();
  return WORK_WINDOWS.find((window) => window.id === normalized);
}

export function formatScheduledWindow(
  windowId: string,
  durationHours = 1,
): string {
  const hours = Math.max(1, Math.round(durationHours));
  return hours <= 1 ? windowId : `${windowId}x${hours}`;
}

export function parseWindowSpec(
  raw: string | null | undefined,
): { windowId: string; durationHours: number } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const legacy = LEGACY_WINDOW_MAP[trimmed.toLowerCase()];
  if (legacy) {
    return { windowId: legacy.startId, durationHours: legacy.hours };
  }

  const match = /^(h\d{2}|am[12]|pm[12])(?:x(\d+))?$/i.exec(trimmed);
  if (!match) return null;

  let windowId = match[1].toLowerCase();
  if (windowId === "am1") windowId = "h08";
  if (windowId === "am2") windowId = "h10";
  if (windowId === "pm1") windowId = "h13";
  if (windowId === "pm2") windowId = "h15";

  const durationHours = match[2] ? Math.max(1, Number(match[2])) : 1;
  return { windowId, durationHours };
}

/** Contiguous hour windows starting at `start`, through end of day. */
export function getSpanWindows(
  start: WorkWindow,
  durationHours: number,
): WorkWindow[] {
  const startIdx = WORK_WINDOWS.findIndex((item) => item.id === start.id);
  if (startIdx < 0) return [start];

  const needed = Math.max(1, Math.round(durationHours));
  return WORK_WINDOWS.slice(startIdx, startIdx + needed);
}

/** Monday–Friday dates for the week containing `reference`. */
export function getWorkWeekDays(reference = new Date()): Date[] {
  const monday = startOfWeek(reference, { weekStartsOn: 1 });
  return [0, 1, 2, 3, 4].map((offset) => addDays(monday, offset));
}

export function formatWeekRange(days: Date[]): string {
  if (days.length === 0) return "";
  const start = days[0];
  const end = days[days.length - 1];
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

export function buildSlotStart(day: Date, window: WorkWindow): Date {
  return setSeconds(setMinutes(setHours(new Date(day), window.startHour), 0), 0);
}

export function slotKey(day: Date, windowId: string): string {
  return `${format(day, "yyyy-MM-dd")}|${windowId}`;
}

export function parseScheduledSlot(
  ticket: ServiceTicket,
): {
  day: Date;
  window: WorkWindow;
  durationHours: number;
  spanWindows: WorkWindow[];
} | null {
  if (!ticket.scheduled_start) return null;
  const instant = new Date(ticket.scheduled_start);
  if (Number.isNaN(instant.getTime())) return null;

  const day = new Date(
    instant.getFullYear(),
    instant.getMonth(),
    instant.getDate(),
  );

  const spec =
    parseWindowSpec(ticket.scheduled_window) ??
    (() => {
      const byHour = WORK_WINDOWS.find(
        (item) => item.startHour === instant.getHours(),
      );
      return byHour
        ? { windowId: byHour.id, durationHours: 1 }
        : { windowId: WORK_WINDOWS[0].id, durationHours: 1 };
    })();

  const window = getWindowById(spec.windowId) ?? WORK_WINDOWS[0];
  const spanWindows = getSpanWindows(window, spec.durationHours);

  return {
    day,
    window,
    durationHours: spanWindows.length,
    spanWindows,
  };
}

/**
 * Build the weekly calendar from manager-persisted schedules only.
 * Multi-hour jobs occupy contiguous hour cells.
 */
export function scheduleTicketsForWeek(
  tickets: ServiceTicket[],
  reference = new Date(),
): ScheduledTicket[] {
  const weekDays = getWorkWeekDays(reference);
  const items: ScheduledTicket[] = [];

  for (const ticket of tickets) {
    const parsed = parseScheduledSlot(ticket);
    if (!parsed) continue;
    if (!weekDays.some((day) => isSameDay(day, parsed.day))) continue;
    items.push({
      ticket,
      day: parsed.day,
      window: parsed.window,
      durationHours: parsed.durationHours,
      spanWindows: parsed.spanWindows,
      persisted: true,
    });
  }

  return items.sort(
    (a, b) =>
      a.day.getTime() - b.day.getTime() ||
      a.window.startHour - b.window.startHour,
  );
}

/** Map every occupied hour slot -> scheduled ticket for that day. */
export function buildOccupancyMap(
  schedule: ScheduledTicket[],
): Map<string, ScheduledTicket> {
  const map = new Map<string, ScheduledTicket>();
  for (const item of schedule) {
    for (const window of item.spanWindows) {
      map.set(slotKey(item.day, window.id), item);
    }
  }
  return map;
}

export function ticketsForDay(
  schedule: ScheduledTicket[],
  day: Date,
): ScheduledTicket[] {
  return schedule.filter((item) => isSameDay(item.day, day));
}

/**
 * Find the next open Mon–Fri hour after `from`, skipping occupied starts.
 */
export function findNextOpenWindow(
  occupiedStarts: Array<string | null | undefined>,
  from = new Date(),
): { scheduled_start: string; scheduled_window: string } {
  const occupiedKeys = new Set(
    occupiedStarts
      .filter(Boolean)
      .map((value) => {
        const date = new Date(value as string);
        if (Number.isNaN(date.getTime())) return null;
        const hour = date.getHours();
        const window =
          WORK_WINDOWS.find((item) => item.startHour === hour) ?? WORK_WINDOWS[0];
        return slotKey(date, window.id);
      })
      .filter(Boolean) as string[],
  );

  for (let weekOffset = 0; weekOffset < 8; weekOffset += 1) {
    const weekRef = addDays(startOfWeek(from, { weekStartsOn: 1 }), weekOffset * 7);
    for (const day of getWorkWeekDays(weekRef)) {
      for (const window of WORK_WINDOWS) {
        const start = buildSlotStart(day, window);
        if (start.getTime() < from.getTime()) continue;
        const key = slotKey(day, window.id);
        if (occupiedKeys.has(key)) continue;
        return {
          scheduled_start: start.toISOString(),
          scheduled_window: window.id,
        };
      }
    }
  }

  const fallbackDay = addDays(startOfWeek(from, { weekStartsOn: 1 }), 7);
  const fallbackWindow = WORK_WINDOWS[0];
  return {
    scheduled_start: buildSlotStart(fallbackDay, fallbackWindow).toISOString(),
    scheduled_window: fallbackWindow.id,
  };
}

export function shiftWeek(reference: Date, direction: -1 | 1): Date {
  const monday = startOfWeek(reference, { weekStartsOn: 1 });
  return direction === 1 ? nextMonday(monday) : previousMonday(monday);
}
