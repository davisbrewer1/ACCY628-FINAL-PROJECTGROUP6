"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";

function revalidateWorkPaths() {
  revalidatePath("/technician");
  revalidatePath("/service-tickets");
  revalidatePath("/end-user/support");
}

async function updateLiveSession(
  ticketId: string,
  patch: Record<string, unknown>,
): Promise<ActionResult> {
  const id = String(ticketId ?? "").trim();
  if (!id) {
    return { success: false, message: "Ticket is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_tickets")
    .update(patch)
    .eq("id", id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateWorkPaths();
  return { success: true, message: "Session updated." };
}

/** Mark On the way (on-site only). Persists across logout. */
export async function markTicketEnRoute(
  ticketId: string,
): Promise<ActionResult> {
  return updateLiveSession(ticketId, {
    en_route: true,
    status: "In Progress",
    live_timer_paused: false,
    live_timer_segment_started_at: null,
    live_timer_banked_seconds: 0,
  });
}

/** Start or restart the live work timer. Clears en route. */
export async function startLiveTimer(ticketId: string): Promise<ActionResult> {
  return updateLiveSession(ticketId, {
    en_route: false,
    status: "In Progress",
    live_timer_paused: false,
    live_timer_banked_seconds: 0,
    live_timer_segment_started_at: new Date().toISOString(),
  });
}

/** Pause the running timer; bank active segment seconds. */
export async function pauseLiveTimer(
  ticketId: string,
  bankedSeconds: number,
): Promise<ActionResult> {
  const banked = Math.max(0, Math.floor(bankedSeconds));
  return updateLiveSession(ticketId, {
    en_route: false,
    live_timer_paused: true,
    live_timer_banked_seconds: banked,
    live_timer_segment_started_at: null,
    status: "In Progress",
  });
}

/** Resume a paused timer with a new wall-clock segment. */
export async function resumeLiveTimer(ticketId: string): Promise<ActionResult> {
  return updateLiveSession(ticketId, {
    en_route: false,
    live_timer_paused: false,
    live_timer_segment_started_at: new Date().toISOString(),
    status: "In Progress",
  });
}

/** Clear en route + live timer fields (end job / save / abandon). */
export async function clearLiveTimer(ticketId: string): Promise<ActionResult> {
  return updateLiveSession(ticketId, {
    en_route: false,
    live_timer_paused: false,
    live_timer_banked_seconds: 0,
    live_timer_segment_started_at: null,
  });
}
