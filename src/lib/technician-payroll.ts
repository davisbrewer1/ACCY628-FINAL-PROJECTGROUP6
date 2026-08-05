import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { WorkEntry } from "@/lib/types";

/** Typical mid-range US IT support / MSP field technician pay rate. */
export const DEFAULT_TECH_HOURLY_RATE = 38;

/** Annual PTO allotment when not set on the technician record (10 days). */
export const DEFAULT_ANNUAL_PTO_HOURS = 80;

/** Biweekly pay periods aligned to Monday starts. */
export function getCurrentPayPeriod(reference = new Date()): { start: Date; end: Date } {
  const monday = startOfWeek(reference, { weekStartsOn: 1 });
  // Anchor: first Monday of 2024, then 14-day cycles
  const anchor = startOfWeek(new Date(2024, 0, 1), { weekStartsOn: 1 });
  const daysSinceAnchor = Math.floor(
    (monday.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000),
  );
  const periodIndex = Math.floor(daysSinceAnchor / 14);
  const start = addDays(anchor, periodIndex * 14);
  const end = addDays(start, 13);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Parse YYYY-MM-DD (or ISO datetime) as a local calendar date at midnight. */
function parseWorkDateLocal(value: string): Date | null {
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dayOnly) {
    const year = Number(dayOnly[1]);
    const month = Number(dayOnly[2]);
    const day = Number(dayOnly[3]);
    const local = new Date(year, month - 1, day, 0, 0, 0, 0);
    return Number.isNaN(local.getTime()) ? null : local;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    0,
    0,
    0,
    0,
  );
}

export function sumHoursInRange(
  entries: WorkEntry[],
  start: Date,
  end: Date,
): number {
  const rangeStart = new Date(start);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(end);
  rangeEnd.setHours(23, 59, 59, 999);

  return entries
    .filter((entry) => {
      if (!entry.work_date) return false;
      const date = parseWorkDateLocal(String(entry.work_date));
      if (!date) return false;
      return isWithinInterval(date, { start: rangeStart, end: rangeEnd });
    })
    .reduce((sum, entry) => sum + Number(entry.hours_worked ?? 0), 0);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getMonthGridDays(reference: Date): Date[] {
  const monthStart = startOfMonth(reference);
  const monthEnd = endOfMonth(reference);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

export function isWeekend(date: Date): boolean {
  const day = getDay(date);
  return day === 0 || day === 6;
}

export { isSameMonth, format, startOfMonth, endOfMonth };
