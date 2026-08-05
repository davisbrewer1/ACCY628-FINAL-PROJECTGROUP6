import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_APPROVAL_THRESHOLD,
  DEFAULT_OTHER_COSTS,
  DEFAULT_TRAVEL_RATE,
} from "@/lib/autoCostCalculator";
import type {
  CostEntry,
  InventoryPart,
  SoftwareCatalogItem,
} from "@/lib/types";

export interface CostSettings {
  travelRate: number;
  approvalThreshold: number;
  otherCosts: Record<string, number>;
}

export interface CostReferenceData {
  settings: CostSettings;
  parts: InventoryPart[];
  software: SoftwareCatalogItem[];
}

function asNumber(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function asOtherCosts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_OTHER_COSTS };
  }

  const result: Record<string, number> = { ...DEFAULT_OTHER_COSTS };
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    result[key] = asNumber(raw, 0);
  }
  return result;
}

export async function fetchCostSettings(
  supabase: SupabaseClient,
): Promise<CostSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["travel_rate", "approval_threshold", "other_costs"]);

  if (error) {
    // Tables may not be migrated yet — return defaults.
    return {
      travelRate: DEFAULT_TRAVEL_RATE,
      approvalThreshold: DEFAULT_APPROVAL_THRESHOLD,
      otherCosts: { ...DEFAULT_OTHER_COSTS },
    };
  }

  const map = new Map((data ?? []).map((row) => [row.key, row.value]));

  return {
    travelRate: asNumber(map.get("travel_rate"), DEFAULT_TRAVEL_RATE),
    approvalThreshold: asNumber(
      map.get("approval_threshold"),
      DEFAULT_APPROVAL_THRESHOLD,
    ),
    otherCosts: asOtherCosts(map.get("other_costs")),
  };
}

export async function fetchTechnicianHourlyRate(
  supabase: SupabaseClient,
  technicianId: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("technicians")
    .select("hourly_rate, internal_hourly_cost")
    .eq("id", technicianId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as {
    hourly_rate?: number | null;
    internal_hourly_cost?: number | null;
  };

  if (row.hourly_rate != null && row.hourly_rate > 0) {
    return row.hourly_rate;
  }
  if (row.internal_hourly_cost != null && row.internal_hourly_cost > 0) {
    return row.internal_hourly_cost;
  }
  return null;
}

export async function fetchInventoryParts(
  supabase: SupabaseClient,
): Promise<InventoryPart[]> {
  const { data, error } = await supabase
    .from("inventory_parts")
    .select("id, part_name, sku, unit_cost, active, created_at")
    .eq("active", true)
    .order("part_name");

  if (error) {
    return [];
  }

  return (data ?? []) as InventoryPart[];
}

export async function fetchSoftwareCatalog(
  supabase: SupabaseClient,
): Promise<SoftwareCatalogItem[]> {
  const { data, error } = await supabase
    .from("software_catalog")
    .select("id, software_name, license_cost, active, created_at")
    .eq("active", true)
    .order("software_name");

  if (error) {
    return [];
  }

  return (data ?? []) as SoftwareCatalogItem[];
}

export async function fetchContractInclusionRules(
  supabase: SupabaseClient,
  contractId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select("included_services, remote_support_included, onsite_support_included")
    .eq("id", contractId)
    .maybeSingle();

  if (error || !data) {
    return [];
  }

  const row = data as {
    included_services?: string[] | null;
    remote_support_included?: boolean | null;
    onsite_support_included?: boolean | null;
  };

  const services = [...(row.included_services ?? [])];
  if (row.remote_support_included) {
    services.push("Remote Support");
  }
  if (row.onsite_support_included) {
    services.push("On-site Support");
  }

  return [...new Set(services.filter(Boolean))];
}

export async function fetchCostReferenceData(
  supabase: SupabaseClient,
): Promise<CostReferenceData> {
  const [settings, parts, software] = await Promise.all([
    fetchCostSettings(supabase),
    fetchInventoryParts(supabase),
    fetchSoftwareCatalog(supabase),
  ]);

  return { settings, parts, software };
}

export async function fetchCostEntries(
  supabase: SupabaseClient,
): Promise<CostEntry[]> {
  const { data, error } = await supabase
    .from("cost_entries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return [];
  }

  return (data ?? []) as CostEntry[];
}
