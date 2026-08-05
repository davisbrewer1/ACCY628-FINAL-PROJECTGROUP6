"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/customers";
import { PLAN_PRICING_MODELS, formatLateFeePolicy } from "@/lib/plan-pricing";
import { createClient } from "@/lib/supabase/server";

function isManagerRole(role: string | null | undefined): boolean {
  return (
    role === "administrator" ||
    role === "service_manager" ||
    role === "account_manager"
  );
}

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) || num < 0 ? null : num;
}

async function requireManager(): Promise<
  { ok: true; supabase: Awaited<ReturnType<typeof createClient>> } | ActionResult
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isManagerRole(actor?.role)) {
    return {
      success: false,
      message: "Only managers can manage service plans.",
    };
  }

  return { ok: true, supabase };
}

function parsePlanFields(formData: FormData): ActionResult | {
  name: string;
  description: string | null;
  pricing_model: string;
  base_price: number;
  included_support_hours: number;
  included_asset_budget: number;
  additional_hourly_rate: number;
  additional_asset_rate: number;
  billing_frequency: string;
  payment_terms: string | null;
  invoice_due_days: number;
  setup_fee: number;
  late_fee_percent: number;
  late_fee_period_days: number;
  late_fee_policy: string;
  revenue_recognition_method: string;
} {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { success: false, message: "Plan name is required." };
  }

  const pricingModel = String(formData.get("pricing_model") ?? "Monthly").trim();
  if (!PLAN_PRICING_MODELS.includes(pricingModel as (typeof PLAN_PRICING_MODELS)[number])) {
    return {
      success: false,
      message: "Pricing model must be Monthly, Yearly, or Up-front.",
    };
  }

  const basePrice = parseNumber(formData.get("base_price"));
  if (basePrice == null) {
    return { success: false, message: "A valid base price is required." };
  }

  const lateFeePercent = parseNumber(formData.get("late_fee_percent")) ?? 0;
  const lateFeePeriodDays =
    parseNumber(formData.get("late_fee_period_days")) ?? 30;
  if (lateFeePeriodDays <= 0) {
    return {
      success: false,
      message: "Late fee timeframe must be a positive number of days.",
    };
  }

  return {
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    pricing_model: pricingModel,
    base_price: basePrice,
    included_support_hours:
      parseNumber(formData.get("included_support_hours")) ?? 0,
    included_asset_budget:
      parseNumber(formData.get("included_asset_budget")) ?? 0,
    additional_hourly_rate:
      parseNumber(formData.get("additional_hourly_rate")) ?? 0,
    additional_asset_rate:
      parseNumber(formData.get("additional_asset_rate")) ?? 1,
    billing_frequency:
      String(formData.get("billing_frequency") ?? "").trim() || "Monthly",
    payment_terms: String(formData.get("payment_terms") ?? "").trim() || null,
    invoice_due_days: parseNumber(formData.get("invoice_due_days")) ?? 30,
    setup_fee: parseNumber(formData.get("setup_fee")) ?? 0,
    late_fee_percent: lateFeePercent,
    late_fee_period_days: lateFeePeriodDays,
    late_fee_policy: formatLateFeePolicy(lateFeePercent, lateFeePeriodDays),
    revenue_recognition_method:
      String(formData.get("revenue_recognition_method") ?? "").trim() ||
      "Monthly over service period",
  };
}

export async function createPlan(formData: FormData): Promise<ActionResult> {
  const auth = await requireManager();
  if (!("ok" in auth)) return auth;
  const { supabase } = auth;

  const fields = parsePlanFields(formData);
  if ("success" in fields) return fields;

  const { error } = await supabase.from("service_plans").insert({
    ...fields,
    active: true,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/plans");
  revalidatePath("/contracts");
  return { success: true, message: "Plan created successfully." };
}

export async function updatePlan(formData: FormData): Promise<ActionResult> {
  const auth = await requireManager();
  if (!("ok" in auth)) return auth;
  const { supabase } = auth;

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) {
    return { success: false, message: "Plan id is required." };
  }

  const fields = parsePlanFields(formData);
  if ("success" in fields) return fields;

  const { data: existing, error: lookupError } = await supabase
    .from("service_plans")
    .select("id")
    .eq("id", planId)
    .maybeSingle();

  if (lookupError) {
    return { success: false, message: lookupError.message };
  }
  if (!existing) {
    return { success: false, message: "Plan not found." };
  }

  const { error } = await supabase
    .from("service_plans")
    .update(fields)
    .eq("id", planId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/plans");
  revalidatePath("/contracts");
  return {
    success: true,
    message:
      "Plan updated. Existing contracts keep their snapshotted terms; new contracts use these values.",
  };
}

export async function deletePlan(planId: string): Promise<ActionResult> {
  const auth = await requireManager();
  if (!("ok" in auth)) return auth;
  const { supabase } = auth;

  if (!planId.trim()) {
    return { success: false, message: "Plan id is required." };
  }

  const { error } = await supabase
    .from("service_plans")
    .update({ active: false })
    .eq("id", planId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/plans");
  revalidatePath("/contracts");
  return {
    success: true,
    message: "Plan marked as no longer in use. Existing contracts keep their terms.",
  };
}
