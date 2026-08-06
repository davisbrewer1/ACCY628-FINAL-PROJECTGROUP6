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
import { allocateNextTicketNumber } from "@/lib/ticket-numbers";
import { buildApprovedPtoDateSet } from "@/lib/technician-pto";
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

  const ticketNumber = await allocateNextTicketNumber(supabase);
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

  let maxHours: number | null = null;
  if (assignedTech) {
    const maxHoursRaw = Number(formData.get("max_hours"));
    if (!Number.isInteger(maxHoursRaw) || maxHoursRaw < 1 || maxHoursRaw > 9) {
      return {
        success: false,
        message:
          "When assigning a technician, set a maximum of 1–9 hours for the task.",
      };
    }
    maxHours = maxHoursRaw;
  }

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
    max_hours: maxHours,
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

  const ticketNumber = await allocateNextTicketNumber(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAsap = String(formData.get("is_asap") ?? "").trim() === "true";
  const lockedRaw = String(formData.get("locked_service_date") ?? "").trim();
  const lockedDate = /^\d{4}-\d{2}-\d{2}$/.test(lockedRaw) ? lockedRaw : null;

  if (!isAsap && !lockedDate) {
    return {
      success: false,
      message: "Choose ASAP-Emergency or an available service day.",
    };
  }

  // ASAP is always Critical. Dated requests default to Medium until a manager
  // sets severity at assign time (priority form field is optional legacy).
  const priority = isAsap
    ? "Critical"
    : String(formData.get("priority") ?? "Medium").trim() || "Medium";

  const { error } = await supabase.from("service_tickets").insert({
    ticket_number: ticketNumber,
    customer_id: customerId,
    contract_id: primaryContract?.id ?? null,
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    category,
    priority,
    service_method: String(formData.get("service_method") ?? "").trim() || null,
    location: String(formData.get("location") ?? "").trim() || null,
    requester_name: String(formData.get("requester_name") ?? "").trim() || null,
    severity: priority,
    is_asap: isAsap,
    locked_service_date: isAsap ? null : lockedDate,
    original_requested_date: isAsap ? null : lockedDate,
    scheduled_off_requested_day: false,
    customer_rescheduled: false,
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

  revalidateTicketPaths("/portal", "/end-user", "/service-tickets");
  return {
    success: true,
    message: isAsap
      ? "Emergency request submitted (ASAP)."
      : `Support request submitted for ${lockedDate}.`,
  };
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

  revalidateTicketPaths("/end-user", "/end-user/support");
  return { success: true, message: "Ticket status updated." };
}

export async function assignTickets(
  ticketIds: string[],
  technicianId: string,
  options: { priority: string; maxHours: number },
): Promise<ActionResult> {
  if (ticketIds.length === 0) {
    return { success: false, message: "Select at least one ticket to assign." };
  }
  if (!technicianId) {
    return { success: false, message: "Select a technician." };
  }

  const priority = normalizePriority(options.priority);
  const maxHours = Math.round(Number(options.maxHours));
  if (!Number.isInteger(maxHours) || maxHours < 1 || maxHours > 9) {
    return {
      success: false,
      message: "Set a maximum of 1–9 hours for this assignment.",
    };
  }

  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("service_tickets")
    .select("id, is_asap, locked_service_date")
    .in("id", ticketIds);

  if (fetchError) {
    return { success: false, message: fetchError.message };
  }

  const lockedDates = [
    ...new Set(
      (existing ?? [])
        .filter((row) => !row.is_asap && row.locked_service_date)
        .map((row) => String(row.locked_service_date).slice(0, 10)),
    ),
  ];

  if (lockedDates.length > 0) {
    const { data: ptoRows } = await supabase
      .from("technician_pto_requests")
      .select("start_date, end_date, status")
      .eq("technician_id", technicianId)
      .eq("status", "Approved");
    const ptoDays = buildApprovedPtoDateSet(ptoRows ?? []);
    const conflict = lockedDates.find((day) => ptoDays.has(day));
    if (conflict) {
      return {
        success: false,
        message: `That technician has approved PTO on ${conflict}. Choose another technician or date.`,
      };
    }
  }

  // ASAP tickets stay Critical regardless of the modal severity pick.
  const asapIds = new Set(
    (existing ?? [])
      .filter((row) => Boolean(row.is_asap))
      .map((row) => String(row.id)),
  );
  const normalIds = ticketIds.filter((id) => !asapIds.has(id));
  const criticalIds = ticketIds.filter((id) => asapIds.has(id));

  if (normalIds.length > 0) {
    const { error } = await supabase
      .from("service_tickets")
      .update({
        assigned_technician_id: technicianId,
        status: "Assigned",
        priority,
        severity: priority,
        max_hours: maxHours,
      })
      .in("id", normalIds);
    if (error) {
      return { success: false, message: error.message };
    }
  }

  if (criticalIds.length > 0) {
    const { error } = await supabase
      .from("service_tickets")
      .update({
        assigned_technician_id: technicianId,
        status: "Assigned",
        priority: "Critical",
        severity: "Critical",
        max_hours: maxHours,
        is_asap: true,
      })
      .in("id", criticalIds);
    if (error) {
      return { success: false, message: error.message };
    }
  }

  revalidateTicketPaths("/end-user", "/end-user/support");
  return {
    success: true,
    message: `Assigned ${ticketIds.length} ticket${ticketIds.length === 1 ? "" : "s"} (${criticalIds.length > 0 && normalIds.length === 0 ? "Critical ASAP" : priority}, max ${maxHours}h).`,
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
  acknowledgedBackwardMoveWarning?: boolean;
  warningFromLabel?: string;
  warningToLabel?: string;
  warningPriority?: string;
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
      scheduled_off_requested_day?: boolean;
      customer_rescheduled?: boolean;
    } = {
      scheduled_start: input.scheduledStart,
    };

    if (input.scheduledWindow !== undefined) {
      updates.scheduled_window = input.scheduledWindow;
    }

    if (input.scheduledStart) {
      updates.status = "Assigned";
      updates.customer_rescheduled = false;
    }

    const { data: ticketBefore, error: ticketFetchError } = await supabase
      .from("service_tickets")
      .select(
        "id, ticket_number, title, priority, assigned_technician_id, locked_service_date, is_asap",
      )
      .eq("id", ticketId)
      .maybeSingle();

    if (ticketFetchError) {
      return { success: false, message: ticketFetchError.message };
    }

    if (input.scheduledStart && ticketBefore?.assigned_technician_id) {
      const scheduledDay = new Date(input.scheduledStart);
      const dayKey = `${scheduledDay.getFullYear()}-${String(scheduledDay.getMonth() + 1).padStart(2, "0")}-${String(scheduledDay.getDate()).padStart(2, "0")}`;
      const { data: ptoRows } = await supabase
        .from("technician_pto_requests")
        .select("start_date, end_date, status")
        .eq("technician_id", ticketBefore.assigned_technician_id)
        .eq("status", "Approved");
      if (buildApprovedPtoDateSet(ptoRows ?? []).has(dayKey)) {
        return {
          success: false,
          message:
            "That day is blocked by approved PTO. Place the ticket on a non-PTO day.",
        };
      }
    }

    if (input.scheduledStart && ticketBefore?.locked_service_date && !ticketBefore.is_asap) {
      const scheduledDay = new Date(input.scheduledStart);
      const scheduledKey = `${scheduledDay.getFullYear()}-${String(scheduledDay.getMonth() + 1).padStart(2, "0")}-${String(scheduledDay.getDate()).padStart(2, "0")}`;
      const lockedKey = String(ticketBefore.locked_service_date).slice(0, 10);
      updates.scheduled_off_requested_day = scheduledKey !== lockedKey;
    } else if (input.scheduledStart) {
      updates.scheduled_off_requested_day = false;
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

    if (input.acknowledgedBackwardMoveWarning && ticketBefore) {
      const technicianId = ticketBefore.assigned_technician_id
        ? String(ticketBefore.assigned_technician_id)
        : "";
      let technicianName = "A technician";
      if (technicianId) {
        const { data: tech } = await supabase
          .from("technicians")
          .select("technician_name")
          .eq("id", technicianId)
          .maybeSingle();
        if (tech?.technician_name) {
          technicianName = String(tech.technician_name);
        }
      }

      const priority =
        String(input.warningPriority ?? ticketBefore.priority ?? "High").trim() ||
        "High";
      const fromLabel = String(input.warningFromLabel ?? "").trim() || "previous slot";
      const toLabel = String(input.warningToLabel ?? "").trim() || "a later slot";
      const message = `${technicianName} moved ${priority} ticket ${ticketBefore.ticket_number} later anyway (${fromLabel} → ${toLabel}): ${ticketBefore.title}`;

      if (technicianId) {
        try {
          await insertNotification(supabase, {
            technicianId,
            type: "schedule_priority_override",
            message,
          });
        } catch (notifyError) {
          console.warn("schedule override notification skipped:", notifyError);
        }
      }
    }

    revalidateTicketPaths("/end-user", "/end-user/support", "/portal");
    return { success: true, message: "Schedule updated." };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update the schedule.";
    return { success: false, message };
  }
}

/**
 * Customer reschedules a visit via SECURITY DEFINER RPC (clients cannot
 * UPDATE service_tickets directly under RLS). Clears calendar placement,
 * tags the request, and notifies the assigned technician.
 */
export async function rescheduleCustomerTicket(
  ticketId: string,
  newLockedDate: string,
  customerId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const dateKey = String(newLockedDate ?? "").trim().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { success: false, message: "Choose a valid service day." };
  }

  const { data: ticket, error: fetchError } = await supabase
    .from("service_tickets")
    .select(
      "id, ticket_number, title, customer_id, assigned_technician_id, scheduled_start, locked_service_date, customer_rescheduled",
    )
    .eq("id", ticketId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, message: fetchError.message };
  }
  if (!ticket || ticket.customer_id !== customerId) {
    return { success: false, message: "Ticket not found." };
  }
  if (!ticket.scheduled_start && !ticket.customer_rescheduled) {
    return {
      success: false,
      message: "Reschedule is available after a technician places your visit.",
    };
  }

  const { data: updated, error } = await supabase.rpc(
    "customer_reschedule_service_ticket",
    {
      p_ticket_id: ticketId,
      p_new_date: dateKey,
    },
  );

  if (error) {
    return {
      success: false,
      message: error.message.replace(/^.*ERROR:\s*/i, "").split("\n")[0],
    };
  }

  const row = Array.isArray(updated) ? updated[0] : updated;
  if (!row) {
    return {
      success: false,
      message: "Reschedule did not save. Try again.",
    };
  }

  // Best-effort duplicate notify from the app layer (RPC already inserts one).
  if (ticket.assigned_technician_id) {
    try {
      const { insertNotification } = await import("@/lib/notifications");
      await insertNotification(supabase, {
        technicianId: String(ticket.assigned_technician_id),
        type: "customer_reschedule",
        message: `Reschedule: ${ticket.ticket_number} → ${dateKey}. Place a new time in Needs scheduling: ${ticket.title}`,
      });
    } catch (notifyError) {
      console.warn("customer reschedule notification skipped:", notifyError);
    }
  }

  revalidatePath("/portal");
  revalidatePath("/end-user");
  revalidatePath("/end-user/support");
  revalidatePath("/technician");
  revalidatePath("/service-tickets");
  return {
    success: true,
    message: `Reschedule requested for ${dateKey}. Your technician was notified and will place a new time.`,
  };
}
