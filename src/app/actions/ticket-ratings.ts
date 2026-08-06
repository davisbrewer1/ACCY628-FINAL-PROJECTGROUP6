"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/customers";
import { createClient } from "@/lib/supabase/server";

function isClosedStatus(status: string | null | undefined): boolean {
  return status === "Completed" || status === "Closed";
}

export async function submitTicketRating(input: {
  ticketId: string;
  rating: number;
  comment?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const ticketId = String(input.ticketId ?? "").trim();
  const rating = Number(input.rating);
  const comment = String(input.comment ?? "").trim() || null;

  if (!ticketId) {
    return { success: false, message: "Ticket is required." };
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { success: false, message: "Choose a rating from 1 to 5 stars." };
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

  const { data: ticket, error: ticketError } = await supabase
    .from("service_tickets")
    .select("id, customer_id, status, assigned_technician_id")
    .eq("id", ticketId)
    .maybeSingle();

  if (ticketError) {
    return { success: false, message: ticketError.message };
  }
  if (!ticket) {
    return { success: false, message: "Ticket not found." };
  }
  if (
    profile.customer_id &&
    ticket.customer_id !== profile.customer_id &&
    profile.role !== "administrator"
  ) {
    return { success: false, message: "You can only rate tickets for your organization." };
  }
  if (!isClosedStatus(ticket.status)) {
    return {
      success: false,
      message: "You can rate a technician after the ticket is completed or closed.",
    };
  }

  const payload = {
    ticket_id: ticket.id,
    customer_id: ticket.customer_id,
    technician_id: ticket.assigned_technician_id,
    rated_by: user.id,
    rating,
    comment,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("ticket_ratings")
    .select("id")
    .eq("ticket_id", ticket.id)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("ticket_ratings").update(payload).eq("id", existing.id)
    : await supabase.from("ticket_ratings").insert(payload);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/end-user/support");
  revalidatePath("/end-user");
  revalidatePath("/technicians");
  return {
    success: true,
    message: existing ? "Your rating was updated." : "Thanks for rating your technician.",
  };
}
