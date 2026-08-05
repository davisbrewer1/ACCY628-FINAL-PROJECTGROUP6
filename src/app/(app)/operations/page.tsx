"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { calcSlaStatus } from "@/lib/calculations";
import { isOpenTicket } from "@/lib/dashboard-stats";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Customer, ServiceTicket, Technician } from "@/lib/types";
import { addDays, isBefore, parseISO } from "date-fns";

export default function OperationsPage() {
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [c, co, t, tech] = await Promise.all([
        supabase.from("customers").select("*"),
        supabase.from("contracts").select("*"),
        supabase.from("service_tickets").select("*").order("opened_at", { ascending: false }),
        supabase.from("technicians").select("*").eq("active", true),
      ]);
      setCustomers(c.data ?? []);
      setContracts(co.data ?? []);
      setTickets(t.data ?? []);
      setTechnicians(tech.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.customer_name])),
    [customers],
  );

  const openTickets = useMemo(
    () => tickets.filter((t) => isOpenTicket(t.status)),
    [tickets],
  );

  const criticalOpen = useMemo(
    () => openTickets.filter((t) => t.priority === "Critical"),
    [openTickets],
  );

  const slaAtRisk = useMemo(
    () =>
      openTickets.filter((t) => {
        const sla = calcSlaStatus({
          status: t.status,
          targetResolutionAt: t.target_resolution_at,
          completedAt: t.completed_at,
        });
        return sla === "Approaching Deadline" || sla === "Overdue";
      }),
    [openTickets],
  );

  const unassigned = useMemo(
    () => openTickets.filter((t) => !t.assigned_technician_id),
    [openTickets],
  );

  const renewalsSoon = useMemo(() => {
    const cutoff = addDays(new Date(), 90);
    return contracts.filter((c) => {
      if (c.contract_status !== "Active" || !c.renewal_date) return false;
      const renewal = parseISO(c.renewal_date);
      return isBefore(renewal, cutoff);
    });
  }, [contracts]);

  const workloadByTech = useMemo(() => {
    const techMap = new Map(technicians.map((t) => [t.id, t.technician_name]));
    const counts = new Map<string, number>();
    for (const ticket of openTickets) {
      if (!ticket.assigned_technician_id) continue;
      const name = techMap.get(ticket.assigned_technician_id) ?? "Unknown";
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [openTickets, technicians]);

  const ticketsByStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of openTickets) {
      const status = t.status ?? "Unknown";
      map.set(status, (map.get(status) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [openTickets]);

  if (
    activeRole !== "administrator" &&
    activeRole !== "service_manager" &&
    activeRole !== "account_manager"
  ) {
    return (
      <AlertBanner
        tone="info"
        title="Operations dashboard"
        message="This dashboard is designed for service and account managers. Use the Demo Role Switcher to preview this view."
      />
    );
  }

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
        title="Operations dashboard"
        description="Day-to-day service delivery — tickets, SLA compliance, technician workload, and upcoming renewals."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Open tickets" value={openTickets.length} tone="warning" />
        <StatCard title="Critical open" value={criticalOpen.length} tone="danger" />
        <StatCard title="SLA at risk" value={slaAtRisk.length} tone="warning" />
        <StatCard title="Unassigned" value={unassigned.length} tone={unassigned.length > 0 ? "danger" : "success"} />
        <StatCard title="Renewals (90 days)" value={renewalsSoon.length} tone="info" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Open tickets by status">
          {ticketsByStatus.length === 0 ? (
            <EmptyState title="No open tickets" description="Ticket status breakdown will appear here." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ticketsByStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Technician workload (open tickets)">
          {workloadByTech.length === 0 ? (
            <EmptyState title="No assignments" description="Technician workload will appear once tickets are assigned." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={workloadByTech} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#0891b2" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">SLA at risk</h2>
            {slaAtRisk.length === 0 ? (
              <EmptyState title="All on track" description="No tickets are approaching or past SLA deadlines." />
            ) : (
              <div className="space-y-2">
                {slaAtRisk.slice(0, 8).map((ticket) => (
                  <div key={ticket.id} className="rounded-box border border-base-300 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{ticket.title}</p>
                        <p className="text-xs text-base-content/60">
                          {ticket.ticket_number} · {customerMap.get(ticket.customer_id)}
                        </p>
                      </div>
                      <PriorityBadge priority={ticket.priority ?? "Medium"} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge
                        status={calcSlaStatus({
                          status: ticket.status,
                          targetResolutionAt: ticket.target_resolution_at,
                          completedAt: ticket.completed_at,
                        })}
                      />
                      <span className="text-xs text-base-content/60">
                        Due {formatDateTime(ticket.target_resolution_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Upcoming renewals</h2>
            {renewalsSoon.length === 0 ? (
              <EmptyState title="No renewals soon" description="Contracts renewing within 90 days will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Contract</th>
                      <th>Customer</th>
                      <th>Renewal</th>
                      <th>Auto-renew</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renewalsSoon.map((contract) => (
                      <tr key={contract.id}>
                        <td className="font-medium">{contract.contract_name}</td>
                        <td>{customerMap.get(contract.customer_id) ?? "—"}</td>
                        <td>{formatDate(contract.renewal_date)}</td>
                        <td>{contract.automatic_renewal ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">Recent tickets</h2>
          {tickets.length === 0 ? (
            <EmptyState title="No tickets" description="Service tickets will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Customer</th>
                    <th>Title</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>SLA</th>
                    <th>Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.slice(0, 12).map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="font-mono text-sm">{ticket.ticket_number}</td>
                      <td>{customerMap.get(ticket.customer_id) ?? "—"}</td>
                      <td className="font-medium">{ticket.title}</td>
                      <td><PriorityBadge priority={ticket.priority ?? "Medium"} /></td>
                      <td><StatusBadge status={ticket.status ?? "New"} /></td>
                      <td>
                        <StatusBadge
                          status={calcSlaStatus({
                            status: ticket.status,
                            targetResolutionAt: ticket.target_resolution_at,
                            completedAt: ticket.completed_at,
                          })}
                        />
                      </td>
                      <td>{formatDateTime(ticket.opened_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card border bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="card-title text-base">{title}</h2>
        <div className="min-h-[260px]">{children}</div>
      </div>
    </div>
  );
}
