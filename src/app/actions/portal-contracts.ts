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

function isManagerRole(role: string | null | undefined): boolean {
  return (
    role === "administrator" ||
    role === "service_manager" ||
    role === "account_manager"
  );
}

function revalidatePlanChangePaths() {
  revalidatePath("/end-user/contracts");
  revalidatePath("/end-user");
  revalidatePath("/contracts");
  revalidatePath("/plans");
  revalidatePath("/billing");
}

/** Client submits a plan upgrade/change or Cancel Plan request for management approval. */
export async function requestClientContractPlanChange(input: {
  contractId: string;
  planId: string;
  note?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const contractId = String(input.contractId ?? "").trim();
  const planId = String(input.planId ?? "").trim();
  const clientNote = String(input.note ?? "").trim() || null;
  const isTermination = planId === "__terminate__";

  if (!contractId) {
    return { success: false, message: "Contract is required." };
  }
  if (!planId) {
    return { success: false, message: "Select a service plan or Cancel Plan." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, customer_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.customer_id && profile?.role !== "administrator") {
    return {
      success: false,
      message: "Your account is not linked to a customer organization.",
    };
  }

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", contractId)
    .maybeSingle();

  if (contractError) {
    return { success: false, message: contractError.message };
  }
  if (!contract) {
    return { success: false, message: "Contract not found." };
  }
  if (
    profile.customer_id &&
    contract.customer_id !== profile.customer_id &&
    profile.role !== "administrator"
  ) {
    return {
      success: false,
      message: "You can only request plan changes for your organization.",
    };
  }
  if (contract.contract_status !== "Active") {
    return {
      success: false,
      message: "Only active contracts can request a plan change or Cancel Plan.",
    };
  }

  const { data: existingPending } = await supabase
    .from("contract_plan_change_requests")
    .select("id")
    .eq("contract_id", contract.id)
    .eq("status", "Pending")
    .maybeSingle();

  if (existingPending) {
    return {
      success: false,
      message:
        "A request is already pending management review for this contract.",
    };
  }

  if (isTermination) {
    const { error } = await supabase.from("contract_plan_change_requests").insert({
      contract_id: contract.id,
      customer_id: contract.customer_id,
      current_plan_id: contract.plan_id ?? null,
      requested_plan_id: null,
      request_type: "termination",
      requested_by: user.id,
      status: "Pending",
      client_note: clientNote,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePlanChangePaths();
    return {
      success: true,
      message:
        "Cancel Plan request sent to management for approval. Your plan stays active until approved.",
    };
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
      message: "Choose an active service plan from the Nexus plan catalog.",
    };
  }

  if (contract.plan_id === plan.id) {
    return {
      success: false,
      message: "That plan is already on this contract.",
    };
  }

  const { error } = await supabase.from("contract_plan_change_requests").insert({
    contract_id: contract.id,
    customer_id: contract.customer_id,
    current_plan_id: contract.plan_id ?? null,
    requested_plan_id: plan.id,
    request_type: "plan_change",
    requested_by: user.id,
    status: "Pending",
    client_note: clientNote,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePlanChangePaths();
  return {
    success: true,
    message: `Plan change request for ${plan.name} sent to management for approval.`,
  };
}

/** Client cancels their own pending request. */
export async function cancelClientContractPlanChangeRequest(
  requestId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const id = String(requestId ?? "").trim();
  if (!id) {
    return { success: false, message: "Request is required." };
  }

  const { data: request, error: lookupError } = await supabase
    .from("contract_plan_change_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    return { success: false, message: lookupError.message };
  }
  if (!request) {
    return { success: false, message: "Request not found." };
  }
  if (request.status !== "Pending") {
    return { success: false, message: "Only pending requests can be cancelled." };
  }
  if (request.requested_by !== user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("customer_id, role")
      .eq("id", user.id)
      .maybeSingle();
    if (
      profile?.role !== "administrator" &&
      profile?.customer_id !== request.customer_id
    ) {
      return { success: false, message: "You can only cancel your organization's requests." };
    }
  }

  const { error } = await supabase
    .from("contract_plan_change_requests")
    .update({
      status: "Cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePlanChangePaths();
  return { success: true, message: "Request cancelled." };
}

/** Management approves or denies a client plan-change request. */
export async function reviewContractPlanChangeRequest(input: {
  requestId: string;
  decision: "Approved" | "Denied";
  managerNote?: string;
}): Promise<ActionResult> {
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
      message: "Only managers can approve or deny plan change requests.",
    };
  }

  const requestId = String(input.requestId ?? "").trim();
  const decision = input.decision;
  const managerNote = String(input.managerNote ?? "").trim() || null;

  if (!requestId) {
    return { success: false, message: "Request is required." };
  }
  if (decision !== "Approved" && decision !== "Denied") {
    return { success: false, message: "Decision must be Approved or Denied." };
  }

  const { data: request, error: requestError } = await supabase
    .from("contract_plan_change_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (requestError) {
    return { success: false, message: requestError.message };
  }
  if (!request) {
    return { success: false, message: "Request not found." };
  }
  if (request.status !== "Pending") {
    return { success: false, message: "This request was already reviewed." };
  }

  if (decision === "Denied") {
    const { error } = await supabase
      .from("contract_plan_change_requests")
      .update({
        status: "Denied",
        manager_note: managerNote,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePlanChangePaths();
    return { success: true, message: "Request denied." };
  }

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", request.contract_id)
    .maybeSingle();

  if (contractError) {
    return { success: false, message: contractError.message };
  }
  if (!contract) {
    return { success: false, message: "Contract not found." };
  }

  const isTermination = request.request_type === "termination";

  if (isTermination) {
    const today = new Date().toISOString().slice(0, 10);
    const { error: contractUpdateError } = await supabase
      .from("contracts")
      .update({
        contract_status: "Canceled",
        automatic_renewal: false,
        end_date: contract.end_date ?? today,
        notes: contract.notes
          ? `${contract.notes}\n\n[Cancel Plan approved on ${today}]`
          : `Cancel Plan approved on ${today}.`,
      })
      .eq("id", contract.id);

    if (contractUpdateError) {
      return { success: false, message: contractUpdateError.message };
    }

    const { error: requestUpdateError } = await supabase
      .from("contract_plan_change_requests")
      .update({
        status: "Approved",
        manager_note: managerNote,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (requestUpdateError) {
      return { success: false, message: requestUpdateError.message };
    }

    revalidatePlanChangePaths();
    return {
      success: true,
      message: "Approved. Plan has been canceled.",
    };
  }

  if (!request.requested_plan_id) {
    return {
      success: false,
      message: "This plan change request is missing a target plan.",
    };
  }

  const { data: plan, error: planError } = await supabase
    .from("service_plans")
    .select("*")
    .eq("id", request.requested_plan_id)
    .maybeSingle();

  if (planError) {
    return { success: false, message: planError.message };
  }
  if (!plan || !plan.active) {
    return {
      success: false,
      message: "The requested plan is no longer available.",
    };
  }

  const typedPlan = plan as ServicePlan;
  const recognizedMonthly = planRecognizedMonthly(
    typedPlan,
    contract.start_date,
    contract.end_date,
  );
  const billingFrequency = snapshotBillingFrequency(typedPlan);
  const setupFee = snapshotSetupFee(typedPlan);

  const { error: contractUpdateError } = await supabase
    .from("contracts")
    .update({
      plan_id: typedPlan.id,
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
      notes: contract.notes
        ? `${contract.notes}\n\n[Plan change approved to ${typedPlan.name} on ${new Date().toISOString().slice(0, 10)}]`
        : `Plan change approved to ${typedPlan.name} on ${new Date().toISOString().slice(0, 10)}.`,
    })
    .eq("id", contract.id);

  if (contractUpdateError) {
    return { success: false, message: contractUpdateError.message };
  }

  const { error: requestUpdateError } = await supabase
    .from("contract_plan_change_requests")
    .update({
      status: "Approved",
      manager_note: managerNote,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  if (requestUpdateError) {
    return { success: false, message: requestUpdateError.message };
  }

  revalidatePlanChangePaths();
  return {
    success: true,
    message: `Approved. Contract updated to ${typedPlan.name} using catalog billing terms.`,
  };
}
