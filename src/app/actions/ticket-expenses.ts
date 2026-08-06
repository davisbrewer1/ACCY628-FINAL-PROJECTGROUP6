"use server";

import { revalidatePath } from "next/cache";
import { createApprovalRequest } from "@/app/actions/approvals";
import type { ActionResult } from "@/app/actions/customers";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseTag, ExpenseType, TicketExpense } from "@/lib/types";
import {
  DEFAULT_EXPENSE_TAG,
  EXPENSE_TAGS,
  EXPENSE_TYPES,
} from "@/lib/types";
import {
  parseReceiptPaths,
  serializeReceiptPaths,
} from "@/lib/ticket-expenses";

function revalidateExpensePaths() {
  revalidatePath("/time-costs");
  revalidatePath("/technician");
}

function isValidType(type: string): type is ExpenseType {
  return (EXPENSE_TYPES as readonly string[]).includes(type);
}

function isValidTag(tag: string): tag is ExpenseTag {
  return (EXPENSE_TAGS as readonly string[]).includes(tag);
}

function buildBillableExpenseReason(input: {
  type: string;
  amount: number;
  description?: string | null;
  date: string;
}) {
  const note = input.description?.trim();
  return [
    `Billable expense for customer invoice approval`,
    `${input.type} · $${Number(input.amount).toFixed(2)} · ${input.date}`,
    note ? note : null,
  ]
    .filter(Boolean)
    .join(" — ");
}

export async function fetchTicketExpenses(
  ticketId: string,
): Promise<TicketExpense[]> {
  if (!ticketId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ticket_expenses")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("fetchTicketExpenses:", error.message);
    return [];
  }

  return (data ?? []) as TicketExpense[];
}

export interface ReceiptUploadInput {
  fileName: string;
  fileType: string;
  base64: string;
}

export async function addTicketExpense(input: {
  ticketId: string;
  technicianId?: string | null;
  type: string;
  expenseTag?: string;
  amount: number;
  description?: string;
  date: string;
  receipts?: ReceiptUploadInput[];
  /** @deprecated use receipts */
  receiptFileName?: string;
  receiptFileType?: string;
  receiptBase64?: string;
}): Promise<ActionResult & { expense?: TicketExpense }> {
  const supabase = await createClient();
  const expenseTag = input.expenseTag?.trim() || DEFAULT_EXPENSE_TAG;
  const isBillable = expenseTag === "Billable to Customer";

  if (!input.ticketId) {
    return { success: false, message: "Ticket is required." };
  }
  if (!isValidType(input.type)) {
    return { success: false, message: "Select a valid expense type." };
  }
  if (!isValidTag(expenseTag)) {
    return { success: false, message: "Select a valid billing option." };
  }
  if (isBillable && !input.technicianId) {
    return {
      success: false,
      message: "Select a technician before submitting a billable expense.",
    };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, message: "Amount must be a positive number." };
  }
  if (!input.date) {
    return { success: false, message: "Date is required." };
  }

  const uploads: ReceiptUploadInput[] = [...(input.receipts ?? [])];
  if (input.receiptBase64 && input.receiptFileName) {
    uploads.push({
      fileName: input.receiptFileName,
      fileType: input.receiptFileType || "application/octet-stream",
      base64: input.receiptBase64,
    });
  }

  const uploadedPaths: string[] = [];

  for (let index = 0; index < uploads.length; index += 1) {
    const file = uploads[index]!;
    const safeName = file.fileName.replace(/[^\w.\-]+/g, "_");
    const path = `${input.ticketId}/${Date.now()}-${index}-${safeName}`;
    const binary = Buffer.from(file.base64, "base64");

    const { error: uploadError } = await supabase.storage
      .from("expense-receipts")
      .upload(path, binary, {
        contentType: file.fileType || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("expense-receipts").remove(uploadedPaths);
      }
      return {
        success: false,
        message: `Receipt upload failed: ${uploadError.message}`,
      };
    }

    uploadedPaths.push(path);
  }

  const { data, error } = await supabase
    .from("ticket_expenses")
    .insert({
      ticket_id: input.ticketId,
      technician_id: input.technicianId || null,
      type: input.type,
      expense_tag: expenseTag,
      amount: input.amount,
      description: input.description?.trim() || null,
      date: input.date,
      receipt_url: serializeReceiptPaths(uploadedPaths),
      approval_status: isBillable ? "Pending" : null,
    })
    .select("*")
    .single();

  if (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from("expense-receipts").remove(uploadedPaths);
    }
    return { success: false, message: error.message };
  }

  let message =
    uploadedPaths.length > 1
      ? `Expense added with ${uploadedPaths.length} receipts.`
      : "Expense added.";

  if (isBillable && data && input.technicianId) {
    const approval = await createApprovalRequest({
      ticketId: input.ticketId,
      technicianId: input.technicianId,
      ticketExpenseId: data.id,
      reason: buildBillableExpenseReason({
        type: input.type,
        amount: input.amount,
        description: input.description,
        date: input.date,
      }),
      totalCost: input.amount,
    });

    if (!approval.success) {
      await supabase
        .from("ticket_expenses")
        .update({ approval_status: null })
        .eq("id", data.id);
      return {
        success: false,
        message: `Expense saved, but approval request failed: ${approval.message}`,
        expense: data as TicketExpense,
      };
    }

    message =
      "Billable expense submitted — awaiting management approval for the customer invoice.";
  }

  revalidateExpensePaths();
  return {
    success: true,
    message,
    expense: data as TicketExpense,
  };
}

