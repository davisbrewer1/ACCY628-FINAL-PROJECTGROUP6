"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";

export async function createHardwareAsset(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!customerId || !category) {
    return { success: false, message: "Customer and category are required." };
  }

  const assetNumber =
    String(formData.get("asset_number") ?? "").trim() ||
    `HW-${Date.now().toString().slice(-8)}`;

  const purchaseCostRaw = String(formData.get("purchase_cost") ?? "").trim();

  const { error } = await supabase.from("hardware_assets").insert({
    asset_number: assetNumber,
    customer_id: customerId,
    location: String(formData.get("location") ?? "").trim() || null,
    category,
    manufacturer: String(formData.get("manufacturer") ?? "").trim() || null,
    model: String(formData.get("model") ?? "").trim() || null,
    serial_number: String(formData.get("serial_number") ?? "").trim() || null,
    purchase_date: String(formData.get("purchase_date") ?? "").trim() || null,
    warranty_expiration:
      String(formData.get("warranty_expiration") ?? "").trim() || null,
    assigned_employee:
      String(formData.get("assigned_employee") ?? "").trim() || null,
    operating_system:
      String(formData.get("operating_system") ?? "").trim() || null,
    device_status: String(formData.get("device_status") ?? "Active").trim(),
    lifecycle_stage:
      String(formData.get("lifecycle_stage") ?? "In Use").trim() || "In Use",
    estimated_replacement_date:
      String(formData.get("estimated_replacement_date") ?? "").trim() || null,
    purchase_cost: purchaseCostRaw ? Number(purchaseCostRaw) : null,
    managed_coverage: formData.get("managed_coverage") === "true",
    support_contract:
      String(formData.get("support_contract") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/hardware");
  revalidatePath("/portal");
  return { success: true, message: `Asset ${assetNumber} registered.` };
}
