"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";
import {
  computeLateFeeAmount,
  invoiceSubtotal,
} from "@/lib/plan-pricing";

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) || num < 0 ? null : num;
}

/**
 * Recompute late fees on open invoices from their contract terms.
 * Fee = subtotal × percent × floor(daysPastDue / periodDays).
 */
export async function syncLateFees(): Promise<
  ActionResult & { updated?: number }
> {
  const supabase = await createClient();

  const { data: invoices, error: invoiceError } = await supabase
    .from("invoices")
    .select("*")
    .in("status", ["Issued", "Partially Paid", "Past Due", "Unpaid"]);

  if (invoiceError) {
    return { success: false, message: invoiceError.message };
  }

  const openInvoices = (invoices ?? []).filter(
    (invoice) =>
      (invoice.remaining_balance ?? 0) > 0 || (invoice.late_fee_amount ?? 0) > 0,
  );

  if (openInvoices.length === 0) {
    return {
      success: true,
      message: "No invoices needed late-fee updates.",
      updated: 0,
    };
  }

  const contractIds = [
    ...new Set(
      openInvoices
        .map((invoice) => invoice.contract_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: contracts, error: contractError } = await supabase
    .from("contracts")
    .select("id, late_fee_percent, late_fee_period_days")
    .in("id", contractIds);

  if (contractError) {
    return { success: false, message: contractError.message };
  }

  const contractMap = new Map(
    (contracts ?? []).map((contract) => [contract.id, contract]),
  );

  const now = new Date();
  let updated = 0;

  for (const invoice of openInvoices) {
    if (!invoice.contract_id) continue;
    const contract = contractMap.get(invoice.contract_id);
    if (!contract) continue;

    const subtotal = invoiceSubtotal(invoice);
    const lateFee = computeLateFeeAmount({
      dueDate: invoice.due_date,
      subtotal,
      percent: contract.late_fee_percent,
      periodDays: contract.late_fee_period_days,
      now,
    });

    const totalAmount = Math.round((subtotal + lateFee) * 100) / 100;
    const amountPaid = Number(invoice.amount_paid ?? 0);
    const remaining = Math.max(
      0,
      Math.round((totalAmount - amountPaid) * 100) / 100,
    );

    let status = String(invoice.status ?? "Issued");
    if (remaining <= 0 && amountPaid > 0) {
      status = "Paid";
    } else if (
      lateFee > 0 ||
      (invoice.due_date && new Date(invoice.due_date) < now)
    ) {
      if (amountPaid > 0 && remaining > 0) {
        status = "Partially Paid";
      } else if (
        invoice.due_date &&
        new Date(invoice.due_date) < now &&
        remaining > 0
      ) {
        status = "Past Due";
      }
    }

    const currentLate = Number(invoice.late_fee_amount ?? 0);
    const currentTotal = Number(invoice.total_amount ?? 0);
    const currentRemaining = Number(invoice.remaining_balance ?? 0);
    if (
      Math.abs(currentLate - lateFee) < 0.005 &&
      Math.abs(currentTotal - totalAmount) < 0.005 &&
      Math.abs(currentRemaining - remaining) < 0.005 &&
      status === invoice.status
    ) {
      continue;
    }

    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        late_fee_amount: lateFee,
        total_amount: totalAmount,
        remaining_balance: remaining,
        status,
      })
      .eq("id", invoice.id);

    if (!updateError) {
      updated += 1;
    }
  }

  if (updated > 0) {
    revalidatePath("/billing");
    revalidatePath("/portal");
    revalidatePath("/end-user/billing");
    revalidatePath("/operations");
    revalidatePath("/reports");
  }

  return {
    success: true,
    message:
      updated > 0
        ? `Applied late fees on ${updated} invoice${updated === 1 ? "" : "s"}.`
        : "Late fees already up to date.",
    updated,
  };
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
  const additional =
    parseNumber(formData.get("additional_support_charges")) ?? 0;
  const software = parseNumber(formData.get("software_charges")) ?? 0;
  const equipment = parseNumber(formData.get("equipment_charges")) ?? 0;
  const other = parseNumber(formData.get("other_charges")) ?? 0;
  const subtotal = recurring + additional + software + equipment + other;

  if (subtotal < 0) {
    return { success: false, message: "Invoice total cannot be negative." };
  }

  const dueDate = String(formData.get("due_date") ?? "").trim() || null;
  const { data: contract } = await supabase
    .from("contracts")
    .select("late_fee_percent, late_fee_period_days")
    .eq("id", contractId)
    .maybeSingle();

  const lateFee = computeLateFeeAmount({
    dueDate,
    subtotal,
    percent: contract?.late_fee_percent,
    periodDays: contract?.late_fee_period_days,
  });
  const totalAmount = Math.round((subtotal + lateFee) * 100) / 100;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let status = String(formData.get("status") ?? "Draft").trim();
  if (
    status !== "Draft" &&
    status !== "Pending Approval" &&
    dueDate &&
    new Date(dueDate) < new Date() &&
    totalAmount > 0
  ) {
    status = "Past Due";
  }

  const { error } = await supabase.from("invoices").insert({
    invoice_number: invoiceNumber,
    customer_id: customerId,
    contract_id: contractId,
    invoice_date: String(formData.get("invoice_date") ?? "").trim() || null,
    due_date: dueDate,
    recurring_service_fee: recurring,
    additional_support_charges: additional,
    software_charges: software,
    equipment_charges: equipment,
    other_charges: other,
    late_fee_amount: lateFee,
    total_amount: totalAmount,
    amount_paid: 0,
    remaining_balance: totalAmount,
    status,
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
    return {
      success: false,
      message: "Invoice and a positive payment amount are required.",
    };
  }

  // Refresh late fees before accepting payment so balance is current.
  await syncLateFees();

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
    const due = invoice.due_date ? new Date(invoice.due_date) : null;
    status = due && due < new Date() ? "Past Due" : "Partially Paid";
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
  revalidatePath("/end-user/billing");
  return { success: true, message: "Payment recorded successfully." };
}

/**
 * Create Draft invoices from selected billable work entries,
 * grouped by customer + contract, and link those entries as Billed.
 */
export async function createInvoicesFromWorkEntries(
  entryIds: string[],
): Promise<ActionResult> {
  if (entryIds.length === 0) {
    return { success: false, message: "Select at least one work entry." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: entries, error: loadError } = await supabase
    .from("work_entries")
    .select("*")
    .in("id", entryIds);

  if (loadError) {
    return { success: false, message: loadError.message };
  }
  if (!entries?.length) {
    return { success: false, message: "No matching work entries found." };
  }

  const ineligible = entries.filter(
    (e) =>
      e.included_in_contract ||
      e.approval_status !== "Approved" ||
      e.billing_status === "Billed" ||
      !e.customer_id ||
      !e.contract_id,
  );

  if (ineligible.length > 0) {
    return {
      success: false,
      message:
        "Every selected entry must be Approved, billable (not included), not already billed, and linked to a contract.",
    };
  }

  const contractIds = Array.from(
    new Set(entries.map((e) => e.contract_id).filter(Boolean)),
  ) as string[];

  const { data: contracts, error: contractError } = await supabase
    .from("contracts")
    .select("id, additional_hourly_rate, invoice_due_days, customer_id")
    .in("id", contractIds);

  if (contractError) {
    return { success: false, message: contractError.message };
  }

  const contractMap = new Map((contracts ?? []).map((c) => [c.id, c]));

  type Group = {
    customerId: string;
    contractId: string;
    entryIds: string[];
    additional: number;
    software: number;
    equipment: number;
    other: number;
    dueDays: number;
  };

  const groups = new Map<string, Group>();

  for (const entry of entries) {
    const contractId = entry.contract_id as string;
    const customerId = entry.customer_id as string;
    const contract = contractMap.get(contractId);
    if (!contract) {
      return {
        success: false,
        message: "One or more entries reference a missing contract.",
      };
    }

    const key = `${customerId}::${contractId}`;
    const existing = groups.get(key) ?? {
      customerId,
      contractId,
      entryIds: [] as string[],
      additional: 0,
      software: 0,
      equipment: 0,
      other: 0,
      dueDays: contract.invoice_due_days ?? 30,
    };

    const hours = Number(entry.hours_worked ?? 0);
    const rate = Number(contract.additional_hourly_rate ?? 0);
    existing.additional += hours * rate;
    existing.software += Number(entry.software_cost ?? 0);
    existing.equipment += Number(entry.equipment_cost ?? 0);
    existing.other +=
      Number(entry.parts_cost ?? 0) +
      Number(entry.travel_cost ?? 0) +
      Number(entry.other_cost ?? 0);
    existing.entryIds.push(entry.id);
    groups.set(key, existing);
  }

  const today = new Date();
  const invoiceDate = today.toISOString().slice(0, 10);
  let created = 0;

  for (const group of groups.values()) {
    const total =
      group.additional + group.software + group.equipment + group.other;

    if (total <= 0) {
      return {
        success: false,
        message:
          "Selected work does not produce a billable amount (check hours and contract overage rates).",
      };
    }

    const due = new Date(today);
    due.setDate(due.getDate() + (group.dueDays || 30));
    const dueDate = due.toISOString().slice(0, 10);

    const stamp = Date.now().toString(36).toUpperCase();
    const suffix = Math.floor(Math.random() * 900 + 100);
    const invoiceNumber = `INV-WB-${stamp}-${suffix}`;

    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        customer_id: group.customerId,
        contract_id: group.contractId,
        invoice_date: invoiceDate,
        due_date: dueDate,
        recurring_service_fee: 0,
        additional_support_charges: roundMoney(group.additional),
        software_charges: roundMoney(group.software),
        equipment_charges: roundMoney(group.equipment),
        other_charges: roundMoney(group.other),
        total_amount: roundMoney(total),
        amount_paid: 0,
        remaining_balance: roundMoney(total),
        status: "Draft",
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (insertError || !invoice) {
      return {
        success: false,
        message: insertError?.message ?? "Failed to create invoice.",
      };
    }

    const { error: linkError } = await supabase
      .from("work_entries")
      .update({
        approval_status: "Approved",
        billing_status: "Billed",
        invoice_id: invoice.id,
      })
      .in("id", group.entryIds);

    if (linkError) {
      return { success: false, message: linkError.message };
    }

    created += 1;
  }

  revalidatePath("/billing");
  revalidatePath("/time-costs");
  revalidatePath("/operations");
  revalidatePath("/reports");
  revalidatePath("/portal");
  revalidatePath("/technician");

  return {
    success: true,
    message: `Created ${created} draft invoice${created === 1 ? "" : "s"} in Billing from ${entryIds.length} work entr${entryIds.length === 1 ? "y" : "ies"}.`,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
