"use client";

import { useMemo, useState } from "react";
import { differenceInMinutes, differenceInYears, parseISO } from "date-fns";
import { EmptyState } from "@/components/EmptyState";
import {
  MetricGrid,
  MetricTile,
  NA,
  ReportTable,
} from "@/components/reports/ReportUi";
import { calcContractProfit, calcProfitMargin } from "@/lib/calculations";
import { formatCurrency, formatPercent } from "@/lib/format";
import {
  getPastDueInvoices,
  cashCollectedMtd,
} from "@/lib/manager-ops";
import {
  contractsInTier,
  simulateContractTier,
  type SimulatedTier,
  avg,
  sum,
} from "@/lib/report-tiers";
import type {
  AiPlatform,
  AiRisk,
  AiUserCompliance,
  AssetRepair,
  Contract,
  Customer,
  HardwareAsset,
  InventoryPart,
  Invoice,
  Payment,
  Recommendation,
  SecurityAlert,
  SecurityScore,
  ServiceCatalogItem,
  ServiceTicket,
  Technician,
  TicketExpense,
  WorkEntry,
} from "@/lib/types";
import { isAcceptedTicketExpense } from "@/lib/ticket-expense-budgets";

export interface ReportDataset {
  customers: Customer[];
  contracts: Contract[];
  tickets: ServiceTicket[];
  workEntries: WorkEntry[];
  ticketExpenses: TicketExpense[];
  invoices: Invoice[];
  payments: Payment[];
  hardware: HardwareAsset[];
  inventoryParts: InventoryPart[];
  assetRepairs: AssetRepair[];
  securityScores: SecurityScore[];
  securityAlerts: SecurityAlert[];
  aiPlatforms: AiPlatform[];
  aiRisks: AiRisk[];
  aiCompliance: AiUserCompliance[];
  recommendations: Recommendation[];
  technicians: Technician[];
  catalogItems: ServiceCatalogItem[];
}

interface ReportBodyProps {
  reportId: string;
  dataset: ReportDataset;
}

function durationHours(opened: string | null, completed: string | null) {
  if (!opened || !completed) return null;
  const minutes = differenceInMinutes(parseISO(completed), parseISO(opened));
  if (Number.isNaN(minutes) || minutes < 0) return null;
  return minutes / 60;
}

function responseHours(opened: string | null, responded: string | null) {
  return durationHours(opened, responded);
}

export function ReportBody({ reportId, dataset }: ReportBodyProps) {
  switch (reportId) {
    case "sla-compliance":
      return <SlaComplianceReport dataset={dataset} />;
    case "technician-productivity":
      return <TechnicianProductivityReport dataset={dataset} />;
    case "ticket-trend":
      return <TicketTrendReport dataset={dataset} />;
    case "hardware-lifecycle":
      return <HardwareLifecycleReport dataset={dataset} />;
    case "asset-utilization":
      return <AssetUtilizationReport dataset={dataset} />;
    case "security-risk":
      return <SecurityRiskReport dataset={dataset} />;
    case "cyber-incident":
      return <CyberIncidentReport dataset={dataset} />;
    case "ai-usage":
      return <AiUsageReport dataset={dataset} />;
    case "ai-risk":
      return <AiRiskReport dataset={dataset} />;
    case "contract-performance":
      return <ContractPerformanceReport dataset={dataset} />;
    case "billing":
      return <BillingReport dataset={dataset} />;
    case "revenue-by-service":
      return <RevenueByServiceReport dataset={dataset} />;
    case "customer-technology":
      return <CustomerTechnologyReport dataset={dataset} />;
    default:
      return (
        <EmptyState
          title="Report not found"
          description="Select another report from the dropdown."
        />
      );
  }
}

