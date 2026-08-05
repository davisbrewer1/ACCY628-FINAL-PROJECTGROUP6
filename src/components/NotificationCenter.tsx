"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Bot,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  MonitorOff,
  Send,
  Siren,
  Ticket,
  UserRound,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  clearAllNotifications,
  dismissNotification,
  markNotificationAsRead,
  refreshTechnicianAlerts,
  sendManagerMessage,
} from "@/app/actions/notifications";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { useToast } from "@/components/Toast";
import {
  fetchNotifications,
  isNotificationsUnavailable,
  playSoftNotificationSound,
  resetNotificationsAvailability,
  subscribeToNotifications,
} from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import type { AppNotification, NotificationType, Technician } from "@/lib/types";

const TYPE_META: Record<
  NotificationType,
  { label: string; Icon: LucideIcon; className: string; href: string }
> = {
  ticket_assigned: {
    label: "Ticket assigned",
    Icon: Wrench,
    className: "text-primary",
    href: "/technician",
  },
  ticket_status_changed: {
    label: "Status changed",
    Icon: Ticket,
    className: "text-info",
    href: "/technician",
  },
  sla_at_risk: {
    label: "SLA risk",
    Icon: AlertTriangle,
    className: "text-warning",
    href: "/technician",
  },
  emergency_incident: {
    label: "Emergency",
    Icon: Siren,
    className: "text-error",
    href: "/technician",
  },
  critical_ticket: {
    label: "Critical ticket",
    Icon: AlertTriangle,
    className: "text-error",
    href: "/technician",
  },
  ai_monitoring: {
    label: "AI alert",
    Icon: Bot,
    className: "text-secondary",
    href: "/ai-governance",
  },
  hardware_offline: {
    label: "Hardware",
    Icon: MonitorOff,
    className: "text-warning",
    href: "/hardware",
  },
  customer_reply: {
    label: "Customer reply",
    Icon: MessageSquare,
    className: "text-success",
    href: "/technician",
  },
  work_approval: {
    label: "Work approval",
    Icon: CheckCircle2,
    className: "text-accent",
    href: "/time-costs",
  },
  manager_message: {
    label: "Manager message",
    Icon: UserRound,
    className: "text-primary",
    href: "/technician",
  },
  upcoming_task: {
    label: "Upcoming task",
    Icon: CalendarClock,
    className: "text-info",
    href: "/technician",
  },
};

function getTypeMeta(type: string) {
  return (
    TYPE_META[type as NotificationType] ?? {
      label: "Notification",
      Icon: Bell,
      className: "text-base-content/70",
      href: "/technician",
    }
  );
}

function formatRelative(value: string) {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return value;
  }
}

