import { calcSlaStatus } from "@/lib/calculations";
import type { ServiceTicket, TicketRating } from "@/lib/types";
import { differenceInMinutes, parseISO, isValid } from "date-fns";

export interface TechnicianPerformance {
  /** Average client star rating (1–5), or null if no ratings yet */
  avgRating: number | null;
  /** Average hours from ticket open → first response */
  avgResponseHours: number | null;
  responseSampleSize: number;
  ratingSampleSize: number;
  responseOnTimeRate: number | null;
  resolutionOnTimeRate: number | null;
  /** True when avgRating comes from client portal ticket_ratings */
  ratingFromClients: boolean;
}

export interface ClientRatingStats {
  avgRating: number | null;
  ratingSampleSize: number;
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

/** Average client portal star ratings for one technician. */
export function computeClientRatingStats(
  technicianId: string,
  ratings: TicketRating[],
): ClientRatingStats {
  const scores = ratings
    .filter((item) => item.technician_id === technicianId)
    .map((item) => item.rating)
    .filter((score) => Number.isFinite(score) && score >= 1 && score <= 5);

  if (scores.length === 0) {
    return { avgRating: null, ratingSampleSize: 0 };
  }

  const avg =
    Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) /
    10;

  return {
    avgRating: Math.min(5, Math.max(1, avg)),
    ratingSampleSize: scores.length,
  };
}

/**
 * Derive average response time from assigned tickets.
 * Prefer client portal star ratings for avgRating when available.
 */
export function computeTechnicianPerformance(
  technicianId: string,
  tickets: ServiceTicket[],
  clientRatings: TicketRating[] = [],
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

  const clientStats = computeClientRatingStats(technicianId, clientRatings);

  return {
    avgRating: clientStats.avgRating,
    avgResponseHours,
    responseSampleSize: responseHours.length,
    ratingSampleSize: clientStats.ratingSampleSize,
    responseOnTimeRate,
    resolutionOnTimeRate,
    ratingFromClients: clientStats.ratingSampleSize > 0,
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
