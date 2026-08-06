import { addMinutes, format } from "date-fns";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  getWindowById,
  parseScheduledSlot,
  parseWindowSpec,
} from "@/lib/technician-schedule";
import type { ServiceTicket, WorkEntry } from "@/lib/types";

export type LiveStepState = "complete" | "active" | "upcoming";

export interface TicketLiveStep {
  id: string;
  label: string;
  detail: string;
  state: LiveStepState;
  at?: string | null;
}

/** How early a tech may arrive vs scheduled start. */
export const ARRIVAL_EARLY_BUFFER_MINUTES = 15;
/** Extra wait window after scheduled start for travel / prior-job delays. */
export const ARRIVAL_LATE_BUFFER_MINUTES = 45;

export interface ScheduledVisitExpectation {
  scheduledStart: Date;
  windowStart: Date;
  windowEnd: Date;
  durationHours: number;
  headline: string;
  detail: string;
  rangeLabel: string;
}

function isOnsiteMethod(method: string | null | undefined): boolean {
  const value = (method ?? "").toLowerCase();
  return value.includes("onsite") || value.includes("on-site") || value.includes("on site");
}

function isRemoteMethod(method: string | null | undefined): boolean {
  const value = (method ?? "").toLowerCase();
  return value.includes("remote") || value.includes("virtual");
}

function capitalizeName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Client-friendly schedule text from technician calendar fields. */
export function formatTicketScheduleForClient(
  ticket: Pick<ServiceTicket, "scheduled_start" | "scheduled_window">,
): string | null {
  if (!ticket.scheduled_start) return null;

  const when = formatDateTime(ticket.scheduled_start);
  if (when === "—") return null;

  const spec = parseWindowSpec(ticket.scheduled_window);
  const window = getWindowById(spec?.windowId ?? ticket.scheduled_window);
  if (window) {
    const hours = spec?.durationHours ?? 1;
    return hours > 1
      ? `${formatDate(ticket.scheduled_start)} · ${window.label} (${hours} hrs)`
      : `${formatDate(ticket.scheduled_start)} · ${window.label}`;
  }

  if (
    ticket.scheduled_window &&
    ticket.scheduled_window !== "Unscheduled"
  ) {
    return `${when} · ${ticket.scheduled_window}`;
  }

  return when;
}

