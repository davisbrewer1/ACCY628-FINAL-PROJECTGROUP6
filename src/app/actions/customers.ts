"use server";

import { revalidatePath } from "next/cache";
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

  // DB RPC creates confirmed Auth user + profile without sending emails
  // (avoids Supabase Auth email rate limits that previously left customers without logins).
  const { data: portalUserId, error: provisionError } = await supabase.rpc(
    "provision_customer_portal_login",
    {
      p_customer_id: customer.id,
      p_email: email,
      p_full_name: contactName,
      p_password: PORTAL_PASSWORD,
    },
  );

  if (provisionError || !portalUserId) {
    await supabase.from("customers").delete().eq("id", customer.id);
    return {
      success: false,
      message: `Customer was not saved because the portal login could not be created: ${
        provisionError?.message ?? "Unknown provisioning error."
      }`,
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

/** Repair a customer that was saved without an Auth portal login. */
export async function provisionCustomerPortalLogin(
  customerId: string,
): Promise<ActionResult> {
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
      message: "Only managers can provision portal logins.",
    };
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, contact_email, primary_contact_name, customer_name")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError || !customer) {
    return {
      success: false,
      message: customerError?.message ?? "Customer not found.",
    };
  }

  const email = String(customer.contact_email ?? "").trim().toLowerCase();
  if (!email) {
    return {
      success: false,
      message: "Customer needs a contact email before a portal login can be created.",
    };
  }

  const fullName =
    String(customer.primary_contact_name ?? "").trim() ||
    String(customer.customer_name ?? "").trim() ||
    email;

  const { data: portalUserId, error: provisionError } = await supabase.rpc(
    "provision_customer_portal_login",
    {
      p_customer_id: customer.id,
      p_email: email,
      p_full_name: fullName,
      p_password: PORTAL_PASSWORD,
    },
  );

  if (provisionError || !portalUserId) {
    return {
      success: false,
      message:
        provisionError?.message ??
        "Could not create the portal login for this customer.",
    };
  }

  revalidatePath("/customers");
  revalidatePath("/operations");
  return {
    success: true,
    message: `Portal login ready. Login: ${email} / ${PORTAL_PASSWORD}`,
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
