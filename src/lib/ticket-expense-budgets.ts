import type { ExpenseTag, TicketExpense } from "@/lib/types";
import { endOfMonth, format, startOfMonth } from "date-fns";

/** Prefix for approvals created when Internal spend exceeds the monthly limit. */
export const INTERNAL_EXPENSE_OVER_LIMIT_REASON =
  "Internal expense over monthly limit";

export const DEFAULT_EXPENSE_MONTHLY_LIMIT = 500;

export function isInternalOverLimitApproval(
  reason: string | null | undefined,
): boolean {
  return (reason ?? "").startsWith(INTERNAL_EXPENSE_OVER_LIMIT_REASON);
}

/**
 * Accepted expenses count as company costs:
 * - Internal: auto (null) or Approved over-limit; not Pending/Denied
 * - Billable: Approved only (whether or not yet invoiced)
 */
export function isAcceptedTicketExpense(expense: {
  expense_tag?: string | null;
  approval_status?: string | null;
  amount?: number | null;
}): boolean {
  if (Number(expense.amount ?? 0) <= 0) return false;
  const status = expense.approval_status ?? null;
  if (status === "Denied" || status === "Pending") return false;

  if (expense.expense_tag === "Billable to Customer") {
    return status === "Approved";
  }

  // Internal Company Expense (and legacy/unknown tags treated as internal cost)
  return status == null || status === "Approved";
}

export function buildInternalOverLimitReason(input: {
  type: string;
  amount: number;
  description?: string | null;
  date: string;
  monthlyLimit: number;
  mtdSpend: number;
}) {
  const note = input.description?.trim();
  return [
    INTERNAL_EXPENSE_OVER_LIMIT_REASON,
    `${input.type} · $${Number(input.amount).toFixed(2)} · ${input.date}`,
    `MTD $${input.mtdSpend.toFixed(2)} / limit $${input.monthlyLimit.toFixed(2)}`,
    note || null,
  ]
    .filter(Boolean)
    .join(" — ");
}

export function currentMonthDateBounds(now = new Date()) {
  return {
    start: format(startOfMonth(now), "yyyy-MM-dd"),
    end: format(endOfMonth(now), "yyyy-MM-dd"),
  };
}

/** Sum accepted Internal expenses for a technician in the current calendar month. */
export function sumAcceptedInternalMtd(
  expenses: Array<Pick<TicketExpense, "technician_id" | "expense_tag" | "approval_status" | "amount" | "date">>,
  technicianId: string,
  now = new Date(),
): number {
  const { start, end } = currentMonthDateBounds(now);
  return expenses
    .filter((row) => {
      if (row.technician_id !== technicianId) return false;
      if (row.expense_tag !== "Internal Company Expense") return false;
      if (!isAcceptedTicketExpense(row)) return false;
      const d = row.date?.slice(0, 10) ?? "";
      return d >= start && d <= end;
    })
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

export function expenseCustomerId(
  expense: { ticket_id: string },
  ticketById: Map<string, { customer_id: string; contract_id?: string | null }>,
): string | null {
  return ticketById.get(expense.ticket_id)?.customer_id ?? null;
}

export function expenseContractId(
  expense: { ticket_id: string },
  ticketById: Map<string, { customer_id: string; contract_id?: string | null }>,
): string | null {
  return ticketById.get(expense.ticket_id)?.contract_id ?? null;
}

export type InternalBudgetDecision =
  | { mode: "accept" }
  | {
      mode: "over_limit";
      monthlyLimit: number;
      mtdSpend: number;
    };

export function decideInternalBudget(input: {
  amount: number;
  monthlyLimit: number;
  mtdSpend: number;
}): InternalBudgetDecision {
  const limit = Number(input.monthlyLimit);
  const mtd = Number(input.mtdSpend);
  const amount = Number(input.amount);
  if (mtd + amount <= limit) {
    return { mode: "accept" };
  }
  return { mode: "over_limit", monthlyLimit: limit, mtdSpend: mtd };
}

export function isInternalExpenseTag(tag: string | null | undefined): boolean {
  return (tag as ExpenseTag) === "Internal Company Expense" || !tag;
}