export async function updateTicketExpense(input: {
  expenseId: string;
  type: string;
  expenseTag: string;
  amount: number;
  description?: string;
  date: string;
}): Promise<ActionResult & { expense?: TicketExpense }> {
  const supabase = await createClient();

  if (!input.expenseId) {
    return { success: false, message: "Expense id is required." };
  }
  if (!isValidType(input.type)) {
    return { success: false, message: "Select a valid expense type." };
  }
  if (!isValidTag(input.expenseTag)) {
    return { success: false, message: "Select a valid billing option." };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, message: "Amount must be a positive number." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("ticket_expenses")
    .select("*")
    .eq("id", input.expenseId)
    .maybeSingle();

  if (existingError || !existing) {
    return {
      success: false,
      message: existingError?.message ?? "Expense not found.",
    };
  }

  const isBillable = input.expenseTag === "Billable to Customer";
  const wasBillable = existing.expense_tag === "Billable to Customer";
  const needsNewApproval =
    isBillable &&
    existing.approval_status !== "Pending" &&
    existing.approval_status !== "Approved";

  if (isBillable && !existing.technician_id) {
    return {
      success: false,
      message:
        "This expense needs a technician before it can be sent for approval.",
    };
  }

  const nextApprovalStatus = !isBillable
    ? null
    : needsNewApproval
      ? "Pending"
      : existing.approval_status;

  const { data, error } = await supabase
    .from("ticket_expenses")
    .update({
      type: input.type,
      expense_tag: input.expenseTag,
      amount: input.amount,
      description: input.description?.trim() || null,
      date: input.date,
      approval_status: nextApprovalStatus,
    })
    .eq("id", input.expenseId)
    .select("*")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  let message = "Expense updated.";

  if (isBillable && needsNewApproval && existing.technician_id) {
    const approval = await createApprovalRequest({
      ticketId: existing.ticket_id,
      technicianId: existing.technician_id,
      ticketExpenseId: input.expenseId,
      reason: buildBillableExpenseReason({
        type: input.type,
        amount: input.amount,
        description: input.description,
        date: input.date,
      }),
      totalCost: input.amount,
    });

    if (!approval.success) {
      return {
        success: false,
        message: `Expense updated, but approval request failed: ${approval.message}`,
        expense: data as TicketExpense,
      };
    }

    message =
      "Billable expense updated and sent to management for invoice approval.";
  } else if (isBillable && existing.approval_status === "Pending") {
    await supabase
      .from("approvals")
      .update({
        reason: buildBillableExpenseReason({
          type: input.type,
          amount: input.amount,
          description: input.description,
          date: input.date,
        }),
        total_cost: input.amount,
        updated_at: new Date().toISOString(),
      })
      .eq("ticket_expense_id", input.expenseId)
      .eq("status", "Pending");
  } else if (
    wasBillable &&
    !isBillable &&
    existing.approval_status === "Pending"
  ) {
    await supabase
      .from("approvals")
      .update({
        status: "Denied",
        manager_notes:
          "Technician changed billing to Internal Company Expense.",
        updated_at: new Date().toISOString(),
      })
      .eq("ticket_expense_id", input.expenseId)
      .eq("status", "Pending");
    message =
      "Expense updated to internal. Pending invoice approval cancelled.";
  }

  revalidateExpensePaths();
  return {
    success: true,
    message,
    expense: data as TicketExpense,
  };
}

export async function deleteTicketExpense(
  expenseId: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  if (!expenseId) {
    return { success: false, message: "Expense id is required." };
  }

  const { data: existing } = await supabase
    .from("ticket_expenses")
    .select("receipt_url")
    .eq("id", expenseId)
    .maybeSingle();

  const { error } = await supabase
    .from("ticket_expenses")
    .delete()
    .eq("id", expenseId);

  if (error) {
    return { success: false, message: error.message };
  }

  const paths = parseReceiptPaths(existing?.receipt_url);
  if (paths.length > 0) {
    await supabase.storage.from("expense-receipts").remove(paths);
  }

  revalidateExpensePaths();
  return { success: true, message: "Expense deleted." };
}

export async function getExpenseReceiptUrl(
  receiptPath: string,
): Promise<string | null> {
  if (!receiptPath) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("expense-receipts")
    .createSignedUrl(receiptPath, 60 * 30);

  if (error) {
    console.warn("receipt signed url:", error.message);
    return null;
  }

  return data.signedUrl;
}
