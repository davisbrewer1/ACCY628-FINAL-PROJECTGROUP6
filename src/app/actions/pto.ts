"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";
import { differenceInCalendarDays, parseISO } from "date-fns";

export async function createPtoRequest(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const technicianId = String(formData.get("technician_id") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!technicianId || !startDate || !endDate) {
    return { success: false, message: "Technician, start date, and end date are required." };
  }

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return { success: false, message: "Enter a valid date range." };
  }

  const daySpan = differenceInCalendarDays(end, start) + 1;
  const rawHours = String(formData.get("hours_requested") ?? "").trim();
  const hoursRequested = rawHours ? Number(rawHours) : daySpan * 8;
  if (!Number.isFinite(hoursRequested) || hoursRequested <= 0) {
    return { success: false, message: "Hours requested must be greater than zero." };
  }

  const { error } = await supabase.from("technician_pto_requests").insert({
    technician_id: technicianId,
    start_date: startDate,
    end_date: endDate,
    hours_requested: hoursRequested,
    reason,
    status: "Pending",
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/technician");
  return { success: true, message: "PTO request submitted." };
}

export async function cancelPtoRequest(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("technician_pto_requests")
    .update({ status: "Cancelled" })
    .eq("id", requestId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/technician");
  return { success: true, message: "PTO request cancelled." };
}