function formatExpectationRange(start: Date, end: Date): string {
  const sameDay = format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd");
  if (sameDay) {
    return `${format(start, "EEE, MMM d")} · ${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;
  }
  return `${format(start, "EEE, MMM d h:mm a")} – ${format(end, "EEE, MMM d h:mm a")}`;
}

/**
 * Client-facing arrival / start window once a technician places the job on their schedule.
 * Includes early/late buffers for scheduling delays.
 */
export function getScheduledVisitExpectation(
  ticket: ServiceTicket,
  technicianName?: string | null,
): ScheduledVisitExpectation | null {
  const parsed = parseScheduledSlot(ticket);
  if (!parsed) return null;

  const scheduledStart = parsed.day
    ? (() => {
        const start = new Date(parsed.day);
        start.setHours(parsed.window.startHour, 0, 0, 0);
        return start;
      })()
    : new Date(ticket.scheduled_start!);

  // Prefer persisted ISO start when present (more accurate than rebuilt local day).
  const fromIso = ticket.scheduled_start
    ? new Date(ticket.scheduled_start)
    : null;
  const start =
    fromIso && !Number.isNaN(fromIso.getTime()) ? fromIso : scheduledStart;

  const durationHours = Math.max(1, parsed.durationHours);
  const windowStart = addMinutes(start, -ARRIVAL_EARLY_BUFFER_MINUTES);
  const windowEnd = addMinutes(
    start,
    durationHours * 60 + ARRIVAL_LATE_BUFFER_MINUTES,
  );
  const rangeLabel = formatExpectationRange(windowStart, windowEnd);
  const techName = technicianName?.trim() || "Your technician";
  const method = ticket.service_method;
  const onsite = isOnsiteMethod(method);
  const remote = isRemoteMethod(method);

  const headline = onsite
    ? `Expect ${techName} on site`
    : remote
      ? `Expect remote support from ${techName}`
      : `Expect ${techName}`;

  const detail = onsite
    ? `${techName} scheduled this visit for ${format(start, "h:mm a")}. Please be ready between ${rangeLabel}. This window includes a buffer for traffic and prior-job delays.`
    : remote
      ? `${techName} scheduled remote support starting around ${format(start, "h:mm a")}. Expect contact between ${rangeLabel}. This window includes a buffer for scheduling delays.`
      : `${techName} scheduled this work for ${format(start, "h:mm a")}. Expect service between ${rangeLabel}. This window includes a buffer for scheduling delays.`;

  return {
    scheduledStart: start,
    windowStart,
    windowEnd,
    durationHours,
    headline,
    detail,
    rangeLabel,
  };
}

/**
 * Builds a client-friendly progress timeline for an open support ticket.
 */
export function buildTicketLiveSteps(
  ticket: ServiceTicket,
  technicianName: string | null,
  workEntries: WorkEntry[],
): TicketLiveStep[] {
  const status = ticket.status ?? "New";
  const isResolved = status === "Completed" || status === "Closed";
  const isWaiting =
    status === "Waiting on Customer" ||
    status === "Waiting on Vendor" ||
    status === "Waiting on Approval";
  const isEscalated = status === "Escalated";
  const hasAssignment = Boolean(ticket.assigned_technician_id);
  const expectation = getScheduledVisitExpectation(ticket, technicianName);
  const hasSchedule = Boolean(expectation);
  const hasReviewSignal = Boolean(
    ticket.responded_at ||
      hasAssignment ||
      workEntries.length > 0 ||
      (status !== "New" && status !== "Closed"),
  );
  const hasStartedWork =
    status === "In Progress" ||
    isWaiting ||
    isEscalated ||
    isResolved ||
    workEntries.length > 0;
  const latestWork = workEntries[0] ?? null;
  const method = latestWork?.service_method ?? ticket.service_method;
  const onsite = isOnsiteMethod(method);
  const remote = isRemoteMethod(method);
  const techName = technicianName ?? "A technician";
  const techLabel = technicianName ?? "a technician";

  const steps: TicketLiveStep[] = [
    {
      id: "received",
      label: "Support ticket received",
      detail: "Your request was submitted and logged in the Nexus support queue.",
      state: "complete",
      at: ticket.opened_at ?? ticket.created_at,
    },
    {
      id: "reviewed",
      label: "Technician reviewed the problem",
      detail: hasReviewSignal
        ? `Support has reviewed the reported issue${ticket.responded_at ? " and acknowledged the ticket" : ""}.`
        : "Waiting for a technician to review the problem details.",
      state: hasReviewSignal ? "complete" : "active",
      at: ticket.responded_at,
    },
    {
      id: "assigned",
      label: "Technician assigned",
      detail: hasAssignment
        ? `${techName} has been assigned to this ticket.`
        : "A technician has not been assigned yet.",
      state: hasAssignment
        ? "complete"
        : hasReviewSignal
          ? "active"
          : "upcoming",
      at: hasAssignment ? ticket.responded_at ?? ticket.opened_at : null,
    },
  ];

  if (hasSchedule && expectation) {
    steps.push({
      id: "scheduled",
      label: expectation.headline,
      detail: expectation.detail,
      state: hasStartedWork || isResolved ? "complete" : "active",
      at: ticket.scheduled_start,
    });
  }

  if (onsite) {
    // Onsite path: transit first, then arrived / work in progress.
    const waitingForSchedule = hasAssignment && !hasSchedule && !hasStartedWork;
    steps.push({
      id: "en_route",
      label: "Technician on the way",
      detail: hasStartedWork
        ? `${techName} was dispatched and traveled to your location.`
        : hasSchedule && expectation
          ? `${techName} will travel to your location for the scheduled visit (${expectation.rangeLabel}).`
          : hasAssignment
            ? `${techName} will head to your location once the visit is placed on their schedule.`
            : "After assignment, the technician will travel to your site.",
      state: !hasAssignment
        ? "upcoming"
        : hasStartedWork
          ? "complete"
          : hasSchedule
            ? "upcoming"
            : waitingForSchedule
              ? "upcoming"
              : "active",
      at: hasStartedWork
        ? ticket.responded_at ?? ticket.opened_at
        : hasSchedule
          ? ticket.scheduled_start
          : null,
    });

    steps.push({
      id: "onsite_wip",
      label: "Technician Arrived on Site (Work in Progress)",
      detail: hasStartedWork
        ? latestWork?.work_performed
          ? `${techName} has arrived on site and is working on this problem: ${latestWork.work_performed}`
          : `${techName} has arrived on site and is actively working on this problem.`
        : hasSchedule && expectation
          ? `On-site work begins when ${techName} arrives. Be ready during ${expectation.rangeLabel}.`
          : hasAssignment
            ? "Work in progress begins once the technician arrives on site."
            : "On-site work begins after the technician is assigned and arrives.",
      state: hasStartedWork
        ? isResolved || isWaiting || isEscalated
          ? "complete"
          : "active"
        : "upcoming",
      at: latestWork?.work_date ?? latestWork?.created_at ?? null,
    });
  } else if (remote) {
    steps.push({
      id: "virtual_wip",
      label: "Technician working virtually",
      detail: hasStartedWork
        ? latestWork?.work_performed
          ? `${techName} is virtually connected and working on this problem: ${latestWork.work_performed}`
          : `${techName} is virtually connected and actively working on this problem remotely.`
        : hasSchedule && expectation
          ? `${capitalizeName(techLabel)} is scheduled to begin remote support between ${expectation.rangeLabel}.`
          : hasAssignment
            ? `${capitalizeName(techLabel)} will begin virtual work shortly.`
            : "Virtual work begins after a technician is assigned.",
      state: hasStartedWork
        ? isResolved || isWaiting || isEscalated
          ? "complete"
          : "active"
        : hasSchedule
          ? "upcoming"
          : hasAssignment
            ? "active"
            : "upcoming",
      at: latestWork?.work_date ?? latestWork?.created_at ?? null,
    });
  } else {
    steps.push({
      id: "working",
      label: "Technician working the problem",
      detail: hasStartedWork
        ? latestWork?.work_performed
          ? `${techName} is actively working on this problem: ${latestWork.work_performed}`
          : `${techName} is actively working on this problem.`
        : hasSchedule && expectation
          ? `${capitalizeName(techLabel)} is scheduled between ${expectation.rangeLabel}.`
          : hasAssignment
            ? `${capitalizeName(techLabel)} is preparing to begin work.`
            : "Work begins after a technician is assigned.",
      state: hasStartedWork
        ? isResolved || isWaiting || isEscalated
          ? "complete"
          : "active"
        : hasSchedule
          ? "upcoming"
          : hasAssignment
            ? "active"
            : "upcoming",
      at: latestWork?.work_date ?? latestWork?.created_at ?? null,
    });
  }

  if (isWaiting) {
    let waitingDetail = "Work is temporarily paused.";
    if (status === "Waiting on Customer") {
      waitingDetail =
        "Nexus reviewed the problem and is waiting on information or approval from your team.";
    } else if (status === "Waiting on Vendor") {
      waitingDetail =
        "A technician is engaged, and work is paused while Nexus waits on a vendor response.";
    } else if (status === "Waiting on Approval") {
      waitingDetail =
        "Additional work was identified and is waiting on approval before the technician continues.";
    }

    steps.push({
      id: "waiting",
      label: status,
      detail: waitingDetail,
      state: "active",
      at: latestWork?.created_at ?? ticket.responded_at,
    });
  }

  if (isEscalated) {
    steps.push({
      id: "escalated",
      label: "Escalated for higher priority",
      detail: `${capitalizeName(techLabel)} escalated this ticket for accelerated attention.`,
      state: isResolved ? "complete" : "active",
      at: ticket.responded_at,
    });
  }

  steps.push({
    id: "resolved",
    label: isResolved ? "Problem resolved" : "Resolution pending",
    detail: isResolved
      ? ticket.resolution_notes
        ? `This ticket was resolved. ${ticket.resolution_notes}`
        : "This ticket has been completed and closed."
      : "You will see a final update here when the technician finishes the work.",
    state: isResolved ? "complete" : "upcoming",
    at: ticket.completed_at,
  });

  // Ensure only one active step when later milestones are already complete.
  if (isResolved) {
    return steps.map((step) =>
      step.id === "resolved"
        ? { ...step, state: "complete" as const }
        : step.id === "waiting" || step.id === "escalated"
          ? { ...step, state: "complete" as const }
          : step.state === "active"
            ? { ...step, state: "complete" as const }
            : step,
    );
  }

  const firstActiveIndex = steps.findIndex((step) => step.state === "active");
  if (firstActiveIndex >= 0) {
    return steps.map((step, index) => {
      if (index < firstActiveIndex && step.state !== "complete") {
        return { ...step, state: "complete" as const };
      }
      if (index > firstActiveIndex && step.state === "active") {
        return { ...step, state: "upcoming" as const };
      }
      return step;
    });
  }

  return steps;
}

export function getActiveLiveSummary(steps: TicketLiveStep[]): string {
  const scheduled = steps.find(
    (step) => step.id === "scheduled" && step.state === "active",
  );
  if (scheduled) return scheduled.detail;
  const active = steps.find((step) => step.state === "active");
  if (active) return active.detail;
  const lastComplete = [...steps]
    .reverse()
    .find((step) => step.state === "complete");
  return (
    lastComplete?.detail ??
    "Your ticket is being tracked by the Nexus support team."
  );
}

export function formatLiveStepTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const formatted = formatDateTime(value);
  return formatted === "—" ? null : formatted;
}
