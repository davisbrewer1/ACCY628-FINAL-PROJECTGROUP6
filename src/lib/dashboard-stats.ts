import {
  calcContractProfit,
  calcProfitMargin,
  calcSlaStatus,
} from "@/lib/calculations";
import type {
  Alert,
  Contract,
  Customer,
  Invoice,
  ServiceTicket,
  WorkEntry,
} from "@/lib/types";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";

const OPEN_STATUSES = new Set([
  "New",
  "Assigned",
  "In Progress",
  "On Hold",
  "Waiting on Customer",
  "Waiting on Vendor",
  "Waiting on Approval",
  "Escalated",
]);

export function isOpenTicket(status: string | null | undefined): boolean {
  return OPEN_STATUSES.has(status ?? "");
}

export function isThisMonth(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  return isWithinInterval(date, {
    start: startOfMonth(now),
    end: endOfMonth(now),
  });
}

export function computeDashboardStats(
  customers: Customer[],
  contracts: Contract[],
  tickets: ServiceTicket[],
  workEntries: WorkEntry[],
  invoices: Invoice[],
) {
  const activeCustomers = customers.filter((c) => c.status === "Active").length;
  const activeContracts = contracts.filter((c) => c.contract_status === "Active").length;
  const openTickets = tickets.filter((t) => isOpenTicket(t.status)).length;
  const criticalTickets = tickets.filter(
    (t) => t.priority === "Critical" && isOpenTicket(t.status),
  ).length;

  const approachingSla = tickets.filter((t) => {
    const sla = calcSlaStatus({
      status: t.status,
      targetResolutionAt: t.target_resolution_at,
      completedAt: t.completed_at,
    });
    return sla === "Approaching Deadline" || sla === "Overdue";
  }).length;

  const monthEntries = workEntries.filter((e) => isThisMonth(e.work_date));

  // Pool-aware: hours within each contract's included_support_hours are covered;
  // only overage hours are "billable" for revenue estimates.
  let includedHours = 0;
  let billableHours = 0;
  const activeForHours = contracts.filter((c) => c.contract_status === "Active");
  const seenContractIds = new Set<string>();

  for (const contract of activeForHours) {
    seenContractIds.add(contract.id);
    const entries = monthEntries
      .filter((e) => e.contract_id === contract.id)
      .sort((a, b) => {
        const da = a.work_date ?? "";
        const db = b.work_date ?? "";
        if (da !== db) return da.localeCompare(db);
        return a.id.localeCompare(b.id);
      });
    const pool = Number(contract.included_support_hours ?? 0);
    let used = 0;
    for (const entry of entries) {
      const hours = Number(entry.hours_worked ?? 0);
      if (hours <= 0) continue;
      const covered = Math.min(hours, Math.max(0, pool - used));
      includedHours += covered;
      billableHours += Math.max(0, hours - covered);
      used += hours;
    }
  }

  for (const entry of monthEntries) {
    if (entry.contract_id && seenContractIds.has(entry.contract_id)) continue;
    billableHours += Number(entry.hours_worked ?? 0);
  }

  const unpaidBalance = invoices
    .filter((i) => i.status !== "Paid" && i.status !== "Canceled")
    .reduce((sum, i) => sum + (i.remaining_balance ?? 0), 0);

  const mrr = contracts
    .filter((c) => c.contract_status === "Active")
    .reduce((sum, c) => sum + (c.monthly_recurring_fee ?? 0), 0);

  const margins = contracts
    .filter((c) => c.contract_status === "Active")
    .map((c) => {
      const contractEntries = workEntries.filter((e) => e.contract_id === c.id);
      const costs = contractEntries.reduce(
        (sum, e) => sum + (e.total_direct_cost ?? 0),
        0,
      );
      const monthContractEntries = monthEntries.filter(
        (e) => e.contract_id === c.id,
      );
      const pool = Number(c.included_support_hours ?? 0);
      let used = 0;
      let overage = 0;
      const sorted = [...monthContractEntries].sort((a, b) =>
        (a.work_date ?? "").localeCompare(b.work_date ?? ""),
      );
      for (const entry of sorted) {
        const hours = Number(entry.hours_worked ?? 0);
        const covered = Math.min(hours, Math.max(0, pool - used));
        overage += Math.max(0, hours - covered);
        used += hours;
      }
      const revenue =
        (c.monthly_recurring_fee ?? 0) +
        overage * (c.additional_hourly_rate ?? 0);
      return calcProfitMargin(revenue, costs);
    })
    .filter((m): m is number => m != null);

  const avgMargin =
    margins.length > 0
      ? margins.reduce((sum, m) => sum + m, 0) / margins.length
      : null;

  return {
    activeCustomers,
    activeContracts,
    openTickets,
    criticalTickets,
    approachingSla,
    includedHours,
    billableHours,
    unpaidBalance,
    mrr,
    avgMargin,
  };
}

export function groupTicketsByStatus(tickets: ServiceTicket[]) {
  const counts: Record<string, number> = {};
  tickets.forEach((t) => {
    const key = t.status ?? "Unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

export function groupTicketsByPriority(tickets: ServiceTicket[]) {
  const counts: Record<string, number> = {};
  tickets.forEach((t) => {
    const key = t.priority ?? "Unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

export function revenueVsCostsByMonth(
  invoices: Invoice[],
  workEntries: WorkEntry[],
) {
  const months: Record<string, { revenue: number; costs: number }> = {};

  invoices.forEach((inv) => {
    if (!inv.invoice_date) return;
    const key = format(new Date(inv.invoice_date), "MMM yyyy");
    months[key] ??= { revenue: 0, costs: 0 };
    months[key].revenue += inv.total_amount ?? 0;
  });

  workEntries.forEach((entry) => {
    if (!entry.work_date) return;
    const key = format(new Date(entry.work_date), "MMM yyyy");
    months[key] ??= { revenue: 0, costs: 0 };
    months[key].costs += entry.total_direct_cost ?? 0;
  });

  return Object.entries(months).map(([month, data]) => ({
    month,
    revenue: data.revenue,
    costs: data.costs,
  }));
}

export function hoursByCustomer(
  workEntries: WorkEntry[],
  customers: Customer[],
) {
  const customerMap = new Map(customers.map((c) => [c.id, c.customer_name]));
  const hours: Record<string, number> = {};

  workEntries.forEach((e) => {
    const name = customerMap.get(e.customer_id) ?? "Unknown";
    hours[name] = (hours[name] ?? 0) + (e.hours_worked ?? 0);
  });

  return Object.entries(hours).map(([name, hours]) => ({ name, hours }));
}

export function profitabilityByCustomer(
  customers: Customer[],
  contracts: Contract[],
  workEntries: WorkEntry[],
) {
  return customers.map((customer) => {
    const customerContracts = contracts.filter((c) => c.customer_id === customer.id);
    const revenue = customerContracts.reduce(
      (sum, c) => sum + (c.monthly_recurring_fee ?? 0),
      0,
    );
    const costs = workEntries
      .filter((e) => e.customer_id === customer.id)
      .reduce((sum, e) => sum + (e.total_direct_cost ?? 0), 0);
    const profit = calcContractProfit(revenue, costs);
    return {
      name: customer.customer_name,
      revenue,
      costs,
      profit,
    };
  });
}

export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts]
    .filter((a) => !a.resolved)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}

export const CHART_COLORS = [
  "#2563eb",
  "#0891b2",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#64748b",
];
