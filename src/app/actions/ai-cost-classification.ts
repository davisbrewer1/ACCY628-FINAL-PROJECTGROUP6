"use server";

import type { ActionResult } from "@/app/actions/customers";
import {
  classifyWorkNotes,
  type CostClassificationContext,
  type CostClassificationResult,
} from "@/lib/ai/cost-classification";

export async function analyzeCostNotes(
  notes: string,
  context: CostClassificationContext = {},
): Promise<ActionResult & { result?: CostClassificationResult }> {
  try {
    const result = await classifyWorkNotes(notes, context);
    return {
      success: true,
      message: "Cost classification complete.",
      result,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to classify costs.";
    return { success: false, message };
  }
}
