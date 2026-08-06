import { workEntriesAttributedToContract } from "@/lib/manager-ops";
import {
  DEFAULT_TECH_HOURLY_RATE,
  getCurrentPayPeriod,
  salariedHoursInPayPeriod,
} from "@/lib/technician-payroll";
import { isAcceptedTicketExpense } from "@/lib/ticket-expense-budgets";
import type {
  Contract,
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

/** Current biweekly salaried payroll for active technicians (My Work pay rules). */
export function computeTechnicianPayrollOpex(
  activeTechCount: number,
  reference = new Date(),
): {
  activeTechCount: number;
  paidHoursPerTech: number;
  hourlyRate: number;
  payrollCost: number;
  payPeriod: { start: Date; end: Date };
} {
  const paidHoursPerTech = salariedHoursInPayPeriod(reference);
  const payrollCost =
    activeTechCount * paidHoursPerTech * DEFAULT_TECH_HOURLY_RATE;
  return {
    activeTechCount,
    paidHoursPerTech,
    hourlyRate: DEFAULT_TECH_HOURLY_RATE,
    payrollCost,
    payPeriod: getCurrentPayPeriod(reference),
  };
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
  options?: { activeTechCount?: number; reference?: Date },
) {
  const revenue = sumRecognizedRevenue(invoices);
  const fulfillmentWork = sumFulfillmentWorkCosts(workEntries);
  const fulfillmentBillable = sumAcceptedExpenses(
    expenses,
    "Billable to Customer",
  );
  const fulfillment = fulfillmentWork + fulfillmentBillable;
  const operatingTracked = sumOperatingExpenses(expenses);
  const payroll = computeTechnicianPayrollOpex(
    options?.activeTechCount ?? 0,
    options?.reference,
  );
  const operating = operatingTracked + payroll.payrollCost;

  return {
    revenue,
    fulfillment,
    fulfillmentWork,
    fulfillmentBillable,
    operating,
    operatingTracked,
    technicianPayroll: payroll,
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

export interface ContractProfitabilityRow {
  contractId: string;
  contractName: string;
  customerId: string;
  status: string | null;
  revenue: number;
  fulfillment: number;
  fulfillmentWork: number;
  fulfillmentBillable: number;
  margin: number;
}

const OPEN_CONTRACT_STATUSES = new Set([
  "Active",
  "Pending Approval",
  "Open",
]);

export function isOpenContractStatus(status: string | null | undefined): boolean {
  const value = (status ?? "").trim();
  if (!value) return true;
  return OPEN_CONTRACT_STATUSES.has(value) || value.toLowerCase() === "active";
}

/**
 * Per-contract profitability: recognized invoice revenue vs attributed fulfillment.
 */
export function buildContractProfitabilityRows(
  contracts: Contract[],
  invoices: Invoice[],
  workEntries: WorkEntry[],
  expenses: TicketExpense[],
  ticketContractById: Map<string, string | null | undefined>,
): ContractProfitabilityRow[] {
  const openContracts = contracts.filter((contract) =>
    isOpenContractStatus(contract.contract_status),
  );

  return openContracts
    .map((contract) => {
      const contractInvoices = filterRecognizedInvoices(invoices).filter(
        (invoice) => invoice.contract_id === contract.id,
      );
      const revenue = sumRecognizedRevenue(contractInvoices);
      const attributedWork = workEntriesAttributedToContract(
        contract,
        contracts,
        workEntries,
      );
      const fulfillmentWork = sumFulfillmentWorkCosts(attributedWork);
      const billableForContract = filterAcceptedExpensesByTag(
        expenses,
        "Billable to Customer",
      ).filter((expense) => {
        const ticketContractId = ticketContractById.get(expense.ticket_id);
        return ticketContractId === contract.id;
      });
      const fulfillmentBillable = billableForContract.reduce(
        (sum, expense) => sum + Number(expense.amount ?? 0),
        0,
      );
      const fulfillment = fulfillmentWork + fulfillmentBillable;
      return {
        contractId: contract.id,
        contractName: contract.contract_name,
        customerId: contract.customer_id,
        status: contract.contract_status,
        revenue,
        fulfillment,
        fulfillmentWork,
        fulfillmentBillable,
        margin: revenue - fulfillment,
      };
    })
    .sort((a, b) => b.margin - a.margin);
}
