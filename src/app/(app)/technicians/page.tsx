"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";
import { getOpenTickets } from "@/lib/manager-ops";
import { createClient } from "@/lib/supabase/client";
import type { ServiceTicket, Technician } from "@/lib/types";

interface TechCard extends Technician {
  openLoad: number;
  criticalLoad: number;
}

export default function TechniciansPage() {
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [tech, t] = await Promise.all([
        supabase.from("technicians").select("*").order("technician_name"),
        supabase.from("service_tickets").select("*"),
      ]);
      setTechnicians(tech.data ?? []);
      setTickets(t.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const cards: TechCard[] = useMemo(() => {
    const open = getOpenTickets(tickets);
    return technicians.map((tech) => {
      const assigned = open.filter((t) => t.assigned_technician_id === tech.id);
      return {
        ...tech,
        openLoad: assigned.length,
        criticalLoad: assigned.filter((t) => t.priority === "Critical").length,
      };
    });
  }, [technicians, tickets]);

  const unassignedCount = useMemo(
    () => getOpenTickets(tickets).filter((t) => !t.assigned_technician_id).length,
    [tickets],
  );

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
        title="Technician capacity"
        description="Open load and specialty vs backlog — use assignments from Service Tickets."
      />

      {unassignedCount > 0 ? (
        <div className="alert alert-warning text-sm">
          <span>
            {unassignedCount} unassigned open ticket{unassignedCount === 1 ? "" : "s"} in the backlog.{" "}
            <a href="/service-tickets?filter=unassigned" className="link font-medium">
              Assign now
            </a>
          </span>
        </div>
      ) : null}

      {cards.length === 0 ? (
        <EmptyState
          title="No technicians found"
          description="Technician records will appear here once they are added to the system."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((tech) => (
            <div key={tech.id} className="card border bg-base-100 shadow-sm">
              <div className="card-body">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="card-title text-base">{tech.technician_name}</h3>
                  <StatusBadge status={tech.active ? "Active" : "Inactive"} />
                </div>
                <p className="text-sm text-base-content/70">
                  Specialty: {tech.specialty ?? "General support"}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-box bg-base-200/60 p-2">
                    <div className="text-xs text-base-content/60">Open load</div>
                    <div className={`text-lg font-semibold ${tech.openLoad >= 5 ? "text-warning" : ""}`}>
                      {tech.openLoad}
                    </div>
                  </div>
                  <div className="rounded-box bg-base-200/60 p-2">
                    <div className="text-xs text-base-content/60">Critical</div>
                    <div className={`text-lg font-semibold ${tech.criticalLoad > 0 ? "text-error" : ""}`}>
                      {tech.criticalLoad}
                    </div>
                  </div>
                  <div className="rounded-box bg-base-200/60 p-2">
                    <div className="text-xs text-base-content/60">Int. rate</div>
                    <div className="text-sm font-semibold leading-7">
                      {formatCurrency(tech.internal_hourly_cost)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
