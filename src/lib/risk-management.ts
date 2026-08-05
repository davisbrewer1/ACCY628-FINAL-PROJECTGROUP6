import { isThisMonth } from "@/lib/dashboard-stats";
import { formatCurrency } from "@/lib/format";
import {
  computeContractHoursBurns,
  getPastDueInvoices,
  getReadyToInvoiceEntries,
  getRenewalsInDays,
  getSlaAtRiskTickets,
  getUnassignedTickets,
  getOpenTickets,
} from "@/lib/manager-ops";
import type {
  AiPlatform,
  AiRisk,
  Contract,
  Customer,
  Invoice,
  Recommendation,
  SecurityAlert,
  ServiceTicket,
  Technician,
  WorkEntry,
} from "@/lib/types";

export type RiskCategory =
  | "delivery"
  | "revenue"
  | "billing"
  | "security"
  | "ai"
  | "capacity"
  | "growth";

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  delivery: "Delivery / SLA",
  revenue: "Renewals / revenue",
  billing: "Billing / AR",
  security: "Security",
  ai: "AI governance",
  capacity: "Capacity",
  growth: "Growth ideas",
};

export type RiskPriority = "Critical" | "High" | "Medium" | "Low";

export interface RiskActionItem {
  id: string;
  category: RiskCategory;
  priority: RiskPriority;
  title: string;
  evidence: string;
  why: string;
  customerId?: string | null;
  customerName?: string;
  contractId?: string | null;
  href: string;
  hrefLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  canCreateTicket: boolean;
  ticketPrefill?: {
    customerId: string;
    title: string;
    priority: RiskPriority;
    description: string;
  };
  estimatedImpact?: string;
  source: "live" | "recommendation";
  recommendationId?: string;
  status?: string;
}

const PRIORITY_WEIGHT: Record<RiskPriority, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

function customerName(
  customers: Customer[],
  customerId: string | null | undefined,
): string {
  if (!customerId) return "Portfolio";
  return customers.find((c) => c.id === customerId)?.customer_name ?? "Unknown";
}

