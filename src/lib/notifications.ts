import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { AppNotification, NotificationType } from "@/lib/types";

export const NOTIFICATION_TYPES = [
  "ticket_assigned",
  "ticket_status_changed",
  "sla_at_risk",
  "emergency_incident",
  "critical_ticket",
  "ai_monitoring",
  "hardware_offline",
  "customer_reply",
  "work_approval",
  "manager_message",
  "upcoming_task",
  "work_past_due",
  "schedule_priority_override",
  "ticket_unassigned",
  "customer_reschedule",
] as const satisfies readonly NotificationType[];

export interface CreateNotificationInput {
  technicianId: string;
  type: NotificationType | string;
  message: string;
}

/** True after we learn the notifications table is missing — skip future network calls. */
let notificationsUnavailable = false;

export function isNotificationsUnavailable() {
  return notificationsUnavailable;
}

export function markNotificationsUnavailable() {
  notificationsUnavailable = true;
}

export function resetNotificationsAvailability() {
  notificationsUnavailable = false;
}

function isMissingTableError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /could not find the table/i.test(message) ||
    /relation .* does not exist/i.test(message) ||
    /schema cache/i.test(message)
  );
}

/** Fetch notifications for a technician, newest first. */
export async function fetchNotifications(
  supabase: SupabaseClient,
  technicianId: string,
  limit = 40,
): Promise<AppNotification[]> {
  if (notificationsUnavailable) {
    return [];
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id, technician_id, type, message, created_at, read")
    .eq("technician_id", technicianId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error)) {
      markNotificationsUnavailable();
    }
    throw error;
  }

  return (data ?? []) as AppNotification[];
}

/** Insert a notification row. */
export async function insertNotification(
  supabase: SupabaseClient,
  input: CreateNotificationInput,
): Promise<AppNotification> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      technician_id: input.technicianId,
      type: input.type,
      message: input.message,
      read: false,
    })
    .select("id, technician_id, type, message, created_at, read")
    .single();

  if (error) {
    throw error;
  }

  return data as AppNotification;
}

/** Mark a single notification as read. */
export async function markNotificationRead(
  supabase: SupabaseClient,
  notificationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);

  if (error) {
    throw error;
  }
}

/** Permanently dismiss / delete a notification. */
export async function deleteNotification(
  supabase: SupabaseClient,
  notificationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);

  if (error) {
    throw error;
  }
}

/** Mark all notifications for a technician as read. */
export async function markAllNotificationsRead(
  supabase: SupabaseClient,
  technicianId: string,
): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("technician_id", technicianId)
    .eq("read", false);

  if (error) {
    throw error;
  }
}

export interface NotificationSubscriptionHandlers {
  onInsert?: (notification: AppNotification) => void;
  onUpdate?: (notification: AppNotification) => void;
  onDelete?: (notificationId: string) => void;
}

/**
 * Subscribe to realtime notification changes for one technician.
 * Returns an unsubscribe function.
 */
export function subscribeToNotifications(
  supabase: SupabaseClient,
  technicianId: string,
  handlers: NotificationSubscriptionHandlers,
): () => void {
  if (notificationsUnavailable) {
    return () => undefined;
  }

  const channel: RealtimeChannel = supabase
    .channel(`notifications:tech:${technicianId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `technician_id=eq.${technicianId}`,
      },
      (payload) => {
        handlers.onInsert?.(payload.new as AppNotification);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "notifications",
        filter: `technician_id=eq.${technicianId}`,
      },
      (payload) => {
        handlers.onUpdate?.(payload.new as AppNotification);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "notifications",
        filter: `technician_id=eq.${technicianId}`,
      },
      (payload) => {
        const oldRow = payload.old as { id?: string };
        if (oldRow.id) {
          handlers.onDelete?.(oldRow.id);
        }
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function playSoftNotificationSound() {
  if (typeof window === "undefined") return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    oscillator.stop(ctx.currentTime + 0.2);
    window.setTimeout(() => void ctx.close(), 300);
  } catch {
    // Audio is optional — ignore blocked autoplay / unsupported browsers.
  }
}
