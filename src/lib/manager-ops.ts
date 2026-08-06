import { calcSlaStatus } from "@/lib/calculations";
import { isOpenTicket, isThisMonth } from "@/lib/dashboard-stats";
import { pickPrimaryActiveContract } from "@/lib/customer-access";
import type {
  Contract,
  Customer,
  HardwareAsset,
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

export interface ContractAssetBurn {
  contractId: string;
  customerId: string;
  assetSpend: number;
  includedBudget: number;
  burnPercent: number | null;
  overageAmount: number;
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

/** Open tickets already past the SLA resolution target. */
export function getLateTickets(tickets: ServiceTicket[]): ServiceTicket[] {
  return getOpenTickets(tickets).filter((t) => {
    const sla = calcSlaStatus({
      status: t.status,
      targetResolutionAt: t.target_resolution_at,
      completedAt: t.completed_at,
    });
    return sla === "Overdue";
  });
}

export interface TechnicianLoadRow {
  technicianId: string;
  technicianName: string;
  openTickets: number;
  criticalTickets: number;
}

/** Open ticket load per active technician, heaviest first. */
export function computeTechnicianLoads(
  technicians: Array<{
    id: string;
    technician_name: string;
    active: boolean;
  }>,
  tickets: ServiceTicket[],
): TechnicianLoadRow[] {
  const open = getOpenTickets(tickets);
  return technicians
    .filter((tech) => tech.active)
    .map((tech) => {
      const assigned = open.filter((t) => t.assigned_technician_id === tech.id);
      return {
        technicianId: tech.id,
        technicianName: tech.technician_name,
        openTickets: assigned.length,
        criticalTickets: assigned.filter((t) => t.priority === "Critical").length,
      };
    })
    .sort((a, b) => {
      if (b.openTickets !== a.openTickets) return b.openTickets - a.openTickets;
      return b.criticalTickets - a.criticalTickets;
    });
}

export interface UnprofitableContractRow {
  contractId: string;
  customerId: string;
  contractName: string;
  mrr: number;
  monthDirectCost: number;
  shortfall: number;
}

/**
 * Active contracts whose attributed month direct costs exceed monthly recurring fee.
 * Simple delivery profitability signal for managers — not full GAAP P&L.
 */
export function getUnprofitableContracts(
  contracts: Contract[],
  workEntries: WorkEntry[],
): UnprofitableContractRow[] {
  return contracts
    .filter((c) => c.contract_status === "Active")
    .map((contract) => {
      const monthDirectCost = workEntriesAttributedToContract(
        contract,
        contracts,
        workEntries,
      )
        .filter((e) => isThisMonth(e.work_date))
        .reduce((sum, e) => sum + Number(e.total_direct_cost ?? 0), 0);
      const mrr = Number(contract.monthly_recurring_fee ?? 0);
      return {
        contractId: contract.id,
        customerId: contract.customer_id,
        contractName: contract.contract_name,
        mrr,
        monthDirectCost,
        shortfall: Math.max(0, monthDirectCost - mrr),
      };
    })
    .filter((row) => row.mrr > 0 && row.monthDirectCost > row.mrr)
    .sort((a, b) => b.shortfall - a.shortfall);
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
    .filter((c) => c.contract_status !== "Canceled")
    .map((contract) => {
      const hoursUsed = workEntriesAttributedToContract(
        contract,
        contracts,
        workEntries,
      )
        .filter((e) => isThisMonth(e.work_date))
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

/**
 * Asset dollars against a contract-length budget:
 * hardware purchase_cost (deployed to customer in term) + work-entry
 * parts_cost and equipment_cost attributed to the contract.
 */
export function assetSpendForContract(
  contract: Contract,
  assets: HardwareAsset[],
  workEntries: WorkEntry[] = [],
  contracts: Contract[] = [],
): number {
  const start = safeParse(contract.start_date);
  const end = safeParse(contract.end_date);

  const hardwareSpend = assets
    .filter((asset) => asset.customer_id === contract.customer_id)
    .reduce((sum, asset) => {
      const purchase = safeParse(asset.purchase_date);
      if (purchase) {
        if (start && purchase < start) return sum;
        if (end && purchase > end) return sum;
      } else if (!asset.customer_id) {
        return sum;
      }
      return sum + (asset.purchase_cost ?? asset.current_value ?? 0);
    }, 0);

  const attributed =
    contracts.length > 0
      ? workEntriesAttributedToContract(contract, contracts, workEntries)
      : workEntries.filter((e) => e.contract_id === contract.id);

  const workSpend = attributed.reduce((sum, e) => {
    const workDate = safeParse(e.work_date);
    if (workDate) {
      if (start && workDate < start) return sum;
      if (end && workDate > end) return sum;
    }
    return (
      sum +
      Number(e.parts_cost ?? 0) +
      Number(e.equipment_cost ?? 0)
    );
  }, 0);

  return hardwareSpend + workSpend;
}

export function computeContractAssetBurns(
  contracts: Contract[],
  assets: HardwareAsset[],
  workEntries: WorkEntry[] = [],
): ContractAssetBurn[] {
  return contracts
    .filter((c) => c.contract_status !== "Canceled")
    .map((contract) => {
      const assetSpend = assetSpendForContract(
        contract,
        assets,
        workEntries,
        contracts,
      );
      const includedBudget = contract.included_asset_budget ?? 0;
      const overageAmount = Math.max(0, assetSpend - includedBudget);
      const burnPercent =
        includedBudget > 0 ? (assetSpend / includedBudget) * 100 : null;
      return {
        contractId: contract.id,
        customerId: contract.customer_id,
        assetSpend,
        includedBudget,
        burnPercent,
        overageAmount,
        overageEstimate:
          overageAmount * (contract.additional_asset_rate ?? 1),
        isOver: includedBudget > 0 && assetSpend > includedBudget,
      };
    });
}

/**
 * Contract that should own unlinked (null contract_id) work for a customer:
 * primary Active, else the customer's only open (non-canceled/expired) contract.
 */
export function pickContractForCustomerWork(
  contracts: Contract[],
  customerId: string,
): Contract | null {
  const forCustomer = contracts.filter(
    (c) =>
      c.customer_id === customerId &&
      c.contract_status !== "Canceled" &&
      c.contract_status !== "Expired",
  );
  const primary = pickPrimaryActiveContract(forCustomer);
  if (primary) return primary;
  if (forCustomer.length === 1) return forCustomer[0];
  const pending = forCustomer.filter(
    (c) =>
      c.contract_status === "Pending Approval" ||
      c.contract_status === "Active",
  );
  if (pending.length === 1) return pending[0];
  return null;
}

/** Direct contract_id matches plus orphan work attributed to this contract. */
export function workEntriesAttributedToContract(
  contract: Contract,
  contracts: Contract[],
  workEntries: WorkEntry[],
): WorkEntry[] {
  const direct = workEntries.filter((e) => e.contract_id === contract.id);
  const orphanOwner = pickContractForCustomerWork(
    contracts,
    contract.customer_id,
  );
  if (!orphanOwner || orphanOwner.id !== contract.id) return direct;
  const orphans = workEntries.filter(
    (e) => !e.contract_id && e.customer_id === contract.customer_id,
  );
  if (orphans.length === 0) return direct;
  return [...direct, ...orphans];
}

/**
 * Approved work ready to push to Billing. Pool-based hour inclusion is applied
 * at invoice time — entries are eligible regardless of included_in_contract.
 * Prefer entries with expenses or that may produce overage; still include
 * in-pool-only rows so managers can clear them as covered.
 */
export function getReadyToInvoiceEntries(workEntries: WorkEntry[]): WorkEntry[] {
  return workEntries.filter(
    (e) =>
      e.approval_status === "Approved" &&
      e.billing_status !== "Billed" &&
      Boolean(e.customer_id) &&
      Boolean(e.contract_id),
  );
}

/**
 * Split this month's hours into pool-covered vs overage using each contract's
 * included_support_hours (chronological within the month).
 */
export function computePoolHourSplit(
  contracts: Contract[],
  workEntries: WorkEntry[],
): { includedHours: number; overageHours: number } {
  let includedHours = 0;
  let overageHours = 0;

  for (const contract of contracts) {
    const monthEntries = workEntries.filter(
      (e) => e.contract_id === contract.id && isThisMonth(e.work_date),
    );
    if (monthEntries.length === 0) continue;

    const pool = Number(contract.included_support_hours ?? 0);
    const sorted = [...monthEntries].sort((a, b) => {
      const da = a.work_date ?? "";
      const db = b.work_date ?? "";
      if (da !== db) return da.localeCompare(db);
      return a.id.localeCompare(b.id);
    });

    let used = 0;
    for (const entry of sorted) {
      const hours = Number(entry.hours_worked ?? 0);
      if (hours <= 0) continue;
      const remaining = Math.max(0, pool - used);
      const covered = Math.min(hours, remaining);
      includedHours += covered;
      overageHours += Math.max(0, hours - covered);
      used += hours;
    }
  }

  // Entries without a contract still count as overage/billable for metrics
  const orphanHours = workEntries
    .filter((e) => !e.contract_id && isThisMonth(e.work_date))
    .reduce((sum, e) => sum + (e.hours_worked ?? 0), 0);
  overageHours += orphanHours;

  return { includedHours, overageHours };
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

/** Composite account score for manager preview — not a persisted field. */
export interface ClientHealthInsight {
  customerId: string;
  customerName: string;
  score: number;
  drivers: string[];
  recommendedAction: string;
  actionHref: string;
  mrr: number;
  arBalance: number;
  openTickets: number;
}

/**
 * Score each active customer from SLA, AR, hour burn, criticals, and renewal pressure.
 * Returns weakest accounts first for the Command Center preview.
 */
export function buildClientHealthInsights(
  customers: Customer[],
  contracts: Contract[],
  tickets: ServiceTicket[],
  workEntries: WorkEntry[],
  invoices: Invoice[],
): ClientHealthInsight[] {
  const burns = computeContractHoursBurns(contracts, workEntries);
  const openTickets = getOpenTickets(tickets);
  const pastDueByCustomer = new Map<string, number>();
  for (const inv of getPastDueInvoices(invoices)) {
    pastDueByCustomer.set(
      inv.customer_id,
      (pastDueByCustomer.get(inv.customer_id) ?? 0) +
        (inv.remaining_balance ?? 0),
    );
  }
  const renewals30 = new Set(
    getRenewalsInDays(contracts, 30).map((c) => c.customer_id),
  );
  const slaCustomers = new Set(
    getSlaAtRiskTickets(tickets).map((t) => t.customer_id),
  );

  return customers
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
      const overHours = custBurns.some((b) => b.isOver);
      const arPastDue = pastDueByCustomer.get(customer.id) ?? 0;
      const custOpen = openTickets.filter((t) => t.customer_id === customer.id);
      const criticalOpen = custOpen.filter((t) => t.priority === "Critical").length;
      const renewingSoon = renewals30.has(customer.id);
      const slaRisk = slaCustomers.has(customer.id);

      let score = 100;
      const drivers: string[] = [];
      let recommendedAction = "Keep routine check-ins — account looks stable.";
      let actionHref = "/customers";

      if (slaRisk) {
        score -= 18;
        drivers.push("SLA pressure on open tickets");
        recommendedAction = "Stabilize SLA — assign owner and set recovery ETA.";
        actionHref = "/service-tickets?filter=sla";
      }
      if (arPastDue > 0) {
        score -= Math.min(22, 10 + Math.floor(arPastDue / 2500));
        drivers.push("Past-due AR balance");
        if (arPastDue >= 500 || !slaRisk) {
          recommendedAction = "Collections call — clear past-due before more work accumulates.";
          actionHref = "/billing?filter=past-due";
        }
      }
      if (overHours) {
        score -= 12;
        drivers.push("Burned past included hours");
        if (!slaRisk && arPastDue === 0) {
          recommendedAction = "Invoice overage or propose a plan upgrade.";
          actionHref = "/contracts?filter=over-hours";
        }
      }
      if (criticalOpen > 0) {
        score -= Math.min(15, criticalOpen * 5);
        drivers.push(`${criticalOpen} critical open ticket${criticalOpen === 1 ? "" : "s"}`);
        if (!slaRisk && arPastDue === 0 && !overHours) {
          recommendedAction = "Escalate critical work — daily update until closed.";
          actionHref = "/service-tickets?filter=critical";
        }
      }
      if (renewingSoon) {
        score -= 6;
        drivers.push("Renewal within 30 days");
        if (drivers.length === 1) {
          recommendedAction = "Book renewal review with health score and hour burn ready.";
          actionHref = "/contracts?filter=renewals";
        }
      }
      if (
        customer.technology_health_score != null &&
        customer.technology_health_score < 70
      ) {
        score -= 10;
        drivers.push("Low technology health score");
      }
      if (includedHours > 0 && hoursUsed / includedHours >= 0.85 && !overHours) {
        score -= 5;
        drivers.push("Approaching hour allotment");
      }

      score = Math.max(0, Math.min(100, Math.round(score)));
      if (drivers.length === 0) drivers.push("No active risk drivers");

      return {
        customerId: customer.id,
        customerName: customer.customer_name,
        score,
        drivers,
        recommendedAction,
        actionHref,
        mrr,
        arBalance: invoices
          .filter((i) => i.customer_id === customer.id)
          .reduce((sum, i) => sum + (i.remaining_balance ?? 0), 0),
        openTickets: custOpen.length,
      };
    })
    .sort((a, b) => a.score - b.score || b.mrr - a.mrr)
    .slice(0, 8);
}

export type ProfitLeakKind =
  | "unbilled_work"
  | "unbilled_overage"
  | "margin_shortfall"
  | "past_due_ar"
  | "awaiting_send";

export interface ProfitLeakSignal {
  id: string;
  kind: ProfitLeakKind;
  title: string;
  detail: string;
  amountAtRisk: number;
  recommendedAction: string;
  href: string;
}

/**
 * Money left on the table: unbilled work, overage not invoiced, cost > MRR, AR, drafts.
 */
export function buildProfitLeakageSignals(
  customers: Customer[],
  contracts: Contract[],
  workEntries: WorkEntry[],
  invoices: Invoice[],
): ProfitLeakSignal[] {
  const customerMap = new Map(customers.map((c) => [c.id, c.customer_name]));
  const contractMap = new Map(contracts.map((c) => [c.id, c]));
  const signals: ProfitLeakSignal[] = [];

  const ready = getReadyToInvoiceEntries(workEntries);
  if (ready.length > 0) {
    const amount = ready.reduce((sum, e) => {
      const contract = e.contract_id ? contractMap.get(e.contract_id) : null;
      const hours = e.included_in_contract ? 0 : (e.hours_worked ?? 0);
      return (
        sum +
        hours * (contract?.additional_hourly_rate ?? 0) +
        (e.parts_cost ?? 0) +
        (e.software_cost ?? 0) +
        (e.equipment_cost ?? 0) +
        (e.travel_cost ?? 0) +
        (e.other_cost ?? 0)
      );
    }, 0);
    signals.push({
      id: "leak-unbilled-work",
      kind: "unbilled_work",
      title: `${ready.length} approved entries ready to invoice`,
      detail: "Approved technician work has not been pushed to billing yet.",
      amountAtRisk: amount,
      recommendedAction: "Send to billing this week — cash is sitting in Work & Billing.",
      href: "/time-costs?filter=ready",
    });
  }

  const overHours = computeContractHoursBurns(contracts, workEntries).filter(
    (b) => b.isOver && b.overageEstimate > 0,
  );
  for (const burn of overHours.slice(0, 4)) {
    signals.push({
      id: `leak-overage-${burn.contractId}`,
      kind: "unbilled_overage",
      title: `${contractMap.get(burn.contractId)?.contract_name ?? "Contract"} over hours`,
      detail: `${customerMap.get(burn.customerId) ?? "Customer"} · ${burn.hoursUsed.toFixed(1)}h / ${burn.includedHours.toFixed(1)}h included`,
      amountAtRisk: burn.overageEstimate,
      recommendedAction: "Bill overage or convert to a higher plan before month close.",
      href: "/contracts?filter=over-hours",
    });
  }

  for (const row of getUnprofitableContracts(contracts, workEntries).slice(0, 4)) {
    signals.push({
      id: `leak-margin-${row.contractId}`,
      kind: "margin_shortfall",
      title: `${row.contractName} delivering below MRR`,
      detail: `${customerMap.get(row.customerId) ?? "Customer"} · month cost exceeds recurring fee`,
      amountAtRisk: row.shortfall,
      recommendedAction: "Review scope creep, raise rate, or right-size included hours.",
      href: "/contracts",
    });
  }

  const pastDue = getPastDueInvoices(invoices);
  const pastDueTotal = pastDue.reduce(
    (sum, i) => sum + (i.remaining_balance ?? 0),
    0,
  );
  if (pastDueTotal > 0) {
    signals.push({
      id: "leak-past-due",
      kind: "past_due_ar",
      title: `${pastDue.length} past-due invoice${pastDue.length === 1 ? "" : "s"}`,
      detail: "Open AR past due — collections risk and labor on unpaid accounts.",
      amountAtRisk: pastDueTotal,
      recommendedAction: "Collections workflow — pause non-critical work if needed.",
      href: "/billing?filter=past-due",
    });
  }

  const awaiting = getAwaitingSendInvoices(invoices);
  if (awaiting.length > 0) {
    const amount = awaiting.reduce(
      (sum, i) => sum + (i.remaining_balance ?? i.total_amount ?? 0),
      0,
    );
    signals.push({
      id: "leak-awaiting-send",
      kind: "awaiting_send",
      title: `${awaiting.length} draft invoice${awaiting.length === 1 ? "" : "s"} awaiting send`,
      detail: "Invoices built but not delivered to the client.",
      amountAtRisk: amount,
      recommendedAction: "Send drafts today — delay slows cash conversion.",
      href: "/billing?filter=action",
    });
  }

  return signals.sort((a, b) => b.amountAtRisk - a.amountAtRisk);
}
