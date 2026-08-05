"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookOpen,
  Cloud,
  HardDrive,
  LifeBuoy,
  Shield,
  Brain,
  RefreshCw,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  daysOpen,
  getWorkOutstandingDueDays,
  isWorkOutstandingPastDue,
} from "@/lib/calculations";
import { isOpenTicket } from "@/lib/dashboard-stats";
import type { ServiceTicket } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

const SERVICE_KNOWLEDGE = [
  {
    title: "Hardware Procurement & Lifecycle",
    icon: HardDrive,
    summary:
      "Buy, image, deploy, warranty-track, and retire devices on a refresh schedule.",
    checklist: [
      "Confirm asset tag and serial before on-site work",
      "Document warranty and refresh year in hardware assets",
      "Wipe and retire devices only after manager approval",
    ],
  },
  {
    title: "Software & Cloud Management",
    icon: Cloud,
    summary:
      "Microsoft 365, identity, licensing, and cloud workspace support.",
    checklist: [
      "Verify license assignment before creating mailboxes",
      "Use least-privilege groups for SharePoint and Teams",
      "Capture change notes for tenant admin updates",
    ],
  },
  {
    title: "Managed IT Support",
    icon: LifeBuoy,
    summary: "Service desk tickets, remote support, and SLA-driven escalation.",
    checklist: [
      "Acknowledge Critical tickets within the SLA window",
      "Log start/end time for every work entry",
      "Escalate after two failed remote remediation attempts",
    ],
  },
  {
    title: "Cybersecurity Monitoring",
    icon: Shield,
    summary:
      "Endpoint, patch, backup, and firewall risk triage before outages.",
    checklist: [
      "Treat Security-tagged tickets as incident workflow",
      "Preserve logs before reboot or containment changes",
      "Notify the service manager for phishing or MFA fatigue",
    ],
  },
  {
    title: "AI Governance",
    icon: Brain,
    summary:
      "Inventory, policy, and risk review for existing AI platforms.",
    checklist: [
      "Do not connect live vendor AI APIs in this demo",
      "Flag unused licenses and shadow AI usage",
      "Document policy exceptions in ticket notes",
    ],
  },
  {
    title: "Deployment & Retirement",
    icon: RefreshCw,
    summary: "Rollouts, staging, data wipe, and end-of-life records.",
    checklist: [
      "Stage devices before deployment day",
      "Confirm user readiness window with the requester",
      "Record wipe method and retirement date",
    ],
  },
] as const;

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

