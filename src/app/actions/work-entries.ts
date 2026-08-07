"use server";

import { revalidatePath } from "next/cache";
import { createInvoicesFromWorkEntries } from "@/app/actions/billing";
import {
  calcLaborCost,
  calcTotalDirectCost,
  hoursBetween,
} from "@/lib/calculations";
import type { PartUsageInput } from "@/lib/autoCostCalculator";
import { pickContractForCustomerWork } from "@/lib/manager-ops";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";
import type { Contract } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

async function resolveWorkContractId(
  supabase: SupabaseClient,
  formData: FormData,
  ticketId: string,
  customerId: string,
): Promise<string | null> {
  const formContractId = String(formData.get("contract_id") ?? "").trim() || null;
  if (formContractId) return formContractId;

  const { data: ticket } = await supabase
    .from("service_tickets")
    .select("contract_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (ticket?.contract_id) return ticket.contract_id as string;

  const { data: customerContracts } = await supabase
    .from("contracts")
    .select("*")
    .eq("customer_id", customerId);
  return (
    pickContractForCustomerWork(
      (customerContracts as Contract[]) ?? [],
      customerId,
    )?.id ?? null
  );
}

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

function parsePartsUsedRaw(raw: string | null): PartUsageInput[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const parts: PartUsageInput[] = [];
    for (const item of parsed) {
      const row = item as Partial<PartUsageInput>;
      const partId = String(row.partId ?? "").trim();
      const quantity = Number(row.quantity);
      const unitCost = Number(row.unitCost);
      if (!partId || !Number.isInteger(quantity) || quantity < 1) continue;
      parts.push({
        partId,
        partName: row.partName ? String(row.partName) : undefined,
        unitCost: Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0,
        quantity,
      });
    }
    return parts;
  } catch {
    return [];
  }
}

async function resolvePartsUsed(
  supabase: SupabaseClient,
  formData: FormData,
  /** Quantities already deducted for this entry (edit flow) count as available again. */
  previousParts: PartUsageInput[] = [],
): Promise<{ parts: PartUsageInput[]; partsCost: number; error: string | null }> {
  const requested = parsePartsUsedRaw(
    String(formData.get("parts_used") ?? "").trim() || null,
  );
  if (requested.length === 0) {
    return { parts: [], partsCost: 0, error: null };
  }

  const partIds = [...new Set(requested.map((item) => item.partId))];
  const { data: rows, error } = await supabase
    .from("inventory_parts")
    .select("id, part_name, unit_cost, quantity, active")
    .in("id", partIds);

  if (error) {
    return { parts: [], partsCost: 0, error: error.message };
  }

  const byId = new Map((rows ?? []).map((row) => [row.id as string, row]));
  const previousById = new Map<string, number>();
  for (const item of previousParts) {
    previousById.set(
      item.partId,
      (previousById.get(item.partId) ?? 0) + item.quantity,
    );
  }

  const parts: PartUsageInput[] = [];

  for (const item of requested) {
    const part = byId.get(item.partId);
    if (!part || part.active === false) {
      return {
        parts: [],
        partsCost: 0,
        error: "One or more selected parts are unavailable.",
      };
    }
    const existing = parts.find((row) => row.partId === item.partId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      parts.push({
        partId: item.partId,
        partName: String(part.part_name),
        unitCost: Number(part.unit_cost) || 0,
        quantity: item.quantity,
      });
    }
  }

  for (const item of parts) {
    const part = byId.get(item.partId);
    if (!part) continue;
    const available =
      Number(part.quantity) + (previousById.get(item.partId) ?? 0);
    if (item.quantity > available) {
      return {
        parts: [],
        partsCost: 0,
        error: `Not enough stock for ${part.part_name} (available: ${available}).`,
      };
    }
  }

  const partsCost = parts.reduce(
    (sum, item) => sum + item.unitCost * item.quantity,
    0,
  );

  return { parts, partsCost: Math.round(partsCost * 100) / 100, error: null };
}

async function applyInventoryDelta(
  supabase: SupabaseClient,
  previous: PartUsageInput[],
  next: PartUsageInput[],
): Promise<string | null> {
  const delta = new Map<string, number>();
  for (const item of previous) {
    delta.set(item.partId, (delta.get(item.partId) ?? 0) - item.quantity);
  }
  for (const item of next) {
    delta.set(item.partId, (delta.get(item.partId) ?? 0) + item.quantity);
  }

  const partIds = [...delta.keys()];
  if (partIds.length === 0) return null;

  const { data: rows, error } = await supabase
    .from("inventory_parts")
    .select("id, part_name, quantity")
    .in("id", partIds);

  if (error) return error.message;

  const byId = new Map((rows ?? []).map((row) => [row.id as string, row]));

  for (const [partId, change] of delta) {
    if (change === 0) continue;
    const part = byId.get(partId);
    if (!part) return "A selected inventory part could not be found.";
    const nextQty = Number(part.quantity) - change;
    if (nextQty < 0) {
      return `Not enough stock for ${part.part_name} (on hand: ${part.quantity}).`;
    }
  }

  for (const [partId, change] of delta) {
    if (change === 0) continue;
    const part = byId.get(partId)!;
    const nextQty = Number(part.quantity) - change;
    const { error: updateError } = await supabase
      .from("inventory_parts")
      .update({
        quantity: nextQty,
        updated_at: new Date().toISOString(),
      })
      .eq("id", partId)
      .gte("quantity", change > 0 ? change : 0);

    if (updateError) return updateError.message;
  }

  return null;
}

