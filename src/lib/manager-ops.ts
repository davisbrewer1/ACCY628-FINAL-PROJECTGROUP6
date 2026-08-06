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

/** Billable Expense Tracker rows waiting for invoice after manager approval. */
export function isReadyToInvoiceExpense(expense: {
  expense_tag?: string | null;
  approval_status?: string | null;
  invoice_id?: string | null;
  amount?: number | null;
}): boolean {
  return (
    expense.expense_tag === "Billable to Customer" &&
    expense.approval_status === "Approved" &&
    !expense.invoice_id &&
    Number(expense.amount ?? 0) > 0
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
