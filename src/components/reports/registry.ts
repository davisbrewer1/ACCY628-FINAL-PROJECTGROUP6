export type ReportCategoryId =
  | "operational"
  | "hardware"
  | "cybersecurity"
  | "ai"
  | "financial"
  | "customer"
  | "cash"
  | "margin"
  | "leakage"
  | "churn"
  | "resolution";

export interface ReportDefinition {
  id: string;
  title: string;
  featured?: boolean;
  /** Existing manager report views relocated into the picker. */
  legacyView?: "cash" | "margin" | "leakage" | "churn" | "resolution";
}

export interface ReportCategory {
  id: ReportCategoryId;
  title: string;
  reports: ReportDefinition[];
}

export const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: "operational",
    title: "Operational",
    reports: [
      { id: "sla-compliance", title: "SLA Compliance Report" },
      { id: "technician-productivity", title: "Technician Productivity Report" },
      { id: "ticket-trend", title: "Service Ticket Trend Report" },
    ],
  },
  {
    id: "hardware",
    title: "Hardware",
    reports: [
      { id: "hardware-lifecycle", title: "Hardware Lifecycle Report" },
      { id: "asset-utilization", title: "Asset Utilization Report" },
    ],
  },
  {
    id: "cybersecurity",
    title: "Cybersecurity",
    reports: [
      { id: "security-risk", title: "Security Risk Assessment" },
      { id: "cyber-incident", title: "Cyber Incident Report" },
    ],
  },
  {
    id: "ai",
    title: "AI Risk and Usage",
    reports: [
      { id: "ai-usage", title: "AI Usage Report", featured: true },
      { id: "ai-risk", title: "AI Risk Report" },
    ],
  },
  {
    id: "financial",
    title: "Financial Report",
    reports: [
      { id: "contract-performance", title: "Contract Performance Report" },
      { id: "billing", title: "Billing Report" },
      { id: "revenue-by-service", title: "Revenue by Service" },
    ],
  },
  {
    id: "customer",
    title: "Customer",
    reports: [
      { id: "customer-technology", title: "Customer Technology Report" },
    ],
  },
  {
    id: "cash",
    title: "Cash vs billed",
    reports: [{ id: "cash", title: "Cash vs billed", legacyView: "cash" }],
  },
  {
    id: "margin",
    title: "Margin by contract",
    reports: [
      { id: "margin", title: "Margin by contract", legacyView: "margin" },
    ],
  },
  {
    id: "leakage",
    title: "Hours leakage",
    reports: [{ id: "leakage", title: "Hours leakage", legacyView: "leakage" }],
  },
  {
    id: "churn",
    title: "Churn / renewal risk",
    reports: [
      {
        id: "churn",
        title: "Churn / renewal risk",
        legacyView: "churn",
      },
    ],
  },
  {
    id: "resolution",
    title: "Ticket resolution time",
    reports: [
      {
        id: "resolution",
        title: "Ticket resolution time",
        legacyView: "resolution",
      },
    ],
  },
];

export function findReport(reportId: string): ReportDefinition | null {
  for (const category of REPORT_CATEGORIES) {
    const report = category.reports.find((r) => r.id === reportId);
    if (report) return report;
  }
  return null;
}
