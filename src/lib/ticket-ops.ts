import { addHours } from "date-fns";
import type { Contract, Technician, TicketPriority } from "@/lib/types";

export const TICKET_TYPES = [
  "Incident",
  "Service Request",
  "Change",
  "Project",
] as const;

export type TicketType = (typeof TICKET_TYPES)[number];

/** Flexible, vendor-agnostic categories any IT MSP can use. */
export const FLEXIBLE_TICKET_CATEGORIES = [
  "Hardware",
  "Software",
  "Network",
  "Security",
  "Cloud / Hosting",
  "Email / Collaboration",
  "Identity / Access",
  "Backup / Recovery",
  "Telephony / VoIP",
  "Onboarding / Offboarding",
  "Monitoring / Alerts",
  "Project Work",
  "Other",
] as const;

export const PRIORITY_ORDER: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export function priorityRank(priority: string | null | undefined): number {
  return PRIORITY_ORDER[priority ?? "Medium"] ?? 2;
}

/** Map category keywords → specialty keywords for skill matching. */
const CATEGORY_SKILL_MAP: Record<string, string[]> = {
  Hardware: ["hardware", "desktop", "laptop", "endpoint", "device"],
  Software: ["software", "application", "app"],
  Network: ["network", "firewall", "wifi", "lan", "wan"],
  Security: ["security", "cyber", "soc", "compliance"],
  "Cloud / Hosting": ["cloud", "azure", "aws", "hosting"],
  "Email / Collaboration": ["email", "microsoft", "365", "m365", "exchange", "teams"],
  "Identity / Access": ["identity", "active directory", "entra", "okta", "access"],
  "Backup / Recovery": ["backup", "recovery", "dr"],
  "Telephony / VoIP": ["phone", "voip", "telephony"],
  "Onboarding / Offboarding": ["onboard", "offboard", "hr", "general"],
  "Monitoring / Alerts": ["monitor", "alert", "noc", "general"],
  "Project Work": ["project", "general"],
  Other: ["general", "support"],
};

export function rankTechniciansForTicket(
  technicians: Technician[],
  category: string | null | undefined,
): Technician[] {
  const keys = CATEGORY_SKILL_MAP[category ?? ""] ?? ["general", "support"];
  return [...technicians].sort((a, b) => {
    const score = (tech: Technician) => {
      const specialty = (tech.specialty ?? "").toLowerCase();
      return keys.reduce(
        (sum, key) => sum + (specialty.includes(key) ? 2 : 0),
        specialty ? 0 : -1,
      );
    };
    return score(b) - score(a);
  });
}

export function isSkillMatch(
  technician: Technician,
  category: string | null | undefined,
): boolean {
  const keys = CATEGORY_SKILL_MAP[category ?? ""] ?? [];
  const specialty = (technician.specialty ?? "").toLowerCase();
  return keys.some((key) => specialty.includes(key));
}

export function responseHoursForPriority(
  contract: Contract | null | undefined,
  priority: string,
): number {
  if (!contract) {
    if (priority === "Critical") return 1;
    if (priority === "High") return 4;
    if (priority === "Low") return 24;
    return 8;
  }

  if (priority === "Critical") {
    return contract.critical_response_target_hours ?? 1;
  }
  if (priority === "High") {
    return contract.high_response_target_hours ?? 4;
  }
  return contract.standard_response_target_hours ?? 8;
}

export function resolutionHoursForPriority(
  contract: Contract | null | undefined,
  priority: string,
): number {
  const base = contract?.resolution_target_hours;
  if (base != null && base > 0) {
    if (priority === "Critical") return Math.max(1, base * 0.5);
    if (priority === "High") return Math.max(2, base * 0.75);
    if (priority === "Low") return base * 1.5;
    return base;
  }

  if (priority === "Critical") return 4;
  if (priority === "High") return 8;
  if (priority === "Low") return 72;
  return 24;
}

export function computeSlaTargets(options: {
  contract: Contract | null | undefined;
  priority: string;
  openedAt?: Date;
}): { targetResponseAt: string; targetResolutionAt: string } {
  const opened = options.openedAt ?? new Date();
  const responseHours = responseHoursForPriority(
    options.contract,
    options.priority,
  );
  const resolutionHours = resolutionHoursForPriority(
    options.contract,
    options.priority,
  );

  return {
    targetResponseAt: addHours(opened, responseHours).toISOString(),
    targetResolutionAt: addHours(opened, resolutionHours).toISOString(),
  };
}

export function composeCategoryLabel(
  type: string,
  category: string,
): string {
  if (type && category) return `${type} · ${category}`;
  return category || type || "";
}

export function parseCategoryLabel(raw: string | null | undefined): {
  type: string;
  category: string;
} {
  if (!raw) return { type: "", category: "" };
  const parts = raw.split("·").map((p) => p.trim());
  if (parts.length >= 2) {
    return { type: parts[0], category: parts.slice(1).join(" · ") };
  }
  return { type: "", category: raw };
}

export function billableLabel(ticket: {
  additional_billable_work?: boolean | null;
  invoice_status?: string | null;
  additional_work_suspected?: boolean | null;
}): string {
  if (ticket.invoice_status === "Billed" || ticket.invoice_status === "Invoiced") {
    return "Invoiced";
  }
  if (ticket.invoice_status === "Ready to Invoice") {
    return "Ready to invoice";
  }
  if (ticket.additional_billable_work) {
    return "Billable overage";
  }
  if (ticket.additional_work_suspected) {
    return "Review billable";
  }
  return "Covered";
}

export function normalizePriority(
  value: string | null | undefined,
): TicketPriority {
  if (value === "Critical" || value === "High" || value === "Medium" || value === "Low") {
    return value;
  }
  return "Medium";
}
