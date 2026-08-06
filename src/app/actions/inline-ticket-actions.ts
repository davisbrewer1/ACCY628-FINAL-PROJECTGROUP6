"use server";

import { revalidatePath } from "next/cache";
import { calcLaborCost, calcTotalDirectCost } from "@/lib/calculations";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";

function revalidateTicketPaths() {
  revalidatePath("/technician");
  revalidatePath("/service-tickets");
  revalidatePath("/operations");
  revalidatePath("/time-costs");
  revalidatePath("/reports");
}

export async function updateInlineTicketStatus(
  ticketId: string,
  status: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const updates: Record<string, string> = { status };

  if (status === "Completed" || status === "Closed") {
    updates.completed_at = new Date().toISOString();
  }

  const { data: existing } = await supabase
    .from("service_tickets")
    .select("ticket_number, title, assigned_technician_id, status")
    .eq("id", ticketId)
    .maybeSingle();

  const { error } = await supabase
    .from("service_tickets")
    .update(updates)
    .eq("id", ticketId);

  if (error) {
    return { success: false, message: error.message };
  }

  if (
    existing?.assigned_technician_id &&
    existing.status !== status
  ) {
    try {
      const { insertNotification } = await import("@/lib/notifications");
      await insertNotification(supabase, {
        technicianId: existing.assigned_technician_id,
        type: "ticket_status_changed",
        message: `Ticket ${existing.ticket_number} status changed to ${status} — ${existing.title}`,
      });
    } catch (notifyError) {
      console.warn("status notification skipped:", notifyError);
    }
  }

  revalidateTicketPaths();
  return { success: true, message: "Ticket status updated." };
}

export async function addWorkNote(
  ticketId: string,
  technicianId: string,
  note: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const trimmed = note.trim();

  if (!trimmed) {
    return { success: false, message: "Work note cannot be empty." };
  }

  const { error } = await supabase.from("work_notes").insert({
    ticket_id: ticketId,
    technician_id: technicianId,
    note: trimmed,
  });

  if (error) {
    // Fallback: append to ticket notes if work_notes table is not migrated yet.
    const { data: ticket } = await supabase
      .from("service_tickets")
      .select("notes")
      .eq("id", ticketId)
      .maybeSingle();

    const stamp = new Date().toISOString();
    const nextNotes = [ticket?.notes, `[${stamp}] ${trimmed}`]
      .filter(Boolean)
      .join("\n");

    const { error: fallbackError } = await supabase
      .from("service_tickets")
      .update({ notes: nextNotes })
      .eq("id", ticketId);

    if (fallbackError) {
      return { success: false, message: error.message };
    }
  }

  revalidateTicketPaths();
  return { success: true, message: "Work note added." };
}

