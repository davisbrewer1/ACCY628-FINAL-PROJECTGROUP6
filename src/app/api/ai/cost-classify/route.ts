import { NextResponse } from "next/server";
import {
  classifyWorkNotes,
  type CostClassificationContext,
} from "@/lib/ai/cost-classification";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      notes?: string;
      context?: CostClassificationContext;
    };
    const result = await classifyWorkNotes(
      String(body.notes ?? ""),
      body.context ?? {},
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to classify costs.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
