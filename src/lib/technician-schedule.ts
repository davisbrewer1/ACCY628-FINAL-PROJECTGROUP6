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
import { isOpenTicket } from "@/lib/dashboard-stats";
import type { ServiceTicket, Technician } from "@/lib/types";

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
 * Prefer `findNextOpenWindowFromKeys` when you already know every occupied hour.
 */
export function findNextOpenWindow(
  occupiedStarts: Array<string | null | undefined>,
  from = new Date(),
  durationHours = 1,
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

  return findNextOpenWindowFromKeys(occupiedKeys, from, durationHours);
}

/** Occupied hour keys for scheduled open tickets (includes multi-hour spans). */
export function occupiedSlotKeysForTickets(
  tickets: ServiceTicket[],
): Set<string> {
  const keys = new Set<string>();
  for (const ticket of tickets) {
    if (!isOpenTicket(ticket.status)) continue;
    const parsed = parseScheduledSlot(ticket);
    if (!parsed) continue;
    for (const window of parsed.spanWindows) {
      keys.add(slotKey(parsed.day, window.id));
    }
  }
  return keys;
}

/**
 * Next open start that has `durationHours` contiguous free windows.
 */
export function findNextOpenWindowFromKeys(
  occupiedKeys: Set<string>,
  from = new Date(),
  durationHours = 1,
): { scheduled_start: string; scheduled_window: string; start: Date } {
  const needed = Math.max(1, Math.round(durationHours));

  for (let weekOffset = 0; weekOffset < 8; weekOffset += 1) {
    const weekRef = addDays(
      startOfWeek(from, { weekStartsOn: 1 }),
      weekOffset * 7,
    );
    for (const day of getWorkWeekDays(weekRef)) {
      for (const window of WORK_WINDOWS) {
        const start = buildSlotStart(day, window);
        if (start.getTime() < from.getTime()) continue;
        const span = getSpanWindows(window, needed);
        if (span.length < needed) continue;
        const blocked = span.some((item) =>
          occupiedKeys.has(slotKey(day, item.id)),
        );
        if (blocked) continue;
        return {
          scheduled_start: start.toISOString(),
          scheduled_window: formatScheduledWindow(window.id, needed),
          start,
        };
      }
    }
  }

  const fallbackDay = addDays(startOfWeek(from, { weekStartsOn: 1 }), 7);
  const fallbackWindow = WORK_WINDOWS[0];
  return {
    scheduled_start: buildSlotStart(fallbackDay, fallbackWindow).toISOString(),
    scheduled_window: formatScheduledWindow(fallbackWindow.id, needed),
    start: buildSlotStart(fallbackDay, fallbackWindow),
  };
}

export function formatNextAvailableLabel(when: Date): string {
  return `${format(when, "EEE MMM d")} · ${format(when, "h:mma").toLowerCase()}`;
}

export interface TechnicianAvailabilityRank {
  technician: Technician;
  nextAvailable: Date;
  nextLabel: string;
  openScheduledCount: number;
}

/**
 * Rank active technicians by soonest free schedule slot (then lighter load).
 */
export function rankTechniciansByNextAvailable(
  technicians: Technician[],
  tickets: ServiceTicket[],
  options?: {
    durationHours?: number;
    from?: Date;
    /** Prefer skill matches first within the same availability window (±same hour). */
    skillMatchIds?: Set<string>;
  },
): TechnicianAvailabilityRank[] {
  const from = options?.from ?? new Date();
  const durationHours = options?.durationHours ?? 1;
  const skillMatchIds = options?.skillMatchIds;

  const openTickets = tickets.filter((ticket) => isOpenTicket(ticket.status));
  const byTech = new Map<string, ServiceTicket[]>();
  for (const ticket of openTickets) {
    if (!ticket.assigned_technician_id) continue;
    const list = byTech.get(ticket.assigned_technician_id) ?? [];
    list.push(ticket);
    byTech.set(ticket.assigned_technician_id, list);
  }

  const ranked = technicians
    .filter((tech) => tech.active !== false)
    .map((technician) => {
      const assigned = byTech.get(technician.id) ?? [];
      const occupied = occupiedSlotKeysForTickets(assigned);
      const next = findNextOpenWindowFromKeys(occupied, from, durationHours);
      return {
        technician,
        nextAvailable: next.start,
        nextLabel: formatNextAvailableLabel(next.start),
        openScheduledCount: assigned.filter((ticket) =>
          Boolean(ticket.scheduled_start),
        ).length,
      } satisfies TechnicianAvailabilityRank;
    });

  ranked.sort((a, b) => {
    const timeDiff = a.nextAvailable.getTime() - b.nextAvailable.getTime();
    // Prefer skill match when availability is within the same hour.
    if (skillMatchIds && Math.abs(timeDiff) < 60 * 60 * 1000) {
      const aMatch = skillMatchIds.has(a.technician.id) ? 0 : 1;
      const bMatch = skillMatchIds.has(b.technician.id) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
    }
    if (timeDiff !== 0) return timeDiff;
    if (a.openScheduledCount !== b.openScheduledCount) {
      return a.openScheduledCount - b.openScheduledCount;
    }
    return a.technician.technician_name.localeCompare(
      b.technician.technician_name,
    );
  });

  return ranked;
}

