"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  getCustomerSelectableServiceDates,
  parseLocalDateKey,
} from "@/lib/technician-schedule";
import { createClient } from "@/lib/supabase/client";
import type { ServiceTicket, Technician } from "@/lib/types";

function dayKey(day: Date): string {
  return format(day, "yyyy-MM-dd");
}

interface ServiceDatePickerProps {
  /** Hidden input name for ASAP flag ("true" / "false"). */
  asapName?: string;
  /** Hidden input name for selected yyyy-MM-dd date. */
  dateName?: string;
  required?: boolean;
  className?: string;
  /** When false, hides ASAP and requires a calendar day (reschedule flow). */
  allowAsap?: boolean;
}

/**
 * Customer-facing ASAP + available-day calendar. Replaces severity on submit.
 * Days with no openings across any technician schedule are disabled.
 */
export function ServiceDatePicker({
  asapName = "is_asap",
  dateName = "locked_service_date",
  required = true,
  className = "",
  allowAsap = true,
}: ServiceDatePickerProps) {
  const [mode, setMode] = useState<"asap" | "date">(
    allowAsap ? "asap" : "date",
  );
  const [selectedDate, setSelectedDate] = useState("");
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const [techRes, ticketRes] = await Promise.all([
        supabase.from("technicians").select("*").eq("active", true),
        supabase
          .from("service_tickets")
          .select(
            "id, status, assigned_technician_id, scheduled_start, scheduled_window, max_hours",
          ),
      ]);
      if (cancelled) return;

      const dates = getCustomerSelectableServiceDates(
        (techRes.data ?? []) as Technician[],
        (ticketRes.data ?? []) as ServiceTicket[],
        { from: new Date(), weekCount: 8, durationHours: 1 },
      );
      setAvailableDates(new Set(dates));
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthAnchor), { weekStartsOn: 1 });
    const end = addDays(
      startOfWeek(endOfMonth(monthAnchor), { weekStartsOn: 1 }),
      6,
    );
    return eachDayOfInterval({ start, end });
  }, [monthAnchor]);

  const isAsap = mode === "asap";
  const validSelection =
    isAsap || (Boolean(selectedDate) && availableDates.has(selectedDate));

  return (
    <div className={`space-y-3 ${className}`}>
      <input type="hidden" name={asapName} value={isAsap ? "true" : "false"} />
      <input
        type="hidden"
        name={dateName}
        value={isAsap ? "" : selectedDate}
        required={required && !isAsap}
      />

      {allowAsap ? (
        <button
          type="button"
          className={`btn w-full justify-start gap-3 border-2 ${
            isAsap
              ? "border-error bg-error/15 text-error"
              : "border-base-300 bg-base-100"
          }`}
          onClick={() => {
            setMode("asap");
            setSelectedDate("");
          }}
          aria-pressed={isAsap}
        >
          <span className="badge badge-error badge-sm">ASAP</span>
          <span className="text-left">
            <span className="block font-semibold">ASAP — Emergency</span>
            <span className="block text-xs font-normal opacity-70">
              Critical priority · next available technician
            </span>
          </span>
        </button>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium">
          {allowAsap ? "Or choose an available day" : "Choose an available day"}
        </p>
        <div className="rounded-box border border-base-300 bg-base-100 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setMonthAnchor((m) => addMonths(m, -1))}
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="text-sm font-semibold">
              {format(monthAnchor, "MMMM yyyy")}
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setMonthAnchor((m) => addMonths(m, 1))}
              aria-label="Next month"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium opacity-60">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthDays.map((day) => {
              const key = dayKey(day);
              const inMonth = isSameMonth(day, monthAnchor);
              const weekday = day.getDay();
              const isWeekend = weekday === 0 || weekday === 6;
              const available = availableDates.has(key);
              const selectable = inMonth && !isWeekend && available;
              const selected = !isAsap && selectedDate === key;

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!selectable || loading}
                  className={`btn btn-xs h-8 min-h-0 border ${
                    selected
                      ? "border-primary bg-primary text-primary-content"
                      : selectable
                        ? "border-base-300 bg-base-200 hover:border-primary"
                        : "pointer-events-none border-transparent bg-transparent opacity-30"
                  } ${!inMonth ? "invisible" : ""}`}
                  onClick={() => {
                    setMode("date");
                    setSelectedDate(key);
                  }}
                  aria-label={
                    selectable
                      ? `Request service on ${format(day, "MMMM d, yyyy")}`
                      : undefined
                  }
                  aria-pressed={selected}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs opacity-60">
            {loading
              ? "Loading technician availability…"
              : "Grayed-out days have no openings on any technician schedule."}
          </p>
          {!isAsap && selectedDate ? (
            <p className="mt-1 text-xs font-medium text-primary">
              Requested:{" "}
              {format(parseLocalDateKey(selectedDate), "EEEE, MMM d, yyyy")}
            </p>
          ) : null}
        </div>
      </div>

      {required && !validSelection ? (
        <p className="text-xs text-error">
          Choose ASAP-Emergency or an available service day.
        </p>
      ) : null}
    </div>
  );
}
