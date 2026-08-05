import {
  autoCostCalculator,
  DEFAULT_OTHER_COSTS,
  DEFAULT_TECHNICIAN_HOURLY_RATE,
  DEFAULT_TRAVEL_RATE,
  type CostCalculationResult,
  type CostCalculatorRates,
} from "@/lib/autoCostCalculator";

export type CostCategory =
  | "labor"
  | "travel"
  | "equipment"
  | "software"
  | "other";

export interface CostClassificationContext {
  includedServices?: string[];
  rates?: Partial<CostCalculatorRates>;
  serviceHint?: string | null;
}

export interface CostClassificationResult {
  primaryCategory: CostCategory;
  categories: CostCategory[];
  estimatedHours: number;
  estimatedMiles: number;
  serviceKey: string;
  otherCategory: string;
  billingStatus: "Included" | "Billable";
  approvalRequired: boolean;
  recommended: {
    laborCost: number;
    travelCost: number;
    equipmentCost: number;
    softwareCost: number;
    otherCost: number;
    totalCost: number;
  };
  confidence: number;
  rationale: string[];
  matchedKeywords: string[];
  provider: "openai" | "local";
  calculation: CostCalculationResult;
}

const CATEGORY_KEYWORDS: Record<CostCategory, string[]> = {
  labor: [
    "troubleshoot",
    "diagnos",
    "configured",
    "configure",
    "setup",
    "set up",
    "rebooted",
    "restarted",
    "patched",
    "updated",
    "reviewed",
    "tested",
    "resolved",
    "fixed",
    "supported",
  ],
  travel: [
    "traveled",
    "travelled",
    "drove",
    "drive",
    "miles",
    "onsite",
    "on-site",
    "on site",
    "site visit",
    "commute",
  ],
  equipment: [
    "replaced",
    "replacement",
    "installed hardware",
    "cable",
    "ssd",
    "hard drive",
    "router",
    "switch",
    "printer",
    "ups",
    "battery",
    "part",
    "hardware",
    "keyboard",
    "monitor",
  ],
  software: [
    "installed",
    "software",
    "license",
    "agent",
    "endpoint",
    "antivirus",
    "backup agent",
    "office",
    "vpn client",
    "application",
  ],
  other: [
    "after hours",
    "after-hours",
    "emergency",
    "disposal",
    "recycle",
    "urgent fee",
    "weekend",
  ],
};

const SERVICE_KEYWORDS: Array<{ key: string; terms: string[] }> = [
  { key: "On-site Support", terms: ["onsite", "on-site", "on site", "site visit"] },
  { key: "Hardware Replacement", terms: ["replaced", "replacement", "hardware"] },
  { key: "Software Install", terms: ["installed", "software", "license", "agent"] },
  { key: "Patching", terms: ["patch", "update", "windows update"] },
  { key: "Monitoring", terms: ["monitor", "alert", "threshold"] },
  { key: "Remote Support", terms: ["remote", "vpn", "rdp"] },
];

function cleanNotes(notes: string): string {
  return notes.replace(/\r\n/g, "\n").trim();
}

function roundHours(value: number): number {
  return Math.round(value * 4) / 4;
}

function detectCategories(text: string): {
  categories: CostCategory[];
  matchedKeywords: string[];
  scores: Record<CostCategory, number>;
} {
  const lower = text.toLowerCase();
  const scores: Record<CostCategory, number> = {
    labor: 0,
    travel: 0,
    equipment: 0,
    software: 0,
    other: 0,
  };
  const matchedKeywords: string[] = [];

  (Object.keys(CATEGORY_KEYWORDS) as CostCategory[]).forEach((category) => {
    for (const term of CATEGORY_KEYWORDS[category]) {
      if (lower.includes(term)) {
        scores[category] += 1;
        matchedKeywords.push(term);
      }
    }
  });

  // Baseline labor presence for any notes.
  if (text.length > 0) {
    scores.labor += 0.5;
  }

  const ranked = (Object.entries(scores) as Array<[CostCategory, number]>)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  const categories = ranked.map(([category]) => category);
  if (categories.length === 0) {
    categories.push("labor");
  }

  return { categories, matchedKeywords: [...new Set(matchedKeywords)], scores };
}

function estimateHours(text: string, categories: CostCategory[]): number {
  const lower = text.toLowerCase();
  let hours = 0.75;

  if (categories.includes("travel") || /onsite|on-site|site visit/.test(lower)) {
    hours += 0.5;
  }
  if (categories.includes("equipment") || /replac|hardware|ssd|router/.test(lower)) {
    hours += 0.75;
  }
  if (categories.includes("software") || /install|license|agent/.test(lower)) {
    hours += 0.5;
  }
  if (/complex|multiple|several|escalat|migrat/.test(lower)) {
    hours += 1;
  }
  if (/quick|brief|simple|minor/.test(lower)) {
    hours = Math.max(0.5, hours - 0.5);
  }

  const explicit = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/);
  if (explicit) {
    hours = Number(explicit[1]);
  }

  return roundHours(Math.min(Math.max(hours, 0.25), 8));
}