/** Parse a yyyy-MM-dd (or ISO) date as a local calendar day. */
export function parseLocalDateKey(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function toDateKey(day: Date): string {
  return format(day, "yyyy-MM-dd");
}

/** Next Mon–Fri on or after `from` (skips weekends). */
export function nextBusinessDay(from: Date): Date {
  let day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < 14; i += 1) {
    const weekday = day.getDay();
    if (weekday !== 0 && weekday !== 6) return day;
    day = addDays(day, 1);
  }
  return day;
}

/** Business day immediately after `from` (skips weekends). */
export function followingBusinessDay(from: Date): Date {
  return nextBusinessDay(addDays(parseLocalDateKey(from), 1));
}

function occupancyForTechnician(
  tickets: ServiceTicket[],
  technicianId: string,
): Set<string> {
  return occupiedSlotKeysForTickets(
    tickets.filter(
      (ticket) =>
        ticket.assigned_technician_id === technicianId &&
        isOpenTicket(ticket.status),
    ),
  );
}

/** True when the tech has `durationHours` contiguous free windows on `day`. */
export function technicianHasOpeningOnDay(
  tickets: ServiceTicket[],
  technicianId: string,
  day: Date,
  durationHours = 1,
): boolean {
  const occupied = occupancyForTechnician(tickets, technicianId);
  const needed = Math.max(1, Math.round(durationHours));
  const target = parseLocalDateKey(day);

  for (const window of WORK_WINDOWS) {
    const span = getSpanWindows(window, needed);
    if (span.length < needed) continue;
    const blocked = span.some((item) =>
      occupied.has(slotKey(target, item.id)),
    );
    if (!blocked) return true;
  }
  return false;
}

/**
 * Days (Mon–Fri) in the next `weekCount` weeks where at least one active
 * technician has a free hour slot. Specialty is ignored.
 */
export function getCustomerSelectableServiceDates(
  technicians: Technician[],
  tickets: ServiceTicket[],
  options?: {
    from?: Date;
    weekCount?: number;
    durationHours?: number;
  },
): string[] {
  const from = options?.from ?? new Date();
  const weekCount = options?.weekCount ?? 8;
  const durationHours = options?.durationHours ?? 1;
  const active = technicians.filter((tech) => tech.active !== false);
  const dates: string[] = [];
  const startMonday = startOfWeek(from, { weekStartsOn: 1 });

  for (let weekOffset = 0; weekOffset < weekCount; weekOffset += 1) {
    for (const day of getWorkWeekDays(addDays(startMonday, weekOffset * 7))) {
      if (day.getTime() < parseLocalDateKey(from).getTime()) continue;
      const open = active.some((tech) =>
        technicianHasOpeningOnDay(tickets, tech.id, day, durationHours),
      );
      if (open) dates.push(toDateKey(day));
    }
  }

  return dates;
}

export interface DayAvailabilityRank {
  technician: Technician;
  hasOpeningOnDay: boolean;
  freeHoursOnDay: number;
  nextSlotOnDay: Date | null;
  nextLabel: string;
  openScheduledCount: number;
}

/**
 * Rank technicians by openings on a specific locked service day
 * (most free capacity / earliest slot that day first).
 */
