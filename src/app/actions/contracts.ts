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
import { ensureFirstPlanInvoiceForContract } from "@/app/actions/billing";

function parseBool(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "on" || value === "1";
}

function revalidateContractPaths() {
  revalidatePath("/contracts");
  revalidatePath("/billing");
  revalidatePath("/reports");
  revalidatePath("/portal");
  revalidatePath("/end-user");
  revalidatePath("/end-user/contracts");
  revalidatePath("/customers");
  revalidatePath("/operations");
}

async function requireManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, message: "You must be signed in." };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = profile?.role;
  if (
    role !== "administrator" &&
    role !== "service_manager" &&
    role !== "account_manager"
  ) {
    return {
      ok: false as const,
      message: "Only managers can manage contracts.",
    };
  }
  return { ok: true as const, supabase };
}

async function loadPlanSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
  startDate: string,
  endDate: string,
  allowInactive = false,
): Promise<
  | { ok: true; fields: Record<string, unknown>; planName: string }
  | { ok: false; message: string }
> {
  const { data: plan, error: planError } = await supabase
    .from("service_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();

  if (planError) {
    return { ok: false, message: planError.message };
  }
  if (!plan) {
    return { ok: false, message: "Select a service plan." };
  }
  if (!plan.active && !allowInactive) {
    return {
      ok: false,
      message: "Choose an active plan. Retired plans cannot be used for new contracts.",
    };
  }

  const typedPlan = plan as ServicePlan;
  return {
    ok: true,
    planName: typedPlan.name,
    fields: {
      plan_id: typedPlan.id,
      service_plan_name: typedPlan.name,
      monthly_recurring_fee: planRecognizedMonthly(
        typedPlan,
        startDate,
        endDate,
      ),
      included_support_hours: typedPlan.included_support_hours,
      included_asset_budget: typedPlan.included_asset_budget,
      additional_hourly_rate: typedPlan.additional_hourly_rate,
      additional_asset_rate: typedPlan.additional_asset_rate,
      billing_frequency: snapshotBillingFrequency(typedPlan),
      payment_terms: typedPlan.payment_terms,
      invoice_due_days: typedPlan.invoice_due_days,
      setup_fee: snapshotSetupFee(typedPlan),
      late_fee_percent: typedPlan.late_fee_percent ?? 0,
      late_fee_period_days: typedPlan.late_fee_period_days ?? 30,
      late_fee_policy: typedPlan.late_fee_policy,
      revenue_recognition_method:
        typedPlan.revenue_recognition_method ?? "Monthly over service period",
    },
  };
}

function parseContractForm(formData: FormData): ActionResult | {
  customerId: string;
  planId: string;
  contractName: string;
  startDate: string;
  endDate: string;
  approvalStatus: string;
  contractStatus: string;
  renewalDate: string | null;
  automaticRenewal: boolean;
  notes: string | null;
} {
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const planId = String(formData.get("plan_id") ?? "").trim();
  const contractName = String(formData.get("contract_name") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const approvalStatusRaw = String(formData.get("approval_status") ?? "").trim();
  let contractStatus = String(formData.get("contract_status") ?? "Draft").trim();
  let approvalStatus = approvalStatusRaw || "Pending";

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

  // Managers setting Active also approve — no separate approval step required.
  if (contractStatus === "Active") {
    approvalStatus = "Approved";
  } else if (approvalStatus === "Approved" && contractStatus === "Draft") {
    // Approving a draft without choosing Active leaves it pending activation.
    contractStatus = "Pending Approval";
  }

  return {
    customerId,
    planId,
    contractName,
    startDate,
    endDate,
    approvalStatus,
    contractStatus,
    renewalDate: String(formData.get("renewal_date") ?? "").trim() || null,
    automaticRenewal: parseBool(formData.get("automatic_renewal")),
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function createContract(formData: FormData): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return { success: false, message: auth.message };
  const { supabase } = auth;

  const parsed = parseContractForm(formData);
  if ("success" in parsed) return parsed;

  const snapshot = await loadPlanSnapshot(
    supabase,
    parsed.planId,
    parsed.startDate,
    parsed.endDate,
  );
  if (!snapshot.ok) return { success: false, message: snapshot.message };

  const { data: created, error } = await supabase
    .from("contracts")
    .insert({
      customer_id: parsed.customerId,
      contract_name: parsed.contractName,
      contract_status: parsed.contractStatus,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      renewal_date: parsed.renewalDate,
      automatic_renewal: parsed.automaticRenewal,
      pass_through_charges_allowed: true,
      approval_status: parsed.approvalStatus,
      notes: parsed.notes,
      ...snapshot.fields,
    })
    .select("id, contract_status")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  let invoiceNote = "";
  if (created?.contract_status === "Active" && created.id) {
    const invoiceResult = await ensureFirstPlanInvoiceForContract(created.id);
    if (invoiceResult.success && invoiceResult.created) {
      invoiceNote = " First plan invoice issued to Invoice.";
    } else if (!invoiceResult.success) {
      invoiceNote = ` Contract saved, but first plan invoice failed: ${invoiceResult.message}`;
    }
  }

  revalidateContractPaths();
  return {
    success: true,
    message: `Contract created from plan successfully.${invoiceNote}`,
  };
}

/**
 * Full edit including plan re-snapshot. Does not modify existing invoices —
 * future plan cadence billing uses the updated contract snapshot.
 */
export async function updateContract(formData: FormData): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return { success: false, message: auth.message };
  const { supabase } = auth;

  const contractId = String(formData.get("contract_id") ?? "").trim();
  if (!contractId) {
    return { success: false, message: "Contract id is required." };
  }

  const parsed = parseContractForm(formData);
  if ("success" in parsed) return parsed;

  const { data: existing } = await supabase
    .from("contracts")
    .select("id, plan_id, contract_status")
    .eq("id", contractId)
    .maybeSingle();

  if (!existing) {
    return { success: false, message: "Contract not found." };
  }

  // Allow keeping a retired plan if the contract already used it and plan_id unchanged.
  const allowInactive = existing.plan_id === parsed.planId;
  const snapshot = await loadPlanSnapshot(
    supabase,
    parsed.planId,
    parsed.startDate,
    parsed.endDate,
    allowInactive,
  );
  if (!snapshot.ok) return { success: false, message: snapshot.message };

  const { error } = await supabase
    .from("contracts")
    .update({
      customer_id: parsed.customerId,
      contract_name: parsed.contractName,
      contract_status: parsed.contractStatus,
      start_date: parsed.startDate,
      end_date: parsed.endDate,
      renewal_date: parsed.renewalDate,
      automatic_renewal: parsed.automaticRenewal,
      approval_status: parsed.approvalStatus,
      notes: parsed.notes,
      ...snapshot.fields,
    })
    .eq("id", contractId);

  if (error) {
    return { success: false, message: error.message };
  }

  let invoiceNote = "";
  const becameActive =
    parsed.contractStatus === "Active" &&
    existing.contract_status !== "Active";
  if (parsed.contractStatus === "Active") {
    const invoiceResult = await ensureFirstPlanInvoiceForContract(contractId);
    if (invoiceResult.success && invoiceResult.created) {
      invoiceNote = becameActive
        ? " First plan invoice issued to Invoice."
        : " Missing first plan invoice was issued to Invoice.";
    } else if (!invoiceResult.success) {
      invoiceNote = ` Updated, but plan invoice sync failed: ${invoiceResult.message}`;
    }
  }

  revalidateContractPaths();
  return {
    success: true,
    message:
      `Contract updated. Recognized MRR and future plan invoices use the new terms; already-issued invoices are unchanged.${invoiceNote}`,
  };
}

async function contractHasUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contractId: string,
  customerId: string,
  startDate: string | null,
  endDate: string | null,
): Promise<boolean> {
  const { data: entries } = await supabase
    .from("work_entries")
    .select("hours_worked, equipment_cost")
    .eq("contract_id", contractId);

  const workUsed = (entries ?? []).some(
    (e) =>
      Number(e.hours_worked ?? 0) > 0 || Number(e.equipment_cost ?? 0) > 0,
  );
  if (workUsed) return true;

  const { count: invoiceCount } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("contract_id", contractId);
  if ((invoiceCount ?? 0) > 0) return true;

  const { data: assets } = await supabase
    .from("hardware_assets")
    .select("purchase_cost, current_value, purchase_date, customer_id")
    .eq("customer_id", customerId);

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  const hwSpend = (assets ?? []).reduce((sum, asset) => {
    if (asset.purchase_date) {
      const purchase = new Date(asset.purchase_date);
      if (start && purchase < start) return sum;
      if (end && purchase > end) return sum;
    }
    return sum + Number(asset.purchase_cost ?? asset.current_value ?? 0);
  }, 0);

  return hwSpend > 0;
}

/**
 * Soft-delete (Canceled) if contractual benefits were used; otherwise hard-delete.
 */
export async function deleteContract(contractId: string): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return { success: false, message: auth.message };
  const { supabase } = auth;

  if (!contractId.trim()) {
    return { success: false, message: "Contract id is required." };
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select("id, customer_id, start_date, end_date, contract_status")
    .eq("id", contractId)
    .maybeSingle();

  if (!contract) {
    return { success: false, message: "Contract not found." };
  }

  const used = await contractHasUsage(
    supabase,
    contract.id,
    contract.customer_id,
    contract.start_date,
    contract.end_date,
  );

  if (used) {
    const { error } = await supabase
      .from("contracts")
      .update({ contract_status: "Canceled" })
      .eq("id", contractId);
    if (error) {
      return { success: false, message: error.message };
    }
    revalidateContractPaths();
    return {
      success: true,
      message:
        "Contract canceled (soft delete). Hours, assets, or invoices were already used under this agreement.",
    };
  }

  const { error } = await supabase.from("contracts").delete().eq("id", contractId);
  if (error) {
    return { success: false, message: error.message };
  }

  revalidateContractPaths();
  return { success: true, message: "Unused contract deleted." };
}
