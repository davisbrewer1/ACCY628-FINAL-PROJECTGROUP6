import type { SlaStatus, TicketStatus } from "@/lib/types";

export interface DirectCostBreakdown {
  labor?: number | null;
  parts?: number | null;
  software?: number | null;
  equipment?: number | null;
  travel?: number | null;
  other?: number | null;
}

export interface SlaStatusInput {
  status: TicketStatus | string | null | undefined;
  targetResolutionAt: string | Date | null | undefined;
  completedAt: string | Date | null | undefined;
  now?: Date;
}

const COMPLETED_STATUSES = new Set(["Completed", "Closed"]);

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function safeNumber(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) {
    return 0;
  }
  return value;
}

export function calcLaborCost(
  hours: number | null | undefined,
  hourlyRate: number | null | undefined,
): number {
  return safeNumber(hours) * safeNumber(hourlyRate);
}

export function calcTotalDirectCost(costs: DirectCostBreakdown): number {
  return (
    safeNumber(costs.labor) +
    safeNumber(costs.parts) +
    safeNumber(costs.software) +
    safeNumber(costs.equipment) +
    safeNumber(costs.travel) +
    safeNumber(costs.other)
  );
}

export function calcContractProfit(
  revenue: number | null | undefined,
  costs: number | null | undefined,
): number {
  return safeNumber(revenue) - safeNumber(costs);
}

export function calcProfitMargin(
  revenue: number | null | undefined,
  costs: number | null | undefined,
): number | null {
  const revenueValue = safeNumber(revenue);
  if (revenueValue === 0) {
    return null;
  }
  const profit = calcContractProfit(revenue, costs);
  return (profit / revenueValue) * 100;
}

export function calcSlaStatus({
  status,
  targetResolutionAt,
  completedAt,
  now = new Date(),
}: SlaStatusInput): SlaStatus {
  const normalizedStatus = status ?? "";

  if (COMPLETED_STATUSES.has(normalizedStatus)) {
    if (!targetResolutionAt || !completedAt) {
      return "Completed on Time";
    }
    const target = toDate(targetResolutionAt);
    const completed = toDate(completedAt);
    return completed <= target ? "Completed on Time" : "Completed Late";
  }

  if (!targetResolutionAt) {
    return "On Track";
  }

  const target = toDate(targetResolutionAt);
  const current = now;

  if (current > target) {
    return "Overdue";
  }

  const msUntilDeadline = target.getTime() - current.getTime();
  const approachingThresholdMs = 24 * 60 * 60 * 1000;

  if (msUntilDeadline <= approachingThresholdMs) {
    return "Approaching Deadline";
  }

  return "On Track";
}

export function hoursBetween(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): number | null {
  if (!startTime || !endTime) {
    return null;
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);

  if (startMinutes == null || endMinutes == null) {
    return null;
  }

  let diffMinutes = endMinutes - startMinutes;
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60;
  }

  return Math.round((diffMinutes / 60) * 100) / 100;
}

function parseTimeToMinutes(time: string): number | null {
  const trimmed = time.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}
