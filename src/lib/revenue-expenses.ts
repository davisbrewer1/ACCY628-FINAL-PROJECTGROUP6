import { isAcceptedTicketExpense } from "@/lib/ticket-expense-budgets";
import type {
  ExpenseTag,
  Invoice,
  TicketExpense,
  WorkEntry,
} from "@/lib/types";

/** Invoice statuses counted as recognized (billed) revenue. */
export const RECOGNIZED_INVOICE_STATUSES = [
  "Issued",
  "Past Due",
  "Partially Paid",
  "Paid",
] as const;

export type RecognizedInvoiceStatus =
  (typeof RECOGNIZED_INVOICE_STATUSES)[number];

export function isRecognizedInvoiceStatus(
  status: string | null | undefined,
): boolean {
  const value = (status ?? "").trim();
  return (RECOGNIZED_INVOICE_STATUSES as readonly string[]).includes(value);
}

export function filterRecognizedInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter((invoice) =>
    isRecognizedInvoiceStatus(invoice.status),
  );
}

export function sumRecognizedRevenue(invoices: Invoice[]): number {
  return filterRecognizedInvoices(invoices).reduce(
    (sum, invoice) => sum + Number(invoice.total_amount ?? 0),
    0,
  );
}

export function sumFulfillmentWorkCosts(workEntries: WorkEntry[]): number {
  return workEntries.reduce(
    (sum, entry) => sum + Number(entry.total_direct_cost ?? 0),
    0,
  );
}

export function filterAcceptedExpensesByTag(
  expenses: TicketExpense[],
  tag: ExpenseTag,
): TicketExpense[] {
  return expenses.filter(
    (expense) =>
      isAcceptedTicketExpense(expense) && expense.expense_tag === tag,
  );
}

export function sumAcceptedExpenses(
  expenses: TicketExpense[],
  tag: ExpenseTag,
): number {
  return filterAcceptedExpensesByTag(expenses, tag).reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0,
  );
}

export function sumTicketFulfillmentExpenses(
  workEntries: WorkEntry[],
  expenses: TicketExpense[],
): number {
  return (
    sumFulfillmentWorkCosts(workEntries) +
    sumAcceptedExpenses(expenses, "Billable to Customer")
  );
}

export function sumOperatingExpenses(expenses: TicketExpense[]): number {
  return sumAcceptedExpenses(expenses, "Internal Company Expense");
}

export function contributionMargin(input: {
  revenue: number;
  fulfillment: number;
  operating: number;
}): number {
  return input.revenue - input.fulfillment - input.operating;
}

export function buildRevenueExpenseTotals(
  invoices: Invoice[],
  workEntries: WorkEntry[],
  expenses: TicketExpense[],
) {
  const revenue = sumRecognizedRevenue(invoices);
  const fulfillmentWork = sumFulfillmentWorkCosts(workEntries);
  const fulfillmentBillable = sumAcceptedExpenses(
    expenses,
    "Billable to Customer",
  );
  const fulfillment = fulfillmentWork + fulfillmentBillable;
  const operating = sumOperatingExpenses(expenses);

  return {
    revenue,
    fulfillment,
    fulfillmentWork,
    fulfillmentBillable,
    operating,
    contribution: contributionMargin({ revenue, fulfillment, operating }),
    recognizedInvoices: filterRecognizedInvoices(invoices),
    billableExpenses: filterAcceptedExpensesByTag(
      expenses,
      "Billable to Customer",
    ),
    operatingExpenses: filterAcceptedExpensesByTag(
      expenses,
      "Internal Company Expense",
    ),
  };
}
