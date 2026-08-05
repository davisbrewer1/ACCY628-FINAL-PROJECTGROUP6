import { calcSlaStatus } from "@/lib/calculations";
import { isOpenTicket, isThisMonth } from "@/lib/dashboard-stats";
import type {
  Contract,
  Customer,
  Invoice,
  Payment,
  Recommendation,
  ServiceTicket,
  WorkEntry,
} from "@/lib/types";
import {
  addDays,
  differenceInCalendarDays,
  isBefore,
  parseISO,
  startOfMonth,
} from "date-fns";

export type ArAgingBucket = "current" | "d30" | "d60" | "d90";

export interface ContractHoursBurn {
  contractId: string;
  customerId: string;
  hoursUsed: number;
  includedHours: number;
  burnPercent: number | null;
  overageHours: number;
  overageEstimate: number;
  isOver: boolean;
}

export interface AccountHealthRow {
  customerId: string;
  customerName: string;
  healthScore: number | null;
  mrr: number;
  hoursUsed: number;
  includedHours: number;
  burnPercent: number | null;
  openTickets: number;
  arBalance: number;
  nextRenewal: string | null;
  riskFlags: string[];
}

function safeParse(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getOpenTickets(tickets: ServiceTicket[]): ServiceTicket[] {
  return tickets.filter((t) => isOpenTicket(t.status));
}

export function getSlaAtRiskTickets(tickets: ServiceTicket[]): ServiceTicket[] {
  return getOpenTickets(tickets).filter((t) => {
    const sla = calcSlaStatus({
      status: t.status,
      targetResolutionAt: t.target_resolution_at,
      completedAt: t.completed_at,
    });
    return sla === "Approaching Deadline" || sla === "Overdue";
  });
}

export function getUnassignedTickets(tickets: ServiceTicket[]): ServiceTicket[] {
  return getOpenTickets(tickets).filter((t) => !t.assigned_technician_id);
}

export function getRenewalsInDays(
  contracts: Contract[],
  days: number,
): Contract[] {
  const cutoff = addDays(new Date(), days);
  return contracts
    .filter((c) => {
      if (c.contract_status !== "Active") return false;
      const renewal = safeParse(c.renewal_date);
      if (!renewal) return false;
      return isBefore(renewal, cutoff) || renewal.getTime() === cutoff.getTime();
    })
    .sort((a, b) => {
      const da = safeParse(a.renewal_date)?.getTime() ?? 0;
      const db = safeParse(b.renewal_date)?.getTime() ?? 0;
      return da - db;
    });
}

export function computeContractHoursBurns(
  contracts: Contract[],
  workEntries: WorkEntry[],
): ContractHoursBurn[] {
  return contracts
    .filter((c) => c.contract_status === "Active")
    .map((contract) => {
      const hoursUsed = workEntries
        .filter((e) => e.contract_id === contract.id && isThisMonth(e.work_date))
        .reduce((sum, e) => sum + (e.hours_worked ?? 0), 0);
      const includedHours = contract.included_support_hours ?? 0;
      const overageHours = Math.max(0, hoursUsed - includedHours);
      const burnPercent =
        includedHours > 0 ? (hoursUsed / includedHours) * 100 : null;
      return {
        contractId: contract.id,
        customerId: contract.customer_id,
        hoursUsed,
        includedHours,
        burnPercent,
        overageHours,
        overageEstimate:
          overageHours * (contract.additional_hourly_rate ?? 0),
        isOver: includedHours > 0 && hoursUsed > includedHours,
      };
    });
}

export function getReadyToInvoiceEntries(workEntries: WorkEntry[]): WorkEntry[] {
  return workEntries.filter(
    (e) =>
      !e.included_in_contract &&
      e.approval_status === "Approved" &&
      e.billing_status !== "Billed",
  );
}

/** Entries waiting on a manager approve / dispute decision. */
export function getPendingApprovalEntries(workEntries: WorkEntry[]): WorkEntry[] {
  return workEntries.filter(
    (e) => !e.approval_status || e.approval_status === "Pending",
  );
}

/** Entries returned to technicians for correction. */
export function getDisputedWorkEntries(workEntries: WorkEntry[]): WorkEntry[] {
  return workEntries.filter((e) => e.approval_status === "Disputed");
}

export function getOpenArInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter(
    (i) =>
      i.status !== "Paid" &&
      i.status !== "Canceled" &&
      (i.remaining_balance ?? 0) > 0,
  );
}

