import { formatCurrency, formatHours } from "@/lib/format";
import type { Contract, HardwareAsset, Invoice, ServicePlan, WorkEntry } from "@/lib/types";
import { isThisMonth } from "@/lib/dashboard-stats";
import {
  buildInvoiceLineItems,
  toClientInvoiceStatus,
  type InvoiceLineItem,
} from "@/lib/client-billing";

/** Mid-size MSP plan context for the client billing portal. */
export function buildPortalPlanBillingSummary(input: {
  contract: Contract | null | undefined;
  plan: ServicePlan | null | undefined;
  workEntries: WorkEntry[];
  assets: HardwareAsset[];
  invoices: Invoice[];
}) {
  const { contract, plan, workEntries, assets, invoices } = input;

  const includedHours =
    contract?.included_support_hours ?? plan?.included_support_hours ?? 0;
  const overageRate =
    contract?.additional_hourly_rate ?? plan?.additional_hourly_rate ?? 0;
  const monthlyFee =
    contract?.monthly_recurring_fee ??
    (plan ? Number(plan.base_price ?? 0) : 0);
  const assetBudget =
    contract?.included_asset_budget ?? plan?.included_asset_budget ?? 0;

  const monthEntries = workEntries.filter((entry) => isThisMonth(entry.work_date));
  const monthHours = monthEntries.reduce(
    (sum, entry) => sum + (entry.hours_worked ?? 0),
    0,
  );
  const coveredHours = monthEntries
    .filter((entry) => entry.included_in_contract)
    .reduce((sum, entry) => sum + (entry.hours_worked ?? 0), 0);
  const billableExtraHours = monthEntries
    .filter((entry) => entry.included_in_contract === false)
    .reduce((sum, entry) => sum + (entry.hours_worked ?? 0), 0);

  const remainingHours = Math.max(0, includedHours - monthHours);
  const overageHours = Math.max(0, monthHours - includedHours);
  const estimatedOverageCharge = overageHours * overageRate;

  const activeAssets = assets.filter(
    (asset) =>
      asset.device_status !== "Retired" &&
      asset.device_status !== "Disposed" &&
      asset.device_status !== "Lost",
  );
  const hardwareSpend = invoices.reduce(
    (sum, invoice) => sum + (invoice.equipment_charges ?? 0),
    0,
  );
  const remainingAssetBudget = Math.max(0, assetBudget - hardwareSpend);

  const planName =
    contract?.service_plan_name ?? plan?.name ?? "No active plan";

  return {
    planName,
    monthlyFee,
    includedHours,
    overageRate,
    monthHours,
    coveredHours,
    billableExtraHours,
    remainingHours,
    overageHours,
    estimatedOverageCharge,
    assetBudget,
    activeAssetCount: activeAssets.length,
    hardwareSpend,
    remainingAssetBudget,
    billingFrequency: contract?.billing_frequency ?? plan?.billing_frequency ?? "Monthly",
    paymentTerms: contract?.payment_terms ?? plan?.payment_terms ?? "Net 30",
  };
}

export function buildPortalInvoiceLineItems(
  invoice: Invoice,
  contract?: Contract | null,
): InvoiceLineItem[] {
  const base = buildInvoiceLineItems(invoice);
  const includedHours = contract?.included_support_hours;
  const overageRate = contract?.additional_hourly_rate;

  return base.map((item) => {
    if (item.key === "recurring") {
      return {
        ...item,
        label: "Managed service plan (recurring)",
        explanation: includedHours
          ? `Recurring plan fee covering up to ${formatHours(includedHours)} of included support for your organization this billing period.`
          : item.explanation,
      };
    }
    if (item.key === "additional") {
      return {
        ...item,
        label: "Support hours beyond included plan allotment",
        explanation: overageRate
          ? `Billable support time above your plan’s included hours, charged at ${formatCurrency(overageRate)}/hour.`
          : item.explanation,
      };
    }
    if (item.key === "equipment") {
      return {
        ...item,
        label: "Hardware / device fleet purchases",
        explanation:
          "Bulk or multi-device hardware procured for your mid-size organization (laptops, desktops, networking, and related equipment), not a single one-off computer order.",
      };
    }
    return item;
  });
}

export function payableInvoices(invoices: Invoice[]): Invoice[] {
  return invoices.filter((invoice) => {
    const status = toClientInvoiceStatus(
      invoice.status,
      invoice.amount_paid,
      invoice.remaining_balance,
    );
    return (
      status !== "Paid" &&
      status !== "Canceled" &&
      (invoice.remaining_balance ?? 0) > 0
    );
  });
}