export async function uploadTicketPhoto(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const ticketId = String(formData.get("ticket_id") ?? "").trim();
  const technicianId = String(formData.get("technician_id") ?? "").trim();
  const file = formData.get("file");

  if (!ticketId || !(file instanceof File) || file.size === 0) {
    return { success: false, message: "Ticket and photo file are required." };
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const filePath = `${ticketId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("ticket-attachments")
    .upload(filePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return {
      success: false,
      message: `Upload failed: ${uploadError.message}. Ensure the ticket-attachments bucket exists.`,
    };
  }

  const { error: metaError } = await supabase.from("attachments").insert({
    ticket_id: ticketId,
    technician_id: technicianId || null,
    file_name: file.name,
    file_path: filePath,
    file_size: file.size,
    mime_type: file.type || null,
  });

  if (metaError) {
    return {
      success: false,
      message: `File uploaded, but metadata save failed: ${metaError.message}`,
    };
  }

  revalidateTicketPaths();
  return { success: true, message: "Photo attached to ticket." };
}

export async function addQuickHours(input: {
  ticketId: string;
  technicianId: string;
  customerId: string;
  contractId?: string | null;
  hours: number;
  note?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { ticketId, technicianId, customerId, contractId, hours, note } = input;

  if (!ticketId || !technicianId || !customerId) {
    return { success: false, message: "Ticket, technician, and customer are required." };
  }

  if (!Number.isFinite(hours) || hours <= 0) {
    return { success: false, message: "Enter a valid number of hours greater than zero." };
  }

  const { data: technician } = await supabase
    .from("technicians")
    .select("internal_hourly_cost")
    .eq("id", technicianId)
    .maybeSingle();

  const laborCost = calcLaborCost(hours, technician?.internal_hourly_cost);
  const totalDirectCost = calcTotalDirectCost({
    labor: laborCost,
    parts: 0,
    software: 0,
    equipment: 0,
    travel: 0,
    other: 0,
  });

  const { error } = await supabase.from("work_entries").insert({
    ticket_id: ticketId,
    customer_id: customerId,
    contract_id: contractId || null,
    technician_id: technicianId,
    work_date: new Date().toISOString().slice(0, 10),
    hours_worked: hours,
    work_performed: note?.trim() || "Quick hours entry from ticket list",
    labor_cost: laborCost,
    total_direct_cost: totalDirectCost,
    parts_cost: 0,
    software_cost: 0,
    equipment_cost: 0,
    travel_cost: 0,
    other_cost: 0,
    included_in_contract: true,
    additional_approval_required: false,
    approval_status: "Pending",
    billing_status: "Not Billed",
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateTicketPaths();
  return { success: true, message: `${hours} hour(s) logged.` };
}

export async function flagTicketConcern(input: {
  ticketId: string;
  technicianId: string;
  flagType: "security" | "ai";
  enabled: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { ticketId, technicianId, flagType, enabled } = input;

  const ticketUpdate =
    flagType === "security"
      ? { cybersecurity_incident: enabled }
      : { ai_involved: enabled };

  const { data: updatedTicket, error: ticketError } = await supabase
    .from("service_tickets")
    .update(ticketUpdate)
    .eq("id", ticketId)
    .select("id, cybersecurity_incident, ai_involved")
    .maybeSingle();

  if (ticketError) {
    return { success: false, message: ticketError.message };
  }

  if (!updatedTicket) {
    return {
      success: false,
      message: "Could not update this ticket. You may not have permission to change flags.",
    };
  }

  // History table is optional until the migration is applied — never fail the flag
  // action if the ticket columns were updated successfully.
  if (enabled) {
    const { error: flagError } = await supabase.from("ticket_flags").insert({
      ticket_id: ticketId,
      technician_id: technicianId || null,
      flag_type: flagType,
    });

    if (flagError) {
      console.warn("ticket_flags insert skipped:", flagError.message);
    }
  }

  revalidateTicketPaths();

  if (flagType === "security") {
    return {
      success: true,
      message: enabled
        ? "Security concern flagged."
        : "Security concern cleared.",
    };
  }

  return {
    success: true,
    message: enabled ? "AI concern flagged." : "AI concern cleared.",
  };
}

export async function markTicketComplete(
  ticketId: string,
  options?: { requireWorkNote?: boolean; complete?: boolean },
): Promise<ActionResult> {
  const supabase = await createClient();
  const requireWorkNote = options?.requireWorkNote ?? true;
  const complete = options?.complete ?? true;

  if (!complete) {
    const { data, error } = await supabase
      .from("service_tickets")
      .update({
        status: "In Progress",
        completed_at: null,
      })
      .eq("id", ticketId)
      .select("id, status")
      .maybeSingle();

    if (error) {
      return { success: false, message: error.message };
    }

    if (!data) {
      return {
        success: false,
        message: "Could not reopen this ticket. You may not have permission.",
      };
    }

    revalidateTicketPaths();
    return { success: true, message: "Ticket reopened as In Progress." };
  }

  if (requireWorkNote) {
    const [{ count: noteCount }, { data: ticket }, { count: entryCount }] =
      await Promise.all([
        supabase
          .from("work_notes")
          .select("id", { count: "exact", head: true })
          .eq("ticket_id", ticketId),
        supabase
          .from("service_tickets")
          .select("notes")
          .eq("id", ticketId)
          .maybeSingle(),
        supabase
          .from("work_entries")
          .select("id", { count: "exact", head: true })
          .eq("ticket_id", ticketId),
      ]);

    const hasNote =
      (noteCount ?? 0) > 0 ||
      Boolean(ticket?.notes?.trim()) ||
      (entryCount ?? 0) > 0;

    if (!hasNote) {
      return {
        success: false,
        message: "Add a work note or hours before marking complete.",
      };
    }
  }

  const { data, error } = await supabase
    .from("service_tickets")
    .update({
      status: "Completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", ticketId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    return { success: false, message: error.message };
  }

  if (!data) {
    return {
      success: false,
      message: "Could not complete this ticket. You may not have permission.",
    };
  }

  revalidateTicketPaths();
  return { success: true, message: "Ticket marked complete." };
}
