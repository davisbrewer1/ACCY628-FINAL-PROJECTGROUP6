"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/customers";
import { createClient } from "@/lib/supabase/server";

export async function recordClientPortalPayment(input: {
  invoiceId: string;
  amount: number;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const invoiceId = String(input.invoiceId ?? "").trim();
  const amount = Number(input.amount);
  const paymentMethod = String(input.paymentMethod ?? "").trim() || "Credit Card";
  const referenceNumber =
    String(input.referenceNumber ?? "").trim() ||
    `PORTAL-${Date.now().toString().slice(-8)}`;
  const notes =
    String(input.notes ?? "").trim() ||
    "Simulated payment submitted from the client billing portal.";

  if (!invoiceId) {
    return { success: false, message: "Invoice is required." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, message: "Enter a valid payment amount greater than zero." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("customer_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.customer_id && profile?.role !== "administrator") {
    return {
      success: false,
      message: "Your account is not linked to a customer organization.",
    };
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, customer_id, remaining_balance, invoice_number")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError) {
    return { success: false, message: invoiceError.message };
  }
  if (!invoice) {
    return { success: false, message: "Invoice not found." };
  }
  if (
    profile.customer_id &&
    invoice.customer_id !== profile.customer_id &&
    profile.role !== "administrator"
  ) {
    return {
      success: false,
      message: "You can only pay invoices for your organization.",
    };
  }

  const remaining = Number(invoice.remaining_balance ?? 0);
  if (remaining <= 0) {
    return { success: false, message: "This invoice is already paid in full." };
  }
  if (amount > remaining + 0.0001) {
    return {
      success: false,
      message: `Payment cannot exceed the remaining balance of ${remaining.toFixed(2)}.`,
    };
  }

  const { error } = await supabase.rpc("client_record_invoice_payment", {
    p_invoice_id: invoiceId,
    p_amount: Math.round(amount * 100) / 100,
    p_method: paymentMethod,
    p_reference: referenceNumber,
    p_notes: notes,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/end-user/billing");
  revalidatePath(`/end-user/billing/${invoiceId}`);
  revalidatePath("/end-user");
  return {
    success: true,
    message: `Payment of $${amount.toFixed(2)} recorded for ${invoice.invoice_number}.`,
  };
}