function estimateMiles(text: string, categories: CostCategory[]): number {
  const lower = text.toLowerCase();
  const explicit = lower.match(/(\d+(?:\.\d+)?)\s*miles?/);
  if (explicit) {
    return Number(explicit[1]);
  }
  if (categories.includes("travel") || /onsite|on-site|site visit|drove|traveled/.test(lower)) {
    return 20;
  }
  return 0;
}

function detectServiceKey(text: string, hint?: string | null): string {
  if (hint?.trim()) return hint.trim();
  const lower = text.toLowerCase();
  for (const option of SERVICE_KEYWORDS) {
    if (option.terms.some((term) => lower.includes(term))) {
      return option.key;
    }
  }
  return "Remote Support";
}

function detectOtherCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/after[- ]?hours|weekend|night/.test(lower)) return "After Hours";
  if (/emergency|urgent/.test(lower)) return "Emergency Fee";
  if (/dispos|recycl/.test(lower)) return "Disposal";
  return "None";
}

function estimateEquipmentCost(categories: CostCategory[], text: string): number {
  if (!categories.includes("equipment")) return 0;
  const lower = text.toLowerCase();
  if (/ssd|hard drive/.test(lower)) return 89;
  if (/ups|battery/.test(lower)) return 65;
  if (/keyboard|mouse/.test(lower)) return 42;
  if (/cable/.test(lower)) return 8.5;
  return 45;
}

function estimateSoftwareCost(categories: CostCategory[], text: string): number {
  if (!categories.includes("software")) return 0;
  const lower = text.toLowerCase();
  if (/backup/.test(lower)) return 15;
  if (/antivirus|endpoint|protection/.test(lower)) return 12;
  if (/office/.test(lower)) return 22;
  if (/vpn/.test(lower)) return 8;
  return 12;
}

function buildLocalClassification(
  notes: string,
  context: CostClassificationContext = {},
): Omit<CostClassificationResult, "provider"> {
  const cleaned = cleanNotes(notes);
  const { categories, matchedKeywords, scores } = detectCategories(cleaned);
  const primaryCategory = categories[0] ?? "labor";
  const estimatedHours = estimateHours(cleaned, categories);
  const estimatedMiles = estimateMiles(cleaned, categories);
  const serviceKey = detectServiceKey(cleaned, context.serviceHint);
  const otherCategory = detectOtherCategory(cleaned);

  const rates: CostCalculatorRates = {
    technicianHourlyRate:
      context.rates?.technicianHourlyRate ?? DEFAULT_TECHNICIAN_HOURLY_RATE,
    travelRate: context.rates?.travelRate ?? DEFAULT_TRAVEL_RATE,
    otherCosts: context.rates?.otherCosts ?? DEFAULT_OTHER_COSTS,
    approvalThreshold: context.rates?.approvalThreshold,
  };

  const equipmentEstimate = estimateEquipmentCost(categories, cleaned);
  const softwareEstimate = estimateSoftwareCost(categories, cleaned);

  const calculation = autoCostCalculator({
    laborHours: estimatedHours,
    miles: estimatedMiles,
    partsUsed:
      equipmentEstimate > 0
        ? [
            {
              partId: "ai-estimated-part",
              partName: "AI estimated equipment",
              unitCost: equipmentEstimate,
              quantity: 1,
            },
          ]
        : [],
    softwareInstalled:
      softwareEstimate > 0
        ? [
            {
              softwareId: "ai-estimated-software",
              softwareName: "AI estimated license",
              licenseCost: softwareEstimate,
            },
          ]
        : [],
    otherCategory,
    serviceKey,
    includedServices: context.includedServices ?? [],
    rates,
  });

  const topScore = Math.max(...Object.values(scores), 0.5);
  const confidence = Math.min(0.95, 0.45 + topScore * 0.12 + matchedKeywords.length * 0.03);

  const rationale = [
    `Primary category detected as ${primaryCategory}.`,
    `Estimated ${estimatedHours} labor hour(s) from note complexity.`,
    calculation.billingStatus === "Included"
      ? `Service "${serviceKey}" appears included in the contract.`
      : `Service "${serviceKey}" appears billable.`,
    calculation.approvalRequired
      ? `Estimated total ${calculation.totalCost.toFixed(2)} exceeds approval threshold.`
      : "Estimated total is under the approval threshold.",
  ];

  if (estimatedMiles > 0) {
    rationale.push(`Travel implied; estimated ${estimatedMiles} miles.`);
  }

  return {
    primaryCategory,
    categories,
    estimatedHours,
    estimatedMiles,
    serviceKey,
    otherCategory,
    billingStatus: calculation.billingStatus,
    approvalRequired: calculation.approvalRequired,
    recommended: {
      laborCost: calculation.laborCost,
      travelCost: calculation.travelCost,
      equipmentCost: calculation.equipmentCost,
      softwareCost: calculation.softwareCost,
      otherCost: calculation.otherCost,
      totalCost: calculation.totalCost,
    },
    confidence,
    rationale,
    matchedKeywords,
    calculation,
  };
}

