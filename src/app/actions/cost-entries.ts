"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/customers";
import {
  autoCostCalculator,
  type PartUsageInput,
  type SoftwareUsageInput,
} from "@/lib/autoCostCalculator";
import {
  fetchContractInclusionRules,
  fetchCostSettings,
  fetchTechnicianHourlyRate,
} from "@/lib/cost-data";
import { createClient } from "@/lib/supabase/server";

export interface SaveCostEntryInput {
  ticketId: string;
  technicianId: string;
  customerId: string;
  contractId?: string | null;
  laborHours: number;
  miles: number;
  otherCategory: string;
  serviceKey: string;
  partsUsed: PartUsageInput[];
  softwareInstalled: SoftwareUsageInput[];
  notes?: string;
  overrides?: {
    laborCost?: number | null;
    travelCost?: number | null;
    equipmentCost?: number | null;
    softwareCost?: number | null;
    otherCost?: number | null;
  };
  createWorkEntry?: boolean;
}

/** Map calculator billing status onto work_entries.billing_status check values. */
function toWorkEntryBillingStatus(
  billingStatus: "Included" | "Billable",
  approvalRequired: boolean,
): string {
  if (billingStatus === "Included") {
    return "Not Billable";
  }
  return approvalRequired ? "Pending Approval" : "Ready to Bill";
}

export async function saveCostEntry(
  input: SaveCostEntryInput,
): Promise<ActionResult & { costEntryId?: string }> {
  const supabase = await createClient();

  if (!input.ticketId || !input.technicianId || !input.customerId) {
    return {
      success: false,
      message: "Ticket, technician, and customer are required.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Technicians may only insert work_entries for their own technician_id (RLS).
  let technicianId = input.technicianId;
  if (user?.id) {
    const { data: linkedTech } = await supabase
      .from("technicians")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role ?? "";
    const canLogForOthers =
      role === "administrator" ||
      role === "service_manager" ||
      role === "account_manager" ||
      role === "billing" ||
      role === "executive";

    if (linkedTech?.id && !canLogForOthers) {
      technicianId = linkedTech.id;
    }
  }

  const [hourlyRate, settings, includedServices] = await Promise.all([
    fetchTechnicianHourlyRate(supabase, technicianId),
    fetchCostSettings(supabase),
    input.contractId
      ? fetchContractInclusionRules(supabase, input.contractId)
      : Promise.resolve([] as string[]),
  ]);

  const calculation = autoCostCalculator({
    laborHours: input.laborHours,
    miles: input.miles,
    partsUsed: input.partsUsed,
    softwareInstalled: input.softwareInstalled,
    otherCategory: input.otherCategory,
    serviceKey: input.serviceKey,
    includedServices,
    rates: {
      technicianHourlyRate: hourlyRate,
      travelRate: settings.travelRate,
      otherCosts: settings.otherCosts,
      approvalThreshold: settings.approvalThreshold,
    },
    overrides: input.overrides,
  });

  let workEntryId: string | null = null;
  let workEntryWarning: string | null = null;

  if (input.createWorkEntry !== false) {
    const { data: workEntry, error: workError } = await supabase
      .from("work_entries")
      .insert({
        ticket_id: input.ticketId,
        customer_id: input.customerId,
        contract_id: input.contractId || null,
        technician_id: technicianId,
        work_date: new Date().toISOString().slice(0, 10),
        hours_worked: input.laborHours,
        work_performed: input.notes?.trim() || "Auto cost calculation entry",
        labor_cost: calculation.laborCost,
        travel_cost: calculation.travelCost,
        equipment_cost: calculation.equipmentCost,
        software_cost: calculation.softwareCost,
        other_cost: calculation.otherCost,
        parts_cost: 0,
        total_direct_cost: calculation.totalCost,
        included_in_contract: calculation.billingStatus === "Included",
        additional_approval_required: calculation.approvalRequired,
        approval_status: calculation.approvalRequired ? "Pending" : "Not Required",
        billing_status: toWorkEntryBillingStatus(
          calculation.billingStatus,
          calculation.approvalRequired,
        ),
      })
      .select("id")
      .single();

    if (workError) {
      // Still persist the cost_entries row so the calculator save is not blocked.
      workEntryWarning = workError.message;
      console.warn("work_entries insert skipped:", workError.message);
    } else {
      workEntryId = workEntry?.id ?? null;
    }
  }

  const { data: costEntry, error: costError } = await supabase
    .from("cost_entries")
    .insert({
      work_entry_id: workEntryId,
      ticket_id: input.ticketId,
      technician_id: technicianId,
      customer_id: input.customerId,
      contract_id: input.contractId || null,
      labor_hours: input.laborHours,
      miles: input.miles,
      other_category: input.otherCategory || null,
      labor_cost: calculation.laborCost,
      travel_cost: calculation.travelCost,
      equipment_cost: calculation.equipmentCost,
      software_cost: calculation.softwareCost,
      other_cost: calculation.otherCost,
      total_cost: calculation.totalCost,
      billing_status: calculation.billingStatus,
      approval_required: calculation.approvalRequired,
      approval_status: calculation.approvalRequired ? "Pending" : "Not Required",
      service_key: input.serviceKey || null,
      parts_used: input.partsUsed,
      software_installed: input.softwareInstalled,
      overrides: input.overrides ?? {},
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (costError) {
    return {
      success: false,
      message: workEntryWarning
        ? `Could not save cost entry (${costError.message}). Work entry also failed: ${workEntryWarning}`
        : `Could not save cost entry: ${costError.message}`,
    };
  }

  revalidatePath("/time-costs");
  revalidatePath("/technician");
  revalidatePath("/reports");

  return {
    success: true,
    message: workEntryWarning
      ? "Cost entry saved. Linked work entry could not be created (permissions)."
      : "Cost calculation saved.",
    costEntryId: costEntry?.id,
  };
}
