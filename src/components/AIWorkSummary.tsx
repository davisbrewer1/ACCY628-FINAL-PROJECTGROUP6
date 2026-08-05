"use client";

import { useState } from "react";
import { Bot, RefreshCw, Sparkles } from "lucide-react";
import {
  generateAiWorkSummary,
  saveSummaryToWorkNotes,
} from "@/app/actions/ai-summary";
import { useToast } from "@/components/Toast";

interface AIWorkSummaryProps {
  ticketId?: string;
  technicianId?: string;
  initialNotes?: string;
  onInsert: (summary: string) => void;
}

export function AIWorkSummary({
  ticketId,
  technicianId,
  initialNotes = "",
  onInsert,
}: AIWorkSummaryProps) {
  const { showToast } = useToast();
  const [notes, setNotes] = useState(initialNotes);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    const result = await generateAiWorkSummary(notes);
    setLoading(false);

    if (!result.success || !result.summary) {
      setError(result.message);
      showToast(result.message, "error");
      return;
    }

    setSummary(result.summary);
    setProvider(result.provider ?? null);
    showToast("Summary ready.");
  }

  function handleInsert() {
    const value = summary.trim();
    if (!value) return;
    onInsert(value);
    showToast("Summary inserted into work notes.");
  }

  async function handleSaveToSupabase() {
    if (!ticketId || !technicianId) {
      showToast("Select a ticket before saving to work notes.", "error");
      return;
    }

    const value = summary.trim();
    if (!value) return;

    setSaving(true);
    const result = await saveSummaryToWorkNotes({
      ticketId,
      technicianId,
      summary: value,
    });
    setSaving(false);

    if (result.success) {
      showToast(result.message);
    } else {
      showToast(result.message, "error");
    }
  }

  return (
    <div className="card border border-base-300 bg-base-200/40 shadow-sm">
      <div className="card-body gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="size-4 text-primary" aria-hidden="true" />
              AI Work Summary
            </h3>
            <p className="text-xs text-base-content/60">
              Turn rough technician notes into a customer-friendly summary.
            </p>
          </div>
          {provider ? (
            <span className="badge badge-ghost badge-sm">
              {provider === "openai" ? "OpenAI" : "Local AI"}
            </span>
          ) : null}
        </div>

        <label className="form-control w-full">
          <span className="mb-1 text-xs font-medium text-base-content/70">
            Technician notes
          </span>
          <textarea
            className="textarea textarea-bordered min-h-24 w-full bg-base-100"
            placeholder="Paste or type your raw notes here…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={loading}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm gap-2"
            disabled={loading || !notes.trim()}
            onClick={() => void handleGenerate()}
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            {summary ? "Regenerate" : "Generate Summary"}
          </button>

          {summary ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm gap-2"
              disabled={loading || !notes.trim()}
              onClick={() => void handleGenerate()}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Regenerate
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="alert alert-error text-sm">
            <span>{error}</span>
          </div>
        ) : null}

        {summary || loading ? (
          <label className="form-control w-full">
            <span className="mb-1 text-xs font-medium text-base-content/70">
              Summary preview
            </span>
            {loading ? (
              <div className="flex min-h-28 items-center justify-center rounded-box border border-dashed border-base-300 bg-base-100">
                <span className="loading loading-spinner loading-md text-primary" />
              </div>
            ) : (
              <textarea
                className="textarea textarea-bordered min-h-28 w-full bg-base-100"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            )}
          </label>
        ) : null}

        {summary ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleInsert}
            >
              Insert into Work Notes
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={saving || !ticketId || !technicianId}
              onClick={() => void handleSaveToSupabase()}
              title={
                !ticketId
                  ? "Select a ticket first"
                  : "Save summary to work_notes"
              }
            >
              {saving ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                "Save to work notes"
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