async function classifyWithOpenAi(
  notes: string,
  context: CostClassificationContext,
): Promise<CostClassificationResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Classify IT technician work notes for cost tracking. Return JSON with keys: primaryCategory (labor|travel|equipment|software|other), categories (array), estimatedHours (number), estimatedMiles (number), serviceKey (string), otherCategory (None|Disposal|Emergency Fee|After Hours), rationale (string array). Do not invent unrelated work.",
        },
        {
          role: "user",
          content: JSON.stringify({
            notes: cleanNotes(notes),
            includedServices: context.includedServices ?? [],
            serviceHint: context.serviceHint ?? null,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as Partial<CostClassificationResult>;
    const local = buildLocalClassification(notes, {
      ...context,
      serviceHint: parsed.serviceKey || context.serviceHint,
    });

    const estimatedHours =
      typeof parsed.estimatedHours === "number"
        ? roundHours(parsed.estimatedHours)
        : local.estimatedHours;
    const estimatedMiles =
      typeof parsed.estimatedMiles === "number"
        ? parsed.estimatedMiles
        : local.estimatedMiles;
    const serviceKey = parsed.serviceKey || local.serviceKey;
    const otherCategory = parsed.otherCategory || local.otherCategory;
    const categories =
      Array.isArray(parsed.categories) && parsed.categories.length > 0
        ? (parsed.categories as CostCategory[])
        : local.categories;
    const primaryCategory =
      (parsed.primaryCategory as CostCategory) || categories[0] || "labor";

    const rates: CostCalculatorRates = {
      technicianHourlyRate:
        context.rates?.technicianHourlyRate ?? DEFAULT_TECHNICIAN_HOURLY_RATE,
      travelRate: context.rates?.travelRate ?? DEFAULT_TRAVEL_RATE,
      otherCosts: context.rates?.otherCosts ?? DEFAULT_OTHER_COSTS,
      approvalThreshold: context.rates?.approvalThreshold,
    };

    const calculation = autoCostCalculator({
      laborHours: estimatedHours,
      miles: estimatedMiles,
      partsUsed:
        categories.includes("equipment")
          ? [
              {
                partId: "ai-estimated-part",
                partName: "AI estimated equipment",
                unitCost: local.recommended.equipmentCost || 45,
                quantity: 1,
              },
            ]
          : [],
      softwareInstalled:
        categories.includes("software")
          ? [
              {
                softwareId: "ai-estimated-software",
                softwareName: "AI estimated license",
                licenseCost: local.recommended.softwareCost || 12,
              },
            ]
          : [],
      otherCategory,
      serviceKey,
      includedServices: context.includedServices ?? [],
      rates,
    });

    return {
      primaryCategory,
      categories,
      estimatedHours,
      estimatedMiles,
      serviceKey,
      otherCategory,
      billingStatus: calculation.billingStatus,
      approvalRequired: calculation.approvalRequired,
      recommended: {
        laborCost: calculation.laborCost,
        travelCost: calculation.travelCost,
        equipmentCost: calculation.equipmentCost,
        softwareCost: calculation.softwareCost,
        otherCost: calculation.otherCost,
        totalCost: calculation.totalCost,
      },
      confidence: Math.max(local.confidence, 0.7),
      rationale:
        Array.isArray(parsed.rationale) && parsed.rationale.length > 0
          ? parsed.rationale.map(String)
          : local.rationale,
      matchedKeywords: local.matchedKeywords,
      provider: "openai",
      calculation,
    };
  } catch {
    return null;
  }
}

export async function classifyWorkNotes(
  notes: string,
  context: CostClassificationContext = {},
): Promise<CostClassificationResult> {
  const cleaned = cleanNotes(notes);
  if (!cleaned) {
    throw new Error("Enter technician notes before analyzing costs.");
  }

  const openAi = await classifyWithOpenAi(cleaned, context);
  if (openAi) {
    return openAi;
  }

  return {
    ...buildLocalClassification(cleaned, context),
    provider: "local",
  };
}
