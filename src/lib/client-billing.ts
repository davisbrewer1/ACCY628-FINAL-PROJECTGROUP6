import type { Invoice } from "@/lib/types";

/** Client-facing invoice status labels from acceptance criteria. */
export type ClientInvoiceStatus = "Paid" | "Unpaid" | "Partial" | "Disputed" | "Canceled";

export function toClientInvoiceStatus(
  status: string | null | undefined,
  amountPaid: number | null | undefined = 0,
  remainingBalance: number | null | undefined = 0,
): ClientInvoiceStatus {
  if (status === "Disputed") return "Disputed";
  if (status === "Canceled") return "Canceled";
  if (status === "Paid" || ((remainingBalance ?? 0) <= 0 && (amountPaid ?? 0) > 0)) {
    return "Paid";
  }
  if (
    status === "Partially Paid" ||
    ((amountPaid ?? 0) > 0 && (remainingBalance ?? 0) > 0)
  ) {
    return "Partial";
  }
  return "Unpaid";
}

export interface InvoiceLineItem {
  key: string;
  label: string;
  explanation: string;
  amount: number;
}

export function buildInvoiceLineItems(invoice: Invoice): InvoiceLineItem[] {
  const candidates: InvoiceLineItem[] = [
    {
      key: "recurring",
      label: "Recurring support agreement",
      explanation:
        "Monthly recurring charge for your managed IT support agreement and included services.",
      amount: invoice.recurring_service_fee ?? 0,
    },
    {
      key: "additional",
      label: "Additional billable work",
      explanation:
        "Additional support hours beyond the included limit (or approved extra work) billed at your contract overage / hourly rates.",
      amount: invoice.additional_support_charges ?? 0,
    },
    {
      key: "software",
      label: "Software / license charges",
      explanation:
        "Software subscriptions, licenses, or cloud charges associated with your account for this billing period.",
      amount: invoice.software_charges ?? 0,
    },
    {
      key: "equipment",
      label: "Hardware purchase / equipment",
      explanation:
        "Purchase cost for hardware, replacements, or equipment procured through Nexus for your organization.",
      amount: invoice.equipment_charges ?? 0,
    },
    {
      key: "other",
      label: "Other charges",
      explanation: "Other approved billable items not categorized above.",
      amount: invoice.other_charges ?? 0,
    },
    {
      key: "late_fee",
      label: "Late fee",
      explanation:
        "Automatic past-due charge from your contract late-fee percent and timeframe.",
      amount: invoice.late_fee_amount ?? 0,
    },
  ];

  return candidates.filter((item) => item.amount > 0);
}

export function sumOutstandingBalance(invoices: Invoice[]): number {
  return invoices
    .filter((invoice) => {
      const clientStatus = toClientInvoiceStatus(
        invoice.status,
        invoice.amount_paid,
        invoice.remaining_balance,
      );
      return clientStatus !== "Paid" && clientStatus !== "Canceled";
    })
    .reduce((sum, invoice) => sum + (invoice.remaining_balance ?? 0), 0);
}
