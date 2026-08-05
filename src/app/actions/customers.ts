"use server";

import { revalidatePath } from "next/cache";
import { createAnonAuthClient } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  success: boolean;
  message: string;
  portalEmail?: string;
  portalPassword?: string;
}

const PORTAL_PASSWORD = "DemoPass123!";

function isManagerRole(role: string | null | undefined): boolean {
  return (
    role === "administrator" ||
    role === "service_manager" ||
    role === "account_manager"
  );
}

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isManagerRole(actor?.role)) {
    return {
      success: false,
      message: "Only managers can create customer accounts.",
    };
  }

  const customerName = String(formData.get("customer_name") ?? "").trim();
  if (!customerName) {
    return { success: false, message: "Customer name is required." };
  }

  const email = String(formData.get("contact_email") ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      success: false,
      message: "A valid contact email is required to create the customer login.",
    };
  }

  const contactName =
    String(formData.get("primary_contact_name") ?? "").trim() || customerName;

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      customer_name: customerName,
      industry: String(formData.get("industry") ?? "").trim() || null,
      primary_contact_name: contactName,
      contact_email: email,
      contact_phone: String(formData.get("contact_phone") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      state: String(formData.get("state") ?? "").trim() || null,
      zip_code: String(formData.get("zip_code") ?? "").trim() || null,
      status: String(formData.get("status") ?? "Active").trim() || "Active",
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (error || !customer) {
    return { success: false, message: error?.message ?? "Could not create customer." };
  }

  const authClient = createAnonAuthClient();
  const { data: signUpData, error: signUpError } = await authClient.auth.signUp({
    email,
    password: PORTAL_PASSWORD,
    options: {
      data: {
        full_name: contactName,
        role: "client_admin",
        customer_id: customer.id,
      },
    },
  });

  if (signUpError) {
    await supabase.from("customers").delete().eq("id", customer.id);
    return {
      success: false,
      message: `Customer was not saved because the portal login could not be created: ${signUpError.message}`,
    };
  }

  if (!signUpData.user) {
    await supabase.from("customers").delete().eq("id", customer.id);
    return {
      success: false,
      message:
        "Portal account requires email confirmation before it can be used. Enable auto-confirm in Supabase Auth for local demos, then try again.",
    };
  }

  const { error: confirmError } = await supabase.rpc("confirm_portal_user", {
    p_user_id: signUpData.user.id,
    p_customer_id: customer.id,
  });

  if (confirmError) {
    await supabase.from("customers").delete().eq("id", customer.id);
    return {
      success: false,
      message: `Portal login could not be activated: ${confirmError.message}`,
    };
  }

  revalidatePath("/customers");
  revalidatePath("/operations");
  return {
    success: true,
    message: `Customer approved and portal account created. Login: ${email} / ${PORTAL_PASSWORD}`,
    portalEmail: email,
    portalPassword: PORTAL_PASSWORD,
  };
}

export async function deleteCustomer(customerId: string): Promise<ActionResult> {
  const supabase = await createClient();

  if (!customerId) {
    return { success: false, message: "Customer id is required." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isManagerRole(actor?.role)) {
    return { success: false, message: "Only managers can delete customers." };
  }

  const { error } = await supabase.rpc("delete_customer_account", {
    p_customer_id: customerId,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/customers");
  revalidatePath("/operations");
  revalidatePath("/contracts");
  revalidatePath("/billing");
  return { success: true, message: "Customer and related records deleted." };
}
