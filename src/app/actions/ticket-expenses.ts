"use server";

import { revalidatePath } from "next/cache";
import { createApprovalRequest } from "@/app/actions/approvals";
import type { ActionResult } from "@/app/actions/customers";
import { insertNotification } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import {
  buildInternalOverLimitReason,
  currentMonthDateBounds,
  decideInternalBudget,
  DEFAULT_EXPENSE_MONTHLY_LIMIT,
  isAcceptedTicketExpense,
} from "@/lib/ticket-expense-budgets";
import type {
  ExpenseTag,
  ExpenseType,
  TechnicianExpenseBudget,
  TicketExpense,
} from "@/lib/types";
import {
  DEFAULT_EXPENSE_TAG,
  EXPENSE_TAGS,
  EXPENSE_TYPES,
} from "@/lib/types";
import {
  parseReceiptPaths,
  serializeReceiptPaths,
} from "@/lib/ticket-expenses";
import type { SupabaseClient } from "@supabase/supabase-js";

function revalidateExpensePaths() {
  revalidatePath("/time-costs");
  revalidatePath("/technician");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
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

function isManagerRole(role: string | null | undefined): boolean {
  return (
    role === "administrator" ||
    role === "service_manager" ||
    role === "account_manager"
  );
}

async function ensureTechnicianExpenseBudget(
  supabase: SupabaseClient,
  technicianId: string,
): Promise<{ monthly_limit: number }> {
  const { data: existing } = await supabase
    .from("technician_expense_budgets")
    .select("monthly_limit")
    .eq("technician_id", technicianId)
    .maybeSingle();

  if (existing) {
    return { monthly_limit: Number(existing.monthly_limit) };
  }

  await supabase.from("technician_expense_budgets").insert({
    technician_id: technicianId,
    monthly_limit: DEFAULT_EXPENSE_MONTHLY_LIMIT,
  });

  return { monthly_limit: DEFAULT_EXPENSE_MONTHLY_LIMIT };
}

async function sumMtdAcceptedInternalSpend(
  supabase: SupabaseClient,
  technicianId: string,
  excludeExpenseId?: string,
): Promise<number> {
  const { start, end } = currentMonthDateBounds();
  const { data } = await supabase
    .from("ticket_expenses")
    .select("id, amount, approval_status, expense_tag, date")
    .eq("technician_id", technicianId)
    .eq("expense_tag", "Internal Company Expense")
    .gte("date", start)
    .lte("date", end);

  return (data ?? [])
    .filter((row) => {
      if (excludeExpenseId && row.id === excludeExpenseId) return false;
      return isAcceptedTicketExpense(row);
    })
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
}

/** Notify managers (linked technician inboxes) of an over-limit internal expense. */
async function notifyManagersOfOverLimitExpense(
  supabase: SupabaseClient,
  message: string,
  fallbackTechnicianId: string | null,
): Promise<void> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["administrator", "service_manager", "account_manager"]);

  const profileIds = (profiles ?? []).map((p) => p.id as string);
  const notifyIds = new Set<string>();

  if (profileIds.length > 0) {
    const { data: managerTechs } = await supabase
      .from("technicians")
      .select("id")
      .in("profile_id", profileIds);
    for (const row of managerTechs ?? []) {
      notifyIds.add(row.id as string);
    }
  }

  // Managers without a technician link see the global notification feed.
  if (notifyIds.size === 0 && fallbackTechnicianId) {
    notifyIds.add(fallbackTechnicianId);
  }

  for (const technicianId of notifyIds) {
    try {
      await insertNotification(supabase, {
        technicianId,
        type: "work_approval",
        message,
      });
    } catch (error) {
      console.warn("over-limit manager notify skipped:", error);
    }
  }
}

