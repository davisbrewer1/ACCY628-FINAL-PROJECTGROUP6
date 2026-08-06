"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/customers";
import { insertNotification } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import type { Approval, ApprovalStatus } from "@/lib/types";

function revalidateApprovalPaths() {
  revalidatePath("/time-costs");
  revalidatePath("/technician");
  revalidatePath("/operations");
  revalidatePath("/service-tickets");
  revalidatePath("/reports");
}

export async function createApprovalRequest(input: {
  ticketId: string;
  technicianId: string;
  costEntryId?: string | null;
  workEntryId?: string | null;
  reason: string;
  totalCost?: number | null;
  files?: Array<{
    name: string;
    type: string;
    size: number;
    base64: string;
  }>;
}): Promise<ActionResult & { approvalId?: string }> {
  const supabase = await createClient();
  const reason = input.reason.trim();

  if (!input.ticketId || !input.technicianId) {
    return { success: false, message: "Ticket and technician are required." };
  }
  if (!reason) {
    return { success: false, message: "Please explain why approval is needed." };
  }

  const { data: approval, error } = await supabase
    .from("approvals")
    .insert({
      ticket_id: input.ticketId,
      technician_id: input.technicianId,
      cost_entry_id: input.costEntryId || null,
      work_entry_id: input.workEntryId || null,
      status: "Pending",
      reason,
      total_cost: input.totalCost ?? null,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  const approvalId = approval.id as string;

  for (const file of input.files ?? []) {
    try {
      const binary = Buffer.from(file.base64, "base64");
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${approvalId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("approval-attachments")
        .upload(path, binary, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        console.warn("approval attachment upload skipped:", uploadError.message);
        continue;
      }

      await supabase.from("approval_attachments").insert({
        approval_id: approvalId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || null,
      });
    } catch (attachError) {
      console.warn("approval attachment failed:", attachError);
    }
  }

  if (input.costEntryId) {
    await supabase
      .from("cost_entries")
      .update({
        approval_required: true,
        approval_status: "Pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.costEntryId);
  }

  if (input.workEntryId) {
    await supabase
      .from("work_entries")
      .update({
        additional_approval_required: true,
        approval_status: "Pending",
      })
      .eq("id", input.workEntryId);
  }

  await supabase
    .from("service_tickets")
    .update({
      approval_status: "Pending",
      status: "Waiting on Approval",
    })
    .eq("id", input.ticketId);

  revalidateApprovalPaths();
  return {
    success: true,
    message: "Approval request submitted.",
    approvalId,
  };
}

export async function decideApproval(input: {
  approvalId: string;
  decision: Extract<ApprovalStatus, "Approved" | "Denied">;
  managerNotes?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const { data: approval, error: fetchError } = await supabase
    .from("approvals")
    .select("*")
    .eq("id", input.approvalId)
    .maybeSingle();

  if (fetchError || !approval) {
    return {
      success: false,
      message: fetchError?.message ?? "Approval request not found.",
    };
  }

  if (approval.status !== "Pending") {
    return { success: false, message: "This approval has already been decided." };
  }

  const { error } = await supabase
    .from("approvals")
    .update({
      status: input.decision,
      manager_id: user.id,
      manager_notes: input.managerNotes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.approvalId);

  if (error) {
    return { success: false, message: error.message };
  }

  const approvalStatus = input.decision;

  if (approval.cost_entry_id) {
    await supabase
      .from("cost_entries")
      .update({
        approval_required: false,
        approval_status: approvalStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", approval.cost_entry_id);
  }

  if (approval.work_entry_id) {
    await supabase
      .from("work_entries")
      .update({
        additional_approval_required: approvalStatus === "Denied",
        approval_status: approvalStatus,
      })
      .eq("id", approval.work_entry_id);
  }

  if (approval.ticket_id) {
    await supabase
      .from("service_tickets")
      .update({
        approval_status: approvalStatus,
        status:
          approvalStatus === "Approved" ? "In Progress" : "Waiting on Approval",
        additional_billable_work: approvalStatus === "Approved",
      })
      .eq("id", approval.ticket_id);
  }

  if (approval.technician_id) {
    try {
      await insertNotification(supabase, {
        technicianId: approval.technician_id,
        type: "work_approval",
        message:
          approvalStatus === "Approved"
            ? `Your approval request was approved.${
                input.managerNotes?.trim()
                  ? ` Manager note: ${input.managerNotes.trim()}`
                  : ""
              }`
            : `Your approval request was denied.${
                input.managerNotes?.trim()
                  ? ` Manager note: ${input.managerNotes.trim()}`
                  : ""
              }`,
      });
    } catch (notifyError) {
      console.warn("approval notification skipped:", notifyError);
    }
  }

  revalidateApprovalPaths();
  return {
    success: true,
    message:
      approvalStatus === "Approved"
        ? "Approval granted. Technician notified."
        : "Approval denied. Technician notified.",
  };
}

export async function fetchPendingApprovalsAction(): Promise<Approval[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approvals")
    .select("*")
    .eq("status", "Pending")
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }

  return (data ?? []) as Approval[];
}
