"use server";

import type { ActionResult } from "@/app/actions/customers";
import { addWorkNote } from "@/app/actions/inline-ticket-actions";
import { generateWorkSummary } from "@/lib/ai/work-summary";

export async function generateAiWorkSummary(
  notes: string,
): Promise<ActionResult & { summary?: string; provider?: string }> {
  try {
    const result = await generateWorkSummary(notes);
    return {
      success: true,
      message: "Summary generated.",
      summary: result.summary,
      provider: result.provider,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate summary.";
    return { success: false, message };
  }
}

export async function saveSummaryToWorkNotes(input: {
  ticketId: string;
  technicianId: string;
  summary: string;
}): Promise<ActionResult> {
  return addWorkNote(input.ticketId, input.technicianId, input.summary);
}