/** Build a prioritized action queue from live ops data + stored recommendations. */
export function buildRiskActionItems(input: {
  customers: Customer[];
  contracts: Contract[];
  tickets: ServiceTicket[];
  invoices: Invoice[];
  workEntries: WorkEntry[];
  technicians: Technician[];
  securityAlerts: SecurityAlert[];
  aiRisks: AiRisk[];
  aiPlatforms: AiPlatform[];
  recommendations: Recommendation[];
}): RiskActionItem[] {
  const {
    customers,
    contracts,
    tickets,
    invoices,
    workEntries,
    technicians,
    securityAlerts,
    aiRisks,
    aiPlatforms,
    recommendations,
  } = input;

  const items: RiskActionItem[] = [];
  const open = getOpenTickets(tickets);
  const critical = open.filter((t) => t.priority === "Critical");
  const slaRisk = getSlaAtRiskTickets(tickets);
  const unassigned = getUnassignedTickets(tickets);
  const renewals = getRenewalsInDays(contracts, 90);
  const pastDue = getPastDueInvoices(invoices);
  const readyInvoice = getReadyToInvoiceEntries(workEntries);
  const burns = computeContractHoursBurns(contracts, workEntries).filter(
    (b) => b.isOver,
  );

  if (critical.length > 0) {
    const byCustomer = groupCount(critical.map((t) => t.customer_id));
    const topCustomerId = topKey(byCustomer);
    items.push({
      id: "live-critical-tickets",
      category: "delivery",
      priority: "Critical",
      title: `${critical.length} critical open ticket${critical.length === 1 ? "" : "s"}`,
      evidence: `${critical.length} Critical · ${byCustomer.size} account${byCustomer.size === 1 ? "" : "s"} affected`,
      why: "Critical incidents drive SLA breaches and churn risk — assign and clear them first.",
      customerId: topCustomerId,
      customerName: customerName(customers, topCustomerId),
      href: "/service-tickets?filter=critical",
      hrefLabel: "Open critical tickets",
      canCreateTicket: Boolean(topCustomerId),
      ticketPrefill: topCustomerId
        ? {
            customerId: topCustomerId,
            title: "Follow up on critical open incidents",
            priority: "Critical",
            description:
              "Auto-created from Risk Management: customer has critical open service tickets needing escalation handling.",
          }
        : undefined,
      estimatedImpact: "Service risk",
      source: "live",
    });
  }

  if (slaRisk.length > 0) {
    items.push({
      id: "live-sla-risk",
      category: "delivery",
      priority: "High",
      title: `${slaRisk.length} ticket${slaRisk.length === 1 ? "" : "s"} approaching or past SLA`,
      evidence: `${slaRisk.length} open with Approaching Deadline or Overdue status`,
      why: "Missed resolution targets create contractual exposure and poor CSAT.",
      href: "/service-tickets?filter=sla",
      hrefLabel: "Review SLA queue",
      canCreateTicket: false,
      estimatedImpact: "SLA exposure",
      source: "live",
    });
  }

  if (unassigned.length > 0) {
    items.push({
      id: "live-unassigned",
      category: "delivery",
      priority: unassigned.some((t) => t.priority === "Critical")
        ? "Critical"
        : "High",
      title: `${unassigned.length} unassigned open ticket${unassigned.length === 1 ? "" : "s"}`,
      evidence: "Open tickets with no technician assigned",
      why: "Unowned work sits idle — route it before SLA clocks expire.",
      href: "/service-tickets?filter=unassigned",
      hrefLabel: "Assign backlog",
      secondaryHref: "/technicians",
      secondaryLabel: "View capacity",
      canCreateTicket: false,
      source: "live",
    });
  }

  for (const contract of renewals.slice(0, 8)) {
    items.push({
      id: `live-renewal-${contract.id}`,
      category: "revenue",
      priority: "High",
      title: `Renewal window: ${contract.contract_name}`,
      evidence: `Renews ${contract.renewal_date ?? "soon"} · MRR ${formatCurrency(contract.monthly_recurring_fee)}`,
      why: "Contracts inside 90 days need an AM touch before auto-renew or churn.",
      customerId: contract.customer_id,
      customerName: customerName(customers, contract.customer_id),
      contractId: contract.id,
      href: "/contracts",
      hrefLabel: "Open contracts",
      secondaryHref: "/customers",
      secondaryLabel: "Customers",
      canCreateTicket: true,
      ticketPrefill: {
        customerId: contract.customer_id,
        title: `Renewal prep — ${contract.contract_name}`,
        priority: "Medium",
        description: `Auto-created from Risk Management for upcoming renewal (${contract.renewal_date ?? "date TBD"}).`,
      },
      estimatedImpact: `${formatCurrency(contract.monthly_recurring_fee)}/mo MRR`,
      source: "live",
    });
  }

  if (pastDue.length > 0) {
    const total = pastDue.reduce((sum, i) => sum + (i.remaining_balance ?? 0), 0);
    const top = [...pastDue].sort(
      (a, b) => (b.remaining_balance ?? 0) - (a.remaining_balance ?? 0),
    )[0];
    items.push({
      id: "live-past-due-ar",
      category: "billing",
      priority: total >= 10000 ? "Critical" : "High",
      title: `${pastDue.length} past-due invoice${pastDue.length === 1 ? "" : "s"}`,
      evidence: `${formatCurrency(total)} past due AR`,
      why: "Collections risk — confirm delivery disputes vs collections follow-up.",
      customerId: top?.customer_id,
      customerName: customerName(customers, top?.customer_id),
      href: "/billing?filter=past-due",
      hrefLabel: "Open past-due AR",
      canCreateTicket: Boolean(top?.customer_id),
      ticketPrefill: top?.customer_id
        ? {
            customerId: top.customer_id,
            title: "Past-due invoice follow-up",
            priority: "High",
            description: `Auto-created from Risk Management. Past-due AR around ${formatCurrency(top.remaining_balance)}.`,
          }
        : undefined,
      estimatedImpact: formatCurrency(total),
      source: "live",
    });
  }

  if (readyInvoice.length > 0) {
    items.push({
      id: "live-ready-invoice",
      category: "billing",
      priority: "Medium",
      title: `${readyInvoice.length} billable work entr${readyInvoice.length === 1 ? "y" : "ies"} ready for Billing`,
      evidence: "Approved billable overages not yet invoiced",
      why: "Converted delivery work is sitting before cash — push drafts from Work & Billing.",
      href: "/time-costs?filter=ready",
      hrefLabel: "Send to Billing",
      secondaryHref: "/billing",
      secondaryLabel: "Billing",
      canCreateTicket: false,
      estimatedImpact: "Unbilled revenue",
      source: "live",
    });
  }

  for (const burn of burns.slice(0, 5)) {
    items.push({
      id: `live-overage-${burn.contractId}`,
      category: "billing",
      priority: "Medium",
      title: `Hours overage on contract`,
      evidence: `${burn.overageHours.toFixed(1)} hrs over included · est. ${formatCurrency(burn.overageEstimate)}`,
      why: "Block-hour pools exceeded — confirm billable handling with the customer.",
      customerId: burn.customerId,
      customerName: customerName(customers, burn.customerId),
      contractId: burn.contractId,
      href: "/time-costs?filter=ready",
      hrefLabel: "Review Work & Billing",
      secondaryHref: "/contracts",
      secondaryLabel: "Contracts",
      canCreateTicket: true,
      ticketPrefill: {
        customerId: burn.customerId,
        title: "Discuss hours overage / expansion",
        priority: "Medium",
        description: `Auto-created from Risk Management. Est. overage ${formatCurrency(burn.overageEstimate)}.`,
      },
      estimatedImpact: formatCurrency(burn.overageEstimate),
      source: "live",
    });
  }

  const MONTHLY_CAPACITY = 160;
  const activeTechs = technicians.filter((t) => t.active);
  const stretched = activeTechs
    .map((tech) => {
      const hours = workEntries
        .filter(
          (e) => e.technician_id === tech.id && isThisMonth(e.work_date),
        )
        .reduce((sum, e) => sum + (e.hours_worked ?? 0), 0);
      return {
        tech,
        utilization: Math.min(100, (hours / MONTHLY_CAPACITY) * 100),
        hours,
      };
    })
    .filter((t) => t.utilization >= 85);

  if (stretched.length > 0) {
    items.push({
      id: "live-capacity",
      category: "capacity",
      priority: stretched.some((t) => t.utilization >= 100) ? "High" : "Medium",
      title: `${stretched.length} technician${stretched.length === 1 ? "" : "s"} at high utilization`,
      evidence: stretched
        .slice(0, 3)
        .map((t) => `${t.tech.technician_name} ~${t.utilization.toFixed(0)}%`)
        .join(" · "),
      why: "Overloaded techs slow response times and raise burnout / reassignment risk.",
      href: "/technicians",
      hrefLabel: "Review technicians",
      secondaryHref: "/service-tickets?filter=unassigned",
      secondaryLabel: "Unassigned tickets",
      canCreateTicket: false,
      source: "live",
    });
  }

  const openSecurity = securityAlerts.filter(
    (a) => a.status === "Open" || !a.status,
  );
  const severeSecurity = openSecurity.filter(
    (a) => a.severity === "Critical" || a.severity === "High",
  );
  if (severeSecurity.length > 0) {
    const top = severeSecurity[0];
    items.push({
      id: "live-security",
      category: "security",
      priority: top.severity === "Critical" ? "Critical" : "High",
      title: `${severeSecurity.length} high/critical security alert${severeSecurity.length === 1 ? "" : "s"}`,
      evidence: openSecurity.length
        ? `${openSecurity.length} open alerts total`
        : "Security module",
      why: "Optional for MSPs that sell cyber — remediate or create a delivery ticket.",
      customerId: top.customer_id,
      customerName: customerName(customers, top.customer_id),
      href: "/cybersecurity",
      hrefLabel: "Open cybersecurity",
      canCreateTicket: Boolean(top.customer_id),
      ticketPrefill: top.customer_id
        ? {
            customerId: top.customer_id,
            title: `Security remediation — ${top.alert_type || top.title}`,
            priority: top.severity === "Critical" ? "Critical" : "High",
            description:
              top.description ??
              top.recommended_solution ??
              top.title ??
              "Security alert from Risk Management.",
          }
        : undefined,
      source: "live",
    });
  }

  const openAi = aiRisks.filter(
    (r) => r.status !== "Closed" && r.status !== "Resolved",
  );
  if (openAi.length > 0) {
    const spend = aiPlatforms.reduce(
      (sum, p) =>
        sum + (p.monthly_subscription_cost ?? 0) + (p.monthly_api_cost ?? 0),
      0,
    );
    items.push({
      id: "live-ai-risk",
      category: "ai",
      priority: "Medium",
      title: `${openAi.length} open AI governance risk${openAi.length === 1 ? "" : "s"}`,
      evidence:
        spend > 0
          ? `Platform spend ${formatCurrency(spend)}/mo`
          : "AI risk register has open items",
      why: "Optional module for firms managing client AI tooling and data exposure.",
      href: "/ai-governance",
      hrefLabel: "Open AI governance",
      canCreateTicket: false,
      source: "live",
    });
  }

  for (const rec of recommendations.filter((r) => r.status === "New")) {
    const category = mapSourceToCategory(rec.source_area);
    items.push({
      id: `rec-${rec.id}`,
      category,
      priority: normalizePriority(rec.priority),
      title: rec.title,
      evidence: [
        rec.source_area,
        rec.risk_exists,
        rec.estimated_impact,
      ]
        .filter(Boolean)
        .join(" · "),
      why: rec.why_it_matters ?? rec.recommended_solution ?? "Manual growth / risk idea.",
      customerId: rec.customer_id,
      customerName: customerName(customers, rec.customer_id),
      contractId: rec.contract_id,
      href: hrefForCategory(category),
      hrefLabel: "Open related area",
      canCreateTicket: Boolean(rec.customer_id),
      ticketPrefill: rec.customer_id
        ? {
            customerId: rec.customer_id,
            title: rec.title,
            priority: normalizePriority(rec.priority),
            description: [
              rec.recommended_solution,
              rec.why_it_matters,
              rec.risk_exists,
            ]
              .filter(Boolean)
              .join("\n\n"),
          }
        : undefined,
      estimatedImpact:
        rec.estimated_monthly_revenue != null
          ? `${formatCurrency(rec.estimated_monthly_revenue)}/mo revenue`
          : rec.estimated_monthly_savings != null
            ? `${formatCurrency(rec.estimated_monthly_savings)}/mo savings`
            : rec.estimated_impact ?? undefined,
      source: "recommendation",
      recommendationId: rec.id,
      status: rec.status,
    });
  }

  return items.sort((a, b) => {
    const byPriority = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (byPriority !== 0) return byPriority;
    return a.title.localeCompare(b.title);
  });
}

