"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/customers";
import {
  planRecognizedMonthly,
  snapshotBillingFrequency,
  snapshotSetupFee,
} from "@/lib/plan-pricing";
import { createClient } from "@/lib/supabase/server";
import type { ServicePlan } from "@/lib/types";

function parseBool(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "on" || value === "1";
}

export async function createContract(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const planId = String(formData.get("plan_id") ?? "").trim();
  const contractName = String(formData.get("contract_name") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const approvalStatus = String(formData.get("approval_status") ?? "").trim();
  let contractStatus = String(formData.get("contract_status") ?? "Draft").trim();

  if (!customerId || !contractName) {
    return { success: false, message: "Customer and contract name are required." };
  }

  if (!planId) {
    return { success: false, message: "Select a service plan." };
  }

  if (!startDate || !endDate) {
    return { success: false, message: "Start and end dates are required." };
  }

  if (new Date(endDate) < new Date(startDate)) {
    return { success: false, message: "End date must be on or after the start date." };
  }

  if (contractStatus === "Active" && approvalStatus !== "Approved") {
    contractStatus = "Pending Approval";
  }

  const { data: plan, error: planError } = await supabase
    .from("service_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();

  if (planError) {
    return { success: false, message: planError.message };
  }

  if (!plan || !plan.active) {
    return {
      success: false,
      message: "Choose an active plan. Retired plans cannot be used for new contracts.",
    };
  }

  const typedPlan = plan as ServicePlan;
  const recognizedMonthly = planRecognizedMonthly(typedPlan, startDate, endDate);
  const billingFrequency = snapshotBillingFrequency(typedPlan);
  const setupFee = snapshotSetupFee(typedPlan);

  const { error } = await supabase.from("contracts").insert({
    customer_id: customerId,
    plan_id: typedPlan.id,
    contract_name: contractName,
    contract_status: contractStatus,
    start_date: startDate,
    end_date: endDate,
    renewal_date: String(formData.get("renewal_date") ?? "").trim() || null,
    automatic_renewal: parseBool(formData.get("automatic_renewal")),
    service_plan_name: typedPlan.name,
    monthly_recurring_fee: recognizedMonthly,
    included_support_hours: typedPlan.included_support_hours,
    included_asset_budget: typedPlan.included_asset_budget,
    additional_hourly_rate: typedPlan.additional_hourly_rate,
    additional_asset_rate: typedPlan.additional_asset_rate,
    billing_frequency: billingFrequency,
    payment_terms: typedPlan.payment_terms,
    invoice_due_days: typedPlan.invoice_due_days,
    setup_fee: setupFee,
    late_fee_percent: typedPlan.late_fee_percent ?? 0,
    late_fee_period_days: typedPlan.late_fee_period_days ?? 30,
    late_fee_policy: typedPlan.late_fee_policy,
    revenue_recognition_method:
      typedPlan.revenue_recognition_method ?? "Monthly over service period",
    pass_through_charges_allowed: true,
    approval_status: approvalStatus || "Pending",
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/contracts");
  revalidatePath("/billing");
  revalidatePath("/reports");
  return { success: true, message: "Contract created from plan successfully." };
}
