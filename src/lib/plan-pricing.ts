import type { Contract, PlanPricingModel, ServicePlan } from "@/lib/types";

/** Inclusive calendar-month span for a contract term; minimum 1. */
export function contractMonthCount(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): number {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  if (end < start) return 1;

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1;
  return Math.max(1, months);
}

/**
 * Normalize plan pricing to monthly recognized revenue for dashboards/MRR.
 * Monthly: fee as-is. Yearly: fee / 12. Up-front: fee / contract months.
 */
export function recognizedMonthlyRevenue(
  pricingModel: PlanPricingModel | string | null | undefined,
  basePrice: number | null | undefined,
  monthCount: number,
): number {
  const price = Number(basePrice ?? 0);
  if (!Number.isFinite(price) || price < 0) return 0;
  const months = Math.max(1, monthCount || 1);

  switch (pricingModel) {
    case "Yearly":
      return price / 12;
    case "Up-front":
      return price / months;
    case "Monthly":
    default:
      return price;
  }
}

export function planRecognizedMonthly(
  plan: Pick<ServicePlan, "pricing_model" | "base_price">,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): number {
  return recognizedMonthlyRevenue(
    plan.pricing_model,
    plan.base_price,
    contractMonthCount(startDate, endDate),
  );
}

/** Billing frequency label written onto the contract snapshot from the plan. */
export function snapshotBillingFrequency(
  plan: Pick<ServicePlan, "pricing_model" | "billing_frequency">,
): string {
  if (plan.pricing_model === "Yearly") return "Annual";
  if (plan.pricing_model === "Up-front") return "Up-front";
  return plan.billing_frequency || "Monthly";
}

/**
 * For Up-front plans the full base price is stored as setup_fee (cash received /
 * billed up front) while monthly_recurring_fee holds the recognized monthly amount.
 */
export function snapshotSetupFee(
  plan: Pick<ServicePlan, "pricing_model" | "base_price" | "setup_fee">,
): number {
  if (plan.pricing_model === "Up-front") {
    return Number(plan.base_price ?? 0);
  }
  return Number(plan.setup_fee ?? 0);
}

export type CashCadence = "Monthly" | "Yearly" | "Up-front";

/** Infer cash billing cadence from contract snapshot (and optional plan). */
export function resolveCashCadence(
  contract: Pick<Contract, "billing_frequency"> & {
    pricing_model?: string | null;
  },
  plan?: Pick<ServicePlan, "pricing_model"> | null,
): CashCadence {
  const model = plan?.pricing_model ?? contract.pricing_model ?? null;
  if (model === "Yearly" || model === "Up-front" || model === "Monthly") {
    return model;
  }
  const freq = String(contract.billing_frequency ?? "").toLowerCase();
  if (freq.includes("up-front") || freq.includes("upfront")) return "Up-front";
  if (freq.includes("annual") || freq.includes("year")) return "Yearly";
  return "Monthly";
}

/**
 * Cash amount billed each cadence period (not recognized MRR).
 * Monthly: monthly_recurring_fee. Yearly: ×12. Up-front: setup_fee (full base).
 */
export function cashBillAmount(
  contract: Pick<
    Contract,
    "monthly_recurring_fee" | "setup_fee" | "billing_frequency"
  > & { pricing_model?: string | null },
  plan?: Pick<ServicePlan, "pricing_model" | "base_price"> | null,
): number {
  const cadence = resolveCashCadence(contract, plan);
  const monthly = Number(contract.monthly_recurring_fee ?? 0);
  const setup = Number(contract.setup_fee ?? 0);

  switch (cadence) {
    case "Yearly":
      if (plan?.base_price != null && Number(plan.base_price) > 0) {
        return Number(plan.base_price);
      }
      return Math.round(monthly * 12 * 100) / 100;
    case "Up-front":
      if (setup > 0) return setup;
      if (plan?.base_price != null && Number(plan.base_price) > 0) {
        return Number(plan.base_price);
      }
      return monthly;
    case "Monthly":
    default:
      return monthly;
  }
}

