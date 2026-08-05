"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";

export async function createRecommendation(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const sourceArea = String(formData.get("source_area") ?? "").trim();

  if (!title || !sourceArea) {
    return { success: false, message: "Title and source area are required." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const savingsRaw = String(
    formData.get("estimated_monthly_savings") ?? "",
  ).trim();
  const revenueRaw = String(
    formData.get("estimated_monthly_revenue") ?? "",
  ).trim();

  const { error } = await supabase.from("recommendations").insert({
    customer_id: String(formData.get("customer_id") ?? "").trim() || null,
    contract_id: String(formData.get("contract_id") ?? "").trim() || null,
    source_area: sourceArea,
    title,
    risk_exists: String(formData.get("risk_exists") ?? "").trim() || null,
    why_it_matters:
      String(formData.get("why_it_matters") ?? "").trim() || null,
    recommended_solution:
      String(formData.get("recommended_solution") ?? "").trim() || null,
    estimated_impact:
      String(formData.get("estimated_impact") ?? "").trim() || null,
    estimated_monthly_savings: savingsRaw ? Number(savingsRaw) : null,
    estimated_monthly_revenue: revenueRaw ? Number(revenueRaw) : null,
    priority: String(formData.get("priority") ?? "Medium").trim(),
    status: "New",
    created_by: user?.id ?? null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/recommendations");
  return { success: true, message: "Recommendation created." };
}

export async function updateRecommendationStatus(
  recommendationId: string,
  status: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const allowed = new Set(["Reviewed", "Approved", "Dismissed", "New"]);
  if (!allowed.has(status)) {
    return { success: false, message: "Invalid status." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const updates: Record<string, string | null> = { status };
  if (status === "Reviewed" || status === "Approved" || status === "Dismissed") {
    updates.reviewed_by = user?.id ?? null;
  }

  const { error } = await supabase
    .from("recommendations")
    .update(updates)
    .eq("id", recommendationId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/recommendations");
  revalidatePath("/operations");
  return { success: true, message: `Recommendation marked as ${status}.` };
}
