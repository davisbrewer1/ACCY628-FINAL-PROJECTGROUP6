"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";

export async function updateProfileContact(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!fullName) {
    return { success: false, message: "Full name is required." };
  }
  if (!email) {
    return { success: false, message: "Email is required." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      email,
      phone: phone || null,
    })
    .eq("id", user.id);

  if (profileError) {
    return { success: false, message: profileError.message };
  }

  if (email !== user.email) {
    const { error: authError } = await supabase.auth.updateUser({ email });
    if (authError) {
      return {
        success: false,
        message: `Profile saved, but email change needs confirmation: ${authError.message}`,
      };
    }
  }

  revalidatePath("/end-user/settings");
  return { success: true, message: "Contact information updated." };
}

export async function updateNotificationPreferences(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const preferences = {
    ticket_updates: formData.get("ticket_updates") === "on",
    security_alerts: formData.get("security_alerts") === "on",
    billing_notices: formData.get("billing_notices") === "on",
    announcements: formData.get("announcements") === "on",
    email_enabled: formData.get("email_enabled") === "on",
    sms_enabled: formData.get("sms_enabled") === "on",
  };

  const { error } = await supabase
    .from("profiles")
    .update({ notification_preferences: preferences })
    .eq("id", user.id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/end-user/settings");
  return { success: true, message: "Notification preferences saved." };
}

export async function updateCommunicationPreferences(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const preferences = {
    preferred_channel: String(formData.get("preferred_channel") ?? "email").trim(),
    best_time: String(formData.get("best_time") ?? "").trim() || null,
    language: String(formData.get("language") ?? "English").trim(),
    marketing_opt_in: formData.get("marketing_opt_in") === "on",
  };

  const { error } = await supabase
    .from("profiles")
    .update({ communication_preferences: preferences })
    .eq("id", user.id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/end-user/settings");
  return { success: true, message: "Communication preferences saved." };
}

export async function addClientContact(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) {
    return { success: false, message: "Contact name is required." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("client_contacts").insert({
    profile_id: user.id,
    customer_id: profile?.customer_id ?? null,
    full_name: fullName,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    relationship: String(formData.get("relationship") ?? "").trim() || null,
    preferred_contact: formData.get("preferred_contact") === "on",
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/end-user/settings");
  return { success: true, message: "Additional contact added." };
}

export async function deleteClientContact(
  contactId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const { error } = await supabase
    .from("client_contacts")
    .delete()
    .eq("id", contactId)
    .eq("profile_id", user.id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/end-user/settings");
  return { success: true, message: "Contact removed." };
}