export function getPastDueInvoices(invoices: Invoice[], now = new Date()): Invoice[] {
  return getOpenArInvoices(invoices).filter((i) => {
    if (i.status === "Past Due") return true;
    const due = safeParse(i.due_date);
    return due != null && isBefore(due, now);
  });
}

export function getAwaitingSendInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter(
    (i) => i.status === "Draft" || i.status === "Pending Approval",
  );
}

export function cashCollectedMtd(payments: Payment[], now = new Date()): number {
  const start = startOfMonth(now);
  return payments
    .filter((p) => {
      const d = safeParse(p.payment_date);
      return d != null && !isBefore(d, start);
    })
    .reduce((sum, p) => sum + (p.payment_amount ?? 0), 0);
}

export function getArAgingBucket(
  invoice: Invoice,
  now = new Date(),
): ArAgingBucket {
  const due = safeParse(invoice.due_date);
  if (!due || !isBefore(due, now)) return "current";
  const daysPast = differenceInCalendarDays(now, due);
  if (daysPast <= 30) return "d30";
  if (daysPast <= 60) return "d60";
  return "d90";
}

export function summarizeArAging(invoices: Invoice[]) {
  const buckets = { current: 0, d30: 0, d60: 0, d90: 0 };
  for (const inv of getOpenArInvoices(invoices)) {
    buckets[getArAgingBucket(inv)] += inv.remaining_balance ?? 0;
  }
  return buckets;
}

export function getNewRecommendations(
  recommendations: Recommendation[],
): Recommendation[] {
  return recommendations.filter((r) => r.status === "New");
}

export function buildAccountHealthRows(
  customers: Customer[],
  contracts: Contract[],
  tickets: ServiceTicket[],
  workEntries: WorkEntry[],
  invoices: Invoice[],
): AccountHealthRow[] {
  const burns = computeContractHoursBurns(contracts, workEntries);
  const openTickets = getOpenTickets(tickets);
  const pastDue = new Set(getPastDueInvoices(invoices).map((i) => i.customer_id));
  const renewals30 = new Set(
    getRenewalsInDays(contracts, 30).map((c) => c.customer_id),
  );
  const slaCustomers = new Set(
    getSlaAtRiskTickets(tickets).map((t) => t.customer_id),
  );

  const rows = customers
    .filter((c) => c.status === "Active")
    .map((customer) => {
      const custContracts = contracts.filter(
        (c) => c.customer_id === customer.id && c.contract_status === "Active",
      );
      const mrr = custContracts.reduce(
        (sum, c) => sum + (c.monthly_recurring_fee ?? 0),
        0,
      );
      const custBurns = burns.filter((b) => b.customerId === customer.id);
      const hoursUsed = custBurns.reduce((sum, b) => sum + b.hoursUsed, 0);
      const includedHours = custBurns.reduce(
        (sum, b) => sum + b.includedHours,
        0,
      );
      const burnPercent =
        includedHours > 0 ? (hoursUsed / includedHours) * 100 : null;
      const arBalance = invoices
        .filter((i) => i.customer_id === customer.id)
        .reduce((sum, i) => sum + (i.remaining_balance ?? 0), 0);
      const nextRenewal =
        custContracts
          .map((c) => c.renewal_date)
          .filter((d): d is string => Boolean(d))
          .sort()[0] ?? null;

      const riskFlags: string[] = [];
      if (slaCustomers.has(customer.id)) riskFlags.push("SLA");
      if (custBurns.some((b) => b.isOver)) riskFlags.push("Over hours");
      if (pastDue.has(customer.id)) riskFlags.push("Past due");
      if (renewals30.has(customer.id)) riskFlags.push("Renewing soon");
      if (
        customer.technology_health_score != null &&
        customer.technology_health_score < 70
      ) {
        riskFlags.push("Low health");
      }

      return {
        customerId: customer.id,
        customerName: customer.customer_name,
        healthScore: customer.technology_health_score,
        mrr,
        hoursUsed,
        includedHours,
        burnPercent,
        openTickets: openTickets.filter((t) => t.customer_id === customer.id)
          .length,
        arBalance,
        nextRenewal,
        riskFlags,
      };
    });

  return rows
    .sort((a, b) => {
      const riskDiff = b.riskFlags.length - a.riskFlags.length;
      if (riskDiff !== 0) return riskDiff;
      return b.arBalance - a.arBalance || b.mrr - a.mrr;
    })
    .slice(0, 10);
}

export function nextInvoiceDateHint(contract: Contract): string | null {
  if (!contract.billing_frequency) return null;
  return `${contract.billing_frequency} billing`;
}
