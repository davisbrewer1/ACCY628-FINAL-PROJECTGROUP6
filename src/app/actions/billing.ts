"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/customers";
import {
  allocateOverageHours,
  computeLateFeeAmount,
  expectedPlanPeriods,
  invoiceSubtotal,
} from "@/lib/plan-pricing";
import { pickPrimaryActiveContract } from "@/lib/customer-access";
import { computeContractAssetBurns } from "@/lib/manager-ops";
import { createClient } from "@/lib/supabase/server";
import type {
  Contract,
  HardwareAsset,
  ServicePlan,
  TicketExpense,
  WorkEntry,
} from "@/lib/types";

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) || num < 0 ? null : num;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function revalidateBillingPaths() {
  revalidatePath("/billing");
  revalidatePath("/portal");
  revalidatePath("/end-user/billing");
  revalidatePath("/operations");
  revalidatePath("/reports");
  revalidatePath("/time-costs");
  revalidatePath("/contracts");
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
    revalidateBillingPaths();
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

/**
 * Create missing cash-cadence plan invoices for Active contracts
 * (monthly / yearly / up-front). Idempotent via (contract, source, period).
 */
export async function syncPlanInvoices(): Promise<
  ActionResult & { created?: number }
> {
  const supabase = await createClient();
  const now = new Date();

  const { data: contracts, error: contractError } = await supabase
    .from("contracts")
    .select(
      "id, customer_id, contract_status, approval_status, start_date, end_date, monthly_recurring_fee, setup_fee, billing_frequency, invoice_due_days, plan_id",
    )
    .eq("contract_status", "Active");

  if (contractError) {
    return { success: false, message: contractError.message };
  }

  const active = (contracts ?? []).filter(
    (c) => !c.approval_status || c.approval_status === "Approved",
  ) as Contract[];

  if (active.length === 0) {
    return {
      success: true,
      message: "No active contracts for plan invoicing.",
      created: 0,
    };
  }

  const planIds = [
    ...new Set(active.map((c) => c.plan_id).filter((id): id is string => Boolean(id))),
  ];

  const planMap = new Map<string, ServicePlan>();
  if (planIds.length > 0) {
    const { data: plans } = await supabase
      .from("service_plans")
      .select("id, pricing_model, base_price")
      .in("id", planIds);
    for (const plan of plans ?? []) {
      planMap.set(plan.id, plan as ServicePlan);
    }
  }

  const contractIds = active.map((c) => c.id);
  const { data: existing } = await supabase
    .from("invoices")
    .select("contract_id, billing_period")
    .eq("invoice_source", "plan_recurring")
    .in("contract_id", contractIds);

  const existingKeys = new Set(
    (existing ?? [])
      .filter((row) => row.contract_id && row.billing_period)
      .map((row) => `${row.contract_id}::${row.billing_period}`),
  );

  let created = 0;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  for (const contract of active) {
    const plan = contract.plan_id ? planMap.get(contract.plan_id) : null;
    const periods = expectedPlanPeriods(contract, now, plan ?? null);

    for (const period of periods) {
      if (period.amount <= 0) continue;
      const key = `${contract.id}::${period.period}`;
      if (existingKeys.has(key)) continue;

      const stamp = Date.now().toString(36).toUpperCase();
      const suffix = Math.floor(Math.random() * 900 + 100);
      const invoiceNumber = `INV-PLAN-${period.period}-${stamp}-${suffix}`.slice(
        0,
        64,
      );

      const due = new Date(period.dueDate);
      let status = "Issued";
      if (due < now) status = "Past Due";

      const { error: insertError } = await supabase.from("invoices").insert({
        invoice_number: invoiceNumber,
        customer_id: contract.customer_id,
        contract_id: contract.id,
        invoice_date: period.invoiceDate,
        due_date: period.dueDate,
        recurring_service_fee: roundMoney(period.amount),
        additional_support_charges: 0,
        software_charges: 0,
        equipment_charges: 0,
        other_charges: 0,
        late_fee_amount: 0,
        total_amount: roundMoney(period.amount),
        amount_paid: 0,
        remaining_balance: roundMoney(period.amount),
        status,
        invoice_source: "plan_recurring",
        billing_period: period.period,
        created_by: user?.id ?? null,
      });

      if (!insertError) {
        existingKeys.add(key);
        created += 1;
      }
    }
  }

  if (created > 0) {
    revalidateBillingPaths();
  }

  return {
    success: true,
    message:
      created > 0
        ? `Generated ${created} plan invoice${created === 1 ? "" : "s"} from contract cadence.`
        : "Plan invoices already up to date.",
    created,
  };
}

/**
 * Ensure one open asset-overage invoice per Active contract that is over budget.
 * Updates the open invoice in place when the overage estimate changes.
 */
export async function syncAssetOverageInvoices(): Promise<
  ActionResult & { created?: number; updated?: number }
> {
  const supabase = await createClient();

  const { data: contracts, error: contractError } = await supabase
    .from("contracts")
    .select(
      "id, customer_id, contract_status, start_date, end_date, included_asset_budget, additional_asset_rate, invoice_due_days",
    )
    .eq("contract_status", "Active");

  if (contractError) {
    return { success: false, message: contractError.message };
  }

  const active = (contracts ?? []) as Contract[];
  if (active.length === 0) {
    return {
      success: true,
      message: "No active contracts for asset overage sync.",
      created: 0,
      updated: 0,
    };
  }

  const [{ data: assets }, { data: workEntries }] = await Promise.all([
    supabase.from("hardware_assets").select("*"),
    supabase.from("work_entries").select("*"),
  ]);
  const burns = computeContractAssetBurns(
    active,
    (assets ?? []) as HardwareAsset[],
    (workEntries ?? []) as WorkEntry[],
  );
  const overBurns = burns.filter((b) => b.isOver && b.overageEstimate > 0);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let created = 0;
  let updated = 0;
  const today = new Date();
  const invoiceDate = today.toISOString().slice(0, 10);

  for (const burn of overBurns) {
    const contract = active.find((c) => c.id === burn.contractId);
    if (!contract) continue;

    const billingPeriod = `term:${contract.start_date ?? "open"}:${contract.end_date ?? "open"}`;
    const amount = roundMoney(burn.overageEstimate);

    const { data: existing } = await supabase
      .from("invoices")
      .select("*")
      .eq("contract_id", contract.id)
      .eq("invoice_source", "asset_overage")
      .eq("billing_period", billingPeriod)
      .maybeSingle();

    if (existing) {
      if (existing.status === "Paid" || existing.status === "Canceled") {
        continue;
      }
      const amountPaid = Number(existing.amount_paid ?? 0);
      const lateFee = Number(existing.late_fee_amount ?? 0);
      const totalAmount = roundMoney(amount + lateFee);
      const remaining = Math.max(0, roundMoney(totalAmount - amountPaid));
      if (
        Math.abs(Number(existing.equipment_charges ?? 0) - amount) < 0.005 &&
        Math.abs(Number(existing.total_amount ?? 0) - totalAmount) < 0.005
      ) {
        continue;
      }

      let status = String(existing.status ?? "Issued");
      if (remaining <= 0 && amountPaid > 0) status = "Paid";
      else if (amountPaid > 0) status = "Partially Paid";
      else if (existing.due_date && new Date(existing.due_date) < today) {
        status = "Past Due";
      } else {
        status = "Issued";
      }

      const { error } = await supabase
        .from("invoices")
        .update({
          equipment_charges: amount,
          total_amount: totalAmount,
          remaining_balance: remaining,
          status,
        })
        .eq("id", existing.id);

      if (!error) updated += 1;
      continue;
    }

    const dueDays = Number(contract.invoice_due_days ?? 30) || 30;
    const due = new Date(today);
    due.setDate(due.getDate() + dueDays);
    const stamp = Date.now().toString(36).toUpperCase();
    const suffix = Math.floor(Math.random() * 900 + 100);

    const { error: insertError } = await supabase.from("invoices").insert({
      invoice_number: `INV-ASSET-${stamp}-${suffix}`,
      customer_id: contract.customer_id,
      contract_id: contract.id,
      invoice_date: invoiceDate,
      due_date: due.toISOString().slice(0, 10),
      recurring_service_fee: 0,
      additional_support_charges: 0,
      software_charges: 0,
      equipment_charges: amount,
      other_charges: 0,
      late_fee_amount: 0,
      total_amount: amount,
      amount_paid: 0,
      remaining_balance: amount,
      status: "Issued",
      invoice_source: "asset_overage",
      billing_period: billingPeriod,
      created_by: user?.id ?? null,
    });

    if (!insertError) created += 1;
  }

  if (created > 0 || updated > 0) {
    revalidateBillingPaths();
  }

  return {
    success: true,
    message:
      created + updated > 0
        ? `Asset overage sync: ${created} created, ${updated} updated.`
        : "Asset overage invoices already up to date.",
    created,
    updated,
  };
}

/** Run plan cadence, asset overage, and late-fee sync (Billing page load). */
export async function syncBillingCadence(): Promise<
  ActionResult & {
    planCreated?: number;
    assetCreated?: number;
    assetUpdated?: number;
    lateUpdated?: number;
  }
> {
  const plan = await syncPlanInvoices();
  if (!plan.success) return plan;

  const asset = await syncAssetOverageInvoices();
  if (!asset.success) return asset;

  const late = await syncLateFees();
  if (!late.success) return late;

  const planCreated = plan.created ?? 0;
  const assetCreated = asset.created ?? 0;
  const assetUpdated = asset.updated ?? 0;
  const lateUpdated = late.updated ?? 0;
  const total = planCreated + assetCreated + assetUpdated + lateUpdated;

  return {
    success: true,
    message:
      total > 0
        ? `Billing sync: ${planCreated} plan invoice(s), ${assetCreated + assetUpdated} asset overage change(s), ${lateUpdated} late-fee update(s).`
        : "Billing already up to date.",
    planCreated,
    assetCreated,
    assetUpdated,
    lateUpdated,
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
    invoice_source: "manual",
    billing_period: null,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateBillingPaths();
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
 * Create Draft invoices from selected work entries (pool-based hours).
 * In-pool support hours are $0; overage hours × rate + pass-through expenses bill.
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
      e.approval_status !== "Approved" ||
      e.billing_status === "Billed" ||
      !e.customer_id ||
      !e.contract_id,
  );

  if (ineligible.length > 0) {
    return {
      success: false,
      message:
        "Every selected entry must be Approved, not already billed, and linked to a contract. Hours inside the plan pool are not charged; expenses still bill.",
    };
  }

  const contractIds = Array.from(
    new Set(entries.map((e) => e.contract_id).filter(Boolean)),
  ) as string[];

  const { data: contracts, error: contractError } = await supabase
    .from("contracts")
    .select(
      "id, additional_hourly_rate, included_support_hours, invoice_due_days, customer_id",
    )
    .in("id", contractIds);

  if (contractError) {
    return { success: false, message: contractError.message };
  }

  const contractMap = new Map((contracts ?? []).map((c) => [c.id, c]));

  // Prior billed hours by contract+month so pool allocation is chronological.
  const months = [
    ...new Set(
      entries
        .map((e) => (e.work_date ? String(e.work_date).slice(0, 7) : null))
        .filter((m): m is string => Boolean(m)),
    ),
  ];

  const priorByContractMonth = new Map<string, number>();
  if (months.length > 0) {
    const { data: priorEntries } = await supabase
      .from("work_entries")
      .select("id, contract_id, work_date, hours_worked, billing_status")
      .in("contract_id", contractIds)
      .eq("billing_status", "Billed");

    for (const prior of priorEntries ?? []) {
      if (!prior.contract_id || !prior.work_date) continue;
      if (entryIds.includes(prior.id)) continue;
      const month = String(prior.work_date).slice(0, 7);
      if (!months.includes(month)) continue;
      const key = `${prior.contract_id}::${month}`;
      priorByContractMonth.set(
        key,
        (priorByContractMonth.get(key) ?? 0) + Number(prior.hours_worked ?? 0),
      );
    }
  }

  type Group = {
    customerId: string;
    contractId: string;
    entryIds: string[];
    entries: typeof entries;
    dueDays: number;
    includedHours: number;
    rate: number;
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
      entries: [] as typeof entries,
      dueDays: contract.invoice_due_days ?? 30,
      includedHours: Number(contract.included_support_hours ?? 0),
      rate: Number(contract.additional_hourly_rate ?? 0),
    };
    existing.entryIds.push(entry.id);
    existing.entries.push(entry);
    groups.set(key, existing);
  }

  const today = new Date();
  const invoiceDate = today.toISOString().slice(0, 10);
  let created = 0;
  let coveredOnly = 0;

  for (const group of groups.values()) {
    const priorHoursByMonth: Record<string, number> = {};
    for (const [key, hours] of priorByContractMonth) {
      if (!key.startsWith(`${group.contractId}::`)) continue;
      const month = key.slice(group.contractId.length + 2);
      priorHoursByMonth[month] = hours;
    }

    const overageById = allocateOverageHours({
      selected: group.entries,
      includedHoursPerMonth: group.includedHours,
      priorHoursByMonth,
    });

    let additional = 0;
    let software = 0;
    let equipment = 0;
    let other = 0;

    for (const entry of group.entries) {
      const overageHours = overageById.get(entry.id) ?? 0;
      additional += overageHours * group.rate;
      software += Number(entry.software_cost ?? 0);
      equipment += Number(entry.equipment_cost ?? 0);
      other +=
        Number(entry.parts_cost ?? 0) +
        Number(entry.travel_cost ?? 0) +
        Number(entry.other_cost ?? 0);
    }

    const total = additional + software + equipment + other;

    if (total <= 0) {
      const { error: linkError } = await supabase
        .from("work_entries")
        .update({
          approval_status: "Approved",
          billing_status: "Billed",
          invoice_id: null,
        })
        .in("id", group.entryIds);

      if (linkError) {
        return { success: false, message: linkError.message };
      }
      coveredOnly += group.entryIds.length;
      continue;
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
        additional_support_charges: roundMoney(additional),
        software_charges: roundMoney(software),
        equipment_charges: roundMoney(equipment),
        other_charges: roundMoney(other),
        late_fee_amount: 0,
        total_amount: roundMoney(total),
        amount_paid: 0,
        remaining_balance: roundMoney(total),
        status: "Draft",
        invoice_source: "work_entries",
        billing_period: null,
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

  revalidateBillingPaths();
  revalidatePath("/technician");

  const parts: string[] = [];
  if (created > 0) {
    parts.push(
      `Created ${created} draft invoice${created === 1 ? "" : "s"} from work entries (pool hours excluded; expenses and overages billed)`,
    );
  }
  if (coveredOnly > 0) {
    parts.push(
      `marked ${coveredOnly} entr${coveredOnly === 1 ? "y" : "ies"} billed with no charge (covered by plan pool, no expenses)`,
    );
  }

  return {
    success: true,
    message:
      parts.length > 0
        ? `${parts.join("; ")}.`
        : "No billable amounts from selected work.",
  };
}

/**
 * Draft invoices from Expense Tracker rows that are Billable to Customer,
 * manager-Approved, and not yet linked to an invoice.
 */
export async function createInvoicesFromApprovedExpenses(
  expenseIds?: string[],
): Promise<ActionResult & { created?: number; billedExpenseCount?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("ticket_expenses")
    .select("*")
    .eq("expense_tag", "Billable to Customer")
    .eq("approval_status", "Approved")
    .is("invoice_id", null)
    .gt("amount", 0);

  if (expenseIds && expenseIds.length > 0) {
    query = query.in("id", expenseIds);
  }

  const { data: expenses, error: loadError } = await query;
  if (loadError) {
    return { success: false, message: loadError.message };
  }

  const rows = (expenses as TicketExpense[]) ?? [];
  if (rows.length === 0) {
    return {
      success: true,
      message: "No approved billable expenses ready to invoice.",
      created: 0,
      billedExpenseCount: 0,
    };
  }

  const ticketIds = Array.from(new Set(rows.map((e) => e.ticket_id)));
  const { data: tickets, error: ticketError } = await supabase
    .from("service_tickets")
    .select("id, customer_id, contract_id, ticket_number")
    .in("id", ticketIds);

  if (ticketError) {
    return { success: false, message: ticketError.message };
  }

  const ticketMap = new Map((tickets ?? []).map((t) => [t.id, t]));
  const customerIds = Array.from(
    new Set(
      (tickets ?? [])
        .map((t) => t.customer_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const { data: contracts } = await supabase
    .from("contracts")
    .select("*")
    .in("customer_id", customerIds.length > 0 ? customerIds : ["00000000-0000-0000-0000-000000000000"]);

  const contractsByCustomer = new Map<string, Contract[]>();
  for (const c of (contracts as Contract[]) ?? []) {
    const list = contractsByCustomer.get(c.customer_id) ?? [];
    list.push(c);
    contractsByCustomer.set(c.customer_id, list);
  }

  type ExpenseGroup = {
    customerId: string;
    contractId: string | null;
    dueDays: number;
    expenseIds: string[];
    total: number;
  };

  const groups = new Map<string, ExpenseGroup>();
  const skipped: string[] = [];

  for (const expense of rows) {
    const ticket = ticketMap.get(expense.ticket_id);
    if (!ticket?.customer_id) {
      skipped.push(expense.id);
      continue;
    }

    const customerContracts = contractsByCustomer.get(ticket.customer_id) ?? [];
    let contractId = ticket.contract_id ?? null;
    let dueDays = 30;
    if (contractId) {
      const linked = customerContracts.find((c) => c.id === contractId);
      dueDays = Number(linked?.invoice_due_days ?? 30) || 30;
    } else {
      const primary = pickPrimaryActiveContract(customerContracts);
      contractId = primary?.id ?? null;
      dueDays = Number(primary?.invoice_due_days ?? 30) || 30;
    }

    const key = `${ticket.customer_id}::${contractId ?? "none"}`;
    const existing = groups.get(key);
    const amount = Number(expense.amount ?? 0);
    if (existing) {
      existing.expenseIds.push(expense.id);
      existing.total += amount;
    } else {
      groups.set(key, {
        customerId: ticket.customer_id,
        contractId,
        dueDays,
        expenseIds: [expense.id],
        total: amount,
      });
    }
  }

  if (groups.size === 0) {
    return {
      success: false,
      message:
        "Approved expenses need a ticket linked to a customer before they can invoice.",
    };
  }

  const today = new Date();
  const invoiceDate = today.toISOString().slice(0, 10);
  let created = 0;
  let billedExpenseCount = 0;

  for (const group of groups.values()) {
    const amount = roundMoney(group.total);
    if (amount <= 0) continue;

    const due = new Date(today);
    due.setDate(due.getDate() + (group.dueDays || 30));
    const dueDate = due.toISOString().slice(0, 10);

    const stamp = Date.now().toString(36).toUpperCase();
    const suffix = Math.floor(Math.random() * 900 + 100);
    const invoiceNumber = `INV-EX-${stamp}-${suffix}`;

    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        customer_id: group.customerId,
        contract_id: group.contractId,
        invoice_date: invoiceDate,
        due_date: dueDate,
        recurring_service_fee: 0,
        additional_support_charges: 0,
        software_charges: 0,
        equipment_charges: 0,
        other_charges: amount,
        late_fee_amount: 0,
        total_amount: amount,
        amount_paid: 0,
        remaining_balance: amount,
        status: "Draft",
        invoice_source: "ticket_expenses",
        billing_period: null,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (insertError || !invoice) {
      return {
        success: false,
        message: insertError?.message ?? "Failed to create expense invoice.",
      };
    }

    const { error: linkError } = await supabase
      .from("ticket_expenses")
      .update({ invoice_id: invoice.id })
      .in("id", group.expenseIds);

    if (linkError) {
      return { success: false, message: linkError.message };
    }

    created += 1;
    billedExpenseCount += group.expenseIds.length;
  }

  revalidateBillingPaths();
  revalidatePath("/time-costs");
  revalidatePath("/technician");

  const skipNote =
    skipped.length > 0
      ? ` Skipped ${skipped.length} without a customer-linked ticket.`
      : "";

  return {
    success: true,
    message:
      created > 0
        ? `Created ${created} draft invoice${created === 1 ? "" : "s"} from ${billedExpenseCount} approved billable expense${billedExpenseCount === 1 ? "" : "s"}.${skipNote}`
        : `No expense invoices created.${skipNote}`,
    created,
    billedExpenseCount,
  };
}

/**
 * Push selected work entries and/or all ready approved expenses to Billing drafts.
 */
export async function sendWorkAndExpensesToBilling(
  entryIds: string[],
): Promise<ActionResult> {
  const messages: string[] = [];

  if (entryIds.length > 0) {
    const workResult = await createInvoicesFromWorkEntries(entryIds);
    if (!workResult.success) {
      return workResult;
    }
    messages.push(workResult.message.replace(/\.$/, ""));
  }

  const expenseResult = await createInvoicesFromApprovedExpenses();
  if (!expenseResult.success) {
    if (messages.length === 0) return expenseResult;
    // Work invoices succeeded; surface expense failure clearly.
    return {
      success: false,
      message: `${messages.join("; ")}. Expense invoicing failed: ${expenseResult.message}`,
    };
  }

  if ((expenseResult.created ?? 0) > 0 || entryIds.length === 0) {
    messages.push(expenseResult.message.replace(/\.$/, ""));
  }

  if (messages.length === 0) {
    return {
      success: false,
      message:
        "Select approved work entries and/or ensure there are approved billable expenses ready to invoice.",
    };
  }

  return { success: true, message: `${messages.join("; ")}.` };
}
