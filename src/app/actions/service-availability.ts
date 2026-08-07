"use server";

import { createClient } from "@/lib/supabase/server";
import { getCustomerSelectableServiceDates } from "@/lib/technician-schedule";
import type { ServiceTicket, Technician } from "@/lib/types";

/** Load selectable service days as the signed-in client (RLS applies). */
export async function loadCustomerSelectableServiceDates(input?: {
  weekCount?: number;
  durationHours?: number;
}): Promise<{
  dates: string[];
  techCount: number;
  ticketCount: number;
  techError: string | null;
  ticketError: string | null;
}> {
  const supabase = await createClient();

  const [techRes, ticketRes] = await Promise.all([
    supabase.from("technicians").select("*").eq("active", true),
    supabase
      .from("service_tickets")
      .select(
        "id, status, assigned_technician_id, scheduled_start, scheduled_window, max_hours",
      ),
  ]);

  const techs = (techRes.data ?? []) as Technician[];
  const tickets = (ticketRes.data ?? []) as ServiceTicket[];
  const dates = getCustomerSelectableServiceDates(techs, tickets, {
    from: new Date(),
    weekCount: input?.weekCount ?? 8,
    durationHours: input?.durationHours ?? 1,
  });

  return {
    dates,
    techCount: techs.length,
    ticketCount: tickets.length,
    techError: techRes.error?.message ?? null,
    ticketError: ticketRes.error?.message ?? null,
  };
}
