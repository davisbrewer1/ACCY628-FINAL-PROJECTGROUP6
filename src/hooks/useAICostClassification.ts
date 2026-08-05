"use client";

import { useCallback, useState } from "react";
import { analyzeCostNotes } from "@/app/actions/ai-cost-classification";
import type {
  CostClassificationContext,
  CostClassificationResult,
} from "@/lib/ai/cost-classification";

export function useAICostClassification() {
  const [result, setResult] = useState<CostClassificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(
    async (notes: string, context: CostClassificationContext = {}) => {
      setLoading(true);
      setError(null);

      const response = await analyzeCostNotes(notes, context);
      setLoading(false);

      if (!response.success || !response.result) {
        setError(response.message);
        setResult(null);
        return null;
      }

      setResult(response.result);
      return response.result;
    },
    [],
  );

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const updateResult = useCallback(
    (updater: (current: CostClassificationResult) => CostClassificationResult) => {
      setResult((current) => (current ? updater(current) : current));
    },
    [],
  );

  return {
    result,
    loading,
    error,
    analyze,
    clear,
    updateResult,
    setResult,
  };
}
