"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";

export async function createCatalogItem(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const serviceName = String(formData.get("service_name") ?? "").trim();
  if (!serviceName) {
    return { success: false, message: "Service name is required." };
  }

  const basePriceRaw = String(formData.get("base_price") ?? "").trim();
  const estimatedCostRaw = String(
    formData.get("estimated_provider_cost") ?? "",
  ).trim();

  const { error } = await supabase.from("service_catalog_items").insert({
    service_name: serviceName,
    service_family: String(formData.get("service_family") ?? "").trim(),
    business_problem:
      String(formData.get("business_problem") ?? "").trim() || null,
    includes_hardware: formData.get("includes_hardware") === "true",
    includes_software: formData.get("includes_software") === "true",
    includes_labor: formData.get("includes_labor") === "true",
    includes_support: formData.get("includes_support") === "true",
    whats_included:
      String(formData.get("whats_included") ?? "").trim() || null,
    pricing_model: String(formData.get("pricing_model") ?? "").trim() || null,
    base_price: basePriceRaw ? Number(basePriceRaw) : null,
    provider_cost_components:
      String(formData.get("provider_cost_components") ?? "").trim() || null,
    estimated_provider_cost: estimatedCostRaw
      ? Number(estimatedCostRaw)
      : null,
    status: String(formData.get("status") ?? "Active").trim() || "Active",
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/service-catalog");
  return { success: true, message: "Service catalog item added." };
}
