import type { SupabaseClient } from "@supabase/supabase-js";

/** Format a positive integer as TKT-0001 (padding grows past 9999). */
export function formatServiceTicketNumber(n: number): string {
  const safe = Math.max(1, Math.floor(n));
  const width = Math.max(4, String(safe).length);
  return `TKT-${String(safe).padStart(width, "0")}`;
}

function parseTicketSequence(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^TKT-(\d+)$/i.exec(value.trim());
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Allocate the next sequential ticket number (TKT-0001…).
 * Prefers the DB RPC from the sequential-ticket migration; falls back to
 * scanning existing ticket_number values when the RPC is unavailable.
 */
export async function allocateNextTicketNumber(
  supabase: SupabaseClient,
): Promise<string> {
  const { data, error } = await supabase.rpc("next_service_ticket_number");
  if (!error && typeof data === "string" && data.trim()) {
    return data.trim();
  }

  const { data: rows } = await supabase
    .from("service_tickets")
    .select("ticket_number")
    .like("ticket_number", "TKT-%");

  let max = 0;
  for (const row of rows ?? []) {
    const n = parseTicketSequence(
      (row as { ticket_number?: string }).ticket_number,
    );
    if (n != null && n > max) max = n;
  }

  return formatServiceTicketNumber(max + 1);
}
