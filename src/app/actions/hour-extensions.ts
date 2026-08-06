"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";

function revalidateHourPaths() {
  revalidatePath("/technician");
  revalidatePath("/technicians");
  revalidatePath("/service-tickets");
}

export async function requestTicketHourExtension(input: {
  ticketId: string;
  technicianId: string;
  requestedHours: number;
  reason?: string | null;
}): Promise<ActionResult> {
  const ticketId = String(input.ticketId ?? "").trim();
  const technicianId = String(input.technicianId ?? "").trim();
  const requestedHours = Math.round(Number(input.requestedHours));
  const reason = String(input.reason ?? "").trim() || null;

  if (!ticketId || !technicianId) {
    return { success: false, message: "Ticket and technician are required." };
  }
  if (!Number.isInteger(requestedHours) || requestedHours < 1 || requestedHours > 9) {
    return { success: false, message: "Request between 1 and 9 hours." };
  }

  const supabase = await createClient();
  const { data: ticket, error: ticketError } = await supabase
    .from("service_tickets")
    .select("id, assigned_technician_id, max_hours, status, ticket_number, title")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError) {
    return { success: false, message: ticketError.message };
  }
  if (!ticket) {
    return { success: false, message: "Ticket not found." };
  }
  if (ticket.assigned_technician_id !== technicianId) {
    return { success: false, message: "This ticket is not assigned to you." };
  }

  const currentMax = Number(ticket.max_hours);
  if (!Number.isInteger(currentMax) || currentMax < 1) {
    return {
      success: false,
      message: "This ticket has no manager hour cap to extend.",
    };
  }
  if (requestedHours <= currentMax) {
    return {
      success: false,
      message: `Request more than the current maximum (${currentMax}h).`,
    };
  }

  const { data: existingPending } = await supabase
    .from("ticket_hour_extension_requests")
    .select("id")
    .eq("ticket_id", ticketId)
    .eq("status", "Pending")
    .limit(1)
    .maybeSingle();

  if (existingPending) {
    return {
      success: false,
      message: "A pending hour-extension request already exists for this ticket.",
    };
  }

  const { error } = await supabase.from("ticket_hour_extension_requests").insert({
    ticket_id: ticketId,
    technician_id: technicianId,
    current_max_hours: currentMax,
    requested_hours: requestedHours,
    reason,
    status: "Pending",
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateHourPaths();
  return {
    success: true,
    message: `Requested ${requestedHours}h for ${ticket.ticket_number} (awaiting manager approval).`,
  };
}

export async function cancelTicketHourExtension(
  requestId: string,
  technicianId: string,
): Promise<ActionResult> {
  if (!requestId || !technicianId) {
    return { success: false, message: "Request and technician are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("ticket_hour_extension_requests")
    .update({ status: "Cancelled", reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("technician_id", technicianId)
    .eq("status", "Pending");

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateHourPaths();
  return { success: true, message: "Hour-extension request cancelled." };
}

export async function reviewTicketHourExtension(
  requestId: string,
  decision: "Approved" | "Denied",
): Promise<ActionResult> {
  if (!requestId) {
    return { success: false, message: "Request is required." };
  }
  if (decision !== "Approved" && decision !== "Denied") {
    return { success: false, message: "Choose Approve or Deny." };
  }

  const supabase = await createClient();
  const { data: request, error: fetchError } = await supabase
    .from("ticket_hour_extension_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, message: fetchError.message };
  }
  if (!request) {
    return { success: false, message: "Hour-extension request not found." };
  }
  if (request.status !== "Pending") {
    return {
      success: false,
      message: `This request is already ${String(request.status).toLowerCase()}.`,
    };
  }

  if (decision === "Approved") {
    const { error: ticketError } = await supabase
      .from("service_tickets")
      .update({
        max_hours: request.requested_hours,
      })
      .eq("id", request.ticket_id);

    if (ticketError) {
      return { success: false, message: ticketError.message };
    }
  }

  const { error } = await supabase
    .from("ticket_hour_extension_requests")
    .update({
      status: decision,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "Pending");

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateHourPaths();
  return {
    success: true,
    message:
      decision === "Approved"
        ? `Approved — ticket max hours raised to ${request.requested_hours}h.`
        : "Hour-extension request denied.",
  };
}