function groupCount(ids: Array<string | null | undefined>): Map<string, number> {
  const map = new Map<string, number>();
  for (const id of ids) {
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

function topKey(map: Map<string, number>): string | undefined {
  let best: string | undefined;
  let bestCount = -1;
  for (const [key, count] of map) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

function normalizePriority(value: string | null | undefined): RiskPriority {
  const v = (value ?? "Medium").trim();
  if (v === "Critical" || v === "High" || v === "Medium" || v === "Low") {
    return v;
  }
  return "Medium";
}

function mapSourceToCategory(source: string | null | undefined): RiskCategory {
  const s = (source ?? "").toLowerCase();
  if (s.includes("security") || s.includes("cyber")) return "security";
  if (s.includes("ai")) return "ai";
  if (s.includes("billing") || s.includes("invoice") || s.includes("ar")) {
    return "billing";
  }
  if (s.includes("renew") || s.includes("sales") || s.includes("revenue")) {
    return "revenue";
  }
  if (s.includes("capacity") || s.includes("staff") || s.includes("utilization")) {
    return "capacity";
  }
  if (s.includes("ticket") || s.includes("sla") || s.includes("delivery") || s.includes("operation")) {
    return "delivery";
  }
  return "growth";
}

function hrefForCategory(category: RiskCategory): string {
  switch (category) {
    case "delivery":
      return "/service-tickets";
    case "revenue":
      return "/contracts";
    case "billing":
      return "/billing";
    case "security":
      return "/cybersecurity";
    case "ai":
      return "/ai-governance";
    case "capacity":
      return "/technicians";
    default:
      return "/customers";
  }
}

export function defaultCategoriesForRole(role: string): RiskCategory[] | "all" {
  if (role === "account_manager") {
    return ["revenue", "billing", "growth", "delivery"];
  }
  if (role === "service_manager") {
    return ["delivery", "capacity", "billing", "security"];
  }
  if (role === "billing") {
    return ["billing", "revenue"];
  }
  return "all";
}
