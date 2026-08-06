"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, MessageSquare, Shield, X } from "lucide-react";
import { KnowledgeBasePanel } from "@/components/KnowledgeBasePanel";
import { createClient } from "@/lib/supabase/client";
import {
  daysOpen,
  getWorkOutstandingDueDays,
  isWorkOutstandingPastDue,
} from "@/lib/calculations";
import { isOpenTicket } from "@/lib/dashboard-stats";
import type { ServiceTicket } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

const MANAGER_MESSAGES = [
  {
    id: "mgr-1",
    title: "Cover Friday afternoon on-sites",
    body: "Please keep one window open Friday PM for Harbor Retail walk-ups.",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "mgr-2",
    title: "Security tickets first",
    body: "Any Security-tagged work should be acknowledged before routine hardware tickets.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
] as const;

const DISMISSED_MANAGER_KEY = "nexus-dismissed-manager-messages";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  /** Milliseconds since epoch used for assignment age sorting. */
  receivedAtMs: number;
  security: boolean;
  source: "manager" | "assignment" | "overdue";
  priority: string;
  /** Hours past due (overdue only); higher = more urgent. */
  overdueHours: number;
};

function priorityRank(priority: string | null | undefined): number {
  switch ((priority ?? "Medium").trim()) {
    case "Critical":
      return 4;
    case "High":
      return 3;
    case "Medium":
      return 2;
    case "Low":
      return 1;
    default:
      return 2;
  }
}

function toTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** When the tech received / was given the assignment (earliest reliable timestamp). */
function ticketReceivedAtMs(ticket: ServiceTicket): number {
  const created = toTimestamp(ticket.created_at);
  const opened = toTimestamp(ticket.opened_at);
  if (created != null && opened != null) return Math.min(created, opened);
  return created ?? opened ?? 0;
}

function isCompletedTicket(status: string | null | undefined): boolean {
  const value = (status ?? "").trim().toLowerCase();
  return value === "completed" || value === "closed" || value === "cancelled";
}

/**
 * Notifications tab order:
 * 1) Past due (highest urgency first)
 * 2) Security risk (non–past-due)
 * 3) Remaining assignments by priority
 */
function compareWorkNotifications(
  a: NotificationItem,
  b: NotificationItem,
): number {
  const groupRank = (item: NotificationItem) => {
    if (item.source === "overdue" || item.overdueHours > 0) return 3;
    if (item.security) return 2;
    return 1;
  };

  const groupDiff = groupRank(b) - groupRank(a);
  if (groupDiff !== 0) return groupDiff;

  const overdueDiff = b.overdueHours - a.overdueHours;
  if (overdueDiff !== 0) return overdueDiff;

  const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
  if (priorityDiff !== 0) return priorityDiff;

  return a.receivedAtMs - b.receivedAtMs;
}

function ticketIdFromNotification(item: NotificationItem): string | null {
  if (item.id.startsWith("overdue-")) return item.id.slice("overdue-".length);
  if (item.id.startsWith("assign-")) return item.id.slice("assign-".length);
  return null;
}

function readDismissedManagerIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_MANAGER_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function writeDismissedManagerIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISMISSED_MANAGER_KEY, JSON.stringify([...ids]));
}

interface TechnicianHeaderToolsProps {
  technicianId?: string | null;
}

function buildOverdueBody(ticket: ServiceTicket): string {
  const opened = ticket.opened_at ?? ticket.created_at;
  const openDays = daysOpen(opened) ?? 0;
  const dueDays = getWorkOutstandingDueDays(ticket.priority);
  const parts = [
    `${ticket.ticket_number} — ${ticket.title}`,
    `${ticket.priority ?? "Medium"} priority · ${ticket.status ?? "Open"}`,
    dueDays === 0
      ? `Due immediately · open ${openDays === 0 ? "today" : `${openDays} day${openDays === 1 ? "" : "s"}`}`
      : `Due within ${dueDays} day${dueDays === 1 ? "" : "s"} · open ${openDays} day${openDays === 1 ? "" : "s"}`,
  ];

  if (ticket.requester_name) {
    parts.push(`Requester: ${ticket.requester_name}`);
  }
  if (ticket.location) {
    parts.push(`Location: ${ticket.location}`);
  }
  if (ticket.cybersecurity_incident) {
    parts.push("Security incident");
  }

  return parts.join(" · ");
}

