"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/customers";
import {
  insertNotification,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  resetNotificationsAvailability,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import type { NotificationType } from "@/lib/types";

async function notifyQuietly(input: {
  technicianId: string;
  type: NotificationType | string;
  message: string;
}) {
  const supabase = await createClient();
  try {
    await insertNotification(supabase, input);
    return true;
  } catch (error) {
    console.warn("notification skipped:", error);
    return false;
  }
}

export async function createTechnicianNotification(input: {
  technicianId: string;
  type: NotificationType | string;
  message: string;
}): Promise<ActionResult> {
  resetNotificationsAvailability();
  const ok = await notifyQuietly(input);
  if (!ok) {
    return { success: false, message: "Failed to create notification." };
  }
  revalidatePath("/technician");
  return { success: true, message: "Notification created." };
}

/** Manager / admin sends a direct message to a technician. */
export async function sendManagerMessage(input: {
  technicianId: string;
  message: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const trimmed = input.message.trim();
  if (!input.technicianId || !trimmed) {
    return { success: false, message: "Technician and message are required." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? "";
  const allowed =
    role === "administrator" ||
    role === "service_manager" ||
    role === "account_manager";

  if (!allowed) {
    return {
      success: false,
      message: "Only managers and administrators can send team messages.",
    };
  }

  const sender = profile?.full_name?.trim() || "Your manager";
  resetNotificationsAvailability();

  try {
    await insertNotification(supabase, {
      technicianId: input.technicianId,
      type: "manager_message",
      message: `${sender}: ${trimmed}`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send message.";
    return { success: false, message };
  }

  revalidatePath("/technician");
  return { success: true, message: "Message sent to technician." };
}

/**
 * Create alerts for important open work assigned to this technician:
 * critical tickets, SLA risk, and upcoming resolution windows.
 */
export async function refreshTechnicianAlerts(
  technicianId: string,
): Promise<ActionResult & { created?: number }> {
  if (!technicianId) {
    return { success: false, message: "Technician id required." };
  }

  const supabase = await createClient();
  resetNotificationsAvailability();

  const now = Date.now();
  const in48h = new Date(now + 48 * 60 * 60 * 1000).toISOString();

  const { data: tickets, error } = await supabase
    .from("service_tickets")
    .select(
      "id, ticket_number, title, priority, status, target_resolution_at, assigned_technician_id",
    )
    .eq("assigned_technician_id", technicianId)
    .not("status", "in", '("Completed","Closed","Canceled")');

  if (error) {
    return { success: false, message: error.message };
  }

  const { data: existing } = await supabase
    .from("notifications")
    .select("message")
    .eq("technician_id", technicianId)
    .gte("created_at", new Date(now - 12 * 60 * 60 * 1000).toISOString());

  const recentMessages = new Set((existing ?? []).map((row) => row.message));
  let created = 0;

  for (const ticket of tickets ?? []) {
    const label = `${ticket.ticket_number}: ${ticket.title}`;

    if (ticket.priority === "Critical") {
      const message = `Critical ticket needs attention — ${label}`;
      if (!recentMessages.has(message)) {
        const ok = await notifyQuietly({
          technicianId,
          type: "critical_ticket",
          message,
        });
        if (ok) {
          created += 1;
          recentMessages.add(message);
        }
      }
    }

    if (ticket.target_resolution_at) {
      const due = new Date(ticket.target_resolution_at).getTime();
      if (Number.isFinite(due) && due <= new Date(in48h).getTime()) {
        const overdue = due < now;
        const message = overdue
          ? `SLA overdue — resolve ${label}`
          : `Upcoming task — resolution due soon for ${label}`;
        const type = overdue ? "sla_at_risk" : "upcoming_task";
        if (!recentMessages.has(message)) {
          const ok = await notifyQuietly({
            technicianId,
            type,
            message,
          });
          if (ok) {
            created += 1;
            recentMessages.add(message);
          }
        }
      }
    }
  }

  // Surface hardware offline / needs-replacement as operational alerts (light touch).
  const { data: assets } = await supabase
    .from("hardware_assets")
    .select("asset_number, manufacturer, model, device_status, needs_replacement")
    .or("device_status.eq.Offline,needs_replacement.eq.true")
    .limit(5);

  for (const asset of assets ?? []) {
    const device = [asset.manufacturer, asset.model].filter(Boolean).join(" ") ||
      asset.asset_number;
    const message =
      asset.device_status === "Offline"
        ? `Hardware offline: ${device} (${asset.asset_number})`
        : `Upcoming replacement task: ${device} (${asset.asset_number}) flagged for replacement`;
    if (!recentMessages.has(message)) {
      const ok = await notifyQuietly({
        technicianId,
        type:
          asset.device_status === "Offline"
            ? "hardware_offline"
            : "upcoming_task",
        message,
      });
      if (ok) {
        created += 1;
        recentMessages.add(message);
      }
    }
  }

  revalidatePath("/technician");
  return {
    success: true,
    message:
      created > 0
        ? `Refreshed alerts (${created} new).`
        : "Alerts are up to date.",
    created,
  };
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  try {
    await markNotificationRead(supabase, notificationId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to mark notification read.";
    return { success: false, message };
  }

  revalidatePath("/technician");
  return { success: true, message: "Notification marked as read." };
}

export async function dismissNotification(
  notificationId: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  try {
    await deleteNotification(supabase, notificationId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to clear notification.";
    return { success: false, message };
  }

  revalidatePath("/technician");
  return { success: true, message: "Notification cleared." };
}

export async function clearAllNotifications(
  technicianId: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  try {
    await markAllNotificationsRead(supabase, technicianId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to clear notifications.";
    return { success: false, message };
  }

  revalidatePath("/technician");
  return { success: true, message: "All notifications cleared." };
}
