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

/** Prefer stored health_score; otherwise derive a client-friendly 0–100 score. */
export function getDeviceHealthScore(asset: HardwareAsset): number {
  if (asset.health_score != null && !Number.isNaN(Number(asset.health_score))) {
    return Math.round(Number(asset.health_score));
  }

  let score = 100;
  if (asset.device_status === "Offline") score -= 35;
  if (asset.device_status === "Retired") score -= 40;
  if (asset.missing_security_updates) score -= 20;
  if (asset.unsupported_os) score -= 15;
  if (asset.needs_replacement) score -= 15;
  if (asset.nearing_eol) score -= 10;
  if (asset.warranty_expiring_soon) score -= 5;
  return Math.max(0, Math.min(100, score));
}

export function healthTone(
  score: number,
): "success" | "warning" | "danger" | "default" {
  if (score >= 85) return "success";
  if (score >= 70) return "default";
  if (score >= 50) return "warning";
  return "danger";
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