export interface ExpectedPlanPeriod {
  /** Idempotency key stored on invoices.billing_period */
  period: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Expected cash plan invoice periods from start through asOf.
 * Monthly lookback capped at 12 months so opening Billing does not flood AR.
 */
export function expectedPlanPeriods(
  contract: Pick<
    Contract,
    | "start_date"
    | "end_date"
    | "monthly_recurring_fee"
    | "setup_fee"
    | "billing_frequency"
    | "invoice_due_days"
  > & { pricing_model?: string | null },
  asOf: Date = new Date(),
  plan?: Pick<ServicePlan, "pricing_model" | "base_price"> | null,
): ExpectedPlanPeriod[] {
  if (!contract.start_date) return [];

  const start = new Date(contract.start_date);
  if (Number.isNaN(start.getTime())) return [];

  const endCap = contract.end_date ? new Date(contract.end_date) : null;
  const asOfDay = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  let through = asOfDay;
  if (endCap && !Number.isNaN(endCap.getTime()) && endCap < through) {
    through = endCap;
  }
  if (through < start) return [];

  const dueDays = Number(contract.invoice_due_days ?? 30) || 30;
  const cadence = resolveCashCadence(contract, plan);
  const amount = cashBillAmount(contract, plan);
  const periods: ExpectedPlanPeriod[] = [];

  if (cadence === "Up-front") {
    if (amount > 0) {
      periods.push({
        period: "upfront",
        invoiceDate: isoDate(start),
        dueDate: isoDate(addDays(start, dueDays)),
        amount,
      });
    }
    return periods;
  }

  if (cadence === "Yearly") {
    if (amount <= 0) return periods;
    let yearStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (yearStart <= through) {
      periods.push({
        period: String(yearStart.getFullYear()),
        invoiceDate: isoDate(yearStart),
        dueDate: isoDate(addDays(yearStart, dueDays)),
        amount,
      });
      yearStart = new Date(
        yearStart.getFullYear() + 1,
        yearStart.getMonth(),
        yearStart.getDate(),
      );
    }
    // Separate one-time setup for yearly plans that also have setup_fee
    const setup = Number(contract.setup_fee ?? 0);
    if (setup > 0) {
      periods.push({
        period: "setup",
        invoiceDate: isoDate(start),
        dueDate: isoDate(addDays(start, dueDays)),
        amount: setup,
      });
    }
    return periods;
  }

  // Monthly — lookback max 12 months from asOf
  if (amount <= 0) {
    const setupOnly = Number(contract.setup_fee ?? 0);
    if (setupOnly > 0) {
      periods.push({
        period: "setup",
        invoiceDate: isoDate(start),
        dueDate: isoDate(addDays(start, dueDays)),
        amount: setupOnly,
      });
    }
    return periods;
  }
  const lookback = new Date(asOfDay.getFullYear(), asOfDay.getMonth() - 11, 1);
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  if (cursor < lookback) cursor = lookback;
  const throughMonth = new Date(through.getFullYear(), through.getMonth(), 1);

  while (cursor <= throughMonth) {
    const invoiceDate = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      Math.min(start.getDate(), 28),
    );
    // Don't bill a month before the contract actually started
    if (invoiceDate < start) {
      invoiceDate.setTime(start.getTime());
    }
    if (invoiceDate <= through) {
      periods.push({
        period: monthKey(cursor),
        invoiceDate: isoDate(invoiceDate),
        dueDate: isoDate(addDays(invoiceDate, dueDays)),
        amount,
      });
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  // Separate one-time setup fee for Monthly (not rolled into up-front base)
  const setup = Number(contract.setup_fee ?? 0);
  if (setup > 0) {
    periods.push({
      period: "setup",
      invoiceDate: isoDate(start),
      dueDate: isoDate(addDays(start, dueDays)),
      amount: setup,
    });
  }

  return periods;
}

/**
 * Allocate hours against a monthly included pool (chronological).
 * Returns billable overage hours for each entry id in `selected`.
 * `priorHoursByMonth` counts hours already billed (or otherwise consumed)
 * for the same contract in that YYYY-MM before these selected entries.
 */
export function allocateOverageHours(input: {
  selected: Array<{
    id: string;
    work_date: string | null;
    hours_worked: number | null;
  }>;
  includedHoursPerMonth: number;
  priorHoursByMonth?: Record<string, number>;
}): Map<string, number> {
  const included = Math.max(0, Number(input.includedHoursPerMonth ?? 0));
  const prior = { ...(input.priorHoursByMonth ?? {}) };
  const sorted = [...input.selected].sort((a, b) => {
    const da = a.work_date ?? "";
    const db = b.work_date ?? "";
    if (da !== db) return da.localeCompare(db);
    return a.id.localeCompare(b.id);
  });

  const overageById = new Map<string, number>();
  for (const entry of sorted) {
    const hours = Number(entry.hours_worked ?? 0);
    if (!entry.work_date || hours <= 0) {
      overageById.set(entry.id, 0);
      continue;
    }
    const key = entry.work_date.slice(0, 7);
    const used = prior[key] ?? 0;
    const remainingPool = Math.max(0, included - used);
    const covered = Math.min(hours, remainingPool);
    const overage = Math.max(0, hours - covered);
    overageById.set(entry.id, overage);
    prior[key] = used + hours;
  }
  return overageById;
}

export const PLAN_PRICING_MODELS: PlanPricingModel[] = [
  "Monthly",
  "Yearly",
  "Up-front",
];

/** Dropdown options for late fee percent of original invoice subtotal. */
export const LATE_FEE_PERCENT_OPTIONS = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 5, 10,
] as const;

/** Dropdown options for how often the late fee accrues after the due date. */
export const LATE_FEE_PERIOD_OPTIONS = [
  { days: 7, label: "Every 7 days" },
  { days: 14, label: "Every 14 days" },
  { days: 30, label: "Every 30 days" },
  { days: 60, label: "Every 60 days" },
  { days: 90, label: "Every 90 days" },
] as const;

export function formatLateFeePolicy(
  percent: number | null | undefined,
  periodDays: number | null | undefined,
): string {
  const pct = Number(percent ?? 0);
  const days = Number(periodDays ?? 0);
  if (!pct || pct <= 0 || !days || days <= 0) {
    return "No late fee";
  }
  return `${pct}% every ${days} days past due`;
}

/**
 * Late fee accrues once per full timeframe after the due date, on the original
 * invoice subtotal (charges excluding late fees). Example: 1.5% / 30 days and
 * 45 days past due → 1 period → 1.5% of subtotal.
 */
export function computeLateFeeAmount(input: {
  dueDate: string | null | undefined;
  subtotal: number;
  percent: number | null | undefined;
  periodDays: number | null | undefined;
  now?: Date;
}): number {
  const percent = Number(input.percent ?? 0);
  const periodDays = Number(input.periodDays ?? 0);
  const subtotal = Number(input.subtotal ?? 0);
  if (
    !input.dueDate ||
    !Number.isFinite(percent) ||
    percent <= 0 ||
    !Number.isFinite(periodDays) ||
    periodDays <= 0 ||
    !Number.isFinite(subtotal) ||
    subtotal <= 0
  ) {
    return 0;
  }

  const due = new Date(input.dueDate);
  if (Number.isNaN(due.getTime())) return 0;

  const now = input.now ?? new Date();
  const dueStart = new Date(
    due.getFullYear(),
    due.getMonth(),
    due.getDate(),
  );
  const nowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysPastDue = Math.floor(
    (nowStart.getTime() - dueStart.getTime()) / msPerDay,
  );
  if (daysPastDue < periodDays) return 0;

  const periods = Math.floor(daysPastDue / periodDays);
  if (periods <= 0) return 0;

  return Math.round(subtotal * (percent / 100) * periods * 100) / 100;
}

export function invoiceSubtotal(invoice: {
  recurring_service_fee?: number | null;
  additional_support_charges?: number | null;
  software_charges?: number | null;
  equipment_charges?: number | null;
  other_charges?: number | null;
}): number {
  return (
    (invoice.recurring_service_fee ?? 0) +
    (invoice.additional_support_charges ?? 0) +
    (invoice.software_charges ?? 0) +
    (invoice.equipment_charges ?? 0) +
    (invoice.other_charges ?? 0)
  );
}

export const REVENUE_RECOGNITION_GUIDANCE =
  "Plan prices are recognized monthly over the service period (ASC 606-style): Monthly fees as billed, Yearly fees ÷ 12, and Up-front fees ÷ contract months. Cash may be collected on a different cadence than recognition.";

export const PLAN_CASH_BILLING_GUIDANCE =
  "Plan invoices are generated on cash cadence when Billing loads (monthly / yearly / up-front). Recognized MRR on reports stays monthly. Support hours and hardware within contract pools are not double-billed; overages and pass-through expenses (travel, meals, parts) still invoice.";
