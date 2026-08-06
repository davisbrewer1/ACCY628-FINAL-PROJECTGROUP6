import type { LucideIcon } from "lucide-react";
import {
  Brain,
  Cloud,
  HardDrive,
  LifeBuoy,
  RefreshCw,
  Shield,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SERVICE_FAMILIES,
  SUPPORT_ISSUE_CATEGORIES,
  SUPPORT_ISSUE_SUBCATEGORIES,
  type ServiceFamily,
  type SupportIssueCategory,
} from "@/lib/types";

export const LANDING_SERVICES_SETTING_KEY = "landing_services_enabled";

export interface LandingServiceDefinition {
  title: ServiceFamily;
  problem: string;
  includes: string;
  icon: LucideIcon;
  /** Ticket top-level category this service gates. */
  ticketCategory: SupportIssueCategory;
  /**
   * Subcategories under Software/Hardware Issue this service owns.
   * Empty for top-level-only services (AI / Security).
   */
  ticketSubcategories: string[];
}

/** Canonical landing services (source of truth for the marketing page). */
export const LANDING_SERVICE_CATALOG: LandingServiceDefinition[] = [
  {
    title: "Hardware Procurement & Lifecycle",
    problem:
      "Buy, deploy, warranty-track, and retire devices on a predictable schedule.",
    includes: "Laptops, servers, network gear, imaging, refresh planning",
    icon: HardDrive,
    ticketCategory: "Software/Hardware Issue",
    ticketSubcategories: ["Hardware Support", "Device Replacement"],
  },
  {
    title: "Software & Cloud Management",
    problem:
      "Keep Microsoft 365, identity, and cloud workspaces configured and supported.",
    includes: "License admin, mailbox support, identity hygiene",
    icon: Cloud,
    ticketCategory: "Software/Hardware Issue",
    ticketSubcategories: [
      "Software Support",
      "Cloud",
      "Microsoft 365",
      "Network",
    ],
  },
  {
    title: "Managed IT Support",
    problem: "Give employees a reliable service desk with clear SLA visibility.",
    includes: "Ticketing, remote support, escalation, billable overage tracking",
    icon: LifeBuoy,
    ticketCategory: "Software/Hardware Issue",
    ticketSubcategories: ["Project Work"],
  },
  {
    title: "Cybersecurity Monitoring",
    problem:
      "See endpoint, patch, backup, and firewall risk before it becomes an outage.",
    includes: "Alert triage, recommended remediations",
    icon: Shield,
    ticketCategory: "Security Concern",
    ticketSubcategories: [],
  },
  {
    title: "AI Governance",
    problem:
      "Govern existing AI platforms for cost, policy, and risk — without building a chatbot.",
    includes: "Platform inventory, policies, compliance, unused-license insights",
    icon: Brain,
    ticketCategory: "AI Issue",
    ticketSubcategories: [],
  },
  {
    title: "Deployment & Retirement",
    problem:
      "Run rollouts and end-of-life retirements without losing asset control.",
    includes: "Staging, deployment days, data wipe, retirement records",
    icon: RefreshCw,
    ticketCategory: "Software/Hardware Issue",
    ticketSubcategories: ["Hardware Deployment"],
  },
];

export const DEFAULT_ENABLED_LANDING_SERVICES: ServiceFamily[] = [
  ...SERVICE_FAMILIES,
];

function isServiceFamily(value: unknown): value is ServiceFamily {
  return (
    typeof value === "string" &&
    (SERVICE_FAMILIES as readonly string[]).includes(value)
  );
}

export function parseEnabledLandingServices(
  value: unknown,
): ServiceFamily[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_ENABLED_LANDING_SERVICES];
  }
  const enabled = value.filter(isServiceFamily);
  // Keep catalog order; ignore unknown titles.
  const enabledSet = new Set(enabled);
  const ordered = LANDING_SERVICE_CATALOG.map((service) => service.title).filter(
    (title) => enabledSet.has(title),
  );
  return ordered.length > 0 ? ordered : [];
}

export async function fetchEnabledLandingServices(
  supabase: SupabaseClient,
): Promise<ServiceFamily[]> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", LANDING_SERVICES_SETTING_KEY)
    .maybeSingle();

  if (error || !data) {
    return [...DEFAULT_ENABLED_LANDING_SERVICES];
  }

  return parseEnabledLandingServices(data.value);
}

export function filterLandingCatalog(
  enabled: readonly string[],
): LandingServiceDefinition[] {
  const enabledSet = new Set(enabled);
  return LANDING_SERVICE_CATALOG.filter((service) =>
    enabledSet.has(service.title),
  );
}

export function getEnabledSupportCategories(
  enabledServices: readonly string[],
): SupportIssueCategory[] {
  const enabledSet = new Set(enabledServices);
  const categories = new Set<SupportIssueCategory>();

  for (const service of LANDING_SERVICE_CATALOG) {
    if (!enabledSet.has(service.title)) continue;
    categories.add(service.ticketCategory);
  }

  return SUPPORT_ISSUE_CATEGORIES.filter((category) =>
    categories.has(category),
  );
}

export function getEnabledSupportSubcategories(
  enabledServices: readonly string[],
  category: SupportIssueCategory,
): string[] {
  const enabledSet = new Set(enabledServices);
  const all = SUPPORT_ISSUE_SUBCATEGORIES[category];

  if (category === "AI Issue" || category === "Security Concern") {
    return getEnabledSupportCategories(enabledServices).includes(category)
      ? [...all]
      : [];
  }

  // Software/Hardware Issue: union of subcategories from enabled services.
  const allowed = new Set<string>();
  for (const service of LANDING_SERVICE_CATALOG) {
    if (!enabledSet.has(service.title)) continue;
    if (service.ticketCategory !== "Software/Hardware Issue") continue;
    for (const sub of service.ticketSubcategories) {
      allowed.add(sub);
    }
  }

  // Always include unmapped/legacy subcategory slots only when at least one
  // software/hardware service is on — otherwise hide the whole category.
  return all.filter((sub) => allowed.has(sub));
}

/** Server-side validation for portal ticket create. */
export function isPortalTicketSelectionAllowed(
  enabledServices: readonly string[],
  issueCategory: string | null | undefined,
  subcategory: string | null | undefined,
): { ok: true } | { ok: false; message: string } {
  const categories = getEnabledSupportCategories(enabledServices);
  if (!issueCategory || !categories.includes(issueCategory as SupportIssueCategory)) {
    return {
      ok: false,
      message:
        "That support category is not available. Pick a category for an offered service.",
    };
  }

  const category = issueCategory as SupportIssueCategory;
  const subs = getEnabledSupportSubcategories(enabledServices, category);
  if (!subcategory || !subs.includes(subcategory)) {
    return {
      ok: false,
      message:
        "That issue type is not available. Choose a subcategory for an offered service.",
    };
  }

  return { ok: true };
}

export function buildServicesChatAnswer(enabled: readonly string[]): string {
  const titles = filterLandingCatalog(enabled).map((service) => service.title);
  if (titles.length === 0) {
    return "Nexus is updating its public service catalog. Contact us through Portal for the current offerings.";
  }
  return `Nexus manages technology services end to end:\n\n${titles
    .map((title) => `• ${title}`)
    .join("\n")}\n\nYou can review each offering in the Products & services section on this page.`;
}
