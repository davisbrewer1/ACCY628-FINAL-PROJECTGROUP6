"use client";

import { useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAICostClassification } from "@/hooks/useAICostClassification";
import type {
  CostCategory,
  CostClassificationContext,
  CostClassificationResult,
} from "@/lib/ai/cost-classification";
import { formatCurrency } from "@/lib/format";

export interface AICostApplyPayload {
  notes: string;
  estimatedHours: number;
  estimatedMiles: number;
  serviceKey: string;
  otherCategory: string;
  overrides: {
    laborCost: number;
    travelCost: number;
    equipmentCost: number;
    softwareCost: number;
    otherCost: number;
  };
  classification: CostClassificationResult;
}

interface AICostClassifierProps {
  initialNotes?: string;
  context?: CostClassificationContext;
  onApply: (payload: AICostApplyPayload) => void;
}

const CATEGORY_OPTIONS: CostCategory[] = [
  "labor",
  "travel",
  "equipment",
  "software",
  "other",
];

export function AICostClassifier({
  initialNotes = "",
  context,
  onApply,
}: AICostClassifierProps) {
  const { showToast } = useToast();
  const { result, loading, error, analyze, updateResult, setResult } =
    useAICostClassification();
  const [notes, setNotes] = useState(initialNotes);

  async function handleAnalyze() {
    const classification = await analyze(notes, context);
    if (!classification) {
      showToast(error || "Unable to analyze notes.", "error");
      return;
    }
    showToast("AI cost classification ready.");
  }

  function handleApply() {
    if (!result) return;
    onApply({
      notes,
      estimatedHours: result.estimatedHours,
      estimatedMiles: result.estimatedMiles,
      serviceKey: result.serviceKey,
      otherCategory: result.otherCategory,
      overrides: {
        laborCost: result.recommended.laborCost,
        travelCost: result.recommended.travelCost,
        equipmentCost: result.recommended.equipmentCost,
        softwareCost: result.recommended.softwareCost,
        otherCost: result.recommended.otherCost,
      },
      classification: result,
    });
    showToast("AI suggestions applied to cost entry.");
  }

  return (
    <div className="rounded-box border border-secondary/30 bg-secondary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="size-4 text-secondary" aria-hidden="true" />
            AI cost classification
          </h3>
          <p className="text-xs text-base-content/60">
            Analyze notes to predict category, hours, billable status, approval
            need, and recommended costs.
          </p>
        </div>
        {result ? (
          <span className="badge badge-ghost badge-sm">
            {result.provider === "openai" ? "OpenAI" : "Local AI"} ·{" "}
            {Math.round(result.confidence * 100)}% confidence
          </span>
        ) : null}
      </div>

      <label className="form-control mt-3 w-full">
        <span className="mb-1 text-xs font-medium">Technician notes</span>
        <textarea
          className="textarea textarea-bordered min-h-24 w-full bg-base-100"
          placeholder="Example: Replaced SSD onsite, installed endpoint agent, traveled 18 miles..."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          disabled={loading}
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-secondary btn-sm gap-2"
          disabled={loading || !notes.trim()}
          onClick={() => void handleAnalyze()}
        >
          {loading ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Sparkles className="size-4" aria-hidden="true" />
          )}
          Analyze with AI
        </button>
        {result ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setResult(null)}
          >
            Clear results
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="alert alert-error mt-3 text-sm">
          <span>{error}</span>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={result.billingStatus} />
            <StatusBadge
              status={
                result.approvalRequired
                  ? "Approval Required"
                  : "No Approval Needed"
              }
            />
            <span className="badge badge-outline badge-sm capitalize">
              {result.primaryCategory}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="form-control">
              <span className="label-text mb-1 text-xs">Primary category</span>
              <select
                className="select select-bordered select-sm"
                value={result.primaryCategory}
                onChange={(event) =>
                  updateResult((current) => ({
                    ...current,
                    primaryCategory: event.target.value as CostCategory,
                  }))
                }
              >
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">Estimated hours</span>
              <input
                type="number"
                min="0.25"
                step="0.25"
                className="input input-bordered input-sm"
                value={result.estimatedHours}
                onChange={(event) =>
                  updateResult((current) => ({
                    ...current,
                    estimatedHours: Number(event.target.value) || 0,
                    recommended: {
                      ...current.recommended,
                      laborCost:
                        (Number(event.target.value) || 0) *
                        (current.calculation.appliedHourlyRate || 55),
                      totalCost:
                        current.recommended.totalCost -
                        current.recommended.laborCost +
                        (Number(event.target.value) || 0) *
                          (current.calculation.appliedHourlyRate || 55),
                    },
                  }))
                }
              />
            </label>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">Estimated miles</span>
              <input
                type="number"
                min="0"
                step="1"
                className="input input-bordered input-sm"
                value={result.estimatedMiles}
                onChange={(event) =>
                  updateResult((current) => ({
                    ...current,
                    estimatedMiles: Number(event.target.value) || 0,
                  }))
                }
              />
            </label>

            <label className="form-control">
              <span className="label-text mb-1 text-xs">Service key</span>
              <input
                className="input input-bordered input-sm"
                value={result.serviceKey}
                onChange={(event) =>
                  updateResult((current) => ({
                    ...current,
                    serviceKey: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(
              [
                ["Labor", "laborCost"],
                ["Travel", "travelCost"],
                ["Equipment", "equipmentCost"],
                ["Software", "softwareCost"],
                ["Other", "otherCost"],
                ["Total", "totalCost"],
              ] as const
            ).map(([label, key]) => (
              <label key={key} className="form-control">
                <span className="label-text mb-1 text-xs">{label} (recommended)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input input-bordered input-sm"
                  value={result.recommended[key]}
                  onChange={(event) =>
                    updateResult((current) => ({
                      ...current,
                      recommended: {
                        ...current.recommended,
                        [key]: Number(event.target.value) || 0,
                      },
                    }))
                  }
                  disabled={key === "totalCost"}
                />
              </label>
            ))}
          </div>

          <div className="rounded-box border border-base-300 bg-base-100 p-3 text-sm">
            <p className="font-medium">AI rationale</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-base-content/70">
              {result.rationale.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {result.matchedKeywords.length > 0 ? (
              <p className="mt-2 text-xs text-base-content/50">
                Keywords: {result.matchedKeywords.join(", ")}
              </p>
            ) : null}
            <p className="mt-2 text-sm font-semibold">
              Suggested total: {formatCurrency(result.recommended.totalCost)}
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleApply}
          >
            Apply to Cost Entry
          </button>
        </div>
      ) : null}
    </div>
  );
}
