"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "nexus-work-timer-start";

export interface WorkTimerResult {
  hours: number;
  startTime: string;
  endTime: string;
}

interface WorkTimerProps {
  onComplete: (result: WorkTimerResult) => void;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function toTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function readStoredStart(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function WorkTimer({ onComplete }: WorkTimerProps) {
  const [startMs, setStartMs] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const isRunning = startMs != null;

  useEffect(() => {
    const stored = readStoredStart();
    if (stored != null) {
      setStartMs(stored);
      setElapsedMs(Date.now() - stored);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (startMs == null) {
      return;
    }

    const tick = () => setElapsedMs(Date.now() - startMs);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startMs]);

  const handleStart = useCallback(() => {
    if (readStoredStart() != null || startMs != null) {
      return;
    }

    const now = Date.now();
    window.localStorage.setItem(STORAGE_KEY, String(now));
    setStartMs(now);
    setElapsedMs(0);
  }, [startMs]);

  const handleStop = useCallback(() => {
    const startedAt = startMs ?? readStoredStart();
    if (startedAt == null) {
      return;
    }

    const endedAt = Date.now();
    const hours = Math.round(((endedAt - startedAt) / 3600000) * 100) / 100;
    const startDate = new Date(startedAt);
    const endDate = new Date(endedAt);

    window.localStorage.removeItem(STORAGE_KEY);
    setStartMs(null);
    setElapsedMs(0);

    onComplete({
      hours,
      startTime: toTimeInputValue(startDate),
      endTime: toTimeInputValue(endDate),
    });
  }, [onComplete, startMs]);

  if (!hydrated) {
    return (
      <div className="rounded-box border border-base-300 bg-base-200/40 p-4">
        <div className="flex h-16 items-center justify-center">
          <span className="loading loading-spinner loading-sm text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-box border border-base-300 bg-base-200/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            Work timer
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
            {formatElapsed(elapsedMs)}
          </p>
          {isRunning ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-success">
              <span className="inline-block size-2 animate-pulse rounded-full bg-success" />
              Timer running…
            </p>
          ) : (
            <p className="mt-1 text-xs text-base-content/60">
              Start the timer to track time on this work entry.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!isRunning ? (
            <button
              type="button"
              className="btn btn-success"
              onClick={handleStart}
            >
              Start Work
            </button>
          ) : null}
          {isRunning ? (
            <button
              type="button"
              className="btn btn-error"
              onClick={handleStop}
            >
              Stop Work
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
