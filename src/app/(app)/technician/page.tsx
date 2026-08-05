"use client";

import { createPtoRequest, cancelPtoRequest } from "@/app/actions/pto";
import {
  createWorkEntry,
  resubmitWorkEntry,
  updateWorkEntry,
} from "@/app/actions/work-entries";
import { updateTicketSchedule, updateTicketStatus } from "@/app/actions/tickets";
import { hoursBetween } from "@/lib/calculations";
import { isOpenTicket } from "@/lib/dashboard-stats";
import { AlertBanner } from "@/components/AlertBanner";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatusBadge } from "@/components/StatusBadge";
import {
  TechnicianScheduleCalendar,
  type CalendarMode,
} from "@/components/technician/TechnicianScheduleCalendar";
import {
  WorkEntryModal,
  type WorkEntryModalPhase,
} from "@/components/technician/WorkEntryModal";
import { useToast } from "@/components/Toast";
import { formatDate, formatHours } from "@/lib/format";
import {
  DEFAULT_ANNUAL_PTO_HOURS,
  DEFAULT_TECH_HOURLY_RATE,
  formatCurrency,
  getCurrentPayPeriod,
  sumHoursInRange,
} from "@/lib/technician-payroll";
import {
  getWorkWeekDays,
  parseScheduledSlot,
} from "@/lib/technician-schedule";
import type { PartUsageInput } from "@/lib/autoCostCalculator";
import { createClient } from "@/lib/supabase/client";
import type {
  InventoryPart,
  Profile,
  ServiceTicket,
  Technician,
  TechnicianPtoRequest,
  WorkEntry,
} from "@/lib/types";
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { ClipboardPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

function TechStat({
  title,
  value,
  hint,
  tone = "default",
}: {
  title: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "danger" | "warning" | "info" | "pto";
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-500/30 bg-rose-500/10"
      : tone === "warning"
        ? "border-amber-400/30 bg-amber-400/10"
        : tone === "info"
          ? "border-cyan-400/30 bg-cyan-500/10"
          : tone === "pto"
            ? "border-violet-400/30 bg-violet-500/10"
            : "border-cyan-500/20 bg-slate-900/70";

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function nowTimeValue(): string {
  return format(new Date(), "HH:mm");
}

export default function TechnicianWorkspacePage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [ptoRequests, setPtoRequests] = useState<TechnicianPtoRequest[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [resubmitId, setResubmitId] = useState<string | null>(null);
  const [workModalOpen, setWorkModalOpen] = useState(false);
  const [workModalPhase, setWorkModalPhase] =
    useState<WorkEntryModalPhase>("timer");
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("week");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [hoursWorked, setHoursWorked] = useState("");
  const [workPerformed, setWorkPerformed] = useState("");
  const [serviceMethod, setServiceMethod] = useState("On-site");
  const [ticketStatus, setTicketStatus] = useState("In Progress");
  const [inventoryParts, setInventoryParts] = useState<InventoryPart[]>([]);
  const [partsUsed, setPartsUsed] = useState<PartUsageInput[]>([]);
  const [partsStockCredit, setPartsStockCredit] = useState<PartUsageInput[]>(
    [],
  );
  const [liveSessionTicketId, setLiveSessionTicketId] = useState<string | null>(
    null,
  );
  const [sessionPaused, setSessionPaused] = useState(false);
  const [sessionEnRoute, setSessionEnRoute] = useState(false);
  const [enRouteTicketId, setEnRouteTicketId] = useState<string | null>(null);
  const [bankedWorkedSeconds, setBankedWorkedSeconds] = useState(0);
  const [segmentStartedAt, setSegmentStartedAt] = useState<number | null>(null);
  const [pauseCount, setPauseCount] = useState(0);
  const [hoursLockedFromSession, setHoursLockedFromSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ptoError, setPtoError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setTechnician(null);
        setTickets([]);
        setWorkEntries([]);
        setPtoRequests([]);
        setInventoryParts([]);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      setProfile(profileData);

      const { data: techData } = await supabase
        .from("technicians")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();

      setTechnician(techData);

      if (techData) {
        const [t, w, p, parts] = await Promise.all([
          supabase
            .from("service_tickets")
            .select("*")
            .eq("assigned_technician_id", techData.id)
            .order("opened_at", { ascending: false }),
          supabase
            .from("work_entries")
            .select("*")
            .eq("technician_id", techData.id)
            .order("work_date", { ascending: false }),
          supabase
            .from("technician_pto_requests")
            .select("*")
            .eq("technician_id", techData.id)
            .order("start_date", { ascending: false }),
          supabase
            .from("inventory_parts")
            .select("*")
            .eq("active", true)
            .order("part_name"),
        ]);
        setTickets(t.data ?? []);
        setWorkEntries(w.data ?? []);
        setPtoRequests(p.data ?? []);
        setInventoryParts((parts.data ?? []) as InventoryPart[]);
      } else {
        setTickets([]);
        setWorkEntries([]);
        setPtoRequests([]);
        setInventoryParts([]);
      }
    } catch (loadError) {
      console.error("technician loadData failed:", loadError);
      setError("Could not load technician workspace. Refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Keep top stats / calendar in sync as tickets are assigned or completed.
  useEffect(() => {
    const refresh = () => {
      void loadData();
    };
    const intervalId = window.setInterval(refresh, 15000);
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadData]);

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  const assignedOpen = useMemo(
    () => tickets.filter((t) => isOpenTicket(t.status)),
    [tickets],
  );

  /** Open work plus completed/closed items that still have a calendar slot. */
  const calendarTickets = useMemo(
    () =>
      tickets.filter((t) => {
        if (isOpenTicket(t.status)) return true;
        const done = t.status === "Completed" || t.status === "Closed";
        return done && Boolean(t.scheduled_start && t.scheduled_window);
      }),
    [tickets],
  );

  const hoursThisWeek = useMemo(() => {
    const now = new Date();
    return sumHoursInRange(
      workEntries,
      startOfWeek(now, { weekStartsOn: 1 }),
      endOfWeek(now, { weekStartsOn: 1 }),
    );
  }, [workEntries]);

  const returnedEntries = useMemo(
    () => workEntries.filter((e) => e.approval_status === "Disputed"),
    [workEntries],
  );

  const pendingCount = useMemo(
    () =>
      workEntries.filter(
        (e) => !e.approval_status || e.approval_status === "Pending",
      ).length,
    [workEntries],
  );

  const hoursScheduledThisWeek = useMemo(() => {
    const now = new Date();
    const weekDays = getWorkWeekDays(now);
    return assignedOpen.reduce((sum, ticket) => {
      const parsed = parseScheduledSlot(ticket);
      if (!parsed) return sum;
      if (!weekDays.some((day) => isSameDay(day, parsed.day))) return sum;
      return sum + parsed.durationHours;
    }, 0);
  }, [assignedOpen]);

  const payPeriod = useMemo(() => getCurrentPayPeriod(), []);
  const payPeriodHours = useMemo(
    () => sumHoursInRange(workEntries, payPeriod.start, payPeriod.end),
    [workEntries, payPeriod],
  );

  const payRate = DEFAULT_TECH_HOURLY_RATE;
  const payPeriodEarnings = payPeriodHours * payRate;

  const annualPtoAllowance =
    Number(technician?.annual_pto_hours) || DEFAULT_ANNUAL_PTO_HOURS;

  const ptoUsedOrPending = useMemo(() => {
    const yearStart = startOfYear(new Date());
    return ptoRequests
      .filter((request) => {
        if (request.status === "Denied" || request.status === "Cancelled") return false;
        const start = parseISO(request.start_date);
        return start >= yearStart;
      })
      .reduce((sum, request) => sum + Number(request.hours_requested ?? 0), 0);
  }, [ptoRequests]);

  const ptoRemaining = Math.max(0, annualPtoAllowance - ptoUsedOrPending);

  const ptoDates = useMemo(() => {
    const dates = new Set<string>();
    for (const request of ptoRequests) {
      if (request.status === "Denied" || request.status === "Cancelled") continue;
      const start = parseISO(request.start_date);
      const end = parseISO(request.end_date);
      for (const day of eachDayOfInterval({ start, end })) {
        dates.add(format(day, "yyyy-MM-dd"));
      }
    }
    return dates;
  }, [ptoRequests]);

  useEffect(() => {
    if (hoursLockedFromSession) return;
    if (startTime && endTime) {
      const hours = hoursBetween(startTime, endTime);
      if (hours != null) {
        setHoursWorked(hours.toString());
      }
    }
  }, [startTime, endTime, hoursLockedFromSession]);

  function resetSessionTimer() {
    setSessionPaused(false);
    setSessionEnRoute(false);
    setBankedWorkedSeconds(0);
    setSegmentStartedAt(null);
    setPauseCount(0);
    setHoursLockedFromSession(false);
  }

  function patchTicketLocal(
    ticketId: string,
    patch: Partial<ServiceTicket>,
  ) {
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, ...patch } : ticket,
      ),
    );
  }

  function currentActiveSeconds(): number {
    let total = bankedWorkedSeconds;
    if (!sessionPaused && segmentStartedAt != null) {
      total += Math.max(0, Math.floor((Date.now() - segmentStartedAt) / 1000));
    }
    return total;
  }

  function resetPartsSelection() {
    setPartsUsed([]);
    setPartsStockCredit([]);
  }

  function normalizePartsUsed(raw: WorkEntry["parts_used"]): PartUsageInput[] {
    if (!Array.isArray(raw)) return [];
    const parts: PartUsageInput[] = [];
    for (const item of raw) {
      const partId = String(item.partId ?? "").trim();
      const quantity = Number(item.quantity);
      const unitCost = Number(item.unitCost);
      if (!partId || !Number.isFinite(quantity) || quantity < 1) continue;
      parts.push({
        partId,
        partName: item.partName ? String(item.partName) : undefined,
        unitCost: Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0,
        quantity: Math.floor(quantity),
      });
    }
    return parts;
  }

  function openBlankWorkEntry() {
    setEditingEntryId(null);
    setSelectedTicketId("");
    setWorkDate(new Date().toISOString().slice(0, 10));
    setStartTime("");
    setEndTime("");
    setHoursWorked("");
    setWorkPerformed("");
    setServiceMethod("On-site");
    setTicketStatus("In Progress");
    setLiveSessionTicketId(null);
    resetSessionTimer();
    resetPartsSelection();
    setWorkModalPhase("form");
    setError(null);
    setWorkModalOpen(true);
  }

  function openWorkEntryForTicket(ticketId: string) {
    const ticket = assignedOpen.find((item) => item.id === ticketId);
    if (!ticket) return;

    setEditingEntryId(null);
    setSelectedTicketId(ticketId);
    setWorkPerformed("");
    setServiceMethod("On-site");
    setTicketStatus("In Progress");
    setError(null);
    setWorkModalPhase("timer");

    // Resume an in-progress on-site or en-route session for this ticket.
    if (
      liveSessionTicketId === ticketId &&
      ((startTime && !endTime) || sessionEnRoute)
    ) {
      setWorkModalOpen(true);
      return;
    }

    if (enRouteTicketId === ticketId && !startTime) {
      setSessionEnRoute(true);
      setLiveSessionTicketId(ticketId);
      resetPartsSelection();
      setWorkModalOpen(true);
      return;
    }

    setLiveSessionTicketId(null);
    resetSessionTimer();
    setWorkDate(format(new Date(), "yyyy-MM-dd"));
    setStartTime("");
    setEndTime("");
    setHoursWorked("");
    resetPartsSelection();
    setWorkModalOpen(true);
  }

  function openWorkEntryForEdit(entry: WorkEntry) {
    setEditingEntryId(entry.id);
    setSelectedTicketId(entry.ticket_id);
    setWorkDate(entry.work_date ?? new Date().toISOString().slice(0, 10));
    setStartTime(entry.start_time ? String(entry.start_time).slice(0, 5) : "");
    setEndTime(entry.end_time ? String(entry.end_time).slice(0, 5) : "");
    setHoursWorked(
      entry.hours_worked != null ? String(entry.hours_worked) : "",
    );
    setWorkPerformed(entry.work_performed ?? "");
    setServiceMethod(entry.service_method ?? "On-site");
    setTicketStatus("");
    setLiveSessionTicketId(null);
    setEnRouteTicketId(null);
    resetSessionTimer();
    const savedParts = normalizePartsUsed(entry.parts_used);
    setPartsUsed(savedParts);
    setPartsStockCredit(savedParts);
    setWorkModalPhase("form");
    setError(null);
    setWorkModalOpen(true);
  }

  function handleEnRoute() {
    if (!selectedTicketId || startTime) return;
    setSessionEnRoute(true);
    setEnRouteTicketId(selectedTicketId);
    setLiveSessionTicketId(selectedTicketId);
    setTicketStatus("In Progress");
    setServiceMethod("On-site");
    patchTicketLocal(selectedTicketId, { status: "In Progress" });
    startTransition(async () => {
      const result = await updateTicketStatus(selectedTicketId, "In Progress");
      if (!result.success) {
        showToast(result.message, "error");
      } else {
        showToast("Marked on the way to the job.");
        await loadData();
      }
    });
  }

  function handleStartOnSite() {
    const startedAt = nowTimeValue();
    setWorkDate(format(new Date(), "yyyy-MM-dd"));
    setStartTime(startedAt);
    setEndTime("");
    setHoursWorked("");
    setServiceMethod("On-site");
    setTicketStatus("In Progress");
    setLiveSessionTicketId(selectedTicketId || null);
    setSessionEnRoute(false);
    setSessionPaused(false);
    setBankedWorkedSeconds(0);
    setSegmentStartedAt(Date.now());
    setPauseCount(0);
    setHoursLockedFromSession(false);
    if (selectedTicketId) {
      patchTicketLocal(selectedTicketId, { status: "In Progress" });
      if (enRouteTicketId === selectedTicketId) {
        setEnRouteTicketId(null);
      }
    }
  }

  function handlePauseJob() {
    if (!startTime || endTime || sessionPaused || segmentStartedAt == null) return;
    const segmentSeconds = Math.max(
      0,
      Math.floor((Date.now() - segmentStartedAt) / 1000),
    );
    setBankedWorkedSeconds((prev) => prev + segmentSeconds);
    setSegmentStartedAt(null);
    setSessionPaused(true);
    setPauseCount((prev) => prev + 1);
    setTicketStatus("In Progress");
  }

  function handleResumeJob() {
    if (!startTime || endTime || !sessionPaused) return;
    setSessionPaused(false);
    setSegmentStartedAt(Date.now());
    setTicketStatus("In Progress");
  }

  function handleEndJob() {
    if (!startTime) return;
    const endedAt = nowTimeValue();
    const activeSeconds = currentActiveSeconds();
    const hours = Math.round((activeSeconds / 3600) * 100) / 100;
    setEndTime(endedAt);
    setHoursWorked(hours.toString());
    setHoursLockedFromSession(true);
    setSessionPaused(false);
    setSessionEnRoute(false);
    setSegmentStartedAt(null);
    setBankedWorkedSeconds(activeSeconds);
    setTicketStatus("Completed");
    setLiveSessionTicketId(null);
    setEnRouteTicketId(null);
    if (selectedTicketId) {
      // Update top stats immediately; save persists via work entry.
      patchTicketLocal(selectedTicketId, {
        status: "Completed",
        completed_at: new Date().toISOString(),
      });
    }
    if (pauseCount > 0) {
      setWorkPerformed((prev) => {
        const note = `On-site visit included ${pauseCount} pause${pauseCount === 1 ? "" : "s"} (time away excluded from hours).`;
        if (!prev.trim()) return note;
        if (prev.includes("pause")) return prev;
        return `${prev.trim()}\n${note}`;
      });
    }
    setWorkModalPhase("form");
  }

  function handleWorkEntry(formData: FormData) {
    if (!technician || !selectedTicket) return;
    formData.set("technician_id", technician.id);
    formData.set("customer_id", selectedTicket.customer_id);
    formData.set("contract_id", selectedTicket.contract_id ?? "");
    formData.set("ticket_id", selectedTicket.id);
    if (editingEntryId) {
      formData.set("entry_id", editingEntryId);
    }

    setError(null);
    startTransition(async () => {
      const result = editingEntryId
        ? await updateWorkEntry(formData)
        : await createWorkEntry(formData);
      if (result.success) {
        showToast(result.message);
        setWorkModalOpen(false);
        setEditingEntryId(null);
        setLiveSessionTicketId(null);
        resetSessionTimer();
        setWorkModalPhase("timer");
        setStartTime("");
        setEndTime("");
        setHoursWorked("");
        setWorkPerformed("");
        resetPartsSelection();
        await loadData();
      } else {
        setError(result.message);
      }
    });
  }

  function handleMoveTicket(input: {
    ticketId: string;
    scheduledStart: string;
    scheduledWindow: string;
    swapTicketId?: string | null;
    swapScheduledStart?: string | null;
    swapScheduledWindow?: string | null;
  }) {
    startTransition(async () => {
      try {
        const result = await updateTicketSchedule({
          ticketId: input.ticketId,
          scheduledStart: input.scheduledStart,
          scheduledWindow: input.scheduledWindow,
          swapTicketId: input.swapTicketId ?? null,
          swapScheduledStart: input.swapScheduledStart ?? null,
          swapScheduledWindow: input.swapScheduledWindow ?? null,
        });
        if (result.success) {
          showToast(result.message);
          await loadData();
        } else {
          showToast(result.message, "error");
        }
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Could not update the schedule. Please refresh and try again.";
        showToast(message, "error");
      }
    });
  }

  function handlePtoRequest(formData: FormData) {
    if (!technician) return;
    formData.set("technician_id", technician.id);
    setPtoError(null);
    startTransition(async () => {
      const result = await createPtoRequest(formData);
      if (result.success) {
        showToast(result.message);
        await loadData();
      } else {
        setPtoError(result.message);
      }
    });
  }

  function handleCancelPto(requestId: string) {
    startTransition(async () => {
      const result = await cancelPtoRequest(requestId);
      if (result.success) {
        showToast(result.message);
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    });
  }

  function handleResubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await resubmitWorkEntry(formData);
      if (result.success) {
        showToast(result.message);
        setResubmitId(null);
        await loadData();
      } else {
        setError(result.message);
      }
    });
  }

  if (activeRole !== "technician" && activeRole !== "administrator") {
    return (
      <AlertBanner
        tone="info"
        title="Technician workspace"
        message="This workspace is designed for technicians. Switch roles or use the Demo Role Switcher to preview this view."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-cyan-400" />
      </div>
    );
  }

  if (!technician) {
    return (
      <div className="rounded-xl border border-cyan-500/20 bg-slate-900/80 p-8 text-center text-slate-200">
        <h3 className="text-lg font-semibold text-white">No technician profile linked</h3>
        <p className="mt-2 text-sm text-slate-400">
          Your account is not linked to a technician record. Contact an administrator to assign
          your technician profile.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-100">
      <PageHeader
        title={`Welcome, ${profile?.full_name ?? technician.technician_name}`}
        description="Schedule tickets, request PTO, log work, and track pay-period hours."
        action={
          <button
            type="button"
            className="btn border-0 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            onClick={openBlankWorkEntry}
          >
            <ClipboardPlus className="size-4" aria-hidden="true" />
            Log work
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <TechStat title="Open assignments" value={assignedOpen.length} />
        <TechStat
          title="Hours Completed this Week"
          value={hoursThisWeek.toFixed(1)}
          tone="info"
          hint="Logged work Mon–Sun · refreshes automatically"
        />
        <TechStat
          title="Remaining Hours Scheduled this Week"
          value={hoursScheduledThisWeek.toFixed(1)}
          hint="Open tickets scheduled Mon–Fri this week"
        />
      </div>

      {(returnedEntries.length > 0 || pendingCount > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm">
            <p className="font-medium text-amber-100">
              {pendingCount} awaiting manager approval
            </p>
            <p className="mt-1 text-slate-400">
              Logged in My Work — reviewed under Work &amp; Billing by managers.
            </p>
          </div>
          {returnedEntries.length > 0 ? (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm">
              <p className="font-medium text-rose-100">
                {returnedEntries.length} returned for correction
              </p>
              <p className="mt-1 text-slate-400">
                Fix the note from your manager and resubmit below.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-sm text-slate-500">
              No entries currently returned.
            </div>
          )}
        </div>
      )}

      {returnedEntries.length > 0 ? (
        <section className="rounded-xl border border-rose-400/30 bg-slate-900/80 shadow-sm">
          <div className="space-y-4 p-5">
            <h2 className="text-base font-semibold text-white">
              Returned work (fix &amp; resubmit)
            </h2>
            {error && resubmitId ? (
              <div className="alert alert-error text-sm">
                <span>{error}</span>
              </div>
            ) : null}
            <div className="space-y-3">
              {returnedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-700 bg-slate-950/60 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">
                        {formatDate(entry.work_date)} · {formatHours(entry.hours_worked)}
                      </p>
                      <p className="text-sm text-slate-400">
                        {entry.work_performed ?? "No work description"}
                      </p>
                    </div>
                    <StatusBadge status="Disputed" />
                  </div>
                  {entry.approval_notes ? (
                    <div className="mt-2 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
                      <span className="font-medium">Manager note: </span>
                      {entry.approval_notes}
                    </div>
                  ) : null}

                  {resubmitId === entry.id ? (
                    <form
                      action={handleResubmit}
                      className="mt-3 grid gap-3 sm:grid-cols-2"
                    >
                      <input type="hidden" name="entry_id" value={entry.id} />
                      <FormField label="Work date" htmlFor={`rs-date-${entry.id}`}>
                        <input
                          id={`rs-date-${entry.id}`}
                          name="work_date"
                          type="date"
                          className="input input-bordered w-full border-slate-600 bg-slate-950"
                          defaultValue={entry.work_date ?? ""}
                        />
                      </FormField>
                      <FormField label="Hours worked" htmlFor={`rs-hours-${entry.id}`}>
                        <input
                          id={`rs-hours-${entry.id}`}
                          name="hours_worked"
                          type="number"
                          min="0"
                          step="0.25"
                          className="input input-bordered w-full border-slate-600 bg-slate-950"
                          defaultValue={entry.hours_worked ?? ""}
                          required
                        />
                      </FormField>
                      <FormField
                        label="Work performed"
                        htmlFor={`rs-work-${entry.id}`}
                        className="sm:col-span-2"
                      >
                        <textarea
                          id={`rs-work-${entry.id}`}
                          name="work_performed"
                          className="textarea textarea-bordered w-full border-slate-600 bg-slate-950"
                          rows={2}
                          defaultValue={entry.work_performed ?? ""}
                          required
                        />
                      </FormField>
                      <FormField label="Billing type" htmlFor={`rs-inc-${entry.id}`}>
                        <select
                          id={`rs-inc-${entry.id}`}
                          name="included_in_contract"
                          className="select select-bordered w-full border-slate-600 bg-slate-950"
                          defaultValue={entry.included_in_contract ? "true" : "false"}
                        >
                          <option value="true">Included / block hours</option>
                          <option value="false">Billable T&amp;M / overage</option>
                        </select>
                      </FormField>
                      <FormField label="Service method" htmlFor={`rs-method-${entry.id}`}>
                        <select
                          id={`rs-method-${entry.id}`}
                          name="service_method"
                          className="select select-bordered w-full border-slate-600 bg-slate-950"
                          defaultValue={entry.service_method ?? "Remote"}
                        >
                          <option value="Remote">Remote</option>
                          <option value="On-site">On-site</option>
                        </select>
                      </FormField>
                      <div className="flex flex-wrap gap-2 sm:col-span-2">
                        <button
                          type="submit"
                          className="btn btn-sm border-0 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                          disabled={isPending}
                        >
                          Resubmit for approval
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm text-slate-300"
                          onClick={() => setResubmitId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm mt-3 border-slate-600 text-slate-200"
                      onClick={() => {
                        setError(null);
                        setResubmitId(entry.id);
                      }}
                    >
                      Fix &amp; resubmit
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-4 shadow-lg sm:p-5">
        <TechnicianScheduleCalendar
          tickets={calendarTickets}
          anchor={calendarAnchor}
          mode={calendarMode}
          onAnchorChange={setCalendarAnchor}
          onModeChange={setCalendarMode}
          selectedTicketId={selectedTicketId}
          onSelectTicket={openWorkEntryForTicket}
          onMoveTicket={handleMoveTicket}
          ptoDates={ptoDates}
          busy={isPending}
          enRouteTicketId={enRouteTicketId}
        />
      </div>

      <div className="rounded-xl border border-violet-400/20 bg-slate-900/80 shadow-sm">
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">Request PTO</h2>
              <p className="mt-1 text-sm text-slate-400">
                Pending and approved requests reduce your remaining balance.
              </p>
            </div>
            <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-violet-200/80">
                PTO remaining
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {ptoRemaining.toFixed(0)} hrs
              </p>
              <p className="mt-1 text-xs text-slate-400">
                of {annualPtoAllowance} hrs annual allotment
              </p>
            </div>
          </div>
          {ptoError ? (
            <div className="alert alert-error text-sm">
              <span>{ptoError}</span>
            </div>
          ) : null}
          <form action={handlePtoRequest} className="form-grid grid gap-4 md:grid-cols-2">
            <FormField label="Start date" htmlFor="start_date" required>
              <input
                id="start_date"
                name="start_date"
                type="date"
                required
                className="input input-bordered w-full border-slate-600 bg-slate-950"
              />
            </FormField>
            <FormField label="End date" htmlFor="end_date" required>
              <input
                id="end_date"
                name="end_date"
                type="date"
                required
                className="input input-bordered w-full border-slate-600 bg-slate-950"
              />
            </FormField>
            <FormField
              label="Hours requested"
              htmlFor="hours_requested"
              hint="Defaults to 8 hours per day in the range if left blank."
            >
              <input
                id="hours_requested"
                name="hours_requested"
                type="number"
                min="0.5"
                step="0.5"
                className="input input-bordered w-full border-slate-600 bg-slate-950"
                placeholder="Auto from date range"
              />
            </FormField>
            <FormField label="Reason" htmlFor="reason">
              <textarea
                id="reason"
                name="reason"
                rows={2}
                className="textarea textarea-bordered w-full border-slate-600 bg-slate-950"
                placeholder="Vacation, appointment, etc."
              />
            </FormField>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="btn border-0 bg-violet-500 text-white hover:bg-violet-400"
                disabled={isPending}
              >
                {isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Submit PTO request"
                )}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-200">Your PTO requests</h3>
            {ptoRequests.length === 0 ? (
              <p className="text-sm text-slate-500">No PTO requests yet.</p>
            ) : (
              <div className="space-y-2">
                {ptoRequests.slice(0, 6).map((request) => (
                  <div
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-white">
                        {request.start_date}
                        {request.end_date !== request.start_date
                          ? ` → ${request.end_date}`
                          : ""}
                      </p>
                      <p className="text-xs text-slate-400">
                        {Number(request.hours_requested).toFixed(1)} hrs
                        {request.reason ? ` · ${request.reason}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={request.status} />
                      {request.status === "Pending" ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-slate-300"
                          disabled={isPending}
                          onClick={() => handleCancelPto(request.id)}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-400/25 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-white">Current pay period</h2>
          <p className="mt-1 text-sm text-slate-400">
            Biweekly · {format(payPeriod.start, "MMM d")} –{" "}
            {format(payPeriod.end, "MMM d, yyyy")}
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-400/20 bg-slate-950/50 p-4">
            <p className="text-sm text-slate-300">Pay rate</p>
            <p className="mt-1 text-3xl font-semibold text-white">
              {formatCurrency(payRate)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-slate-950/50 p-4">
            <p className="text-sm text-slate-300">Hours worked this period</p>
            <p className="mt-1 text-3xl font-semibold text-white">
              {payPeriodHours.toFixed(1)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-slate-950/50 p-4">
            <p className="text-sm text-slate-300">Current Earnings this period</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-300">
              {formatCurrency(payPeriodEarnings)}
            </p>
          </div>
        </div>
      </div>

      {workEntries.length > 0 ? (
        <div className="rounded-xl border border-cyan-500/20 bg-slate-900/80 shadow-sm">
          <div className="space-y-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-white">Recent work</h2>
              <p className="mt-1 text-sm text-slate-400">
                Click a row to edit a completed work entry.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-sm text-slate-200">
                <thead>
                  <tr className="border-slate-700 text-slate-400">
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Work performed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workEntries.slice(0, 8).map((entry) => (
                    <tr
                      key={entry.id}
                      className="cursor-pointer border-slate-800 transition hover:bg-cyan-500/10"
                      onClick={() => openWorkEntryForEdit(entry)}
                    >
                      <td>{entry.work_date ?? "—"}</td>
                      <td>{formatHours(entry.hours_worked)}</td>
                      <td>{entry.work_performed ?? "—"}</td>
                      <td>
                        <StatusBadge
                          status={
                            entry.approval_status === "Disputed"
                              ? "Disputed"
                              : entry.approval_status === "Pending"
                                ? "Pending"
                                : entry.approval_status === "Approved"
                                  ? "Approved"
                                  : entry.included_in_contract
                                    ? "Included"
                                    : "Billable"
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <WorkEntryModal
        open={workModalOpen}
        onClose={() => {
          setWorkModalOpen(false);
          setEditingEntryId(null);
          // Keep active on-site / en-route sessions so reopening the ticket resumes them.
          if (!(startTime && !endTime) && !sessionEnRoute) {
            setLiveSessionTicketId(null);
          }
        }}
        tickets={
          editingEntryId
            ? // Include the selected ticket even if closed, so edits still show the label.
              (() => {
                const selected = tickets.find((ticket) => ticket.id === selectedTicketId);
                const merged = [...assignedOpen];
                if (selected && !merged.some((ticket) => ticket.id === selected.id)) {
                  merged.unshift(selected);
                }
                return merged;
              })()
            : assignedOpen
        }
        selectedTicketId={selectedTicketId}
        onSelectedTicketChange={setSelectedTicketId}
        workDate={workDate}
        onWorkDateChange={setWorkDate}
        startTime={startTime}
        onStartTimeChange={(value) => {
          setHoursLockedFromSession(false);
          setStartTime(value);
        }}
        endTime={endTime}
        onEndTimeChange={(value) => {
          setHoursLockedFromSession(false);
          setEndTime(value);
        }}
        hoursWorked={hoursWorked}
        onHoursWorkedChange={setHoursWorked}
        workPerformed={workPerformed}
        onWorkPerformedChange={setWorkPerformed}
        serviceMethod={serviceMethod}
        onServiceMethodChange={setServiceMethod}
        ticketStatus={ticketStatus}
        onTicketStatusChange={setTicketStatus}
        inventoryParts={inventoryParts}
        partsUsed={partsUsed}
        onPartsUsedChange={setPartsUsed}
        partsStockCredit={partsStockCredit}
        error={error}
        isPending={isPending}
        onSubmit={handleWorkEntry}
        mode={editingEntryId ? "edit" : "create"}
        phase={workModalPhase}
        onPhaseChange={setWorkModalPhase}
        onEnRoute={handleEnRoute}
        onStartOnSite={handleStartOnSite}
        onPauseJob={handlePauseJob}
        onResumeJob={handleResumeJob}
        onEndJob={handleEndJob}
        sessionEnRoute={sessionEnRoute}
        sessionPaused={sessionPaused}
        bankedWorkedSeconds={bankedWorkedSeconds}
        segmentStartedAt={segmentStartedAt}
        pauseCount={pauseCount}
      />
    </div>
  );
}
