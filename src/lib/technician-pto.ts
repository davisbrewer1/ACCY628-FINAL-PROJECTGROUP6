import {
  eachDayOfInterval,
  format,
  parseISO,
} from "date-fns";

export interface PtoDateRange {
  start_date: string;
  end_date: string;
  status?: string | null;
}

/** Expand Approved PTO ranges into yyyy-MM-dd keys (inclusive). */
export function buildApprovedPtoDateSet(
  requests: PtoDateRange[],
): Set<string> {
  const dates = new Set<string>();
  for (const request of requests) {
    if (String(request.status ?? "").toLowerCase() !== "approved") continue;
    expandPtoRangeIntoSet(request.start_date, request.end_date, dates);
  }
  return dates;
}

/** Expand Pending + Approved PTO (for calendar badges). */
export function buildActivePtoDateSet(requests: PtoDateRange[]): Set<string> {
  const dates = new Set<string>();
  for (const request of requests) {
    const status = String(request.status ?? "").toLowerCase();
    if (status === "denied" || status === "cancelled") continue;
    expandPtoRangeIntoSet(request.start_date, request.end_date, dates);
  }
  return dates;
}

function expandPtoRangeIntoSet(
  startRaw: string,
  endRaw: string,
  dates: Set<string>,
) {
  try {
    const start = parseISO(String(startRaw).slice(0, 10));
    const end = parseISO(String(endRaw).slice(0, 10));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    for (const day of eachDayOfInterval({ start, end })) {
      dates.add(format(day, "yyyy-MM-dd"));
    }
  } catch {
    // ignore malformed ranges
  }
}

/** True when the technician has approved PTO covering dayKey (yyyy-MM-dd). */
export function technicianOnApprovedPto(
  requests: PtoDateRange[],
  technicianId: string | null | undefined,
  dayKey: string,
  requestsWithTechId?: Array<PtoDateRange & { technician_id?: string }>,
): boolean {
  const key = String(dayKey).slice(0, 10);
  const scoped = (requestsWithTechId ?? requests).filter((request) => {
    if (!technicianId) return true;
    const id = (request as { technician_id?: string }).technician_id;
    return !id || id === technicianId;
  });
  return buildApprovedPtoDateSet(scoped).has(key);
}

/**
 * Map technicianId → set of approved PTO day keys.
 */
export function buildApprovedPtoByTechnician(
  requests: Array<PtoDateRange & { technician_id: string }>,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const request of requests) {
    if (String(request.status ?? "").toLowerCase() !== "approved") continue;
    let set = map.get(request.technician_id);
    if (!set) {
      set = new Set<string>();
      map.set(request.technician_id, set);
    }
    expandPtoRangeIntoSet(request.start_date, request.end_date, set);
  }
  return map;
}