export function rankTechniciansByDayAvailability(
  technicians: Technician[],
  tickets: ServiceTicket[],
  lockedDate: string | Date,
  options?: {
    durationHours?: number;
    skillMatchIds?: Set<string>;
  },
): DayAvailabilityRank[] {
  const day = parseLocalDateKey(lockedDate);
  const durationHours = options?.durationHours ?? 1;
  const skillMatchIds = options?.skillMatchIds;
  const needed = Math.max(1, Math.round(durationHours));

  const openTickets = tickets.filter((ticket) => isOpenTicket(ticket.status));
  const byTech = new Map<string, ServiceTicket[]>();
  for (const ticket of openTickets) {
    if (!ticket.assigned_technician_id) continue;
    const list = byTech.get(ticket.assigned_technician_id) ?? [];
    list.push(ticket);
    byTech.set(ticket.assigned_technician_id, list);
  }

  const ranked = technicians
    .filter((tech) => tech.active !== false)
    .map((technician) => {
      const assigned = byTech.get(technician.id) ?? [];
      const occupied = occupiedSlotKeysForTickets(assigned);
      let freeHoursOnDay = 0;
      let nextSlotOnDay: Date | null = null;

      for (const window of WORK_WINDOWS) {
        if (!occupied.has(slotKey(day, window.id))) {
          freeHoursOnDay += 1;
        }
      }

      for (const window of WORK_WINDOWS) {
        const span = getSpanWindows(window, needed);
        if (span.length < needed) continue;
        const blocked = span.some((item) =>
          occupied.has(slotKey(day, item.id)),
        );
        if (blocked) continue;
        nextSlotOnDay = buildSlotStart(day, window);
        break;
      }

      return {
        technician,
        hasOpeningOnDay: nextSlotOnDay != null,
        freeHoursOnDay,
        nextSlotOnDay,
        nextLabel: nextSlotOnDay
          ? formatNextAvailableLabel(nextSlotOnDay)
          : "No opening that day",
        openScheduledCount: assigned.filter((ticket) =>
          Boolean(ticket.scheduled_start),
        ).length,
      } satisfies DayAvailabilityRank;
    });

  ranked.sort((a, b) => {
    if (a.hasOpeningOnDay !== b.hasOpeningOnDay) {
      return a.hasOpeningOnDay ? -1 : 1;
    }
    if (skillMatchIds && a.hasOpeningOnDay && b.hasOpeningOnDay) {
      const aMatch = skillMatchIds.has(a.technician.id) ? 0 : 1;
      const bMatch = skillMatchIds.has(b.technician.id) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
    }
    if (a.nextSlotOnDay && b.nextSlotOnDay) {
      const slotDiff =
        a.nextSlotOnDay.getTime() - b.nextSlotOnDay.getTime();
      if (slotDiff !== 0) return slotDiff;
    }
    if (a.freeHoursOnDay !== b.freeHoursOnDay) {
      return b.freeHoursOnDay - a.freeHoursOnDay;
    }
    if (a.openScheduledCount !== b.openScheduledCount) {
      return a.openScheduledCount - b.openScheduledCount;
    }
    return a.technician.technician_name.localeCompare(
      b.technician.technician_name,
    );
  });

  return ranked;
}

/**
 * Allowed calendar days for placing a ticket with a locked service date:
 * the locked day, or the following business day when the locked day has no
 * opening for this technician at the needed duration.
 */
export function allowedScheduleDaysForTicket(
  ticket: ServiceTicket,
  tickets: ServiceTicket[],
  technicianId: string,
  durationHours?: number,
): { lockedDay: Date; allowedDays: Date[]; dayAfterAllowed: boolean } | null {
  if (!ticket.locked_service_date || ticket.is_asap) return null;

  const lockedDay = parseLocalDateKey(ticket.locked_service_date);
  const hours =
    durationHours ??
    Math.max(1, Number(ticket.max_hours) || 1);
  const hasLockedDay = technicianHasOpeningOnDay(
    tickets,
    technicianId,
    lockedDay,
    hours,
  );
  if (hasLockedDay) {
    return { lockedDay, allowedDays: [lockedDay], dayAfterAllowed: false };
  }

  const dayAfter = followingBusinessDay(lockedDay);
  return {
    lockedDay,
    allowedDays: [lockedDay, dayAfter],
    dayAfterAllowed: true,
  };
}

export function formatLockedServiceDateLabel(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  return format(parseLocalDateKey(value), "EEE MMM d, yyyy");
}

export function shiftWeek(reference: Date, direction: -1 | 1): Date {
  const monday = startOfWeek(reference, { weekStartsOn: 1 });
  return direction === 1 ? nextMonday(monday) : previousMonday(monday);
}