function formatExact(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function NotificationCenter() {
  const router = useRouter();
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [technicianId, setTechnicianId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [messageTechId, setMessageTechId] = useState("");
  const [managerNote, setManagerNote] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const alertsBootstrapped = useRef(false);

  const canSendManagerMessage =
    activeRole === "administrator" ||
    activeRole === "service_manager" ||
    activeRole === "account_manager";

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const selected = useMemo(
    () => notifications.find((item) => item.id === selectedId) ?? null,
    [notifications, selectedId],
  );

  const loadForTechnician = useCallback(async (techId: string) => {
    resetNotificationsAvailability();
    const supabase = createClient();
    try {
      const rows = await fetchNotifications(supabase, techId);
      setNotifications(rows);
      setUnavailable(false);
    } catch {
      setUnavailable(isNotificationsUnavailable() || true);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let idleId: number | undefined;

    async function bootstrap() {
      resetNotificationsAvailability();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      const [{ data: tech }, { data: techList }] = await Promise.all([
        supabase
          .from("technicians")
          .select("id")
          .eq("profile_id", user.id)
          .maybeSingle(),
        canSendManagerMessage
          ? supabase
              .from("technicians")
              .select("id, technician_name")
              .order("technician_name")
          : Promise.resolve({ data: [] as Technician[] }),
      ]);

      if (cancelled) return;

      if (techList?.length) {
        setTechnicians(techList as Technician[]);
        setMessageTechId((current) => current || techList[0]?.id || "");
      }

      if (!tech?.id) {
        setLoading(false);
        setTechnicianId(null);
        if (!canSendManagerMessage) {
          return;
        }
        try {
          const { data } = await supabase
            .from("notifications")
            .select("id, technician_id, type, message, created_at, read")
            .order("created_at", { ascending: false })
            .limit(40);
          setNotifications((data ?? []) as AppNotification[]);
          setUnavailable(false);
        } catch {
          setUnavailable(true);
        }
        return;
      }

      setTechnicianId(tech.id);
      await loadForTechnician(tech.id);

      if (cancelled) return;

      if (!alertsBootstrapped.current) {
        alertsBootstrapped.current = true;
        const result = await refreshTechnicianAlerts(tech.id);
        if (result.success && (result.created ?? 0) > 0) {
          await loadForTechnician(tech.id);
        }
      }

      if (isNotificationsUnavailable()) {
        setUnavailable(true);
        return;
      }

      unsubscribe = subscribeToNotifications(supabase, tech.id, {
        onInsert: (notification) => {
          setNotifications((current) => {
            if (current.some((item) => item.id === notification.id)) {
              return current;
            }
            return [notification, ...current];
          });
          if (!notification.read) {
            playSoftNotificationSound();
          }
        },
        onUpdate: (notification) => {
          setNotifications((current) =>
            current.map((item) =>
              item.id === notification.id ? notification : item,
            ),
          );
        },
        onDelete: (notificationId) => {
          setNotifications((current) =>
            current.filter((item) => item.id !== notificationId),
          );
          setSelectedId((current) =>
            current === notificationId ? null : current,
          );
        },
      });
    }

    const schedule =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? (cb: () => void) =>
            window.requestIdleCallback(cb, { timeout: 1500 })
        : (cb: () => void) => window.setTimeout(cb, 300);

    const cancelSchedule =
      typeof window !== "undefined" && "cancelIdleCallback" in window
        ? (id: number) => window.cancelIdleCallback(id)
        : (id: number) => window.clearTimeout(id);

    idleId = schedule(() => {
      void bootstrap();
    }) as number;

    return () => {
      cancelled = true;
      if (idleId != null) {
        cancelSchedule(idleId);
      }
      unsubscribe?.();
    };
  }, [canSendManagerMessage, loadForTechnician]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: globalThis.MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSelectedId(null);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (selectedId) {
          setSelectedId(null);
        } else {
          setOpen(false);
        }
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, selectedId]);

  async function handleOpenNotification(notification: AppNotification) {
    setSelectedId(notification.id);
    if (notification.read) return;

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read: true } : item,
      ),
    );

    const result = await markNotificationAsRead(notification.id);
    if (!result.success) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read: false } : item,
        ),
      );
    }
  }

  async function handleDismiss(
    notificationId: string,
    event?: ReactMouseEvent,
  ) {
    event?.stopPropagation();
    event?.preventDefault();

    const previous = notifications;
    setNotifications((current) =>
      current.filter((item) => item.id !== notificationId),
    );
    if (selectedId === notificationId) {
      setSelectedId(null);
    }

    const result = await dismissNotification(notificationId);
    if (!result.success) {
      setNotifications(previous);
      showToast(result.message, "error");
    }
  }

  async function handleClearAll() {
    if (!technicianId || unreadCount === 0) return;
    setBusy(true);

    const previous = notifications;
    setNotifications((current) =>
      current.map((item) => ({ ...item, read: true })),
    );

    const result = await clearAllNotifications(technicianId);
    if (!result.success) {
      setNotifications(previous);
    }
    setBusy(false);
  }

  async function handleSendManagerMessage() {
    if (!messageTechId || !managerNote.trim()) return;
    setSendingMessage(true);
    const result = await sendManagerMessage({
      technicianId: messageTechId,
      message: managerNote,
    });
    setSendingMessage(false);
    showToast(result.message, result.success ? "success" : "error");
    if (result.success) {
      setManagerNote("");
      if (technicianId) {
        await loadForTechnician(technicianId);
      }
    }
  }

  async function handleRefreshAlerts() {
    if (!technicianId) return;
    setBusy(true);
    const result = await refreshTechnicianAlerts(technicianId);
    showToast(result.message, result.success ? "success" : "error");
    if (result.success) {
      await loadForTechnician(technicianId);
    }
    setBusy(false);
  }

  function handleGoToRelated(notification: AppNotification) {
    const href = getTypeMeta(notification.type).href;
    setOpen(false);
    setSelectedId(null);
    router.push(href);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="btn btn-ghost btn-square btn-sm relative"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (open) setSelectedId(null);
        }}
      >
        <Bell className="size-5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="badge badge-error absolute -right-0.5 -top-0.5 h-5 min-w-5 px-1 text-[10px] text-error-content">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-box border border-base-300 bg-base-100 text-black shadow-xl">
          <div className="flex items-start justify-between gap-2 border-b border-base-300 px-4 py-3">
            <div>
              <p className="font-semibold text-black">
                {selected ? "Notification" : "Notifications"}
              </p>
              <p className="text-xs text-black/60">
                {selected
                  ? getTypeMeta(selected.type).label
                  : unreadCount === 0
                    ? "Important changes, tasks, and manager messages"
                    : `${unreadCount} unread`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {selected ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs gap-1"
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft className="size-3.5" />
                  Back
                </button>
              ) : (
                <>
                  {technicianId ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      disabled={busy || loading}
                      onClick={() => void handleRefreshAlerts()}
                    >
                      Refresh
                    </button>
                  ) : null}
                  {technicianId && unreadCount > 0 ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs gap-1"
                      disabled={busy}
                      onClick={() => void handleClearAll()}
                    >
                      <CheckCheck className="size-3.5" />
                      Clear
                    </button>
                  ) : null}
                </>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square"
                aria-label="Close notifications"
                onClick={() => {
                  setOpen(false);
                  setSelectedId(null);
                }}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {selected ? (
            <div className="space-y-4 p-4">
              {(() => {
                const meta = getTypeMeta(selected.type);
                const Icon = meta.Icon;
                return (
                  <>
                    <div className="flex items-start gap-3">
                      <span
                        className={`rounded-full bg-base-200 p-2 ${meta.className}`}
                      >
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                          {meta.label}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-black">
                          {selected.message}
                        </p>
                        <p className="mt-2 text-xs text-black/50">
                          {formatExact(selected.created_at)} ·{" "}
                          {formatRelative(selected.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm gap-1"
                        onClick={() => handleGoToRelated(selected)}
                      >
                        <ExternalLink className="size-3.5" />
                        Open related page
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => void handleDismiss(selected.id)}
                      >
                        Clear notification
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <>
              {canSendManagerMessage ? (
                <div className="space-y-2 border-b border-base-300 bg-base-200/40 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/55">
                    Message technician
                  </p>
                  <select
                    className="select select-bordered select-xs w-full text-black"
                    value={messageTechId}
                    onChange={(e) => setMessageTechId(e.target.value)}
                  >
                    {technicians.length === 0 ? (
                      <option value="">No technicians found</option>
                    ) : (
                      technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.technician_name}
                        </option>
                      ))
                    )}
                  </select>
                  <div className="flex gap-2">
                    <input
                      className="input input-bordered input-xs flex-1 text-black"
                      placeholder="Priority note, schedule change, or instruction…"
                      value={managerNote}
                      onChange={(e) => setManagerNote(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleSendManagerMessage();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-xs gap-1"
                      disabled={
                        sendingMessage || !messageTechId || !managerNote.trim()
                      }
                      onClick={() => void handleSendManagerMessage()}
                    >
                      {sendingMessage ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        <Send className="size-3.5" />
                      )}
                      Send
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="flex justify-center py-10">
                    <span className="loading loading-spinner loading-md text-primary" />
                  </div>
                ) : unavailable ? (
                  <div className="space-y-3 px-4 py-8 text-center text-sm text-black/60">
                    <p>
                      Notifications are unavailable until the{" "}
                      <code className="text-xs text-black">notifications</code> table is
                      migrated in Supabase.
                    </p>
                    <button
                      type="button"
                      className="btn btn-outline btn-xs"
                      onClick={() => {
                        resetNotificationsAvailability();
                        setLoading(true);
                        if (technicianId) {
                          void loadForTechnician(technicianId);
                        } else {
                          window.location.reload();
                        }
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ) : !technicianId && !canSendManagerMessage ? (
                  <div className="px-4 py-8 text-center text-sm text-black/60">
                    Link a technician profile to receive alerts.
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-black/60">
                    No notifications yet. Alerts for ticket changes, SLA risk,
                    upcoming tasks, and manager messages will appear here.
                  </div>
                ) : (
                  <ul className="divide-y divide-base-300">
                    {notifications.map((notification) => {
                      const meta = getTypeMeta(notification.type);
                      const Icon = meta.Icon;
                      return (
                        <li key={notification.id} className="relative">
                          <button
                            type="button"
                            className={`flex w-full items-start gap-3 py-3 pl-4 pr-10 text-left text-black transition hover:bg-base-200/70 ${
                              notification.read ? "opacity-70" : "bg-primary/5"
                            }`}
                            onClick={() =>
                              void handleOpenNotification(notification)
                            }
                          >
                            <span
                              className={`mt-0.5 rounded-full bg-base-200 p-1.5 ${meta.className}`}
                            >
                              <Icon className="size-3.5" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-black/55">
                                  {meta.label}
                                </span>
                                {!notification.read ? (
                                  <span className="badge badge-primary badge-xs">
                                    New
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 line-clamp-2 block text-sm leading-snug text-black">
                                {notification.message}
                              </span>
                              <span className="mt-1 block text-xs text-black/50">
                                {formatRelative(notification.created_at)}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs btn-square absolute right-2 top-2 opacity-60 hover:bg-base-300 hover:opacity-100"
                            aria-label="Clear notification"
                            title="Clear notification"
                            onClick={(event) =>
                              void handleDismiss(notification.id, event)
                            }
                          >
                            <X className="size-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
