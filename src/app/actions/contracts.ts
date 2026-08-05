"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) || num < 0 ? null : num;
}

function parseBool(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "on" || value === "1";
}

export async function createContract(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const contractName = String(formData.get("contract_name") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const approvalStatus = String(formData.get("approval_status") ?? "").trim();
  let contractStatus = String(formData.get("contract_status") ?? "Draft").trim();

  if (!customerId || !contractName) {
    return { success: false, message: "Customer and contract name are required." };
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

  const { error } = await supabase.from("contracts").insert({
    customer_id: customerId,
    contract_name: contractName,
    contract_status: contractStatus,
    start_date: startDate,
    end_date: endDate,
    renewal_date: String(formData.get("renewal_date") ?? "").trim() || null,
    automatic_renewal: parseBool(formData.get("automatic_renewal")),
    service_plan_name:
      String(formData.get("service_plan_name") ?? "").trim() || null,
    monthly_recurring_fee: parseNumber(formData.get("monthly_recurring_fee")),
    included_support_hours: parseNumber(formData.get("included_support_hours")),
    additional_hourly_rate: parseNumber(formData.get("additional_hourly_rate")),
    emergency_support_rate: parseNumber(formData.get("emergency_support_rate")),
    onsite_support_rate: parseNumber(formData.get("onsite_support_rate")),
    remote_support_included: parseBool(formData.get("remote_support_included")),
    onsite_support_included: parseBool(formData.get("onsite_support_included")),
    preventive_maintenance_frequency:
      String(formData.get("preventive_maintenance_frequency") ?? "").trim() || null,
    critical_response_target_hours: parseNumber(
      formData.get("critical_response_target_hours"),
    ),
    high_response_target_hours: parseNumber(
      formData.get("high_response_target_hours"),
    ),
    standard_response_target_hours: parseNumber(
      formData.get("standard_response_target_hours"),
    ),
    resolution_target_hours: parseNumber(formData.get("resolution_target_hours")),
    support_coverage:
      String(formData.get("support_coverage") ?? "").trim() || null,
    billing_frequency:
      String(formData.get("billing_frequency") ?? "").trim() || null,
    payment_terms: String(formData.get("payment_terms") ?? "").trim() || null,
    invoice_due_days: parseNumber(formData.get("invoice_due_days")),
    setup_fee: parseNumber(formData.get("setup_fee")),
    late_fee_policy:
      String(formData.get("late_fee_policy") ?? "").trim() || null,
    pass_through_charges_allowed: parseBool(
      formData.get("pass_through_charges_allowed"),
    ),
    revenue_recognition_method:
      String(formData.get("revenue_recognition_method") ?? "").trim() || null,
    approval_status: approvalStatus || "Pending",
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/contracts");
  return { success: true, message: "Contract created successfully." };
}
