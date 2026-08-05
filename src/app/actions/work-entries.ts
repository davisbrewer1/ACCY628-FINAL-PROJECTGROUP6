"use server";

import { revalidatePath } from "next/cache";
import {
  calcLaborCost,
  calcTotalDirectCost,
  hoursBetween,
} from "@/lib/calculations";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) || num < 0 ? null : num;
}

function revalidateWorkPaths() {
  revalidatePath("/technician");
  revalidatePath("/time-costs");
  revalidatePath("/operations");
  revalidatePath("/billing");
  revalidatePath("/reports");
}

export async function createWorkEntry(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const ticketId = String(formData.get("ticket_id") ?? "").trim();
  const technicianId = String(formData.get("technician_id") ?? "").trim();
  const customerId = String(formData.get("customer_id") ?? "").trim();

  if (!ticketId || !technicianId || !customerId) {
    return { success: false, message: "Ticket, technician, and customer are required." };
  }

  const startTime = String(formData.get("start_time") ?? "").trim() || null;
  const endTime = String(formData.get("end_time") ?? "").trim() || null;
  let hoursWorked = parseNumber(formData.get("hours_worked"));

  if (!hoursWorked && startTime && endTime) {
    hoursWorked = hoursBetween(startTime, endTime);
  }

  if (hoursWorked != null && hoursWorked < 0) {
    return { success: false, message: "Hours worked cannot be negative." };
  }

  const { data: technician } = await supabase
    .from("technicians")
    .select("internal_hourly_cost")
    .eq("id", technicianId)
    .maybeSingle();

  const partsCost = parseNumber(formData.get("parts_cost")) ?? 0;
  const softwareCost = parseNumber(formData.get("software_cost")) ?? 0;
  const equipmentCost = parseNumber(formData.get("equipment_cost")) ?? 0;
  const travelCost = parseNumber(formData.get("travel_cost")) ?? 0;
  const otherCost = parseNumber(formData.get("other_cost")) ?? 0;

  const laborCost = calcLaborCost(hoursWorked, technician?.internal_hourly_cost);
  const totalDirectCost = calcTotalDirectCost({
    labor: laborCost,
    parts: partsCost,
    software: softwareCost,
    equipment: equipmentCost,
    travel: travelCost,
    other: otherCost,
  });

  const { error } = await supabase.from("work_entries").insert({
    ticket_id: ticketId,
    customer_id: customerId,
    contract_id: String(formData.get("contract_id") ?? "").trim() || null,
    technician_id: technicianId,
    work_date: String(formData.get("work_date") ?? "").trim() || null,
    start_time: startTime,
    end_time: endTime,
    hours_worked: hoursWorked,
    work_performed: String(formData.get("work_performed") ?? "").trim() || null,
    resolution_notes:
      String(formData.get("resolution_notes") ?? "").trim() || null,
    service_method: String(formData.get("service_method") ?? "").trim() || null,
    parts_cost: partsCost,
    software_cost: softwareCost,
    equipment_cost: equipmentCost,
    travel_cost: travelCost,
    other_cost: otherCost,
    labor_cost: laborCost,
    total_direct_cost: totalDirectCost,
    included_in_contract: formData.get("included_in_contract") === "true",
    additional_approval_required:
      formData.get("additional_approval_required") === "true",
    approval_status: String(formData.get("approval_status") ?? "Pending").trim(),
    billing_status: String(formData.get("billing_status") ?? "Not Billed").trim(),
    approval_notes: null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  const ticketStatus = String(formData.get("ticket_status") ?? "").trim();
  if (ticketStatus) {
    await supabase
      .from("service_tickets")
      .update({
        status: ticketStatus,
        ...(ticketStatus === "Completed" || ticketStatus === "Closed"
          ? { completed_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", ticketId);
  }

  revalidateWorkPaths();
  return { success: true, message: "Work entry recorded." };
}

export async function updateWorkEntryApproval(
  entryId: string,
  approvalStatus: "Approved" | "Disputed" | "Pending",
  approvalNotes?: string | null,
): Promise<ActionResult> {
  const supabase = await createClient();

  const notes = (approvalNotes ?? "").trim();
  if (approvalStatus === "Disputed" && !notes) {
    return {
      success: false,
      message: "Add a short note so the technician knows what to fix.",
    };
  }

  const { error } = await supabase
    .from("work_entries")
    .update({
      approval_status: approvalStatus,
      approval_notes:
        approvalStatus === "Disputed"
          ? notes
          : approvalStatus === "Approved"
            ? null
            : notes || null,
    })
    .eq("id", entryId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateWorkPaths();
  return {
    success: true,
    message:
      approvalStatus === "Disputed"
        ? "Returned to technician with notes."
        : `Work entry marked ${approvalStatus}.`,
  };
}

export async function markWorkEntriesReadyToInvoice(
  entryIds: string[],
): Promise<ActionResult> {
  if (entryIds.length === 0) {
    return { success: false, message: "Select at least one work entry." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("work_entries")
    .update({
      approval_status: "Approved",
      billing_status: "Ready to Invoice",
      approval_notes: null,
    })
    .in("id", entryIds);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateWorkPaths();
  return {
    success: true,
    message: `Marked ${entryIds.length} entr${entryIds.length === 1 ? "y" : "ies"} ready to invoice.`,
  };
}

/** Technician corrects a disputed entry and resubmits for manager review. */
export async function resubmitWorkEntry(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const entryId = String(formData.get("entry_id") ?? "").trim();
  if (!entryId) {
    return { success: false, message: "Work entry is required." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const { data: tech } = await supabase
    .from("technicians")
    .select("id, internal_hourly_cost")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!tech) {
    return { success: false, message: "No technician profile linked." };
  }

  const { data: existing, error: loadError } = await supabase
    .from("work_entries")
    .select("*")
    .eq("id", entryId)
    .eq("technician_id", tech.id)
    .maybeSingle();

  if (loadError) return { success: false, message: loadError.message };
  if (!existing) {
    return { success: false, message: "Work entry not found." };
  }
  if (existing.approval_status !== "Disputed") {
    return { success: false, message: "Only returned entries can be resubmitted." };
  }

  const startTime =
    String(formData.get("start_time") ?? "").trim() || existing.start_time;
  const endTime =
    String(formData.get("end_time") ?? "").trim() || existing.end_time;
  let hoursWorked = parseNumber(formData.get("hours_worked"));
  if (hoursWorked == null && startTime && endTime) {
    hoursWorked = hoursBetween(String(startTime), String(endTime));
  }
  if (hoursWorked == null) hoursWorked = existing.hours_worked;

  const partsCost = parseNumber(formData.get("parts_cost")) ?? existing.parts_cost ?? 0;
  const softwareCost =
    parseNumber(formData.get("software_cost")) ?? existing.software_cost ?? 0;
  const equipmentCost =
    parseNumber(formData.get("equipment_cost")) ?? existing.equipment_cost ?? 0;
  const travelCost =
    parseNumber(formData.get("travel_cost")) ?? existing.travel_cost ?? 0;
  const otherCost = parseNumber(formData.get("other_cost")) ?? existing.other_cost ?? 0;

  const laborCost = calcLaborCost(hoursWorked, tech.internal_hourly_cost);
  const totalDirectCost = calcTotalDirectCost({
    labor: laborCost,
    parts: partsCost,
    software: softwareCost,
    equipment: equipmentCost,
    travel: travelCost,
    other: otherCost,
  });

  const previousNote = existing.approval_notes
    ? `Prior manager note: ${existing.approval_notes}`
    : null;

  const { error } = await supabase
    .from("work_entries")
    .update({
      work_date:
        String(formData.get("work_date") ?? "").trim() || existing.work_date,
      start_time: startTime,
      end_time: endTime,
      hours_worked: hoursWorked,
      work_performed:
        String(formData.get("work_performed") ?? "").trim() ||
        existing.work_performed,
      resolution_notes:
        String(formData.get("resolution_notes") ?? "").trim() ||
        existing.resolution_notes,
      service_method:
        String(formData.get("service_method") ?? "").trim() ||
        existing.service_method,
      parts_cost: partsCost,
      software_cost: softwareCost,
      equipment_cost: equipmentCost,
      travel_cost: travelCost,
      other_cost: otherCost,
      labor_cost: laborCost,
      total_direct_cost: totalDirectCost,
      included_in_contract: formData.has("included_in_contract")
        ? formData.get("included_in_contract") === "true"
        : existing.included_in_contract,
      approval_status: "Pending",
      approval_notes: previousNote,
      billing_status: existing.billing_status ?? "Not Billed",
    })
    .eq("id", entryId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateWorkPaths();
  return { success: true, message: "Corrected entry resubmitted for approval." };
}
