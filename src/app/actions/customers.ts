"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  success: boolean;
  message: string;
}

export async function createCustomer(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const customerName = String(formData.get("customer_name") ?? "").trim();
  if (!customerName) {
    return { success: false, message: "Customer name is required." };
  }

  const email = String(formData.get("contact_email") ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, message: "Please enter a valid email address." };
  }

  const { error } = await supabase.from("customers").insert({
    customer_name: customerName,
    industry: String(formData.get("industry") ?? "").trim() || null,
    primary_contact_name:
      String(formData.get("primary_contact_name") ?? "").trim() || null,
    contact_email: email || null,
    contact_phone: String(formData.get("contact_phone") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    state: String(formData.get("state") ?? "").trim() || null,
    zip_code: String(formData.get("zip_code") ?? "").trim() || null,
    status: String(formData.get("status") ?? "Active").trim() || "Active",
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/customers");
  return { success: true, message: "Customer added successfully." };
}
