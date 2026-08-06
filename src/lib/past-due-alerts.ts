import {
  daysOpen,
  getWorkOutstandingDueDays,
  isWorkOutstandingPastDue,
} from "@/lib/calculations";
import { isOpenTicket } from "@/lib/dashboard-stats";
import type { ServiceTicket } from "@/lib/types";

export type PastDueTicketAlert = {
  ticketId: string;
  ticketNumber: string;
  title: string;
  priority: string;
  status: string;
  technicianId: string | null;
  technicianName: string | null;
  dueAt: string;
  overdueHours: number;
  security: boolean;
  /** Technician-facing body (no tech name). */
  technicianBody: string;
  /** Manager-facing body (includes who is behind). */
  managerBody: string;
};

function buildTechnicianBody(ticket: ServiceTicket): string {
  const opened = ticket.opened_at ?? ticket.created_at;
  const openDays = daysOpen(opened) ?? 0;
  const dueDays = getWorkOutstandingDueDays(ticket.priority);
  const parts = [
    `${ticket.ticket_number} — ${ticket.title}`,
    `${ticket.priority ?? "Medium"} priority · ${ticket.status ?? "Open"}`,
    dueDays === 0
      ? `Due immediately · open ${openDays === 0 ? "today" : `${openDays} day${openDays === 1 ? "" : "s"}`}`
      : `Due within ${dueDays} day${dueDays === 1 ? "" : "s"} · open ${openDays} day${openDays === 1 ? "" : "s"}`,
  ];

  if (ticket.requester_name) {
    parts.push(`Requester: ${ticket.requester_name}`);
  }
  if (ticket.location) {
    parts.push(`Location: ${ticket.location}`);
  }
  if (ticket.cybersecurity_incident) {
    parts.push("Security incident");
  }

  return parts.join(" · ");
}

/**
 * Open tickets that have exceeded the priority work-outstanding window
 * (same rules as technician "Past due" notifications).
 */
export function buildPastDueTicketAlerts(
  tickets: ServiceTicket[],
  options?: {
    technicianNameById?: Map<string, string>;
    now?: Date;
  },
): PastDueTicketAlert[] {
  const now = options?.now ?? new Date();
  const nowMs = now.getTime();
  const nameById = options?.technicianNameById;

  return tickets
    .filter((ticket) => isOpenTicket(ticket.status))
    .filter((ticket) =>
      isWorkOutstandingPastDue({
        status: ticket.status,
        priority: ticket.priority,
        openedAt: ticket.opened_at,
        createdAt: ticket.created_at,
        now,
      }),
    )
    .map((ticket) => {
      const opened = ticket.opened_at ?? ticket.created_at;
      const dueDays = getWorkOutstandingDueDays(ticket.priority);
      const dueAt = new Date(
        new Date(opened).getTime() + dueDays * 24 * 60 * 60 * 1000,
      );
      const overdueHours = Math.max(0, (nowMs - dueAt.getTime()) / (1000 * 60 * 60));
      const technicianId = ticket.assigned_technician_id ?? null;
      const technicianName =
        (technicianId && nameById?.get(technicianId)) || null;
      const technicianBody = buildTechnicianBody(ticket);
      const who = technicianName?.trim() || "An unassigned technician";

      return {
        ticketId: ticket.id,
        ticketNumber: ticket.ticket_number,
        title: ticket.title,
        priority: ticket.priority ?? "Medium",
        status: ticket.status ?? "Open",
        technicianId,
        technicianName,
        dueAt: dueAt.toISOString(),
        overdueHours,
        security: Boolean(ticket.cybersecurity_incident),
        technicianBody,
        managerBody: `${who} is behind on schedule — ${technicianBody}`,
      };
    })
    .sort((a, b) => b.overdueHours - a.overdueHours);
}
