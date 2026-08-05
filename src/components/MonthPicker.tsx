"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  format,
  getMonth,
  getYear,
  isSameMonth,
  parseISO,
  startOfMonth,
} from "date-fns";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface MonthPickerProps {
  /** Month keys with activity, format yyyy-MM */
  activeMonthKeys: Set<string>;
  /** Selected month as Date (start of month) or null for all time */
  value: Date | null;
  onChange: (month: Date | null) => void;
  label?: string;
}

export function MonthPicker({
  activeMonthKeys,
  value,
  onChange,
  label = "Month",
}: MonthPickerProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [viewYear, setViewYear] = useState(
    () => getYear(value ?? new Date()),
  );

  useEffect(() => {
    if (value) setViewYear(getYear(value));
  }, [value]);

  const yearsWithData = useMemo(() => {
    const years = new Set<number>();
    for (const key of activeMonthKeys) {
      const y = Number(key.slice(0, 4));
      if (!Number.isNaN(y)) years.add(y);
    }
    return years;
  }, [activeMonthKeys]);

  function selectMonth(monthIndex: number) {
    const key = `${viewYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    if (!activeMonthKeys.has(key)) return;
    onChange(startOfMonth(new Date(viewYear, monthIndex, 1)));
    if (detailsRef.current) detailsRef.current.open = false;
  }

  const display = value ? format(value, "MMMM yyyy") : "All time";

  return (
    <div className="form-control w-full max-w-xs">
      <span className="label-text mb-1 text-xs font-medium">{label}</span>
      <details ref={detailsRef} className="dropdown">
        <summary className="btn btn-outline btn-sm w-full justify-between font-normal">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="size-4" aria-hidden="true" />
            {display}
          </span>
        </summary>
        <div className="dropdown-content z-30 mt-2 w-72 rounded-box border border-base-300 bg-base-100 p-3 shadow-lg">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="Previous year"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold">{viewYear}</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setViewYear((y) => y + 1)}
              aria-label="Next year"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {!yearsWithData.has(viewYear) ? (
            <p className="mb-2 text-center text-xs text-base-content/60">
              No resolved tickets in {viewYear}
            </p>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            {MONTH_LABELS.map((name, index) => {
              const key = `${viewYear}-${String(index + 1).padStart(2, "0")}`;
              const hasData = activeMonthKeys.has(key);
              const selected =
                value != null &&
                getYear(value) === viewYear &&
                getMonth(value) === index;

              return (
                <button
                  key={name}
                  type="button"
                  disabled={!hasData}
                  onClick={() => selectMonth(index)}
                  className={[
                    "btn btn-sm",
                    selected ? "btn-primary" : "btn-ghost",
                    !hasData ? "pointer-events-none opacity-35 grayscale" : "",
                  ].join(" ")}
                  title={
                    hasData
                      ? `Show ${name} ${viewYear}`
                      : `No tickets resolved in ${name} ${viewYear}`
                  }
                >
                  {name}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-xs mt-3 w-full"
            onClick={() => {
              onChange(null);
              if (detailsRef.current) detailsRef.current.open = false;
            }}
          >
            Clear — all time
          </button>
        </div>
      </details>
    </div>
  );
}

export function monthKeyFromDate(value: string | Date): string | null {
  try {
    const d = typeof value === "string" ? parseISO(value) : value;
    if (Number.isNaN(d.getTime())) return null;
    return format(d, "yyyy-MM");
  } catch {
    return null;
  }
}

export function isInSelectedMonth(
  dateStr: string | null | undefined,
  month: Date | null,
): boolean {
  if (!month) return true;
  if (!dateStr) return false;
  try {
    return isSameMonth(parseISO(dateStr), month);
  } catch {
    return false;
  }
}

/** Keep TypeScript happy when building year navigation ranges. */
export function shiftMonth(base: Date, amount: number): Date {
  return addMonths(base, amount);
}
