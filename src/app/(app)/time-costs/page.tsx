"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExpenseTracker } from "@/components/ExpenseTracker";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/client";
import type { ServiceTicket, Technician } from "@/lib/types";
import { isOpenTicket } from "@/lib/dashboard-stats";

export default function ExpenseTrackerPage() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [ticketId, setTicketId] = useState("");
  const [technicianId, setTechnicianId] = useState("");

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [t, tech] = await Promise.all([
      supabase
        .from("service_tickets")
        .select("*")
        .order("opened_at", { ascending: false }),
      supabase.from("technicians").select("*").order("technician_name"),
    ]);

    setTickets(t.data ?? []);
    setTechnicians(tech.data ?? []);

    if (user) {
      const linked = (tech.data ?? []).find((row) => row.profile_id === user.id);
      if (linked) {
        setTechnicianId(linked.id);
      } else if (tech.data?.[0]) {
        setTechnicianId(tech.data[0].id);
      }
    } else if (tech.data?.[0]) {
      setTechnicianId(tech.data[0].id);
    }

    const open = (t.data ?? []).filter((row) => isOpenTicket(row.status));
    const first = open[0] ?? t.data?.[0];
    if (first) setTicketId(first.id);

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const ticketOptions = useMemo(() => {
    const open = tickets.filter((ticket) => isOpenTicket(ticket.status));
    const closed = tickets.filter((ticket) => !isOpenTicket(ticket.status));
    return [...open, ...closed];
  }, [tickets]);

  const selectedTicket = tickets.find((ticket) => ticket.id === ticketId);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense Tracker"
        description="Add travel, supplies, meals, and other ticket expenses in seconds."
      />

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body grid gap-3 py-4 sm:grid-cols-2">
          <label className="form-control">
            <span className="label-text mb-1 text-xs">Ticket / project</span>
            <select
              className="select select-bordered select-sm"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
            >
              <option value="">Select ticket</option>
              {ticketOptions.map((ticket) => (
                <option key={ticket.id} value={ticket.id}>
                  {ticket.ticket_number} — {ticket.title}
                </option>
              ))}
            </select>
          </label>

          <label className="form-control">
            <span className="label-text mb-1 text-xs">Technician</span>
            <select
              className="select select-bordered select-sm"
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
            >
              <option value="">Select technician</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.technician_name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <ExpenseTracker
        ticketId={ticketId}
        technicianId={technicianId || null}
        ticketLabel={
          selectedTicket
            ? `${selectedTicket.ticket_number} — ${selectedTicket.title}`
            : undefined
        }
      />
    </div>
  );
}
