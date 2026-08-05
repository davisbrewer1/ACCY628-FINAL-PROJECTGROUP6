"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { saveCostEntry } from "@/app/actions/cost-entries";
import { ApprovalRequestButton } from "@/components/ApprovalRequestButton";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import {
  autoCostCalculator,
  type PartUsageInput,
  type SoftwareUsageInput,
} from "@/lib/autoCostCalculator";
import {
  fetchContractInclusionRules,
  fetchCostReferenceData,
  fetchTechnicianHourlyRate,
  type CostSettings,
} from "@/lib/cost-data";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type {
  Contract,
  Customer,
  InventoryPart,
  ServiceTicket,
  SoftwareCatalogItem,
  Technician,
} from "@/lib/types";

const SERVICE_OPTIONS = [
  "Remote Support",
  "On-site Support",
  "Monitoring",
  "Patching",
  "Hardware Replacement",
  "Software Install",
];

interface TimeCostTrackingProps {
  technicians: Technician[];
  customers: Customer[];
  contracts: Contract[];
  tickets: ServiceTicket[];
  onSaved?: () => void;
}

interface CostOverrides {
  laborCost: string;
  travelCost: string;
  equipmentCost: string;
  softwareCost: string;
  otherCost: string;
}

const EMPTY_OVERRIDES: CostOverrides = {
  laborCost: "",
  travelCost: "",
  equipmentCost: "",
  softwareCost: "",
  otherCost: "",
};

