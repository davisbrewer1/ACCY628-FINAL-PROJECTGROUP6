export const DEFAULT_TECHNICIAN_HOURLY_RATE = 55;
export const DEFAULT_TRAVEL_RATE = 0.67;
export const DEFAULT_APPROVAL_THRESHOLD = 500;

export const DEFAULT_OTHER_COSTS: Record<string, number> = {
  None: 0,
  Disposal: 75,
  "Emergency Fee": 150,
  "After Hours": 95,
};

export interface PartUsageInput {
  partId: string;
  partName?: string;
  unitCost: number;
  quantity: number;
}

export interface SoftwareUsageInput {
  softwareId: string;
  softwareName?: string;
  licenseCost: number;
}

export interface CostCalculatorRates {
  technicianHourlyRate: number | null | undefined;
  travelRate: number | null | undefined;
  otherCosts: Record<string, number>;
  approvalThreshold: number | null | undefined;
  fallbackHourlyRate?: number;
}

export interface CostCalculatorInput {
  laborHours: number | null | undefined;
  miles: number | null | undefined;
  partsUsed: PartUsageInput[];
  softwareInstalled: SoftwareUsageInput[];
  otherCategory: string | null | undefined;
  serviceKey?: string | null;
  includedServices?: string[] | null;
  rates: CostCalculatorRates;
  overrides?: Partial<{
    laborCost: number | null;
    travelCost: number | null;
    equipmentCost: number | null;
    softwareCost: number | null;
    otherCost: number | null;
  }>;
}

export interface CostCalculationResult {
  laborCost: number;
  travelCost: number;
  equipmentCost: number;
  softwareCost: number;
  otherCost: number;
  totalCost: number;
  billingStatus: "Included" | "Billable";
  approvalRequired: boolean;
  appliedHourlyRate: number;
  appliedTravelRate: number;
  approvalThreshold: number;
  auto: {
    laborCost: number;
    travelCost: number;
    equipmentCost: number;
    softwareCost: number;
    otherCost: number;
  };
}

function safeNumber(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) {
    return 0;
  }
  return value;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function resolveTechnicianHourlyRate(
  hourlyRate: number | null | undefined,
  fallback = DEFAULT_TECHNICIAN_HOURLY_RATE,
): number {
  const rate = safeNumber(hourlyRate);
  return rate > 0 ? rate : fallback;
}

export function calcEquipmentCost(partsUsed: PartUsageInput[]): number {
  return roundCurrency(
    partsUsed.reduce(
      (sum, part) => sum + safeNumber(part.unitCost) * safeNumber(part.quantity),
      0,
    ),
  );
}

export function calcSoftwareLicenseCost(
  softwareInstalled: SoftwareUsageInput[],
): number {
  return roundCurrency(
    softwareInstalled.reduce(
      (sum, item) => sum + safeNumber(item.licenseCost),
      0,
    ),
  );
}

export function calcTravelCost(
  miles: number | null | undefined,
  travelRate: number | null | undefined,
): number {
  const milesValue = safeNumber(miles);
  if (milesValue <= 0) {
    return 0;
  }
  return roundCurrency(milesValue * safeNumber(travelRate));
}

export function resolveOtherCost(
  category: string | null | undefined,
  otherCosts: Record<string, number>,
): number {
  if (!category || category === "None") {
    return 0;
  }
  return roundCurrency(safeNumber(otherCosts[category]));
}

export function resolveBillingStatus(
  serviceKey: string | null | undefined,
  includedServices: string[] | null | undefined,
): "Included" | "Billable" {
  if (!serviceKey || !includedServices || includedServices.length === 0) {
    return "Billable";
  }

  const normalized = serviceKey.trim().toLowerCase();
  const included = includedServices.some(
    (service) => service.trim().toLowerCase() === normalized,
  );
  return included ? "Included" : "Billable";
}

/**
 * Automatically compute labor, travel, equipment, software, other, and total costs.
 */
export function autoCostCalculator(
  input: CostCalculatorInput,
): CostCalculationResult {
  const fallbackHourlyRate =
    input.rates.fallbackHourlyRate ?? DEFAULT_TECHNICIAN_HOURLY_RATE;
  const appliedHourlyRate = resolveTechnicianHourlyRate(
    input.rates.technicianHourlyRate,
    fallbackHourlyRate,
  );
  const appliedTravelRate =
    safeNumber(input.rates.travelRate) > 0
      ? safeNumber(input.rates.travelRate)
      : DEFAULT_TRAVEL_RATE;
  const approvalThreshold =
    input.rates.approvalThreshold == null
      ? DEFAULT_APPROVAL_THRESHOLD
      : safeNumber(input.rates.approvalThreshold);

  const autoLabor = roundCurrency(
    safeNumber(input.laborHours) * appliedHourlyRate,
  );
  const autoTravel = calcTravelCost(input.miles, appliedTravelRate);
  const autoEquipment = calcEquipmentCost(input.partsUsed);
  const autoSoftware = calcSoftwareLicenseCost(input.softwareInstalled);
  const autoOther = resolveOtherCost(
    input.otherCategory,
    input.rates.otherCosts ?? DEFAULT_OTHER_COSTS,
  );

  const laborCost =
    input.overrides?.laborCost != null
      ? roundCurrency(safeNumber(input.overrides.laborCost))
      : autoLabor;
  const travelCost =
    input.overrides?.travelCost != null
      ? roundCurrency(safeNumber(input.overrides.travelCost))
      : autoTravel;
  const equipmentCost =
    input.overrides?.equipmentCost != null
      ? roundCurrency(safeNumber(input.overrides.equipmentCost))
      : autoEquipment;
  const softwareCost =
    input.overrides?.softwareCost != null
      ? roundCurrency(safeNumber(input.overrides.softwareCost))
      : autoSoftware;
  const otherCost =
    input.overrides?.otherCost != null
      ? roundCurrency(safeNumber(input.overrides.otherCost))
      : autoOther;

  const totalCost = roundCurrency(
    laborCost + travelCost + equipmentCost + softwareCost + otherCost,
  );

  const billingStatus = resolveBillingStatus(
    input.serviceKey,
    input.includedServices,
  );
  const approvalRequired =
    billingStatus === "Billable" && totalCost > approvalThreshold;

  return {
    laborCost,
    travelCost,
    equipmentCost,
    softwareCost,
    otherCost,
    totalCost,
    billingStatus,
    approvalRequired,
    appliedHourlyRate,
    appliedTravelRate,
    approvalThreshold,
    auto: {
      laborCost: autoLabor,
      travelCost: autoTravel,
      equipmentCost: autoEquipment,
      softwareCost: autoSoftware,
      otherCost: autoOther,
    },
  };
}
