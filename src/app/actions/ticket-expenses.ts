"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/customers";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseType, TicketExpense } from "@/lib/types";
import { EXPENSE_TYPES } from "@/lib/types";
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

  if (!input.ticketId) {
    return { success: false, message: "Ticket is required." };
  }
  if (!isValidType(input.type)) {
    return { success: false, message: "Select a valid expense type." };
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
      amount: input.amount,
      description: input.description?.trim() || null,
      date: input.date,
      receipt_url: serializeReceiptPaths(uploadedPaths),
    })
    .select("*")
    .single();

  if (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from("expense-receipts").remove(uploadedPaths);
    }
    return { success: false, message: error.message };
  }

  revalidateExpensePaths();
  return {
    success: true,
    message:
      uploadedPaths.length > 1
        ? `Expense added with ${uploadedPaths.length} receipts.`
        : "Expense added.",
    expense: data as TicketExpense,
  };
}

export async function updateTicketExpense(input: {
  expenseId: string;
  type: string;
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
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, message: "Amount must be a positive number." };
  }

  const { data, error } = await supabase
    .from("ticket_expenses")
    .update({
      type: input.type,
      amount: input.amount,
      description: input.description?.trim() || null,
      date: input.date,
    })
    .eq("id", input.expenseId)
    .select("*")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateExpensePaths();
  return {
    success: true,
    message: "Expense updated.",
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