function parseOverride(value: string): number | null {
  if (!value.trim()) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function TimeCostTracking({
  technicians,
  customers,
  contracts,
  tickets,
  onSaved,
}: TimeCostTrackingProps) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<CostSettings | null>(null);
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [software, setSoftware] = useState<SoftwareCatalogItem[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [saving, setSaving] = useState(false);

  const [technicianId, setTechnicianId] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [laborHours, setLaborHours] = useState("1");
  const [miles, setMiles] = useState("0");
  const [otherCategory, setOtherCategory] = useState("None");
  const [serviceKey, setServiceKey] = useState("Remote Support");
  const [notes, setNotes] = useState("");
  const [hourlyRate, setHourlyRate] = useState<number | null>(null);
  const [includedServices, setIncludedServices] = useState<string[]>([]);
  const [partsUsed, setPartsUsed] = useState<PartUsageInput[]>([]);
  const [softwareInstalled, setSoftwareInstalled] = useState<SoftwareUsageInput[]>(
    [],
  );
  const [selectedPartId, setSelectedPartId] = useState("");
  const [selectedSoftwareId, setSelectedSoftwareId] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [overrides] = useState<CostOverrides>(EMPTY_OVERRIDES);
  const [lastCostEntryId, setLastCostEntryId] = useState<string | null>(null);
  const [promptApproval, setPromptApproval] = useState(false);

  const selectedTicket = tickets.find((ticket) => ticket.id === ticketId);
  const contractId = selectedTicket?.contract_id ?? "";

  useEffect(() => {
    async function loadRefs() {
      const supabase = createClient();
      const data = await fetchCostReferenceData(supabase);
      setSettings(data.settings);
      setParts(data.parts);
      setSoftware(data.software);
      if (data.parts[0]) setSelectedPartId(data.parts[0].id);
      if (data.software[0]) setSelectedSoftwareId(data.software[0].id);
      setLoadingRefs(false);
    }
    void loadRefs();
  }, []);

  useEffect(() => {
    if (!technicianId) {
      setHourlyRate(null);
      return;
    }
    const supabase = createClient();
    void fetchTechnicianHourlyRate(supabase, technicianId).then(setHourlyRate);
  }, [technicianId]);

  useEffect(() => {
    if (!contractId) {
      setIncludedServices([]);
      return;
    }
    const supabase = createClient();
    void fetchContractInclusionRules(supabase, contractId).then(
      setIncludedServices,
    );
  }, [contractId]);

  const calculation = useMemo(() => {
    if (!settings) return null;

    return autoCostCalculator({
      laborHours: Number(laborHours) || 0,
      miles: Number(miles) || 0,
      partsUsed,
      softwareInstalled,
      otherCategory,
      serviceKey,
      includedServices,
      rates: {
        technicianHourlyRate: hourlyRate,
        travelRate: settings.travelRate,
        otherCosts: settings.otherCosts,
        approvalThreshold: settings.approvalThreshold,
      },
      overrides: {
        laborCost: parseOverride(overrides.laborCost),
        travelCost: parseOverride(overrides.travelCost),
        equipmentCost: parseOverride(overrides.equipmentCost),
        softwareCost: parseOverride(overrides.softwareCost),
        otherCost: parseOverride(overrides.otherCost),
      },
    });
  }, [
    settings,
    laborHours,
    miles,
    partsUsed,
    softwareInstalled,
    otherCategory,
    serviceKey,
    includedServices,
    hourlyRate,
    overrides,
  ]);

  const openTickets = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          ticket.status !== "Closed" && ticket.status !== "Canceled",
      ),
    [tickets],
  );

  function addPart() {
    const part = parts.find((item) => item.id === selectedPartId);
    if (!part) return;
    const quantity = Math.max(1, Number(partQty) || 1);
    setPartsUsed((current) => {
      const existing = current.find((item) => item.partId === part.id);
      if (existing) {
        return current.map((item) =>
          item.partId === part.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }
      return [
        ...current,
        {
          partId: part.id,
          partName: part.part_name,
          unitCost: part.unit_cost,
          quantity,
        },
      ];
    });
  }

  function addSoftware() {
    const item = software.find((row) => row.id === selectedSoftwareId);
    if (!item) return;
    setSoftwareInstalled((current) => {
      if (current.some((row) => row.softwareId === item.id)) {
        return current;
      }
      return [
        ...current,
        {
          softwareId: item.id,
          softwareName: item.software_name,
          licenseCost: item.license_cost,
        },
      ];
    });
  }

  async function handleSave() {
    if (!selectedTicket || !technicianId) {
      showToast("Select a technician and ticket first.", "error");
      return;
    }

    setSaving(true);
    const result = await saveCostEntry({
      ticketId,
      technicianId,
      customerId: selectedTicket.customer_id,
      contractId: selectedTicket.contract_id,
      laborHours: Number(laborHours) || 0,
      miles: Number(miles) || 0,
      otherCategory,
      serviceKey,
      partsUsed,
      softwareInstalled,
      notes,
      overrides: {
        laborCost: parseOverride(overrides.laborCost),
        travelCost: parseOverride(overrides.travelCost),
        equipmentCost: parseOverride(overrides.equipmentCost),
        softwareCost: parseOverride(overrides.softwareCost),
        otherCost: parseOverride(overrides.otherCost),
      },
    });
    setSaving(false);

    if (result.success) {
      showToast(result.message);
      setLastCostEntryId(result.costEntryId ?? null);
      setPartsUsed([]);
      setSoftwareInstalled([]);
      setNotes("");
      if (calculation?.approvalRequired) {
        setPromptApproval(true);
        showToast(
          "This billable cost exceeds the approval threshold. Please request approval.",
          "info",
        );
      } else {
        setPromptApproval(false);
      }
      onSaved?.();
    } else {
      showToast(result.message, "error");
    }
  }

  if (loadingRefs) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  const otherCategories = Object.keys(settings?.otherCosts ?? { None: 0 });

  return (
    <div className="card border bg-base-100 shadow-sm">
      <div className="card-body gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="card-title text-base">
              <Calculator className="size-4" aria-hidden="true" />
              Log time & cost
            </h2>
            <p className="text-sm text-base-content/60">
              Enter work details — labor, travel, parts, and software costs calculate
              automatically.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="form-control">
            <span className="label-text mb-1 text-xs">Technician</span>
            <select
              className="select select-bordered select-sm"
              value={technicianId}
              onChange={(event) => setTechnicianId(event.target.value)}
            >
              <option value="">Select technician</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.technician_name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-control">
            <span className="label-text mb-1 text-xs">Ticket</span>
            <select
              className="select select-bordered select-sm"
              value={ticketId}
              onChange={(event) => setTicketId(event.target.value)}
            >
              <option value="">Select ticket</option>
              {openTickets.map((ticket) => (
                <option key={ticket.id} value={ticket.id}>
                  {ticket.ticket_number} — {ticket.title}
                </option>
              ))}
            </select>
          </label>

          <label className="form-control">
            <span className="label-text mb-1 text-xs">Labor hours</span>
            <input
              type="number"
              min="0"
              step="0.25"
              className="input input-bordered input-sm"
              value={laborHours}
              onChange={(event) => setLaborHours(event.target.value)}
            />
          </label>

          <label className="form-control">
            <span className="label-text mb-1 text-xs">Miles traveled</span>
            <input
              type="number"
              min="0"
              step="0.1"
              className="input input-bordered input-sm"
              value={miles}
              onChange={(event) => setMiles(event.target.value)}
            />
          </label>

          <label className="form-control">
            <span className="label-text mb-1 text-xs">Service type</span>
            <select
              className="select select-bordered select-sm"
              value={serviceKey}
              onChange={(event) => setServiceKey(event.target.value)}
            >
              {SERVICE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="form-control">
            <span className="label-text mb-1 text-xs">Other cost category</span>
            <select
              className="select select-bordered select-sm"
              value={otherCategory}
              onChange={(event) => setOtherCategory(event.target.value)}
            >
              {otherCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="form-control md:col-span-2">
            <span className="label-text mb-1 text-xs">Notes</span>
            <input
              className="input input-bordered input-sm"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional work notes"
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-box border border-base-300 p-3">
            <p className="mb-2 text-sm font-semibold">Parts used</p>
            <div className="flex flex-wrap gap-2">
              <select
                className="select select-bordered select-sm min-w-40 flex-1"
                value={selectedPartId}
                onChange={(event) => setSelectedPartId(event.target.value)}
              >
                {parts.map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.part_name} ({formatCurrency(part.unit_cost)})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                className="input input-bordered input-sm w-20"
                value={partQty}
                onChange={(event) => setPartQty(event.target.value)}
              />
              <button type="button" className="btn btn-sm" onClick={addPart}>
                <Plus className="size-4" />
                Add
              </button>
            </div>
            <ul className="mt-3 space-y-1">
              {partsUsed.map((part) => (
                <li
                  key={part.partId}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {part.partName} × {part.quantity}
                  </span>
                  <span className="flex items-center gap-2">
                    {formatCurrency(part.unitCost * part.quantity)}
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-square"
                      onClick={() =>
                        setPartsUsed((current) =>
                          current.filter((item) => item.partId !== part.partId),
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </li>
              ))}
              {partsUsed.length === 0 ? (
                <li className="text-xs text-base-content/50">No parts added.</li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-box border border-base-300 p-3">
            <p className="mb-2 text-sm font-semibold">Software installed</p>
            <div className="flex flex-wrap gap-2">
              <select
                className="select select-bordered select-sm min-w-40 flex-1"
                value={selectedSoftwareId}
                onChange={(event) => setSelectedSoftwareId(event.target.value)}
              >
                {software.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.software_name} ({formatCurrency(item.license_cost)})
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-sm" onClick={addSoftware}>
                <Plus className="size-4" />
                Add
              </button>
            </div>
            <ul className="mt-3 space-y-1">
              {softwareInstalled.map((item) => (
                <li
                  key={item.softwareId}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{item.softwareName}</span>
                  <span className="flex items-center gap-2">
                    {formatCurrency(item.licenseCost)}
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-square"
                      onClick={() =>
                        setSoftwareInstalled((current) =>
                          current.filter(
                            (row) => row.softwareId !== item.softwareId,
                          ),
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </li>
              ))}
              {softwareInstalled.length === 0 ? (
                <li className="text-xs text-base-content/50">
                  No software added.
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        {calculation ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(
                [
                  ["Labor", calculation.laborCost],
                  ["Travel", calculation.travelCost],
                  ["Equipment", calculation.equipmentCost],
                  ["Software", calculation.softwareCost],
                  ["Other", calculation.otherCost],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-box border border-base-300 px-3 py-2"
                >
                  <p className="text-xs text-base-content/55">{label}</p>
                  <p className="font-semibold">{formatCurrency(value)}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-primary/40 bg-primary/5 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                  Total cost
                </p>
                <p className="text-3xl font-bold tracking-tight">
                  {formatCurrency(calculation.totalCost)}
                </p>
                <p className="mt-1 text-xs text-base-content/60">
                  Rate {formatCurrency(calculation.appliedHourlyRate)}/hr · Travel{" "}
                  {formatCurrency(calculation.appliedTravelRate)}/mi
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={calculation.billingStatus} />
                {calculation.approvalRequired ? (
                  <StatusBadge status="Approval Required" />
                ) : (
                  <StatusBadge status="No Approval Needed" />
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving || !technicianId || !ticketId}
                onClick={() => void handleSave()}
              >
                {saving ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Save cost entry"
                )}
              </button>
              <ApprovalRequestButton
                ticketId={ticketId || undefined}
                technicianId={technicianId || undefined}
                costEntryId={lastCostEntryId}
                totalCost={calculation.totalCost}
                approvalRequired={calculation.approvalRequired}
                autoOpen={promptApproval && calculation.approvalRequired}
                disabled={!ticketId || !technicianId}
                onSubmitted={() => {
                  setPromptApproval(false);
                  onSaved?.();
                }}
              />
            </div>

            {calculation.approvalRequired ? (
              <div className="alert alert-warning text-sm">
                <span>
                  Billable total exceeds the approval threshold (
                  {formatCurrency(calculation.approvalThreshold)}). Request
                  manager approval before continuing.
                </span>
              </div>
            ) : null}

            {selectedTicket ? (
              <p className="text-xs text-base-content/50">
                Customer:{" "}
                {customers.find((c) => c.id === selectedTicket.customer_id)
                  ?.customer_name ?? "—"}
                {contractId
                  ? ` · Contract: ${
                      contracts.find((c) => c.id === contractId)?.contract_name ??
                      "—"
                    }`
                  : " · No contract linked"}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
