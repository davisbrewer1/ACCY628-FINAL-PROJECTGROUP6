import { NextResponse } from "next/server";
import { generateWorkSummary } from "@/lib/ai/work-summary";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { notes?: string };
    const notes = String(body.notes ?? "");
    const result = await generateWorkSummary(notes);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate summary.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
