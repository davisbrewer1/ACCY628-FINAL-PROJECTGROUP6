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

function resolveBillingStatus(
  formData: FormData,
  includedInContract: boolean,
): string {
  const raw = String(formData.get("billing_status") ?? "").trim();
  const allowed = new Set([
    "Not Billable",
    "Pending Approval",
    "Ready to Bill",
    "Billed",
    "Excluded",
  ]);
  if (allowed.has(raw)) return raw;
  return includedInContract ? "Not Billable" : "Ready to Bill";
}

function resolveApprovalStatus(formData: FormData): string {
  const raw = String(formData.get("approval_status") ?? "").trim();
  const allowed = new Set(["Not Required", "Pending", "Approved", "Rejected"]);
  if (allowed.has(raw)) return raw;
  return formData.get("additional_approval_required") === "true"
    ? "Pending"
    : "Not Required";
}

async function buildWorkEntryPayload(formData: FormData, technicianId: string) {
  const supabase = await createClient();

  const startTime = String(formData.get("start_time") ?? "").trim() || null;
  const endTime = String(formData.get("end_time") ?? "").trim() || null;
  let hoursWorked = parseNumber(formData.get("hours_worked"));

  if ((hoursWorked == null || hoursWorked === 0) && startTime && endTime) {
    hoursWorked = hoursBetween(startTime, endTime);
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

  // Modal may omit this field; default to included/not billable for routine tech work.
  const includedRaw = formData.get("included_in_contract");
  const includedInContract =
    includedRaw == null ? true : String(includedRaw) === "true";

  const laborCost = calcLaborCost(hoursWorked, technician?.internal_hourly_cost);
  const totalDirectCost = calcTotalDirectCost({
    labor: laborCost,
    parts: partsCost,
    software: softwareCost,
    equipment: equipmentCost,
    travel: travelCost,
    other: otherCost,
  });

  return {
    work_date: String(formData.get("work_date") ?? "").trim() || null,
    start_time: startTime,
    end_time: endTime,
    hours_worked: hoursWorked ?? 0,
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
    included_in_contract: includedInContract,
    additional_approval_required:
      formData.get("additional_approval_required") === "true",
    approval_status: resolveApprovalStatus(formData),
    billing_status: resolveBillingStatus(formData, includedInContract),
  };
}

export async function createWorkEntry(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const ticketId = String(formData.get("ticket_id") ?? "").trim();
  const technicianId = String(formData.get("technician_id") ?? "").trim();
  const customerId = String(formData.get("customer_id") ?? "").trim();

  if (!ticketId || !technicianId || !customerId) {
    return { success: false, message: "Ticket, technician, and customer are required." };
  }

  const payload = await buildWorkEntryPayload(formData, technicianId);
  if (payload.hours_worked < 0) {
    return { success: false, message: "Hours worked cannot be negative." };
  }

  const { error } = await supabase.from("work_entries").insert({
    ticket_id: ticketId,
    customer_id: customerId,
    contract_id: String(formData.get("contract_id") ?? "").trim() || null,
    technician_id: technicianId,
    ...payload,
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

  revalidatePath("/technician");
  revalidatePath("/time-costs");
  return { success: true, message: "Work entry recorded." };
}

export async function updateWorkEntry(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const entryId = String(formData.get("entry_id") ?? "").trim();
  const technicianId = String(formData.get("technician_id") ?? "").trim();
  const ticketId = String(formData.get("ticket_id") ?? "").trim();
  const customerId = String(formData.get("customer_id") ?? "").trim();

  if (!entryId || !technicianId || !ticketId || !customerId) {
    return {
      success: false,
      message: "Work entry, ticket, technician, and customer are required.",
    };
  }

  const payload = await buildWorkEntryPayload(formData, technicianId);
  if (payload.hours_worked < 0) {
    return { success: false, message: "Hours worked cannot be negative." };
  }

  const { error } = await supabase
    .from("work_entries")
    .update({
      ticket_id: ticketId,
      customer_id: customerId,
      contract_id: String(formData.get("contract_id") ?? "").trim() || null,
      ...payload,
    })
    .eq("id", entryId)
    .eq("technician_id", technicianId);

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

  revalidatePath("/technician");
  revalidatePath("/time-costs");
  return { success: true, message: "Work entry updated." };
}
