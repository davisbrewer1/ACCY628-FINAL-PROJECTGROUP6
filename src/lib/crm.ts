import { calcSlaStatus } from "@/lib/calculations";
import { isOpenTicket } from "@/lib/dashboard-stats";
import type { Contract, Invoice, ServiceTicket } from "@/lib/types";
import { addDays, isBefore, parseISO } from "date-fns";

export interface CrmAccountHealth {
  openTickets: number;
  criticalTickets: number;
  slaAtRisk: number;
  mrr: number;
  arBalance: number;
  renewingSoon: boolean;
  nextRenewal: string | null;
  riskFlags: string[];
  scoreLabel: "Healthy" | "Watch" | "At risk";
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

  const riskFlags: string[] = [];
  if (criticalTickets > 0) riskFlags.push("Critical tickets");
  if (slaAtRisk > 0) riskFlags.push("SLA risk");
  if (arBalance > 0) riskFlags.push("Open AR");
  if (renewingSoon) riskFlags.push("Renewal window");

  const scoreLabel =
    riskFlags.length >= 3 || criticalTickets > 0
      ? "At risk"
      : riskFlags.length > 0
        ? "Watch"
        : "Healthy";

  return {
    openTickets: open.length,
    criticalTickets,
    slaAtRisk,
    mrr,
    arBalance,
    renewingSoon,
    nextRenewal,
    riskFlags,
    scoreLabel,
  };
}
