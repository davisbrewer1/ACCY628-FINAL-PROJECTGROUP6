import { calcSlaStatus } from "@/lib/calculations";
import type { ServiceTicket } from "@/lib/types";
import { differenceInMinutes, parseISO, isValid } from "date-fns";

export interface TechnicianPerformance {
  /** 1.0–5.0 quality score from SLA / response performance, or null if insufficient data */
  avgRating: number | null;
  /** Average hours from ticket open → first response */
  avgResponseHours: number | null;
  responseSampleSize: number;
  ratingSampleSize: number;
  responseOnTimeRate: number | null;
  resolutionOnTimeRate: number | null;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Hours from opened/created until responded_at for one ticket. */
export function ticketResponseHours(ticket: ServiceTicket): number | null {
  const start = toDate(ticket.opened_at) ?? toDate(ticket.created_at);
  const responded = toDate(ticket.responded_at);
  if (!start || !responded) return null;
  const minutes = differenceInMinutes(responded, start);
  if (minutes < 0) return null;
  return minutes / 60;
}

function respondedOnTime(ticket: ServiceTicket): boolean | null {
  const responded = toDate(ticket.responded_at);
  const target = toDate(ticket.target_response_at);
  if (!responded || !target) return null;
  return responded <= target;
}

/**
 * Derive average rating + average response time from assigned ticket outcomes.
 * Rating blends on-time first response and on-time resolution into a 1–5 score.
 */
export function computeTechnicianPerformance(
  technicianId: string,
  tickets: ServiceTicket[],
): TechnicianPerformance {
  const assigned = tickets.filter((t) => t.assigned_technician_id === technicianId);

  const responseHours: number[] = [];
  const responseOnTime: boolean[] = [];
  const resolutionOnTime: boolean[] = [];

  for (const ticket of assigned) {
    const hours = ticketResponseHours(ticket);
    if (hours != null) responseHours.push(hours);

    const onTimeResponse = respondedOnTime(ticket);
    if (onTimeResponse != null) responseOnTime.push(onTimeResponse);

    const status = ticket.status ?? "";
    if (status === "Completed" || status === "Closed") {
      const sla = calcSlaStatus({
        status: ticket.status,
        targetResolutionAt: ticket.target_resolution_at,
        completedAt: ticket.completed_at,
      });
      if (sla === "Completed on Time" || sla === "Completed Late") {
        resolutionOnTime.push(sla === "Completed on Time");
      }
    }
  }

  const avgResponseHours =
    responseHours.length > 0
      ? responseHours.reduce((sum, h) => sum + h, 0) / responseHours.length
      : null;

  const responseOnTimeRate =
    responseOnTime.length > 0
      ? responseOnTime.filter(Boolean).length / responseOnTime.length
      : null;

  const resolutionOnTimeRate =
    resolutionOnTime.length > 0
      ? resolutionOnTime.filter(Boolean).length / resolutionOnTime.length
      : null;

  // Need at least one quality signal to show a rating.
  const rateParts = [responseOnTimeRate, resolutionOnTimeRate].filter(
    (r): r is number => r != null,
  );

  let avgRating: number | null = null;
  if (rateParts.length > 0) {
    const quality = rateParts.reduce((sum, r) => sum + r, 0) / rateParts.length;
    // Map 0–100% SLA adherence to roughly 2.5–5.0 stars.
    avgRating = Math.round((2.5 + quality * 2.5) * 10) / 10;
    avgRating = Math.min(5, Math.max(1, avgRating));
  } else if (avgResponseHours != null) {
    // Fallback when we only have response speed: faster average → higher rating.
    // <= 1h → 5.0, 4h → 4.0, 12h → 3.0, 24h+ → ~2.5
    const speedScore = Math.max(0, Math.min(1, 1 - (avgResponseHours - 1) / 23));
    avgRating = Math.round((2.5 + speedScore * 2.5) * 10) / 10;
  }

  return {
    avgRating,
    avgResponseHours,
    responseSampleSize: responseHours.length,
    ratingSampleSize: rateParts.length > 0 ? Math.max(responseOnTime.length, resolutionOnTime.length) : responseHours.length,
    responseOnTimeRate,
    resolutionOnTimeRate,
  };
}

/** Human-readable response duration for technician cards. */
export function formatResponseDuration(hours: number | null | undefined): string {
  if (hours == null || Number.isNaN(hours)) return "—";
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} min`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)} hrs`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

export function formatStarRating(rating: number | null | undefined): string {
  if (rating == null || Number.isNaN(rating)) return "—";
  return `${rating.toFixed(1)} / 5`;
}