async function buildWorkEntryPayload(
  formData: FormData,
  technicianId: string,
  partsCostOverride?: number,
) {
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

  const partsCost =
    partsCostOverride ?? parseNumber(formData.get("parts_cost")) ?? 0;
  const softwareCost = parseNumber(formData.get("software_cost")) ?? 0;
  const equipmentCost = parseNumber(formData.get("equipment_cost")) ?? 0;
  const travelCost = parseNumber(formData.get("travel_cost")) ?? 0;
  const otherCost = parseNumber(formData.get("other_cost")) ?? 0;

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

function revalidateWorkPaths() {
  revalidatePath("/technician");
  revalidatePath("/time-costs");
  revalidatePath("/operations");
  revalidatePath("/billing");
  revalidatePath("/reports");
  revalidatePath("/hardware");
}

export async function createWorkEntry(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const ticketId = String(formData.get("ticket_id") ?? "").trim();
  const technicianId = String(formData.get("technician_id") ?? "").trim();
  const customerId = String(formData.get("customer_id") ?? "").trim();

  if (!ticketId || !technicianId || !customerId) {
    return { success: false, message: "Ticket, technician, and customer are required." };
  }

  const resolvedParts = await resolvePartsUsed(supabase, formData);
  if (resolvedParts.error) {
    return { success: false, message: resolvedParts.error };
  }

  const payload = await buildWorkEntryPayload(
    formData,
    technicianId,
    resolvedParts.partsCost,
  );
  if (payload.hours_worked < 0) {
    return { success: false, message: "Hours worked cannot be negative." };
  }

  const stockError = await applyInventoryDelta(
    supabase,
    [],
    resolvedParts.parts,
  );
  if (stockError) {
    return { success: false, message: stockError };
  }

  const contractId = await resolveWorkContractId(
    supabase,
    formData,
    ticketId,
    customerId,
  );

  const { error } = await supabase.from("work_entries").insert({
    ticket_id: ticketId,
    customer_id: customerId,
    contract_id: contractId,
    technician_id: technicianId,
    ...payload,
    parts_used: resolvedParts.parts,
  });

  if (error) {
    // Best-effort rollback of stock if the work entry insert failed.
    await applyInventoryDelta(supabase, resolvedParts.parts, []);
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
  return {
    success: true,
    message:
      resolvedParts.parts.length > 0
        ? "Work entry recorded and parts inventory updated."
        : "Work entry recorded.",
  };
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

  const { data: existing, error: existingError } = await supabase
    .from("work_entries")
    .select("id, parts_used")
    .eq("id", entryId)
    .eq("technician_id", technicianId)
    .maybeSingle();

  if (existingError || !existing) {
    return { success: false, message: "Work entry not found." };
  }

  const previousParts = Array.isArray(existing.parts_used)
    ? (existing.parts_used as PartUsageInput[])
    : [];

  const resolvedParts = await resolvePartsUsed(
    supabase,
    formData,
    previousParts,
  );
  if (resolvedParts.error) {
    return { success: false, message: resolvedParts.error };
  }

  // Validate next usage against stock after restoring previous consumption.
  const stockError = await applyInventoryDelta(
    supabase,
    previousParts,
    resolvedParts.parts,
  );
  if (stockError) {
    return { success: false, message: stockError };
  }

  const payload = await buildWorkEntryPayload(
    formData,
    technicianId,
    resolvedParts.partsCost,
  );
  if (payload.hours_worked < 0) {
    await applyInventoryDelta(supabase, resolvedParts.parts, previousParts);
    return { success: false, message: "Hours worked cannot be negative." };
  }

  const contractId = await resolveWorkContractId(
    supabase,
    formData,
    ticketId,
    customerId,
  );

  const { error } = await supabase
    .from("work_entries")
    .update({
      ticket_id: ticketId,
      customer_id: customerId,
      contract_id: contractId,
      ...payload,
      parts_used: resolvedParts.parts,
    })
    .eq("id", entryId)
    .eq("technician_id", technicianId);

  if (error) {
    await applyInventoryDelta(supabase, resolvedParts.parts, previousParts);
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
  return {
    success: true,
    message:
      resolvedParts.parts.length > 0
        ? "Work entry updated and parts inventory adjusted."
        : "Work entry updated.",
  };
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

  let invoiceNote = "";
  if (approvalStatus === "Approved") {
    const invoiceResult = await createInvoicesFromWorkEntries([entryId], {
      status: "Issued",
    });
    if (invoiceResult.success) {
      if (
        invoiceResult.message.includes("Created") ||
        invoiceResult.message.includes("marked")
      ) {
        invoiceNote = ` ${invoiceResult.message}`;
      }
    } else if (
      !invoiceResult.message.includes("already billed") &&
      !invoiceResult.message.includes("must be Approved")
    ) {
      invoiceNote = ` Approved, but auto-invoice failed: ${invoiceResult.message}`;
    }
  }

  revalidateWorkPaths();
  return {
    success: true,
    message:
      approvalStatus === "Disputed"
        ? "Returned to technician with notes."
        : `Work entry marked ${approvalStatus}.${invoiceNote}`.trim(),
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
