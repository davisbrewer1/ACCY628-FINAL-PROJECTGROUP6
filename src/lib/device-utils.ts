import type { HardwareAsset, Invoice } from "@/lib/types";

export function deviceDisplayName(asset: HardwareAsset): string {
  const parts = [asset.manufacturer, asset.model].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : asset.category;
}

export function coverageLabel(asset: HardwareAsset): string {
  if (asset.managed_coverage) return "Covered by managed IT";
  if (asset.support_contract) return asset.support_contract;
  return "Listed inventory";
}

export type ClientInvoiceCategory = "Hardware purchase" | "Services" | "Mixed";

export function getInvoiceCategory(invoice: Invoice): ClientInvoiceCategory {
  const equipment = invoice.equipment_charges ?? 0;
  const serviceTotal =
    (invoice.recurring_service_fee ?? 0) +
    (invoice.additional_support_charges ?? 0) +
    (invoice.software_charges ?? 0) +
    (invoice.other_charges ?? 0);

  if (equipment > 0 && serviceTotal <= 0) return "Hardware purchase";
  if (equipment > 0 && serviceTotal > 0) return "Mixed";
  return "Services";
}
