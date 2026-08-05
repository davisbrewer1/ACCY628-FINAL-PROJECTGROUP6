"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";

export async function createServiceTicket(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();

  if (!customerId || !title) {
    return { success: false, message: "Customer and ticket title are required." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ticketNumber = `TKT-${Date.now().toString().slice(-8)}`;

  const { error } = await supabase.from("service_tickets").insert({
    ticket_number: ticketNumber,
    customer_id: customerId,
    contract_id: String(formData.get("contract_id") ?? "").trim() || null,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    category: String(formData.get("category") ?? "").trim() || null,
    priority: String(formData.get("priority") ?? "Medium").trim(),
    service_method: String(formData.get("service_method") ?? "").trim() || null,
    assigned_technician_id:
      String(formData.get("assigned_technician_id") ?? "").trim() || null,
    opened_at: String(formData.get("opened_at") ?? "").trim() || new Date().toISOString(),
    target_response_at:
      String(formData.get("target_response_at") ?? "").trim() || null,
    target_resolution_at:
      String(formData.get("target_resolution_at") ?? "").trim() || null,
    status: String(formData.get("status") ?? "New").trim(),
    customer_approval_required: formData.get("customer_approval_required") === "true",
    additional_work_suspected: formData.get("additional_work_suspected") === "true",
    location: String(formData.get("location") ?? "").trim() || null,
    requester_name: String(formData.get("requester_name") ?? "").trim() || null,
    severity: String(formData.get("severity") ?? "").trim() || null,
    ai_involved: formData.get("ai_involved") === "true",
    cybersecurity_incident: formData.get("cybersecurity_incident") === "true",
    notes: String(formData.get("notes") ?? "").trim() || null,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/service-tickets");
  revalidatePath("/technician");
  revalidatePath("/portal");
  revalidatePath("/end-user");
  revalidatePath("/operations");
  return { success: true, message: `Ticket ${ticketNumber} created.` };
}

export async function createPortalTicket(
  formData: FormData,
  customerId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const title = String(formData.get("title") ?? "").trim();

  if (!title) {
    return { success: false, message: "Ticket title is required." };
  }

  const requestType = String(formData.get("request_type") ?? "support").trim();
  const category =
    String(formData.get("category") ?? "").trim() ||
    (requestType === "ai"
      ? "AI Assistance"
      : requestType === "security"
        ? "Cybersecurity"
        : null);

  const ticketNumber = `TKT-${Date.now().toString().slice(-8)}`;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("service_tickets").insert({
    ticket_number: ticketNumber,
    customer_id: customerId,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    category,
    priority: String(formData.get("priority") ?? "Medium").trim(),
    service_method: String(formData.get("service_method") ?? "").trim() || null,
    location: String(formData.get("location") ?? "").trim() || null,
    requester_name: String(formData.get("requester_name") ?? "").trim() || null,
    severity: String(formData.get("severity") ?? "").trim() || null,
    ai_involved:
      requestType === "ai" || formData.get("ai_involved") === "true",
    cybersecurity_incident:
      requestType === "security" ||
      formData.get("cybersecurity_incident") === "true",
    status: "New",
    opened_at: new Date().toISOString(),
    notes: String(formData.get("availability_notes") ?? "").trim() || null,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/portal");
  revalidatePath("/end-user");
  return { success: true, message: "Support request submitted." };
}

export async function updateTicketStatus(
  ticketId: string,
  status: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const updates: Record<string, string> = { status };
  if (status === "Completed" || status === "Closed") {
    updates.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("service_tickets")
    .update(updates)
    .eq("id", ticketId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/technician");
  revalidatePath("/service-tickets");
  return { success: true, message: "Ticket status updated." };
}
