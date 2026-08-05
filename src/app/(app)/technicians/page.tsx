"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Technician } from "@/lib/types";

export default function TechniciansPage() {
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("technicians")
        .select("*")
        .order("technician_name");
      setTechnicians(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

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
        title="Technicians"
        description="View technician roster, specialties, and internal cost rates."
      />

      {technicians.length === 0 ? (
        <EmptyState
          title="No technicians found"
          description="Technician records will appear here once they are added to the system."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {technicians.map((tech) => (
            <div key={tech.id} className="card border bg-base-100 shadow-sm">
              <div className="card-body">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="card-title text-base">{tech.technician_name}</h3>
                  <StatusBadge status={tech.active ? "Active" : "Inactive"} />
                </div>
                <p className="text-sm text-base-content/70">
                  Specialty: {tech.specialty ?? "General support"}
                </p>
                <div className="stats stats-vertical mt-2 shadow-none lg:stats-horizontal">
                  <div className="stat px-0 py-2">
                    <div className="stat-title text-xs">Internal rate</div>
                    <div className="stat-value text-lg">
                      {formatCurrency(tech.internal_hourly_cost)}
                    </div>
                    <div className="stat-desc">Per hour</div>
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
