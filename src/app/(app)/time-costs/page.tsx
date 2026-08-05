"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Contract, Customer, ServiceTicket, Technician, WorkEntry } from "@/lib/types";

interface WorkEntryRow extends WorkEntry {
  technicianName: string;
  customerName: string;
  contractName: string;
  ticketNumber: string;
  additionalBillable: number;
}

export default function TimeCostsPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [w, tech, c, co, t] = await Promise.all([
        supabase.from("work_entries").select("*").order("work_date", { ascending: false }),
        supabase.from("technicians").select("*"),
        supabase.from("customers").select("*"),
        supabase.from("contracts").select("*"),
        supabase.from("service_tickets").select("*"),
      ]);
      setEntries(w.data ?? []);
      setTechnicians(tech.data ?? []);
      setCustomers(c.data ?? []);
      setContracts(co.data ?? []);
      setTickets(t.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const rows: WorkEntryRow[] = useMemo(() => {
    const techMap = new Map(technicians.map((t) => [t.id, t.technician_name]));
    const customerMap = new Map(customers.map((c) => [c.id, c.customer_name]));
    const contractMap = new Map(contracts.map((c) => [c.id, c]));
    const ticketMap = new Map(tickets.map((t) => [t.id, t.ticket_number]));

    return entries.map((entry) => {
      const contract = entry.contract_id ? contractMap.get(entry.contract_id) : null;
      const billableHours = entry.included_in_contract ? 0 : (entry.hours_worked ?? 0);
      const additionalBillable =
        billableHours * (contract?.additional_hourly_rate ?? 0) +
        (entry.parts_cost ?? 0) +
        (entry.software_cost ?? 0) +
        (entry.equipment_cost ?? 0) +
        (entry.travel_cost ?? 0) +
        (entry.other_cost ?? 0);

      return {
        ...entry,
        technicianName: techMap.get(entry.technician_id) ?? "Unknown",
        customerName: customerMap.get(entry.customer_id) ?? "Unknown",
        contractName: contract?.contract_name ?? "—",
        ticketNumber: ticketMap.get(entry.ticket_id) ?? "—",
        additionalBillable,
      };
    });
  }, [entries, technicians, customers, contracts, tickets]);

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
        title="Time & cost tracking"
        description="Labor hours, direct costs, and billable work connected to tickets and contracts."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No work entries"
          description="Time and cost records will appear once technicians log work on service tickets."
        />
      ) : (
        <div className="card border bg-base-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="table table-zebra table-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Technician</th>
                  <th>Customer</th>
                  <th>Contract</th>
                  <th>Ticket</th>
                  <th>Hours</th>
                  <th>Labor</th>
                  <th>Parts</th>
                  <th>Software</th>
                  <th>Equipment</th>
                  <th>Travel</th>
                  <th>Other</th>
                  <th>Total cost</th>
                  <th>Billable</th>
                  <th>Approval</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.work_date)}</td>
                    <td>{row.technicianName}</td>
                    <td>{row.customerName}</td>
                    <td>{row.contractName}</td>
                    <td className="font-mono text-xs">{row.ticketNumber}</td>
                    <td>{formatHours(row.hours_worked)}</td>
                    <td>{formatCurrency(row.labor_cost)}</td>
                    <td>{formatCurrency(row.parts_cost)}</td>
                    <td>{formatCurrency(row.software_cost)}</td>
                    <td>{formatCurrency(row.equipment_cost)}</td>
                    <td>{formatCurrency(row.travel_cost)}</td>
                    <td>{formatCurrency(row.other_cost)}</td>
                    <td className="font-medium">{formatCurrency(row.total_direct_cost)}</td>
                    <td>
                      <StatusBadge
                        status={row.included_in_contract ? "Included" : "Billable"}
                      />
                    </td>
                    <td>
                      <StatusBadge status={row.approval_status ?? "Pending"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
