"use client";

import { useEffect, useMemo, useState } from "react";
import { differenceInMinutes, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import {
  isInSelectedMonth,
  monthKeyFromDate,
} from "@/components/MonthPicker";
import { PageHeader } from "@/components/PageHeader";
import { ExistingReportPanel } from "@/components/reports/ExistingReportPanel";
import { ReportBody, type ReportDataset } from "@/components/reports/ReportBody";
import { ReportCategoryTable } from "@/components/reports/ReportCategoryTable";
import {
  findReport,
  type ReportCategoryId,
} from "@/components/reports/registry";
import { calcContractProfit, calcProfitMargin } from "@/lib/calculations";
import { isThisMonth } from "@/lib/dashboard-stats";
import {
  cashCollectedMtd,
  getPastDueInvoices,
  getReadyToInvoiceEntries,
  getRenewalsInDays,
} from "@/lib/manager-ops";
import { allocateOverageHours } from "@/lib/plan-pricing";
import { createClient } from "@/lib/supabase/client";
import type {
  AiPlatform,
  AiRisk,
  AiUserCompliance,
  Contract,
  Customer,
  HardwareAsset,
  Invoice,
  Payment,
  Recommendation,
  SecurityAlert,
  SecurityScore,
  ServiceCatalogItem,
  ServiceTicket,
  Technician,
  WorkEntry,
} from "@/lib/types";

function emptyDataset(): ReportDataset {
  return {
    customers: [],
    contracts: [],
    tickets: [],
    workEntries: [],
    invoices: [],
    payments: [],
    hardware: [],
    securityScores: [],
    securityAlerts: [],
    aiPlatforms: [],
    aiRisks: [],
    aiCompliance: [],
    recommendations: [],
    technicians: [],
    catalogItems: [],
  };
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState<ReportDataset>(emptyDataset);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [resolutionCustomerId, setResolutionCustomerId] = useState("");
  const [resolutionTechId, setResolutionTechId] = useState("");
  const [resolutionMonth, setResolutionMonth] = useState<Date | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const results = await Promise.all([
        supabase.from("contracts").select("*"),
        supabase.from("work_entries").select("*"),
        supabase.from("invoices").select("*"),
        supabase.from("payments").select("*"),
        supabase.from("service_tickets").select("*"),
        supabase.from("customers").select("*").order("customer_name"),
        supabase
          .from("technicians")
          .select("*")
          .eq("active", true)
          .order("technician_name"),
        supabase.from("hardware_assets").select("*"),
        supabase.from("security_scores").select("*"),
        supabase.from("security_alerts").select("*"),
        supabase.from("ai_platforms").select("*"),
        supabase.from("ai_risks").select("*"),
        supabase.from("ai_user_compliance").select("*"),
        supabase.from("recommendations").select("*"),
        supabase.from("service_catalog_items").select("*"),
      ]);

      setDataset({
        contracts: (results[0].data ?? []) as Contract[],
        workEntries: (results[1].data ?? []) as WorkEntry[],
        invoices: (results[2].data ?? []) as Invoice[],
        payments: (results[3].data ?? []) as Payment[],
        tickets: (results[4].data ?? []) as ServiceTicket[],
        customers: (results[5].data ?? []) as Customer[],
        technicians: (results[6].data ?? []) as Technician[],
        hardware: (results[7].data ?? []) as HardwareAsset[],
        securityScores: (results[8].data ?? []) as SecurityScore[],
        securityAlerts: (results[9].data ?? []) as SecurityAlert[],
        aiPlatforms: (results[10].data ?? []) as AiPlatform[],
        aiRisks: (results[11].data ?? []) as AiRisk[],
        aiCompliance: (results[12].data ?? []) as AiUserCompliance[],
        recommendations: (results[13].data ?? []) as Recommendation[],
        catalogItems: (results[14].data ?? []) as ServiceCatalogItem[],
      });
      setLoading(false);
    }
    load();
  }, []);

  const {
    contracts,
    workEntries,
    invoices,
    payments,
    tickets,
    customers,
    technicians,
  } = dataset;

  const summary = useMemo(() => {
    const recurringRevenue = contracts
      .filter((c) => c.contract_status === "Active")
      .reduce((sum, c) => sum + (c.monthly_recurring_fee ?? 0), 0);

    // Unbilled = pool overage hours × rate + pass-through expenses on ready entries
    const ready = getReadyToInvoiceEntries(workEntries);
    let unbilledRevenue = 0;
    for (const contract of contracts) {
      const contractReady = ready.filter((e) => e.contract_id === contract.id);
      if (contractReady.length === 0) continue;
      const byMonth = new Map<string, typeof contractReady>();
      for (const entry of contractReady) {
        const month = entry.work_date?.slice(0, 7) ?? "unknown";
        const list = byMonth.get(month) ?? [];
        list.push(entry);
        byMonth.set(month, list);
      }
      for (const monthEntries of byMonth.values()) {
        const allocated = allocateOverageHours({
          selected: monthEntries,
          includedHoursPerMonth: Number(contract.included_support_hours ?? 0),
        });
        for (const entry of monthEntries) {
          const overage = allocated.get(entry.id) ?? 0;
          unbilledRevenue +=
            overage * (contract.additional_hourly_rate ?? 0) +
            (entry.parts_cost ?? 0) +
            (entry.software_cost ?? 0) +
            (entry.equipment_cost ?? 0) +
            (entry.travel_cost ?? 0) +
            (entry.other_cost ?? 0);
        }
      }
    }
    for (const entry of ready) {
      if (entry.contract_id) continue;
      unbilledRevenue +=
        (entry.parts_cost ?? 0) +
        (entry.software_cost ?? 0) +
        (entry.equipment_cost ?? 0) +
        (entry.travel_cost ?? 0) +
        (entry.other_cost ?? 0);
    }

    const accountsReceivable = invoices.reduce(
      (sum, i) => sum + (i.remaining_balance ?? 0),
      0,
    );

    const pastDue = getPastDueInvoices(invoices).reduce(
      (sum, i) => sum + (i.remaining_balance ?? 0),
      0,
    );

    return {
      recurringRevenue,
      unbilledRevenue,
      accountsReceivable,
      pastDue,
      cashMtd: cashCollectedMtd(payments),
      renewals90: getRenewalsInDays(contracts, 90).length,
    };
  }, [contracts, workEntries, invoices, payments]);

  const contractRows = useMemo(() => {
    return contracts.map((contract) => {
      const costs = workEntries
        .filter((e) => e.contract_id === contract.id)
        .reduce((sum, e) => sum + (e.total_direct_cost ?? 0), 0);
      const monthHours = workEntries
        .filter((e) => e.contract_id === contract.id && isThisMonth(e.work_date))
        .reduce((sum, e) => sum + (e.hours_worked ?? 0), 0);
      const included = contract.included_support_hours ?? 0;
      const revenue = contract.monthly_recurring_fee ?? 0;
      const profit = calcContractProfit(revenue, costs);
      const margin = calcProfitMargin(revenue, costs);
      const overHours = included > 0 && monthHours > included;
      const leakageHours = Math.max(0, monthHours - included);
      const leakageEstimate =
        leakageHours * (contract.additional_hourly_rate ?? 0);

      return {
        id: contract.id,
        name: contract.contract_name,
        customerId: contract.customer_id,
        revenue,
        costs,
        profit,
        margin,
        overHours,
        leakageHours,
        leakageEstimate,
        renewalDate: contract.renewal_date,
        automaticRenewal: contract.automatic_renewal,
        lowMargin: margin != null && margin < 10,
        negative: profit < 0,
      };
    });
  }, [contracts, workEntries]);

  const selectedReport = selectedReportId
    ? findReport(selectedReportId)
    : null;
  const legacyView = selectedReport?.legacyView ?? null;

  const viewRows = useMemo(() => {
    if (!legacyView || legacyView === "resolution") return [];
    if (legacyView === "margin") {
      return [...contractRows].sort(
        (a, b) => (a.margin ?? 999) - (b.margin ?? 999),
      );
    }
    if (legacyView === "leakage") {
      return contractRows
        .filter((r) => r.overHours)
        .sort((a, b) => b.leakageEstimate - a.leakageEstimate);
    }
    if (legacyView === "churn") {
      const renewing = new Set(
        getRenewalsInDays(contracts, 90).map((c) => c.id),
      );
      return contractRows
        .filter((r) => renewing.has(r.id) || r.lowMargin || r.negative)
        .sort((a, b) => {
          const ad = a.renewalDate ?? "9999";
          const bd = b.renewalDate ?? "9999";
          return ad.localeCompare(bd);
        });
    }
    return [...contractRows].sort((a, b) => b.revenue - a.revenue);
  }, [legacyView, contractRows, contracts]);

  const resolvedTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (!t.opened_at || !t.completed_at) return false;
      const status = t.status ?? "";
      return status === "Completed" || status === "Closed";
    });
  }, [tickets]);

  const monthsWithResolutions = useMemo(() => {
    const keys = new Set<string>();
    for (const t of resolvedTickets) {
      const key = monthKeyFromDate(t.completed_at ?? "");
      if (key) keys.add(key);
    }
    return keys;
  }, [resolvedTickets]);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.customer_name])),
    [customers],
  );
  const techMap = useMemo(
    () => new Map(technicians.map((t) => [t.id, t.technician_name])),
    [technicians],
  );

  const resolutionStats = useMemo(() => {
    const filtered = resolvedTickets.filter((t) => {
      if (resolutionCustomerId && t.customer_id !== resolutionCustomerId) {
        return false;
      }
      if (resolutionTechId && t.assigned_technician_id !== resolutionTechId) {
        return false;
      }
      if (!isInSelectedMonth(t.completed_at, resolutionMonth)) {
        return false;
      }
      return true;
    });

    const withHours = filtered
      .map((t) => {
        const opened = parseISO(t.opened_at!);
        const completed = parseISO(t.completed_at!);
        const minutes = differenceInMinutes(completed, opened);
        if (Number.isNaN(minutes) || minutes < 0) return null;
        return {
          ticket: t,
          hours: minutes / 60,
        };
      })
      .filter(
        (row): row is { ticket: ServiceTicket; hours: number } => row != null,
      );

    const avgHours =
      withHours.length > 0
        ? withHours.reduce((sum, row) => sum + row.hours, 0) / withHours.length
        : null;

    const companyAvg =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, t) => {
            const minutes = differenceInMinutes(
              parseISO(t.completed_at!),
              parseISO(t.opened_at!),
            );
            return (
              sum + (Number.isNaN(minutes) || minutes < 0 ? 0 : minutes / 60)
            );
          }, 0) / resolvedTickets.length
        : null;

    return {
      count: withHours.length,
      avgHours,
      companyAvg,
      rows: withHours.sort((a, b) => b.hours - a.hours).slice(0, 25),
    };
  }, [
    resolvedTickets,
    resolutionCustomerId,
    resolutionTechId,
    resolutionMonth,
  ]);

  function handleSelectReport(
    _categoryId: ReportCategoryId,
    reportId: string | null,
  ) {
    setSelectedReportId(reportId);
  }

  function handleBack() {
    setSelectedReportId(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (selectedReport) {
    const reportTitle = selectedReport.featured
      ? `★ ${selectedReport.title}`
      : selectedReport.title;

    return (
      <div className="relative space-y-6 pb-20">
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="btn btn-ghost btn-square no-print"
            aria-label="Back to report categories"
            onClick={handleBack}
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </button>
          <h1 className="pt-1.5 text-2xl font-bold tracking-tight">
            {reportTitle}
          </h1>
        </div>

        {legacyView ? (
          <ExistingReportPanel
            view={legacyView}
            summary={summary}
            viewRows={viewRows}
            customers={customers}
            technicians={technicians}
            customerMap={customerMap}
            techMap={techMap}
            resolutionCustomerId={resolutionCustomerId}
            resolutionTechId={resolutionTechId}
            resolutionMonth={resolutionMonth}
            monthsWithResolutions={monthsWithResolutions}
            resolvedTicketCount={resolvedTickets.length}
            resolutionStats={resolutionStats}
            onResolutionCustomerId={setResolutionCustomerId}
            onResolutionTechId={setResolutionTechId}
            onResolutionMonth={setResolutionMonth}
          />
        ) : (
          <div className="card border bg-base-100 shadow-sm">
            <div className="card-body">
              <ReportBody reportId={selectedReport.id} dataset={dataset} />
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary no-print fixed bottom-6 right-6 z-20 shadow-lg"
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Manager Reports" />
      <ReportCategoryTable
        selectedReportId={selectedReportId}
        onSelectReport={handleSelectReport}
      />
    </div>
  );
}