export function TechnicianHeaderTools({
  technicianId,
}: TechnicianHeaderToolsProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"notifications" | "messages">(
    "notifications",
  );
  const [assignedTickets, setAssignedTickets] = useState<ServiceTicket[]>([]);
  const [dismissedManagerIds, setDismissedManagerIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setDismissedManagerIds(readDismissedManagerIds());
  }, []);

  useEffect(() => {
    if (!technicianId) return;

    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("service_tickets")
        .select("*")
        .eq("assigned_technician_id", technicianId)
        .order("created_at", { ascending: true })
        .limit(100);
      setAssignedTickets(data ?? []);
    }

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 15000);
    const onFocus = () => {
      void load();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [technicianId]);

  function dismissManagerMessage(id: string) {
    setDismissedManagerIds((current) => {
      const next = new Set(current);
      next.add(id);
      writeDismissedManagerIds(next);
      return next;
    });
  }

  const openTickets = useMemo(
    () =>
      assignedTickets.filter(
        (ticket) =>
          isOpenTicket(ticket.status) && !isCompletedTicket(ticket.status),
      ),
    [assignedTickets],
  );

  const overdueNotifications = useMemo((): NotificationItem[] => {
    const now = Date.now();
    return openTickets
      .filter((ticket) =>
        isWorkOutstandingPastDue({
          status: ticket.status,
          priority: ticket.priority,
          openedAt: ticket.opened_at,
          createdAt: ticket.created_at,
        }),
      )
      .map((ticket) => {
        const receivedAtMs = ticketReceivedAtMs(ticket);
        const opened = ticket.opened_at ?? ticket.created_at;
        const dueDays = getWorkOutstandingDueDays(ticket.priority);
        const dueAt = new Date(
          new Date(opened).getTime() + dueDays * 24 * 60 * 60 * 1000,
        );
        const overdueHours = Math.max(
          0,
          (now - dueAt.getTime()) / (1000 * 60 * 60),
        );
        return {
          id: `overdue-${ticket.id}`,
          title: "Work Outstanding Past Due",
          body: buildOverdueBody(ticket),
          createdAt: new Date(receivedAtMs).toISOString(),
          receivedAtMs,
          security: Boolean(ticket.cybersecurity_incident),
          source: "overdue" as const,
          priority: ticket.priority ?? "Medium",
          overdueHours,
        };
      });
  }, [openTickets]);

  const assignmentNotifications = useMemo((): NotificationItem[] => {
    return openTickets
      .filter(
        (ticket) =>
          ticket.status === "New" || ticket.status === "Assigned",
      )
      .map((ticket) => {
        const receivedAtMs = ticketReceivedAtMs(ticket);
        return {
          id: `assign-${ticket.id}`,
          title: ticket.cybersecurity_incident
            ? `Security work assigned: ${ticket.title}`
            : `New assignment: ${ticket.title}`,
          body: `${ticket.ticket_number} · ${ticket.priority ?? "Medium"} priority · ${ticket.status}`,
          createdAt: new Date(receivedAtMs).toISOString(),
          receivedAtMs,
          security: Boolean(ticket.cybersecurity_incident),
          source: "assignment" as const,
          priority: ticket.priority ?? "Medium",
          overdueHours: 0,
        };
      });
  }, [openTickets]);

  const workNotifications = useMemo((): NotificationItem[] => {
    const pastDueTicketIds = new Set(
      overdueNotifications
        .map((item) => ticketIdFromNotification(item))
        .filter((id): id is string => Boolean(id)),
    );

    const regularAssignments = assignmentNotifications.filter((item) => {
      const ticketId = ticketIdFromNotification(item);
      return !ticketId || !pastDueTicketIds.has(ticketId);
    });

    return [...overdueNotifications, ...regularAssignments].sort(
      compareWorkNotifications,
    );
  }, [assignmentNotifications, overdueNotifications]);

  const managerMessages = useMemo((): NotificationItem[] => {
    return MANAGER_MESSAGES.filter(
      (message) => !dismissedManagerIds.has(message.id),
    )
      .map((message) => {
        const receivedAtMs = toTimestamp(message.createdAt) ?? 0;
        return {
          ...message,
          receivedAtMs,
          security: false,
          source: "manager" as const,
          priority: "Medium",
          overdueHours: 0,
        };
      })
      .sort((a, b) => b.receivedAtMs - a.receivedAtMs);
  }, [dismissedManagerIds]);

  const activeItems =
    activeTab === "messages" ? managerMessages : workNotifications;
  const unreadCount = workNotifications.length + managerMessages.length;

  return (
    <div className="relative flex items-center gap-2">
      <KnowledgeBasePanel canEdit={false} variant="tech" />

      <button
        type="button"
        className="btn btn-sm gap-2 border-slate-600 bg-slate-900 text-slate-100 hover:border-cyan-500/50"
        aria-expanded={panelOpen}
        onClick={() => setPanelOpen((open) => !open)}
      >
        <Bell className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Notifications</span>
        {unreadCount > 0 ? (
          <span className="badge badge-sm border-0 bg-cyan-500 text-slate-950">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {panelOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close panel"
            onClick={() => setPanelOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-950 shadow-2xl shadow-cyan-950/40">
            <div className="flex items-center justify-between border-b border-cyan-500/15 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">Inbox</p>
                <p className="text-xs text-slate-400">
                  {activeTab === "messages"
                    ? "Messages from your manager"
                    : "Past due first, then security risk"}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square text-slate-300"
                onClick={() => setPanelOpen(false)}
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div
              className="grid grid-cols-2 gap-1 border-b border-cyan-500/15 p-2"
              role="tablist"
              aria-label="Inbox sections"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "notifications"}
                className={`btn btn-sm gap-1 ${
                  activeTab === "notifications"
                    ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                    : "btn-ghost text-slate-300"
                }`}
                onClick={() => setActiveTab("notifications")}
              >
                <Bell className="size-3.5" aria-hidden="true" />
                Notifications
                {workNotifications.length > 0 ? (
                  <span className="badge badge-sm border-0 bg-cyan-500/80 text-slate-950">
                    {workNotifications.length}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "messages"}
                className={`btn btn-sm gap-1 ${
                  activeTab === "messages"
                    ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                    : "btn-ghost text-slate-300"
                }`}
                onClick={() => setActiveTab("messages")}
              >
                <MessageSquare className="size-3.5" aria-hidden="true" />
                Messages
                {managerMessages.length > 0 ? (
                  <span className="badge badge-sm border-0 bg-sky-500/80 text-slate-950">
                    {managerMessages.length}
                  </span>
                ) : null}
              </button>
            </div>

            <div className="max-h-[28rem] space-y-3 overflow-y-auto p-3">
              {activeItems.length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-slate-500">
                  {activeTab === "messages"
                    ? "No manager messages right now."
                    : "No notifications right now."}
                </p>
              ) : (
                activeItems.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-xl border p-3 ${
                      item.source === "overdue"
                        ? "border-amber-400/40 bg-amber-500/10"
                        : item.security
                          ? "border-rose-400/40 bg-rose-500/10"
                          : item.source === "manager"
                            ? "border-sky-400/30 bg-sky-500/10"
                            : "border-slate-700 bg-slate-900/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white">
                        {item.title}
                      </h3>
                      <div className="flex shrink-0 items-center gap-1">
                        {item.source === "overdue" ? (
                          <span className="badge badge-sm badge-warning">
                            Past due
                          </span>
                        ) : item.security ? (
                          <span className="badge badge-sm badge-error gap-1">
                            <Shield className="size-3" aria-hidden="true" />
                            Security
                          </span>
                        ) : item.source === "manager" ? (
                          <span className="badge badge-sm badge-info">
                            Manager
                          </span>
                        ) : (
                          <span className="badge badge-sm">Assignment</span>
                        )}
                        {item.source === "manager" ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-white"
                            aria-label="Dismiss manager message"
                            onClick={() => dismissManagerMessage(item.id)}
                          >
                            <X className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{item.body}</p>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {formatDistanceToNow(new Date(item.receivedAtMs), {
                        addSuffix: true,
                      })}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