type Panel = "knowledge" | "notifications" | null;

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  security: boolean;
  source: "manager" | "assignment" | "overdue";
};

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
  const [panel, setPanel] = useState<Panel>(null);
  const [assignedTickets, setAssignedTickets] = useState<ServiceTicket[]>([]);

  useEffect(() => {
    if (!technicianId) return;

    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("service_tickets")
        .select("*")
        .eq("assigned_technician_id", technicianId)
        .order("opened_at", { ascending: false })
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

  const overdueNotifications = useMemo((): NotificationItem[] => {
    return assignedTickets
      .filter((ticket) => isOpenTicket(ticket.status))
      .filter((ticket) =>
        isWorkOutstandingPastDue({
          status: ticket.status,
          priority: ticket.priority,
          openedAt: ticket.opened_at,
          createdAt: ticket.created_at,
        }),
      )
      .map((ticket) => {
        const opened = ticket.opened_at ?? ticket.created_at;
        const dueDays = getWorkOutstandingDueDays(ticket.priority);
        const dueAt = new Date(
          new Date(opened).getTime() + dueDays * 24 * 60 * 60 * 1000,
        );
        return {
          id: `overdue-${ticket.id}`,
          title: "Work Outstanding Past Due",
          body: buildOverdueBody(ticket),
          createdAt: dueAt.toISOString(),
          security: Boolean(ticket.cybersecurity_incident),
          source: "overdue" as const,
        };
      });
  }, [assignedTickets]);

  const assignmentNotifications = useMemo((): NotificationItem[] => {
    return assignedTickets
      .filter((ticket) => isOpenTicket(ticket.status))
      .filter(
        (ticket) =>
          ticket.status === "New" ||
          ticket.status === "Assigned" ||
          Boolean(ticket.cybersecurity_incident),
      )
      .slice(0, 8)
      .map((ticket) => ({
        id: `assign-${ticket.id}`,
        title: ticket.cybersecurity_incident
          ? `Security work assigned: ${ticket.title}`
          : `New assignment: ${ticket.title}`,
        body: `${ticket.ticket_number} · ${ticket.priority ?? "Medium"} priority · ${ticket.status}`,
        createdAt: ticket.opened_at ?? ticket.created_at,
        security: Boolean(ticket.cybersecurity_incident),
        source: "assignment" as const,
      }));
  }, [assignedTickets]);

  const notifications = useMemo((): NotificationItem[] => {
    return [
      ...MANAGER_MESSAGES.map((message) => ({
        ...message,
        security: false,
        source: "manager" as const,
      })),
      ...overdueNotifications,
      ...assignmentNotifications,
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [assignmentNotifications, overdueNotifications]);

  const unreadCount = notifications.length;

  function toggle(next: Panel) {
    setPanel((current) => (current === next ? null : next));
  }

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        className="btn btn-sm gap-2 border-slate-600 bg-slate-900 text-slate-100 hover:border-cyan-500/50"
        aria-expanded={panel === "knowledge"}
        onClick={() => toggle("knowledge")}
      >
        <BookOpen className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Knowledge base</span>
      </button>
      <button
        type="button"
        className="btn btn-sm gap-2 border-slate-600 bg-slate-900 text-slate-100 hover:border-cyan-500/50"
        aria-expanded={panel === "notifications"}
        onClick={() => toggle("notifications")}
      >
        <Bell className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Notifications</span>
        {unreadCount > 0 ? (
          <span className="badge badge-sm border-0 bg-cyan-500 text-slate-950">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {panel ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close panel"
            onClick={() => setPanel(null)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-cyan-500/25 bg-slate-950 shadow-2xl shadow-cyan-950/40">
            <div className="flex items-center justify-between border-b border-cyan-500/15 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {panel === "knowledge" ? "Service knowledge base" : "Notifications"}
                </p>
                <p className="text-xs text-slate-400">
                  {panel === "knowledge"
                    ? "Reference guides for Nexus service families"
                    : "Past-due work, manager messages, and new assignments"}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square text-slate-300"
                onClick={() => setPanel(null)}
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="max-h-[28rem] space-y-3 overflow-y-auto p-3">
              {panel === "knowledge"
                ? SERVICE_KNOWLEDGE.map((service) => {
                    const Icon = service.icon;
                    return (
                      <article
                        key={service.title}
                        className="rounded-xl border border-slate-700 bg-slate-900/80 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-lg bg-cyan-500/15 p-2 text-cyan-300">
                            <Icon className="size-4" aria-hidden="true" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-white">
                              {service.title}
                            </h3>
                            <p className="mt-1 text-xs text-slate-400">
                              {service.summary}
                            </p>
                            <ul className="mt-2 space-y-1 text-xs text-slate-300">
                              {service.checklist.map((item) => (
                                <li key={item}>• {item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </article>
                    );
                  })
                : notifications.length === 0 ? (
                    <p className="px-1 py-6 text-center text-sm text-slate-500">
                      No notifications right now.
                    </p>
                  ) : (
                    notifications.map((item) => (
                      <article
                        key={item.id}
                        className={`rounded-xl border p-3 ${
                          item.source === "overdue"
                            ? "border-amber-400/40 bg-amber-500/10"
                            : item.security
                              ? "border-rose-400/40 bg-rose-500/10"
                              : "border-slate-700 bg-slate-900/80"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-white">
                            {item.title}
                          </h3>
                          {item.source === "overdue" ? (
                            <span className="badge badge-sm badge-warning shrink-0">
                              Past due
                            </span>
                          ) : item.security ? (
                            <span className="badge badge-sm badge-error gap-1 shrink-0">
                              <Shield className="size-3" aria-hidden="true" />
                              Security
                            </span>
                          ) : item.source === "manager" ? (
                            <span className="badge badge-sm badge-info shrink-0">
                              Manager
                            </span>
                          ) : (
                            <span className="badge badge-sm shrink-0">Assignment</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-300">{item.body}</p>
                        <p className="mt-2 text-[11px] text-slate-500">
                          {formatDistanceToNow(new Date(item.createdAt), {
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
