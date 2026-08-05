"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/customers";
import { createClient } from "@/lib/supabase/server";

function isManagerRole(role: string | null | undefined): boolean {
  return (
    role === "administrator" ||
    role === "service_manager" ||
    role === "account_manager"
  );
}

async function requireManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "You must be signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isManagerRole(profile?.role)) {
    return { ok: false as const, message: "Only managers can update CRM records." };
  }

  return { ok: true as const, supabase, userId: user.id };
}

function revalidateCrm(customerId?: string) {
  revalidatePath("/crm");
  if (customerId) revalidatePath(`/crm/${customerId}`);
}

export async function upsertCrmAccountMeta(formData: FormData): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return { success: false, message: auth.message };

  const customerId = String(formData.get("customer_id") ?? "").trim();
  if (!customerId) return { success: false, message: "Customer is required." };

  const tagsRaw = String(formData.get("tags") ?? "").trim();
  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const { error } = await auth.supabase.from("crm_account_meta").upsert(
    {
      customer_id: customerId,
      industry_template:
        String(formData.get("industry_template") ?? "").trim() || null,
      tags,
      relationship_notes:
        String(formData.get("relationship_notes") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" },
  );

  if (error) return { success: false, message: error.message };
  revalidateCrm(customerId);
  return { success: true, message: "Account CRM profile saved." };
}

export async function createCrmContact(formData: FormData): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return { success: false, message: auth.message };

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!customerId || !fullName) {
    return { success: false, message: "Customer and contact name are required." };
  }

  const { error } = await auth.supabase.from("crm_contacts").insert({
    customer_id: customerId,
    full_name: fullName,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    job_title: String(formData.get("job_title") ?? "").trim() || null,
    role_label: String(formData.get("role_label") ?? "").trim() || null,
    is_primary: formData.get("is_primary") === "true",
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) return { success: false, message: error.message };
  revalidateCrm(customerId);
  return { success: true, message: "Contact added." };
}

export async function deleteCrmContact(
  contactId: string,
  customerId: string,
): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return { success: false, message: auth.message };

  const { error } = await auth.supabase
    .from("crm_contacts")
    .delete()
    .eq("id", contactId);

  if (error) return { success: false, message: error.message };
  revalidateCrm(customerId);
  return { success: true, message: "Contact deleted." };
}

export async function saveCrmFieldValues(formData: FormData): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return { success: false, message: auth.message };

  const customerId = String(formData.get("customer_id") ?? "").trim();
  if (!customerId) return { success: false, message: "Customer is required." };

  const entries: Array<{ field_definition_id: string; value_text: string | null }> =
    [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("field_")) continue;
    const fieldId = key.replace("field_", "");
    const text = String(value).trim();
    entries.push({
      field_definition_id: fieldId,
      value_text: text === "" ? null : text,
    });
  }

  for (const entry of entries) {
    const { error } = await auth.supabase.from("crm_field_values").upsert(
      {
        customer_id: customerId,
        field_definition_id: entry.field_definition_id,
        value_text: entry.value_text,
      },
      { onConflict: "customer_id,field_definition_id" },
    );
    if (error) return { success: false, message: error.message };
  }

  revalidateCrm(customerId);
  return { success: true, message: "Custom fields saved." };
}

export async function createCrmNote(formData: FormData): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return { success: false, message: auth.message };

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!customerId || !body) {
    return { success: false, message: "Note text is required." };
  }

  const { error } = await auth.supabase.from("crm_notes").insert({
    customer_id: customerId,
    author_id: auth.userId,
    note_type: String(formData.get("note_type") ?? "general").trim() || "general",
    body,
  });

  if (error) return { success: false, message: error.message };
  revalidateCrm(customerId);
  return { success: true, message: "Note added to timeline." };
}

export async function createCrmOpportunity(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return { success: false, message: auth.message };

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!customerId || !title) {
    return { success: false, message: "Opportunity title is required." };
  }

  const mrrRaw = String(formData.get("estimated_mrr") ?? "").trim();
  const estimatedMrr = mrrRaw === "" ? null : Number(mrrRaw);

  const { error } = await auth.supabase.from("crm_opportunities").insert({
    customer_id: customerId,
    title,
    service_focus: String(formData.get("service_focus") ?? "").trim() || null,
    stage: String(formData.get("stage") ?? "Lead").trim() || "Lead",
    estimated_mrr:
      estimatedMrr != null && !Number.isNaN(estimatedMrr) ? estimatedMrr : null,
    expected_close_date:
      String(formData.get("expected_close_date") ?? "").trim() || null,
    status: "open",
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) return { success: false, message: error.message };
  revalidateCrm(customerId);
  return { success: true, message: "Opportunity created." };
}

export async function updateCrmOpportunityStage(
  opportunityId: string,
  customerId: string,
  stage: string,
): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return { success: false, message: auth.message };

  const status =
    stage === "Live" || stage === "Contracted" ? "open" : stage === "Lost" ? "lost" : "open";

  const { error } = await auth.supabase
    .from("crm_opportunities")
    .update({
      stage,
      status: stage === "Lost" ? "lost" : status,
    })
    .eq("id", opportunityId);

  if (error) return { success: false, message: error.message };
  revalidateCrm(customerId);
  return { success: true, message: `Opportunity moved to ${stage}.` };
}

export async function createCrmFieldDefinition(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return { success: false, message: auth.message };

  const label = String(formData.get("label") ?? "").trim();
  const fieldType = String(formData.get("field_type") ?? "text").trim();
  if (!label) return { success: false, message: "Field label is required." };

  const fieldKey =
    String(formData.get("field_key") ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_") ||
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  const optionsRaw = String(formData.get("options") ?? "").trim();
  const options = optionsRaw
    ? optionsRaw.split(",").map((o) => o.trim()).filter(Boolean)
    : [];

  const { error } = await auth.supabase.from("crm_field_definitions").insert({
    field_key: fieldKey,
    label,
    field_type: fieldType,
    options,
    industry_template:
      String(formData.get("industry_template") ?? "").trim() || null,
    sort_order: Number(formData.get("sort_order") ?? 100) || 100,
    active: true,
  });

  if (error) return { success: false, message: error.message };
  revalidatePath("/crm");
  return { success: true, message: "Custom field created." };
}