function SlaComplianceReport({ dataset }: { dataset: ReportDataset }) {
  const { tickets, customers, technicians } = dataset;
  const resolved = tickets.filter(
    (t) => t.status === "Completed" || t.status === "Closed",
  );
  const withinSla = resolved.filter((t) => {
    if (!t.target_resolution_at || !t.completed_at) return false;
    return parseISO(t.completed_at) <= parseISO(t.target_resolution_at);
  });
  const missed = resolved.filter((t) => {
    if (!t.target_resolution_at || !t.completed_at) return true;
    return parseISO(t.completed_at) > parseISO(t.target_resolution_at);
  });
  const responseTimes = tickets
    .map((t) => responseHours(t.opened_at, t.responded_at))
    .filter((n): n is number => n != null);
  const resolutionTimes = resolved
    .map((t) => durationHours(t.opened_at, t.completed_at))
    .filter((n): n is number => n != null);

  const techPerf = technicians.map((tech) => {
    const techTickets = resolved.filter(
      (t) => t.assigned_technician_id === tech.id,
    );
    const onTime = techTickets.filter((t) => {
      if (!t.target_resolution_at || !t.completed_at) return false;
      return parseISO(t.completed_at) <= parseISO(t.target_resolution_at);
    }).length;
    return {
      name: tech.technician_name,
      completed: techTickets.length,
      onTime,
      rate:
        techTickets.length > 0
          ? (onTime / techTickets.length) * 100
          : null,
    };
  });

  const repeatViolators = customers
    .map((c) => {
      const misses = missed.filter((t) => t.customer_id === c.id).length;
      return { name: c.customer_name, misses };
    })
    .filter((r) => r.misses >= 2)
    .sort((a, b) => b.misses - a.misses);

  return (
    <div className="space-y-4">
      <MetricGrid>
        <MetricTile
          label="Tickets resolved within SLA"
          value={`${withinSla.length} / ${resolved.length || 0}`}
        />
        <MetricTile
          label="Average response time"
          value={
            avg(responseTimes) != null
              ? `${avg(responseTimes)!.toFixed(1)} hrs`
              : "—"
          }
        />
        <MetricTile
          label="Average resolution time"
          value={
            avg(resolutionTimes) != null
              ? `${avg(resolutionTimes)!.toFixed(1)} hrs`
              : "—"
          }
        />
        <MetricTile label="Missed SLAs" value={missed.length} />
        <MetricTile label="Customer satisfaction" value={NA} />
      </MetricGrid>

      <h3 className="font-semibold">Technician performance</h3>
      <ReportTable headers={["Technician", "Completed", "On-time", "On-time %"]}>
        {techPerf.map((row) => (
          <tr key={row.name}>
            <td>{row.name}</td>
            <td>{row.completed}</td>
            <td>{row.onTime}</td>
            <td>{row.rate != null ? formatPercent(row.rate) : "—"}</td>
          </tr>
        ))}
      </ReportTable>

      <h3 className="font-semibold">Customers with repeated SLA violations</h3>
      {repeatViolators.length === 0 ? (
        <EmptyState
          title="No repeat SLA violators"
          description="Customers with 2+ missed SLAs will appear here."
        />
      ) : (
        <ReportTable headers={["Customer", "Missed SLAs"]}>
          {repeatViolators.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.misses}</td>
            </tr>
          ))}
        </ReportTable>
      )}
    </div>
  );
}