async function resolveTechnicianId(
  supabase: SupabaseClient,
  ticketId: string,
  technicianId?: string | null,
): Promise<string | null> {
  if (technicianId) return technicianId;
  const { data: ticket } = await supabase
    .from("service_tickets")
    .select("assigned_technician_id")
    .eq("id", ticketId)
    .maybeSingle();
  return (ticket?.assigned_technician_id as string | null) ?? null;
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

interface ReceiptUploadInput {
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
  const isInternal = expenseTag === "Internal Company Expense";

  if (!input.ticketId) {
    return { success: false, message: "Ticket is required." };
  }
  if (!isValidType(input.type)) {
    return { success: false, message: "Select a valid expense type." };
  }
  if (!isValidTag(expenseTag)) {
    return { success: false, message: "Select a valid billing option." };
  }

  const technicianId = await resolveTechnicianId(
    supabase,
    input.ticketId,
    input.technicianId,
  );

  if (isBillable && !technicianId) {
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

  let approvalStatus: string | null = isBillable ? "Pending" : null;
  let overLimitMeta: { monthlyLimit: number; mtdSpend: number } | null = null;

  if (isInternal && technicianId) {
    const budget = await ensureTechnicianExpenseBudget(supabase, technicianId);
    const mtdSpend = await sumMtdAcceptedInternalSpend(supabase, technicianId);
    const decision = decideInternalBudget({
      amount: input.amount,
      monthlyLimit: Number(budget.monthly_limit),
      mtdSpend,
    });
    if (decision.mode === "over_limit") {
      approvalStatus = "Pending";
      overLimitMeta = {
        monthlyLimit: decision.monthlyLimit,
        mtdSpend: decision.mtdSpend,
      };
    }
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
      technician_id: technicianId,
      type: input.type,
      expense_tag: expenseTag,
      amount: input.amount,
      description: input.description?.trim() || null,
      date: input.date,
      receipt_url: serializeReceiptPaths(uploadedPaths),
      approval_status: approvalStatus,
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

  if (isBillable && data && technicianId) {
    const approval = await createApprovalRequest({
      ticketId: input.ticketId,
      technicianId,
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

  if (isInternal && overLimitMeta && data && technicianId) {
    const reason = buildInternalOverLimitReason({
      type: input.type,
      amount: input.amount,
      description: input.description,
      date: input.date,
      monthlyLimit: overLimitMeta.monthlyLimit,
      mtdSpend: overLimitMeta.mtdSpend,
    });
    const approval = await createApprovalRequest({
      ticketId: input.ticketId,
      technicianId,
      ticketExpenseId: data.id,
      reason,
      totalCost: input.amount,
    });

    if (!approval.success) {
      await supabase
        .from("ticket_expenses")
        .update({ approval_status: null })
        .eq("id", data.id);
      return {
        success: false,
        message: `Expense saved, but over-limit approval failed: ${approval.message}`,
        expense: data as TicketExpense,
      };
    }

    await notifyManagersOfOverLimitExpense(
      supabase,
      `Over-limit internal expense needs approval: ${input.type} $${Number(input.amount).toFixed(2)} (MTD $${overLimitMeta.mtdSpend.toFixed(2)} / $${overLimitMeta.monthlyLimit.toFixed(2)}). Review on Work & Billing.`,
      technicianId,
    );

    message =
      "Internal expense exceeds your monthly limit — sent to management for approve/deny.";
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
  const isInternal = input.expenseTag === "Internal Company Expense";
  const wasBillable = existing.expense_tag === "Billable to Customer";
  const wasInternalOverLimitPending =
    existing.expense_tag === "Internal Company Expense" &&
    existing.approval_status === "Pending";

  const technicianId =
    (existing.technician_id as string | null) ??
    (await resolveTechnicianId(supabase, existing.ticket_id));

  if (isBillable && !technicianId) {
    return {
      success: false,
      message:
        "This expense needs a technician before it can be sent for approval.",
    };
  }

  const needsNewBillableApproval =
    isBillable &&
    existing.approval_status !== "Pending" &&
    existing.approval_status !== "Approved";

  let nextApprovalStatus: string | null = !isBillable
    ? null
    : needsNewBillableApproval
      ? "Pending"
      : existing.approval_status;

  let overLimitMeta: { monthlyLimit: number; mtdSpend: number } | null = null;

  if (isInternal && technicianId) {
    const budget = await ensureTechnicianExpenseBudget(supabase, technicianId);
    const mtdSpend = await sumMtdAcceptedInternalSpend(
      supabase,
      technicianId,
      input.expenseId,
    );
    const decision = decideInternalBudget({
      amount: input.amount,
      monthlyLimit: Number(budget.monthly_limit),
      mtdSpend,
    });
    if (decision.mode === "over_limit") {
      nextApprovalStatus = "Pending";
      overLimitMeta = {
        monthlyLimit: decision.monthlyLimit,
        mtdSpend: decision.mtdSpend,
      };
    } else {
      nextApprovalStatus = null;
    }
  }

  const { data, error } = await supabase
    .from("ticket_expenses")
    .update({
      type: input.type,
      expense_tag: input.expenseTag,
      amount: input.amount,
      description: input.description?.trim() || null,
      date: input.date,
      approval_status: nextApprovalStatus,
      technician_id: technicianId ?? existing.technician_id,
    })
    .eq("id", input.expenseId)
    .select("*")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  let message = "Expense updated.";

  if (isBillable && needsNewBillableApproval && technicianId) {
    const approval = await createApprovalRequest({
      ticketId: existing.ticket_id,
      technicianId,
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

  if (isInternal && overLimitMeta && technicianId) {
    const reason = buildInternalOverLimitReason({
      type: input.type,
      amount: input.amount,
      description: input.description,
      date: input.date,
      monthlyLimit: overLimitMeta.monthlyLimit,
      mtdSpend: overLimitMeta.mtdSpend,
    });

    const { data: pending } = await supabase
      .from("approvals")
      .select("id")
      .eq("ticket_expense_id", input.expenseId)
      .eq("status", "Pending")
      .maybeSingle();

    if (pending) {
      await supabase
        .from("approvals")
        .update({
          reason,
          total_cost: input.amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pending.id);
      message =
        "Internal expense still over monthly limit — pending approval updated.";
    } else {
      const approval = await createApprovalRequest({
        ticketId: existing.ticket_id,
        technicianId,
        ticketExpenseId: input.expenseId,
        reason,
        totalCost: input.amount,
      });
      if (!approval.success) {
        return {
          success: false,
          message: `Expense updated, but over-limit approval failed: ${approval.message}`,
          expense: data as TicketExpense,
        };
      }
      await notifyManagersOfOverLimitExpense(
        supabase,
        `Over-limit internal expense needs approval: ${input.type} $${Number(input.amount).toFixed(2)}. Review on Work & Billing.`,
        technicianId,
      );
      message =
        "Internal expense exceeds monthly limit — sent to management for approve/deny.";
    }
  } else if (
    wasInternalOverLimitPending &&
    isInternal &&
    !overLimitMeta
  ) {
    await supabase
      .from("approvals")
      .update({
        status: "Denied",
        manager_notes: "Expense revised under monthly limit; auto-accepted.",
        updated_at: new Date().toISOString(),
      })
      .eq("ticket_expense_id", input.expenseId)
      .eq("status", "Pending");
    message = "Expense updated under monthly limit and accepted.";
  } else if (
    wasInternalOverLimitPending &&
    !isInternal &&
    isBillable
  ) {
    // Billable path above handles new approval; cancel over-limit row if still pending.
    await supabase
      .from("approvals")
      .update({
        status: "Denied",
        manager_notes: "Technician changed billing to Billable to Customer.",
        updated_at: new Date().toISOString(),
      })
      .eq("ticket_expense_id", input.expenseId)
      .eq("status", "Pending")
      .like("reason", "Internal expense over monthly limit%");
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

export async function getTechnicianExpenseBudgetStatus(
  technicianId: string,
): Promise<{
  monthlyLimit: number;
  mtdSpend: number;
  remaining: number;
} | null> {
  if (!technicianId) return null;
  const supabase = await createClient();
  const budget = await ensureTechnicianExpenseBudget(supabase, technicianId);
  const mtdSpend = await sumMtdAcceptedInternalSpend(supabase, technicianId);
  const monthlyLimit = Number(budget.monthly_limit);
  return {
    monthlyLimit,
    mtdSpend,
    remaining: Math.max(0, Math.round((monthlyLimit - mtdSpend) * 100) / 100),
  };
}

export async function updateTechnicianExpenseBudget(
  technicianId: string,
  monthlyLimit: number,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isManagerRole(profile?.role)) {
    return {
      success: false,
      message: "Only managers can update expense budgets.",
    };
  }
  if (!Number.isFinite(monthlyLimit) || monthlyLimit < 0) {
    return { success: false, message: "Monthly limit must be zero or greater." };
  }

  const { error } = await supabase.from("technician_expense_budgets").upsert({
    technician_id: technicianId,
    monthly_limit: monthlyLimit,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateExpensePaths();
  return { success: true, message: "Expense budget updated." };
}

export async function listTechnicianExpenseBudgets(): Promise<
  TechnicianExpenseBudget[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("technician_expense_budgets")
    .select("*");

  if (error) {
    console.warn("listTechnicianExpenseBudgets:", error.message);
    return [];
  }

  return (data ?? []) as TechnicianExpenseBudget[];
}
