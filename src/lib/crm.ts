import { calcSlaStatus } from "@/lib/calculations";
import { isOpenTicket } from "@/lib/dashboard-stats";
import type { Contract, Invoice, ServiceTicket } from "@/lib/types";
import { addDays, isBefore, parseISO } from "date-fns";

export type HealthScoreLabel = "Healthy" | "Watch" | "At risk";

export type HealthSignalId =
  | "critical_tickets"
  | "sla_risk"
  | "open_ar"
  | "renewal_window";

export interface HealthSignal {
  id: HealthSignalId;
  label: string;
  /** Where the signal is pulled from in the app/data model */
  source: string;
  /** Source module path managers already know */
  sourceHref: "/service-tickets" | "/billing" | "/contracts";
  active: boolean;
  /** Short evidence line with the real amount/count behind the flag */
  evidence: string;
  detail: string;
}

export interface CrmAccountHealth {
  openTickets: number;
  criticalTickets: number;
  slaAtRisk: number;
  mrr: number;
  arBalance: number;
  renewingSoon: boolean;
  nextRenewal: string | null;
  riskFlags: string[];
  signals: HealthSignal[];
  scoreLabel: HealthScoreLabel;
  scoreReason: string;
}

/** Shared scoring legend for portfolio + detail pages. */
export const HEALTH_SCORE_LEGEND = {
  bands: [
    {
      label: "Healthy" as const,
      rule: "No risk flags from tickets, AR, or renewals.",
    },
    {
      label: "Watch" as const,
      rule: "1–2 risk flags, and no critical open tickets.",
    },
    {
      label: "At risk" as const,
      rule: "Any critical open ticket, or 3+ risk flags at once.",
    },
  ],
  sources: [
    {
      name: "Service tickets",
      href: "/service-tickets" as const,
      pulls: "Critical priority tickets and open work with approaching or overdue SLA.",
    },
    {
      name: "Invoices (billing)",
      href: "/billing" as const,
      pulls: "Sum of remaining_balance on unpaid / partially paid invoices.",
    },
    {
      name: "Active contracts",
      href: "/contracts" as const,
      pulls: "MRR from active monthly fees; renewal window when renewal_date is within 90 days.",
    },
  ],
};

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatShortDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parseISO(value));
  } catch {
    return value;
  }
}

export function computeCrmAccountHealth(
  customerId: string,
  contracts: Contract[],
  tickets: ServiceTicket[],
  invoices: Invoice[],
): CrmAccountHealth {
  const activeContracts = contracts.filter(
    (c) => c.customer_id === customerId && c.contract_status === "Active",
  );
  const open = tickets.filter(
    (t) => t.customer_id === customerId && isOpenTicket(t.status),
  );
  const criticalTickets = open.filter((t) => t.priority === "Critical").length;
  const slaAtRisk = open.filter((t) => {
    const sla = calcSlaStatus({
      status: t.status,
      targetResolutionAt: t.target_resolution_at,
      completedAt: t.completed_at,
    });
    return sla === "Approaching Deadline" || sla === "Overdue";
  }).length;

  const mrr = activeContracts.reduce(
    (sum, c) => sum + (c.monthly_recurring_fee ?? 0),
    0,
  );
  const arBalance = invoices
    .filter((i) => i.customer_id === customerId)
    .reduce((sum, i) => sum + (i.remaining_balance ?? 0), 0);

  const cutoff = addDays(new Date(), 90);
  const renewals = activeContracts
    .map((c) => c.renewal_date)
    .filter((d): d is string => Boolean(d))
    .sort();
  const nextRenewal = renewals[0] ?? null;
  const renewingSoon = renewals.some((d) => {
    try {
      return isBefore(parseISO(d), cutoff);
    } catch {
      return false;
    }
  });

  const signals: HealthSignal[] = [
    {
      id: "critical_tickets",
      label: "Critical tickets",
      source: "Service tickets",
      sourceHref: "/service-tickets",
      active: criticalTickets > 0,
      evidence:
        criticalTickets > 0
          ? `${criticalTickets} critical of ${open.length} open`
          : `${open.length} open · 0 critical`,
      detail:
        "Pulled from open service tickets where priority = Critical. Any critical ticket alone marks the account At risk.",
    },
    {
      id: "sla_risk",
      label: "SLA risk",
      source: "Service tickets",
      sourceHref: "/service-tickets",
      active: slaAtRisk > 0,
      evidence:
        slaAtRisk > 0
          ? `${slaAtRisk} approaching/overdue of ${open.length} open`
          : `${open.length} open · SLA on track`,
      detail:
        "Pulled from open tickets whose target_resolution_at is approaching the deadline or already overdue.",
    },
    {
      id: "open_ar",
      label: "Open AR",
      source: "Invoices (billing)",
      sourceHref: "/billing",
      active: arBalance > 0,
      evidence:
        arBalance > 0
          ? `${formatMoney(arBalance)} remaining balance`
          : "No remaining invoice balance",
      detail:
        "Pulled from invoices.remaining_balance for this customer (issued, partial, past due, etc.).",
    },
    {
      id: "renewal_window",
      label: "Renewal window",
      source: "Active contracts",
      sourceHref: "/contracts",
      active: renewingSoon,
      evidence: renewingSoon
        ? `Next renewal ${formatShortDate(nextRenewal)} (≤ 90 days)`
        : nextRenewal
          ? `Next renewal ${formatShortDate(nextRenewal)} (outside 90 days)`
          : "No renewal date on active contracts",
      detail:
        "Pulled from active contracts.renewal_date. Triggers when any active contract renews within 90 days.",
    },
  ];

  const riskFlags = signals.filter((s) => s.active).map((s) => s.label);

  const scoreLabel: HealthScoreLabel =
    riskFlags.length >= 3 || criticalTickets > 0
      ? "At risk"
      : riskFlags.length > 0
        ? "Watch"
        : "Healthy";

  const scoreReason =
    scoreLabel === "Healthy"
      ? "No risk flags from tickets, AR, or renewals."
      : scoreLabel === "At risk" && criticalTickets > 0
        ? `At risk because there ${
            criticalTickets === 1
              ? "is 1 critical open ticket"
              : `are ${criticalTickets} critical open tickets`
          } (${riskFlags.length} risk flag${riskFlags.length === 1 ? "" : "s"} total).`
        : scoreLabel === "At risk"
          ? `At risk because ${riskFlags.length} risk flags are active: ${riskFlags.join(", ")}.`
          : `Watch because ${riskFlags.length} risk flag${riskFlags.length === 1 ? "" : "s"}: ${riskFlags.join(", ")}.`;

  return {
    openTickets: open.length,
    criticalTickets,
    slaAtRisk,
    mrr,
    arBalance,
    renewingSoon,
    nextRenewal,
    riskFlags,
    signals,
    scoreLabel,
    scoreReason,
  };
}
