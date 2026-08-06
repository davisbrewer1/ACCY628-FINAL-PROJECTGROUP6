"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";
import {
  contractsUnlockPortal,
  pickPrimaryActiveContract,
  PORTAL_LOCK_MESSAGE,
} from "@/lib/customer-access";
import { pickContractForCustomerWork } from "@/lib/manager-ops";
import { insertNotification } from "@/lib/notifications";
import {
  composeCategoryLabel,
  computeSlaTargets,
  normalizePriority,
} from "@/lib/ticket-ops";
import type { Contract } from "@/lib/types";

async function loadActiveContractsForCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  customerId: string,
): Promise<Contract[]> {
  const { data } = await supabase
    .from("contracts")
    .select("*")
    .eq("customer_id", customerId)
    .eq("contract_status", "Active");
  return (data as Contract[]) ?? [];
}

function revalidateTicketPaths(...extra: string[]) {
  revalidatePath("/service-tickets");
  revalidatePath("/technician");
  revalidatePath("/operations");
  revalidatePath("/reports");
  for (const path of extra) {
    revalidatePath(path);
  }
}

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
  const priority = normalizePriority(String(formData.get("priority") ?? "Medium"));
  const contractId = String(formData.get("contract_id") ?? "").trim() || null;
  const ticketType = String(formData.get("ticket_type") ?? "").trim();
  const categoryOnly = String(formData.get("category") ?? "").trim();
  const category =
    composeCategoryLabel(ticketType, categoryOnly) || categoryOnly || null;

  const customerContracts = await loadActiveContractsForCustomer(
    supabase,
    customerId,
  );
  // Also load pending so manager tickets link before activation.
  const { data: allOpen } = await supabase
    .from("contracts")
    .select("*")
    .eq("customer_id", customerId)
    .neq("contract_status", "Canceled")
    .neq("contract_status", "Expired");
  const openContracts = (allOpen as Contract[]) ?? customerContracts;

  let contract: Contract | null = null;
  if (contractId) {
    const { data } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", contractId)
      .maybeSingle();
    contract = data;
  } else {
    contract =
      pickPrimaryActiveContract(openContracts) ??
      pickContractForCustomerWork(openContracts, customerId);
  }

  const openedAt =
    String(formData.get("opened_at") ?? "").trim() || new Date().toISOString();
  const openedDate = new Date(openedAt);
  const autoSla = computeSlaTargets({
    contract,
    priority,
    openedAt: Number.isNaN(openedDate.getTime()) ? new Date() : openedDate,
  });

  const manualResponse = String(formData.get("target_response_at") ?? "").trim();
  const manualResolution = String(formData.get("target_resolution_at") ?? "").trim();
  const assignedTech =
    String(formData.get("assigned_technician_id") ?? "").trim() || null;

  const { error } = await supabase.from("service_tickets").insert({
    ticket_number: ticketNumber,
    customer_id: customerId,
    contract_id: contractId ?? contract?.id ?? null,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    category,
    priority,
    service_method: String(formData.get("service_method") ?? "").trim() || null,
    assigned_technician_id: assignedTech,
    opened_at: openedAt,
    target_response_at: manualResponse || autoSla.targetResponseAt,
    target_resolution_at: manualResolution || autoSla.targetResolutionAt,
    status: assignedTech
      ? "Assigned"
      : String(formData.get("status") ?? "New").trim(),
    customer_approval_required: formData.get("customer_approval_required") === "true",
    additional_work_suspected: formData.get("additional_work_suspected") === "true",
    additional_billable_work: formData.get("additional_billable_work") === "true",
    location: String(formData.get("location") ?? "").trim() || null,
    requester_name: String(formData.get("requester_name") ?? "").trim() || null,
    severity: priority,
    ai_involved: formData.get("ai_involved") === "true",
    cybersecurity_incident:
      formData.get("cybersecurity_incident") === "true" ||
      categoryOnly === "Security",
    notes: String(formData.get("notes") ?? "").trim() || null,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  if (assignedTech) {
    try {
      await insertNotification(supabase, {
        technicianId: assignedTech,
        type: priority === "Critical" ? "critical_ticket" : "ticket_assigned",
        message:
          priority === "Critical"
            ? `Critical ticket assigned: ${ticketNumber} — ${title}`
            : `New ticket assigned: ${ticketNumber} — ${title}`,
      });
    } catch (notifyError) {
      console.warn("assignment notification skipped:", notifyError);
    }
  }

  revalidateTicketPaths("/portal", "/end-user", "/recommendations");
  return {
    success: true,
    message: `Ticket ${ticketNumber} created · ${priority} priority · SLA applied from contract.`,
  };
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

  const activeContracts = await loadActiveContractsForCustomer(
    supabase,
    customerId,
  );
  if (!contractsUnlockPortal(activeContracts)) {
    return { success: false, message: PORTAL_LOCK_MESSAGE };
  }
  const primaryContract = pickPrimaryActiveContract(activeContracts);

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
    contract_id: primaryContract?.id ?? null,
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

  revalidateTicketPaths("/portal", "/end-user");
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

  revalidateTicketPaths();
  return { success: true, message: "Ticket status updated." };
}

export async function assignTickets(
  ticketIds: string[],
  technicianId: string,
): Promise<ActionResult> {
  if (ticketIds.length === 0) {
    return { success: false, message: "Select at least one ticket to assign." };
  }
  if (!technicianId) {
    return { success: false, message: "Select a technician." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_tickets")
    .update({
      assigned_technician_id: technicianId,
      status: "Assigned",
    })
    .in("id", ticketIds);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateTicketPaths();
  return {
    success: true,
    message: `Assigned ${ticketIds.length} ticket${ticketIds.length === 1 ? "" : "s"}.`,
  };
}

export async function updateTicketPriority(
  ticketId: string,
  priority: string,
  options?: { refreshSla?: boolean },
): Promise<ActionResult> {
  const supabase = await createClient();
  const normalized = normalizePriority(priority);

  const { data: ticket, error: fetchError } = await supabase
    .from("service_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();

  if (fetchError || !ticket) {
    return { success: false, message: "Ticket not found." };
  }

  const updates: Record<string, string | null> = {
    priority: normalized,
    severity: normalized,
  };

  if (options?.refreshSla !== false && ticket.status !== "Completed" && ticket.status !== "Closed") {
    let contract: Contract | null = null;
    if (ticket.contract_id) {
      const { data } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", ticket.contract_id)
        .maybeSingle();
      contract = data;
    }

    const opened = ticket.opened_at ? new Date(ticket.opened_at) : new Date();
    const sla = computeSlaTargets({
      contract,
      priority: normalized,
      openedAt: Number.isNaN(opened.getTime()) ? new Date() : opened,
    });
    updates.target_response_at = sla.targetResponseAt;
    updates.target_resolution_at = sla.targetResolutionAt;
  }

  const { error } = await supabase
    .from("service_tickets")
    .update(updates)
    .eq("id", ticketId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateTicketPaths();
  return {
    success: true,
    message: `Priority set to ${normalized}${options?.refreshSla === false ? "" : " · SLA updated"}.`,
  };
}

export async function updateTicketBillingFlags(
  ticketId: string,
  flags: {
    additional_billable_work?: boolean;
    additional_work_suspected?: boolean;
    invoice_status?: string | null;
  },
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_tickets")
    .update({
      additional_billable_work: flags.additional_billable_work ?? false,
      additional_work_suspected: flags.additional_work_suspected ?? false,
      invoice_status: flags.invoice_status ?? null,
    })
    .eq("id", ticketId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateTicketPaths("/time-costs");
  return { success: true, message: "Billing status updated." };
}

/** Move or clear a ticket schedule (supports hour-grid swaps and weekly calendar). */
export async function updateTicketSchedule(input: {
  ticketId: string;
  scheduledStart: string | null;
  scheduledWindow?: string | null;
  swapTicketId?: string | null;
  swapScheduledStart?: string | null;
  swapScheduledWindow?: string | null;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        success: false,
        message: "Your session expired. Sign in again, then retry the move.",
      };
    }

    const ticketId = String(input.ticketId ?? "").trim();
    if (!ticketId) {
      return { success: false, message: "Ticket is required." };
    }

    const updates: {
      scheduled_start: string | null;
      scheduled_window?: string | null;
      status?: string;
    } = {
      scheduled_start: input.scheduledStart,
    };

    if (input.scheduledWindow !== undefined) {
      updates.scheduled_window = input.scheduledWindow;
    }

    if (input.scheduledStart) {
      updates.status = "Assigned";
    }

    const { error } = await supabase
      .from("service_tickets")
      .update(updates)
      .eq("id", ticketId);

    if (error) {
      return { success: false, message: error.message };
    }

    const swapTicketId = input.swapTicketId
      ? String(input.swapTicketId).trim()
      : "";

    if (swapTicketId) {
      const { error: swapError } = await supabase
        .from("service_tickets")
        .update({
          scheduled_start: input.swapScheduledStart
            ? String(input.swapScheduledStart)
            : null,
          scheduled_window: input.swapScheduledWindow
            ? String(input.swapScheduledWindow)
            : null,
        })
        .eq("id", swapTicketId);

      if (swapError) {
        return { success: false, message: swapError.message };
      }
    }

    revalidateTicketPaths();
    return { success: true, message: "Schedule updated." };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update the schedule.";
    return { success: false, message };
  }
}
