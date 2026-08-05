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

async function requireManager(): Promise<
  { ok: true; supabase: Awaited<ReturnType<typeof createClient>> } | { ok: false; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "You must be signed in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isManagerRole(profile?.role)) {
    return { ok: false, message: "Only managers can manage technicians." };
  }

  return { ok: true, supabase };
}

export async function createTechnician(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  const name = String(formData.get("technician_name") ?? "").trim();
  if (!name) {
    return { success: false, message: "Technician name is required." };
  }

  const rateRaw = String(formData.get("internal_hourly_cost") ?? "").trim();
  const rate = rateRaw === "" ? 0 : Number(rateRaw);
  if (Number.isNaN(rate) || rate < 0) {
    return {
      success: false,
      message: "Internal hourly cost must be a non-negative number.",
    };
  }

  const { error } = await auth.supabase.from("technicians").insert({
    technician_name: name,
    specialty: String(formData.get("specialty") ?? "").trim() || null,
    internal_hourly_cost: rate,
    hourly_rate: (() => {
      const billable = String(formData.get("hourly_rate") ?? "").trim();
      if (!billable) return null;
      const value = Number(billable);
      return Number.isNaN(value) || value < 0 ? null : value;
    })(),
    active: String(formData.get("active") ?? "true") === "true",
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/technicians");
  revalidatePath("/service-tickets");
  revalidatePath("/operations");
  return { success: true, message: "Technician added." };
}

export async function deleteTechnician(
  technicianId: string,
): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) {
    return { success: false, message: auth.message };
  }

  if (!technicianId) {
    return { success: false, message: "Technician id is required." };
  }

  const { error } = await auth.supabase
    .from("technicians")
    .delete()
    .eq("id", technicianId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/technicians");
  revalidatePath("/service-tickets");
  revalidatePath("/operations");
  revalidatePath("/time-costs");
  return { success: true, message: "Technician deleted." };
}
