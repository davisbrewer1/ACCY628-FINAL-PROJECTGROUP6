"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/customers";
import { createClient } from "@/lib/supabase/server";

function isCardPaymentMethod(method: string): boolean {
  const value = method.trim().toLowerCase();
  return value === "card" || value === "credit card";
}

export async function recordClientPortalPayment(input: {
  invoiceId: string;
  amount: number;
  paymentMethod?: string;
  referenceNumber?: string;
  notes?: string;
  cardholderName?: string;
  cardNumber?: string;
  cardExp?: string;
  cardCvv?: string;
  billingZip?: string;
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
  const paymentMethod =
    String(input.paymentMethod ?? "").trim() || "Credit Card";
  let referenceNumber = String(input.referenceNumber ?? "").trim();
  let notes = String(input.notes ?? "").trim();

  if (!invoiceId) {
    return { success: false, message: "Invoice is required." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      success: false,
      message: "Enter a valid payment amount greater than zero.",
    };
  }

  if (isCardPaymentMethod(paymentMethod)) {
    const cardholder = String(input.cardholderName ?? "").trim();
    const cardNumber = String(input.cardNumber ?? "").replace(/\s+/g, "");
    const cardExp = String(input.cardExp ?? "").trim();
    const cardCvv = String(input.cardCvv ?? "").trim();
    const billingZip = String(input.billingZip ?? "").trim();

    if (!cardholder) {
      return { success: false, message: "Cardholder name is required." };
    }
    if (!/^\d{13,19}$/.test(cardNumber)) {
      return {
        success: false,
        message: "Enter a valid card number (13–19 digits).",
      };
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExp)) {
      return {
        success: false,
        message: "Enter a valid expiration date as MM/YY.",
      };
    }
    if (!/^\d{3,4}$/.test(cardCvv)) {
      return { success: false, message: "Enter a valid CVV (3–4 digits)." };
    }
    if (!billingZip) {
      return {
        success: false,
        message: "Billing ZIP is required for card payments.",
      };
    }

    const last4 = cardNumber.slice(-4);
    referenceNumber = referenceNumber || `CARD-****${last4}`;
    const cardNote = `Simulated card payment · ${cardholder} · exp ${cardExp} · ZIP ${billingZip}`;
    notes = notes ? `${notes}\n${cardNote}` : cardNote;
  }

  if (!referenceNumber) {
    referenceNumber = `PORTAL-${Date.now().toString().slice(-8)}`;
  }
  if (!notes) {
    notes = "Simulated payment submitted from the client billing portal.";
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