function TechnicianProductivityReport({
  dataset,
}: {
  dataset: ReportDataset;
}) {
  const { technicians, tickets, workEntries } = dataset;
  const rows = technicians.map((tech) => {
    const completed = tickets.filter(
      (t) =>
        t.assigned_technician_id === tech.id &&
        (t.status === "Completed" || t.status === "Closed"),
    );
    const entries = workEntries.filter((e) => e.technician_id === tech.id);
    const laborHours = sum(entries.map((e) => e.hours_worked ?? 0));
    const billableHours = sum(
      entries
        .filter((e) => !e.included_in_contract)
        .map((e) => e.hours_worked ?? 0),
    );
    const utilization =
      laborHours > 0 ? (billableHours / laborHours) * 100 : null;
    const resolutionTimes = completed
      .map((t) => durationHours(t.opened_at, t.completed_at))
      .filter((n): n is number => n != null);
    const revenue = sum(entries.map((e) => e.total_direct_cost ?? 0));

    return {
      name: tech.technician_name,
      completed: completed.length,
      laborHours,
      billableHours,
      utilization,
      avgResolution: avg(resolutionTimes),
      revenue,
    };
  });

  const sorted = [...rows].sort((a, b) => b.completed - a.completed);
  const high = sorted.slice(0, 3);
  const overloaded = rows
    .filter((r) => r.laborHours >= 40)
    .sort((a, b) => b.laborHours - a.laborHours);
  const underutilized = rows
    .filter((r) => r.utilization != null && r.utilization < 50 && r.laborHours > 0)
    .sort((a, b) => (a.utilization ?? 0) - (b.utilization ?? 0));

  return (
    <div className="space-y-4">
      <MetricGrid>
        <MetricTile label="Customer satisfaction" value={NA} />
        <MetricTile
          label="High performers (by tickets)"
          value={high.map((h) => h.name).join(", ") || "—"}
        />
        <MetricTile
          label="Overloaded technicians"
          value={
            overloaded.length
              ? overloaded.map((h) => h.name).slice(0, 3).join(", ")
              : "None flagged"
          }
          hint="≥ 40 logged labor hours"
        />
        <MetricTile
          label="Underutilized employees"
          value={
            underutilized.length
              ? underutilized.map((h) => h.name).slice(0, 3).join(", ")
              : "None flagged"
          }
          hint="< 50% billable utilization"
        />
      </MetricGrid>

      <ReportTable
        headers={[
          "Technician",
          "Tickets completed",
          "Labor hours",
          "Billable hours",
          "Utilization %",
          "Avg resolution",
          "Revenue (cost basis)",
        ]}
      >
        {rows.map((row) => (
          <tr key={row.name}>
            <td>{row.name}</td>
            <td>{row.completed}</td>
            <td>{row.laborHours.toFixed(1)}</td>
            <td>{row.billableHours.toFixed(1)}</td>
            <td>
              {row.utilization != null ? formatPercent(row.utilization) : "—"}
            </td>
            <td>
              {row.avgResolution != null
                ? `${row.avgResolution.toFixed(1)} hrs`
                : "—"}
            </td>
            <td>{formatCurrency(row.revenue)}</td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function TicketTrendReport({ dataset }: { dataset: ReportDataset }) {
  const { tickets, customers } = dataset;
  const byMonth = new Map<string, number>();
  for (const t of tickets) {
    const key = (t.opened_at ?? t.created_at ?? "").slice(0, 7);
    if (!key) continue;
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const byCustomer = customers
    .map((c) => ({
      name: c.customer_name,
      count: tickets.filter((t) => t.customer_id === c.id).length,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const byCategory = new Map<string, number>();
  for (const t of tickets) {
    const cat = t.category ?? "Uncategorized";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
  }

  const titles = new Map<string, number>();
  for (const t of tickets) {
    const key = (t.title ?? "").trim().toLowerCase();
    if (!key) continue;
    titles.set(key, (titles.get(key) ?? 0) + 1);
  }
  const repeats = [...titles.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const emergency = tickets.filter(
    (t) =>
      t.priority === "Critical" ||
      (t.severity ?? "").toLowerCase().includes("emergency"),
  ).length;
  const escalated = tickets.filter(
    (t) =>
      t.status === "Escalated" ||
      (t.notes ?? "").toLowerCase().includes("escalat"),
  ).length;
  const resolutionTimes = tickets
    .filter((t) => t.status === "Completed" || t.status === "Closed")
    .map((t) => durationHours(t.opened_at, t.completed_at))
    .filter((n): n is number => n != null);

  return (
    <div className="space-y-4">
      <MetricGrid>
        <MetricTile label="Emergency tickets" value={emergency} />
        <MetricTile label="Escalated tickets" value={escalated} />
        <MetricTile
          label="Average resolution time"
          value={
            avg(resolutionTimes) != null
              ? `${avg(resolutionTimes)!.toFixed(1)} hrs`
              : "—"
          }
        />
      </MetricGrid>

      <h3 className="font-semibold">Tickets by month</h3>
      <ReportTable headers={["Month", "Tickets"]}>
        {[...byMonth.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, count]) => (
            <tr key={month}>
              <td>{month}</td>
              <td>{count}</td>
            </tr>
          ))}
      </ReportTable>

      <h3 className="font-semibold">Tickets by customer</h3>
      <ReportTable headers={["Customer", "Tickets"]}>
        {byCustomer.map((row) => (
          <tr key={row.name}>
            <td>{row.name}</td>
            <td>{row.count}</td>
          </tr>
        ))}
      </ReportTable>

      <h3 className="font-semibold">Tickets by category</h3>
      <ReportTable headers={["Category", "Tickets"]}>
        {[...byCategory.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([cat, count]) => (
            <tr key={cat}>
              <td>{cat}</td>
              <td>{count}</td>
            </tr>
          ))}
      </ReportTable>

      <h3 className="font-semibold">Repeat issues</h3>
      {repeats.length === 0 ? (
        <EmptyState title="No repeat titles" description="Repeated ticket titles will appear here." />
      ) : (
        <ReportTable headers={["Issue (title)", "Count"]}>
          {repeats.map(([title, count]) => (
            <tr key={title}>
              <td className="capitalize">{title}</td>
              <td>{count}</td>
            </tr>
          ))}
        </ReportTable>
      )}
    </div>
  );
}

function HardwareLifecycleReport({ dataset }: { dataset: ReportDataset }) {
  const { hardware, customers, assetRepairs } = dataset;
  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.customer_name ?? "—";

  const repairsByAsset = new Map<string, number>();
  for (const repair of assetRepairs) {
    repairsByAsset.set(
      repair.asset_id,
      (repairsByAsset.get(repair.asset_id) ?? 0) + 1,
    );
  }
  const repeatedRepairAssets = [...repairsByAsset.values()].filter(
    (n) => n >= 2,
  ).length;

  const rows = hardware.map((a) => {
    const ageYears =
      a.purchase_date != null
        ? differenceInYears(new Date(), parseISO(a.purchase_date))
        : null;
    return {
      id: a.id,
      asset: a.asset_number || a.asset_tag || a.id.slice(0, 8),
      customer: a.customer_id ? customerName(a.customer_id) : "Inventory",
      model: [a.manufacturer, a.model].filter(Boolean).join(" ") || "—",
      ageYears,
      warranty: a.warranty_expiration ?? "—",
      replacement: a.estimated_replacement_date ?? "—",
      value: a.current_value,
      unsupported: a.unsupported_os || a.nearing_eol,
      needsReplacement: a.needs_replacement,
      failures: a.health_score != null && a.health_score < 50,
      repairs: repairsByAsset.get(a.id) ?? 0,
    };
  });

  return (
    <div className="space-y-4">
      <MetricGrid>
        <MetricTile label="Total assets" value={hardware.length} />
        <MetricTile
          label="Warranty expiring soon"
          value={hardware.filter((a) => a.warranty_expiring_soon).length}
        />
        <MetricTile
          label="Needs replacement"
          value={hardware.filter((a) => a.needs_replacement).length}
        />
        <MetricTile
          label="Unsupported / EOL"
          value={hardware.filter((a) => a.unsupported_os || a.nearing_eol).length}
        />
        <MetricTile
          label="Current asset value"
          value={formatCurrency(
            sum(hardware.map((a) => a.current_value ?? 0)),
          )}
        />
        <MetricTile
          label="Repair records"
          value={assetRepairs.length}
          hint={`${repeatedRepairAssets} assets with 2+ repairs`}
        />
      </MetricGrid>

      <ReportTable
        headers={[
          "Asset",
          "Customer",
          "Device",
          "Age (yrs)",
          "Warranty",
          "Replacement",
          "Value",
          "Repairs",
          "Flags",
        ]}
      >
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="font-mono text-xs">{row.asset}</td>
            <td>{row.customer}</td>
            <td>{row.model}</td>
            <td>{row.ageYears ?? "—"}</td>
            <td>{row.warranty}</td>
            <td>{row.replacement}</td>
            <td>
              {row.value != null ? formatCurrency(row.value) : "—"}
            </td>
            <td>{row.repairs}</td>
            <td className="text-xs">
              {[
                row.unsupported ? "Unsupported" : null,
                row.needsReplacement ? "Replace" : null,
                row.failures ? "Low health" : null,
              ]
                .filter(Boolean)
                .join(", ") || "—"}
            </td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function AssetUtilizationReport({ dataset }: { dataset: ReportDataset }) {
  const { hardware, customers, inventoryParts } = dataset;
  const assigned = hardware.filter(
    (a) => a.assigned_employee || a.device_status === "Assigned",
  );
  const unassigned = hardware.filter(
    (a) =>
      !a.assigned_employee &&
      (a.device_status === "In Stock" ||
        a.device_status === "Available" ||
        a.lifecycle_stage === "Inventory"),
  );
  const idle = hardware.filter(
    (a) =>
      a.device_status === "Idle" ||
      a.lifecycle_stage === "Idle" ||
      (a.online_status ?? "").toLowerCase() === "offline",
  );
  const lost = hardware.filter(
    (a) =>
      a.device_status === "Lost" ||
      (a.notes ?? "").toLowerCase().includes("lost"),
  );

  const online = hardware.filter(
    (a) => (a.online_status ?? "").toLowerCase() === "online",
  ).length;
  const withTelemetry = hardware.filter(
    (a) =>
      a.last_check_in != null ||
      a.cpu_pct != null ||
      a.ram_pct != null ||
      a.disk_pct != null,
  ).length;

  const bySku = new Map<
    string,
    { count: number; customers: Set<string>; qty: number }
  >();
  for (const a of hardware) {
    const sku = [a.manufacturer, a.model, a.category]
      .filter(Boolean)
      .join(" / ") || "Unknown SKU";
    const entry = bySku.get(sku) ?? {
      count: 0,
      customers: new Set<string>(),
      qty: 0,
    };
    entry.count += 1;
    entry.qty += a.quantity ?? 1;
    if (a.customer_id) entry.customers.add(a.customer_id);
    bySku.set(sku, entry);
  }

  const customerName = (id: string) =>
    customers.find((c) => c.id === id)?.customer_name ?? id;

  const activeParts = inventoryParts.filter((p) => p.active !== false);
  const lowStock = activeParts.filter(
    (p) => p.quantity <= (p.low_stock_threshold ?? 0),
  );
  const partsQty = sum(activeParts.map((p) => p.quantity ?? 0));
  const partsValue = sum(
    activeParts.map((p) => (p.quantity ?? 0) * (p.unit_cost ?? 0)),
  );

  return (
    <div className="space-y-4">
      <MetricGrid>
        <MetricTile label="Assigned devices" value={assigned.length} />
        <MetricTile label="Unassigned inventory" value={unassigned.length} />
        <MetricTile label="Idle / offline equipment" value={idle.length} />
        <MetricTile label="Lost devices" value={lost.length} />
        <MetricTile
          label="Device usage telemetry"
          value={`${withTelemetry} / ${hardware.length}`}
          hint={`${online} reporting online; last check-in / CPU / RAM / disk where present`}
        />
      </MetricGrid>

      <h3 className="font-semibold">
        SKUs distributed (liability / customer coverage)
      </h3>
      <ReportTable
        headers={["SKU / device type", "Assets", "Qty", "Customers"]}
      >
        {[...bySku.entries()]
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([sku, data]) => (
            <tr key={sku}>
              <td>{sku}</td>
              <td>{data.count}</td>
              <td>{data.qty}</td>
              <td className="text-xs">
                {[...data.customers].map(customerName).join(", ")}
              </td>
            </tr>
          ))}
      </ReportTable>

      <h3 className="font-semibold">Technician parts inventory</h3>
      <MetricGrid>
        <MetricTile label="Active SKUs" value={activeParts.length} />
        <MetricTile label="Total quantity on hand" value={partsQty} />
        <MetricTile label="Low-stock SKUs" value={lowStock.length} />
        <MetricTile
          label="Inventory value"
          value={formatCurrency(partsValue)}
        />
      </MetricGrid>
      {activeParts.length === 0 ? (
        <EmptyState
          title="No parts inventory"
          description="Parts stocked in the Hardware technician inventory will appear here."
        />
      ) : (
        <ReportTable
          headers={[
            "SKU",
            "Part",
            "Category",
            "Qty",
            "Threshold",
            "Unit cost",
            "Status",
          ]}
        >
          {[...activeParts]
            .sort((a, b) => a.sku.localeCompare(b.sku))
            .map((part) => {
              const isLow =
                part.quantity <= (part.low_stock_threshold ?? 0);
              return (
                <tr key={part.id}>
                  <td className="font-mono text-xs">{part.sku}</td>
                  <td>{part.part_name}</td>
                  <td>{part.category || "—"}</td>
                  <td>{part.quantity}</td>
                  <td>{part.low_stock_threshold}</td>
                  <td>{formatCurrency(part.unit_cost ?? 0)}</td>
                  <td className={isLow ? "font-medium text-warning" : ""}>
                    {isLow ? "Low" : "OK"}
                  </td>
                </tr>
              );
            })}
        </ReportTable>
      )}
    </div>
  );
}

function SecurityRiskReport({ dataset }: { dataset: ReportDataset }) {
  const { securityScores, securityAlerts, hardware } = dataset;
  const avgHealth = avg(securityScores.map((s) => s.health_score));
  const critical = securityAlerts.filter(
    (a) => a.severity === "Critical" && a.status !== "Resolved",
  );
  const highRiskDevices = hardware.filter(
    (a) =>
      a.missing_security_updates ||
      a.unsupported_os ||
      (a.health_score != null && a.health_score < 40),
  );
  const avgPatch = avg(
    securityScores
      .map((s) => s.patch_compliance_pct)
      .filter((n): n is number => n != null),
  );
  const avgMfa = avg(
    securityScores
      .map((s) => s.mfa_adoption_pct)
      .filter((n): n is number => n != null),
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-base-content/70">
        What should I worry about / pay attention to?
      </p>
      <MetricGrid>
        <MetricTile
          label="Security Health Score (avg)"
          value={avgHealth != null ? avgHealth.toFixed(0) : "—"}
        />
        <MetricTile label="Critical vulnerabilities / alerts" value={critical.length} />
        <MetricTile label="High-risk devices" value={highRiskDevices.length} />
        <MetricTile
          label="Missing patches (avg compliance)"
          value={avgPatch != null ? formatPercent(avgPatch) : "—"}
        />
        <MetricTile
          label="Firewall status"
          value={
            securityScores[0]?.firewall_status ??
            (securityScores.length ? "See customer scores" : "—")
          }
        />
        <MetricTile
          label="Backup status"
          value={
            hardware.filter((a) => a.last_backup_at).length
              ? `${hardware.filter((a) => a.last_backup_at).length} assets with backup timestamp`
              : NA
          }
        />
        <MetricTile
          label="MFA compliance (avg)"
          value={avgMfa != null ? formatPercent(avgMfa) : NA}
        />
        <MetricTile label="Failed logins" value={NA} />
      </MetricGrid>

      <ReportTable headers={["Customer score", "Health", "Patch %", "MFA %", "Firewall"]}>
        {securityScores.map((s) => (
          <tr key={s.id}>
            <td className="font-mono text-xs">{s.customer_id.slice(0, 8)}</td>
            <td>{s.health_score}</td>
            <td>
              {s.patch_compliance_pct != null
                ? formatPercent(s.patch_compliance_pct)
                : "—"}
            </td>
            <td>
              {s.mfa_adoption_pct != null
                ? formatPercent(s.mfa_adoption_pct)
                : "—"}
            </td>
            <td>{s.firewall_status ?? "—"}</td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function CyberIncidentReport({ dataset }: { dataset: ReportDataset }) {
  const { securityAlerts, tickets } = dataset;
  const open = securityAlerts.filter((a) => a.status !== "Resolved");
  const resolved = securityAlerts.filter((a) => a.status === "Resolved");
  const byType = (needle: string) =>
    securityAlerts.filter((a) =>
      `${a.alert_type} ${a.title}`.toLowerCase().includes(needle),
    ).length;

  const cyberTickets = tickets.filter((t) => t.cybersecurity_incident);

  return (
    <div className="space-y-4">
      <MetricGrid>
        <MetricTile label="Malware detections" value={byType("malware")} />
        <MetricTile label="Phishing attempts" value={byType("phish")} />
        <MetricTile
          label="Unauthorized access"
          value={byType("unauthor") + byType("access")}
        />
        <MetricTile label="Blocked attacks" value={byType("block")} />
        <MetricTile label="Ransomware alerts" value={byType("ransom")} />
        <MetricTile label="Open security alerts" value={open.length} />
        <MetricTile label="Resolved incidents" value={resolved.length} />
        <MetricTile label="Cybersecurity tickets" value={cyberTickets.length} />
      </MetricGrid>

      <ReportTable headers={["Severity", "Title", "Type", "Status", "Detected"]}>
        {securityAlerts.slice(0, 40).map((a) => (
          <tr key={a.id}>
            <td>{a.severity}</td>
            <td>{a.title}</td>
            <td>{a.alert_type}</td>
            <td>{a.status}</td>
            <td>{a.detected_at?.slice(0, 10) ?? "—"}</td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function AiUsageReport({ dataset }: { dataset: ReportDataset }) {
  const { aiPlatforms } = dataset;
  const totalUsers = sum(aiPlatforms.map((p) => p.active_users ?? 0));
  const monthlyCost = sum(
    aiPlatforms.map(
      (p) => (p.monthly_subscription_cost ?? 0) + (p.monthly_api_cost ?? 0),
    ),
  );
  const byDept = new Map<string, number>();
  for (const p of aiPlatforms) {
    const d = p.department ?? "Unassigned";
    byDept.set(d, (byDept.get(d) ?? 0) + (p.active_users ?? 0));
  }
  const topPlatform = [...aiPlatforms].sort(
    (a, b) => (b.active_users ?? 0) - (a.active_users ?? 0),
  )[0];
  const avgUtil = avg(
    aiPlatforms
      .map((p) => p.utilization_pct)
      .filter((n): n is number => n != null),
  );

  return (
    <div className="space-y-4">
      <MetricGrid>
        <MetricTile label="AI platforms in use" value={aiPlatforms.length} />
        <MetricTile label="Active users (all platforms)" value={totalUsers} />
        <MetricTile
          label="Most-used AI platform"
          value={topPlatform?.platform_name ?? "—"}
        />
        <MetricTile label="Monthly AI costs" value={formatCurrency(monthlyCost)} />
        <MetricTile
          label="License utilization (avg)"
          value={avgUtil != null ? formatPercent(avgUtil) : "—"}
        />
        <MetricTile label="Daily AI usage" value={NA} />
      </MetricGrid>

      <h3 className="font-semibold">Most active departments</h3>
      <ReportTable headers={["Department", "Active users"]}>
        {[...byDept.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([dept, users]) => (
            <tr key={dept}>
              <td>{dept}</td>
              <td>{users}</td>
            </tr>
          ))}
      </ReportTable>

      <h3 className="font-semibold">Platforms</h3>
      <ReportTable
        headers={[
          "Platform",
          "Licensed",
          "Active",
          "Utilization",
          "Monthly cost",
          "Status",
        ]}
      >
        {aiPlatforms.map((p) => (
          <tr key={p.id}>
            <td>{p.platform_name}</td>
            <td>{p.licensed_users}</td>
            <td>{p.active_users}</td>
            <td>
              {p.utilization_pct != null
                ? formatPercent(p.utilization_pct)
                : "—"}
            </td>
            <td>
              {formatCurrency(
                (p.monthly_subscription_cost ?? 0) + (p.monthly_api_cost ?? 0),
              )}
            </td>
            <td>{p.status}</td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function AiRiskReport({ dataset }: { dataset: ReportDataset }) {
  const { aiRisks, aiCompliance } = dataset;
  const match = (needle: string) =>
    aiRisks.filter((r) =>
      `${r.risk_type} ${r.title} ${r.description ?? ""}`
        .toLowerCase()
        .includes(needle),
    ).length;

  const openRisks = aiRisks.filter((r) => r.status !== "Resolved");
  const nonCompliant = aiCompliance.filter(
    (c) =>
      c.acknowledgment_status !== "Acknowledged" ||
      c.training_status !== "Complete",
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-base-content/70">
        Determine if employees are using AI safely.
      </p>
      <MetricGrid>
        <MetricTile label="Open AI risks" value={openRisks.length} />
        <MetricTile label="Unauthorized AI tools" value={match("unauthor") + match("shadow")} />
        <MetricTile
          label="Sensitive data in AI"
          value={match("sensitive") + match("data leak")}
        />
        <MetricTile label="Shadow AI" value={match("shadow")} />
        <MetricTile
          label="AI policy violations"
          value={match("policy") + match("violation")}
        />
        <MetricTile
          label="Prompt injection attempts"
          value={match("injection")}
        />
        <MetricTile label="High-risk prompts" value={NA} />
        <MetricTile
          label="Compliance issues (users)"
          value={nonCompliant.length}
        />
      </MetricGrid>

      <ReportTable headers={["Severity", "Type", "Title", "Status", "Detected"]}>
        {aiRisks.slice(0, 40).map((r) => (
          <tr key={r.id}>
            <td>{r.severity}</td>
            <td>{r.risk_type}</td>
            <td>{r.title}</td>
            <td>{r.status}</td>
            <td>{r.detected_at?.slice(0, 10) ?? "—"}</td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function ContractPerformanceReport({
  dataset,
}: {
  dataset: ReportDataset;
}) {
  const [tier, setTier] = useState<SimulatedTier | "All">("All");
  const { contracts, workEntries, customers, tickets, ticketExpenses = [] } =
    dataset;
  const filtered = useMemo(
    () => contractsInTier(contracts, tier),
    [contracts, tier],
  );
  const ticketById = useMemo(
    () => new Map(tickets.map((t) => [t.id, t])),
    [tickets],
  );

  const rows = filtered.map((contract) => {
    const entries = workEntries.filter((e) => e.contract_id === contract.id);
    const workCosts = entries.reduce(
      (acc, e) => acc + (e.total_direct_cost ?? 0),
      0,
    );
    const expenseCosts = ticketExpenses
      .filter((expense) => {
        if (!isAcceptedTicketExpense(expense)) return false;
        return ticketById.get(expense.ticket_id)?.contract_id === contract.id;
      })
      .reduce((acc, expense) => acc + Number(expense.amount ?? 0), 0);
    const costs = workCosts + expenseCosts;
    const labor = entries.reduce(
      (acc, e) => acc + (e.labor_cost ?? 0),
      0,
    );
    const billable = entries
      .filter((e) => !e.included_in_contract)
      .reduce((acc, e) => acc + (e.total_direct_cost ?? 0), 0);
    const hardwareCost = entries.reduce(
      (acc, e) =>
        acc + (e.equipment_cost ?? 0) + (e.parts_cost ?? 0),
      0,
    );
    const softwareCost = entries.reduce(
      (acc, e) => acc + (e.software_cost ?? 0),
      0,
    );
    const revenue = contract.monthly_recurring_fee ?? 0;
    const profit = calcContractProfit(revenue, costs);
    const margin = calcProfitMargin(revenue, costs);
    return {
      id: contract.id,
      name: contract.contract_name,
      customer:
        customers.find((c) => c.id === contract.customer_id)?.customer_name ??
        "—",
      tier: simulateContractTier(contract.monthly_recurring_fee),
      mrr: revenue,
      billable,
      labor,
      hardware: hardwareCost,
      software: softwareCost,
      profit,
      margin,
      csat: NA,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["All", "Bronze", "Silver", "Gold"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`btn btn-sm ${tier === t ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTier(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="text-xs text-base-content/60">
        Bronze / Silver / Gold are simulated from monthly fee bands (UI only).
      </p>

      <ReportTable
        headers={[
          "Contract",
          "Customer",
          "Tier",
          "MRR",
          "Addl. billable",
          "Labor cost",
          "Hardware cost",
          "Software cost",
          "Profit",
          "Margin",
          "CSAT",
        ]}
      >
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="font-medium">{row.name}</td>
            <td>{row.customer}</td>
            <td>{row.tier}</td>
            <td>{formatCurrency(row.mrr)}</td>
            <td>{formatCurrency(row.billable)}</td>
            <td>{formatCurrency(row.labor)}</td>
            <td>{formatCurrency(row.hardware)}</td>
            <td>{formatCurrency(row.software)}</td>
            <td>{formatCurrency(row.profit)}</td>
            <td>{row.margin != null ? formatPercent(row.margin) : "—"}</td>
            <td>{row.csat}</td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function BillingReport({ dataset }: { dataset: ReportDataset }) {
  const { invoices, payments } = dataset;
  const outstanding = invoices.filter(
    (i) => (i.remaining_balance ?? 0) > 0 && i.status !== "Paid",
  );
  const overdue = getPastDueInvoices(invoices);
  const paid = sum(payments.map((p) => p.payment_amount ?? 0));
  const aging = {
    current: 0,
    d30: 0,
    d60: 0,
    d90: 0,
  };
  const now = Date.now();
  for (const inv of outstanding) {
    const due = inv.due_date ? parseISO(inv.due_date).getTime() : now;
    const days = Math.floor((now - due) / (1000 * 60 * 60 * 24));
    const bal = inv.remaining_balance ?? 0;
    if (days <= 0) aging.current += bal;
    else if (days <= 30) aging.d30 += bal;
    else if (days <= 60) aging.d60 += bal;
    else aging.d90 += bal;
  }

  const byMonth = new Map<string, number>();
  for (const inv of invoices) {
    const key = (inv.invoice_date ?? inv.created_at ?? "").slice(0, 7);
    if (!key) continue;
    byMonth.set(key, (byMonth.get(key) ?? 0) + (inv.total_amount ?? 0));
  }

  return (
    <div className="space-y-4">
      <MetricGrid>
        <MetricTile label="Outstanding invoices" value={outstanding.length} />
        <MetricTile
          label="Overdue invoices"
          value={overdue.length}
          hint={formatCurrency(
            sum(overdue.map((i) => i.remaining_balance ?? 0)),
          )}
        />
        <MetricTile
          label="Payments received (all time)"
          value={formatCurrency(paid)}
        />
        <MetricTile
          label="Cash collected MTD"
          value={formatCurrency(cashCollectedMtd(payments))}
        />
      </MetricGrid>

      <h3 className="font-semibold">Accounts receivable aging</h3>
      <MetricGrid>
        <MetricTile label="Current" value={formatCurrency(aging.current)} />
        <MetricTile label="1–30 days" value={formatCurrency(aging.d30)} />
        <MetricTile label="31–60 days" value={formatCurrency(aging.d60)} />
        <MetricTile label="61+ days" value={formatCurrency(aging.d90)} />
      </MetricGrid>

      <h3 className="font-semibold">Monthly invoices</h3>
      <ReportTable headers={["Month", "Invoiced"]}>
        {[...byMonth.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([month, total]) => (
            <tr key={month}>
              <td>{month}</td>
              <td>{formatCurrency(total)}</td>
            </tr>
          ))}
      </ReportTable>
    </div>
  );
}

function RevenueByServiceReport({ dataset }: { dataset: ReportDataset }) {
  const { catalogItems, contracts, invoices } = dataset;
  const families = [
    "Managed IT",
    "Hardware",
    "Cloud",
    "Cybersecurity",
    "AI Services",
    "Consulting",
    "Professional Services",
  ] as const;

  function mapFamily(raw: string | null | undefined): (typeof families)[number] {
    const s = (raw ?? "").toLowerCase();
    if (s.includes("hardware")) return "Hardware";
    if (s.includes("cloud") || s.includes("software")) return "Cloud";
    if (s.includes("cyber") || s.includes("security")) return "Cybersecurity";
    if (s.includes("ai")) return "AI Services";
    if (s.includes("consult")) return "Consulting";
    if (s.includes("professional") || s.includes("deploy"))
      return "Professional Services";
    return "Managed IT";
  }

  const buckets = Object.fromEntries(families.map((f) => [f, 0])) as Record<
    (typeof families)[number],
    number
  >;

  for (const item of catalogItems) {
    const fam = mapFamily(String(item.service_family));
    buckets[fam] += item.base_price ?? 0;
  }

  // Spread active MRR into Managed IT as recurring core if catalog empty-ish
  const mrr = sum(
    contracts
      .filter((c) => c.contract_status === "Active")
      .map((c) => c.monthly_recurring_fee ?? 0),
  );
  if (sum(Object.values(buckets)) === 0 && mrr > 0) {
    buckets["Managed IT"] = mrr;
  }

  const invoiceTotal = sum(invoices.map((i) => i.total_amount ?? 0));

  return (
    <div className="space-y-4">
      <MetricGrid>
        <MetricTile label="Catalog / list revenue signal" value={formatCurrency(sum(Object.values(buckets)))} />
        <MetricTile label="Invoiced total (all time)" value={formatCurrency(invoiceTotal)} />
        <MetricTile label="Active MRR" value={formatCurrency(mrr)} />
      </MetricGrid>
      <ReportTable headers={["Service", "Revenue signal"]}>
        {families.map((f) => (
          <tr key={f}>
            <td>{f}</td>
            <td>{formatCurrency(buckets[f])}</td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function CustomerTechnologyReport({
  dataset,
}: {
  dataset: ReportDataset;
}) {
  const {
    customers,
    hardware,
    tickets,
    securityScores,
    aiPlatforms,
    contracts,
    invoices,
    recommendations,
  } = dataset;
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");

  const customer = customers.find((c) => c.id === customerId);
  const devices = hardware.filter((a) => a.customer_id === customerId);
  const openTickets = tickets.filter(
    (t) =>
      t.customer_id === customerId &&
      t.status !== "Completed" &&
      t.status !== "Closed" &&
      t.status !== "Cancelled",
  );
  const score = securityScores.find((s) => s.customer_id === customerId);
  const aiScore = avg(
    aiPlatforms
      .filter((p) => p.customer_id === customerId)
      .map((p) => p.health_score)
      .filter((n): n is number => n != null),
  );
  const custContracts = contracts.filter((c) => c.customer_id === customerId);
  const monthlyCosts = sum(
    custContracts
      .filter((c) => c.contract_status === "Active")
      .map((c) => c.monthly_recurring_fee ?? 0),
  );
  const custRecs = recommendations.filter((r) => r.customer_id === customerId);
  const warrantySoon = devices.filter((d) => d.warranty_expiring_soon).length;

  return (
    <div className="space-y-4">
      <label className="form-control w-full max-w-md">
        <span className="label-text mb-1 text-xs font-medium">Customer</span>
        <select
          className="select select-bordered"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.customer_name}
            </option>
          ))}
        </select>
      </label>

      {!customer ? (
        <EmptyState title="No customers" description="Add customers to view this report." />
      ) : (
        <>
          <MetricGrid>
            <MetricTile label="Devices covered" value={devices.length} />
            <MetricTile label="Warranty expiring soon" value={warrantySoon} />
            <MetricTile label="Open tickets" value={openTickets.length} />
            <MetricTile
              label="Security score"
              value={score?.health_score ?? customer.technology_health_score ?? "—"}
            />
            <MetricTile
              label="AI score"
              value={aiScore != null ? aiScore.toFixed(0) : "—"}
            />
            <MetricTile label="Active contracts" value={custContracts.filter((c) => c.contract_status === "Active").length} />
            <MetricTile label="Monthly costs (MRR)" value={formatCurrency(monthlyCosts)} />
            <MetricTile
              label="Open AR (customer)"
              value={formatCurrency(
                sum(
                  invoices
                    .filter((i) => i.customer_id === customerId)
                    .map((i) => i.remaining_balance ?? 0),
                ),
              )}
            />
          </MetricGrid>

          <h3 className="font-semibold">Recommendations</h3>
          {custRecs.length === 0 ? (
            <EmptyState
              title="No recommendations"
              description="Recommendations for this customer will appear here."
            />
          ) : (
            <ReportTable headers={["Priority", "Title", "Status"]}>
              {custRecs.map((r) => (
                <tr key={r.id}>
                  <td>{r.priority}</td>
                  <td>{r.title}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </ReportTable>
          )}
        </>
      )}
    </div>
  );
}
