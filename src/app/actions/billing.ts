"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) || num < 0 ? null : num;
}

export async function createInvoice(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const contractId = String(formData.get("contract_id") ?? "").trim();
  const invoiceNumber = String(formData.get("invoice_number") ?? "").trim();

  if (!customerId || !contractId) {
    return {
      success: false,
      message: "Customer and contract are required before creating an invoice.",
    };
  }

  if (!invoiceNumber) {
    return { success: false, message: "Invoice number is required." };
  }

  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("invoice_number", invoiceNumber)
    .maybeSingle();

  if (existing) {
    return { success: false, message: "That invoice number is already in use." };
  }

  const recurring = parseNumber(formData.get("recurring_service_fee")) ?? 0;
  const additional = parseNumber(formData.get("additional_support_charges")) ?? 0;
  const software = parseNumber(formData.get("software_charges")) ?? 0;
  const equipment = parseNumber(formData.get("equipment_charges")) ?? 0;
  const other = parseNumber(formData.get("other_charges")) ?? 0;
  const totalAmount = recurring + additional + software + equipment + other;

  if (totalAmount < 0) {
    return { success: false, message: "Invoice total cannot be negative." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("invoices").insert({
    invoice_number: invoiceNumber,
    customer_id: customerId,
    contract_id: contractId,
    invoice_date: String(formData.get("invoice_date") ?? "").trim() || null,
    due_date: String(formData.get("due_date") ?? "").trim() || null,
    recurring_service_fee: recurring,
    additional_support_charges: additional,
    software_charges: software,
    equipment_charges: equipment,
    other_charges: other,
    total_amount: totalAmount,
    amount_paid: 0,
    remaining_balance: totalAmount,
    status: String(formData.get("status") ?? "Draft").trim(),
    created_by: user?.id ?? null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/billing");
  revalidatePath("/portal");
  revalidatePath("/operations");
  revalidatePath("/reports");
  return { success: true, message: "Invoice created successfully." };
}

export async function recordPayment(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const invoiceId = String(formData.get("invoice_id") ?? "").trim();
  const paymentAmount = parseNumber(formData.get("payment_amount"));

  if (!invoiceId || paymentAmount == null || paymentAmount <= 0) {
    return { success: false, message: "Invoice and a positive payment amount are required." };
  }

  const { data: invoice, error: fetchError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (fetchError || !invoice) {
    return { success: false, message: "Invoice not found." };
  }

  const remaining = Number(invoice.remaining_balance ?? 0);
  if (paymentAmount > remaining) {
    return {
      success: false,
      message: `Payment cannot exceed the remaining balance of ${remaining.toFixed(2)}.`,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: paymentError } = await supabase.from("payments").insert({
    invoice_id: invoiceId,
    customer_id: invoice.customer_id,
    payment_date: String(formData.get("payment_date") ?? "").trim() || null,
    payment_amount: paymentAmount,
    payment_method: String(formData.get("payment_method") ?? "").trim() || null,
    reference_number:
      String(formData.get("reference_number") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    created_by: user?.id ?? null,
  });

  if (paymentError) {
    return { success: false, message: paymentError.message };
  }

  const newPaid = Number(invoice.amount_paid ?? 0) + paymentAmount;
  const newRemaining = Number(invoice.total_amount ?? 0) - newPaid;
  let status = invoice.status;

  if (newRemaining <= 0) {
    status = "Paid";
  } else if (newPaid > 0) {
    status = "Partially Paid";
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      amount_paid: newPaid,
      remaining_balance: Math.max(0, newRemaining),
      status,
    })
    .eq("id", invoiceId);

  if (updateError) {
    return { success: false, message: updateError.message };
  }

  revalidatePath("/billing");
  revalidatePath("/portal");
  return { success: true, message: "Payment recorded successfully." };
}
