import { formatDateTime } from "@/lib/format";
import type { ServiceTicket, WorkEntry } from "@/lib/types";

export type LiveStepState = "complete" | "active" | "upcoming";

export interface TicketLiveStep {
  id: string;
  label: string;
  detail: string;
  state: LiveStepState;
  at?: string | null;
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

  if (onsite) {
    // Onsite path: transit first, then arrived / work in progress.
    steps.push({
      id: "en_route",
      label: "Technician on the way",
      detail: hasAssignment
        ? hasStartedWork
          ? `${techName} was dispatched and traveled to your location.`
          : `${techName} is on the way to your location.`
        : "After assignment, the technician will travel to your site.",
      state: !hasAssignment
        ? "upcoming"
        : hasStartedWork
          ? "complete"
          : "active",
      at: hasAssignment ? ticket.responded_at ?? ticket.opened_at : null,
    });

    steps.push({
      id: "onsite_wip",
      label: "Technician Arrived on Site (Work in Progress)",
      detail: hasStartedWork
        ? latestWork?.work_performed
          ? `${techName} has arrived on site and is working on this problem: ${latestWork.work_performed}`
          : `${techName} has arrived on site and is actively working on this problem.`
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
    // Virtual path: skip "on the way".
    steps.push({
      id: "virtual_wip",
      label: "Technician working virtually",
      detail: hasStartedWork
        ? latestWork?.work_performed
          ? `${techName} is virtually connected and working on this problem: ${latestWork.work_performed}`
          : `${techName} is virtually connected and actively working on this problem remotely.`
        : hasAssignment
          ? `${capitalizeName(techLabel)} will begin virtual work shortly.`
          : "Virtual work begins after a technician is assigned.",
      state: hasStartedWork
        ? isResolved || isWaiting || isEscalated
          ? "complete"
          : "active"
        : hasAssignment
          ? "active"
          : "upcoming",
      at: latestWork?.work_date ?? latestWork?.created_at ?? null,
    });
  } else {
    // Method not known yet — no transit step.
    steps.push({
      id: "working",
      label: "Technician working the problem",
      detail: hasStartedWork
        ? latestWork?.work_performed
          ? `${techName} is actively working on this problem: ${latestWork.work_performed}`
          : `${techName} is actively working on this problem.`
        : hasAssignment
          ? `${capitalizeName(techLabel)} is preparing to begin work.`
          : "Work begins after a technician is assigned.",
      state: hasStartedWork
        ? isResolved || isWaiting || isEscalated
          ? "complete"
          : "active"
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
  const active = steps.find((step) => step.state === "active");
  if (active) return active.detail;
  const lastComplete = [...steps].reverse().find((step) => step.state === "complete");
  return lastComplete?.detail ?? "Your ticket is being tracked by the Nexus support team.";
}

export function formatLiveStepTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const formatted = formatDateTime(value);
  return formatted === "—" ? null : formatted;
}
