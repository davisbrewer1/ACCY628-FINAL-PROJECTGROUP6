import type { UserRole } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: UserRole[];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  administrator: "Administrator",
  executive: "Executive Leadership",
  service_manager: "Service Delivery Manager",
  account_manager: "Account Manager",
  technician: "Technician",
  billing: "Billing & Accounting",
  client_admin: "Client Administrator",
  client_user: "Client End User",
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Executive Dashboard",
    icon: "LayoutDashboard",
    roles: ["administrator", "executive"],
  },
  {
    href: "/operations",
    label: "Manager Command Center",
    icon: "Activity",
    roles: ["administrator", "service_manager", "account_manager"],
  },
  {
    href: "/customers",
    label: "Customers",
    icon: "Building2",
    roles: ["administrator", "service_manager", "account_manager"],
  },
  {
    href: "/contracts",
    label: "Contracts",
    icon: "FileText",
    roles: ["administrator", "service_manager", "account_manager", "billing"],
  },
  {
    href: "/service-tickets",
    label: "Service Tickets",
    icon: "Ticket",
    roles: ["administrator", "service_manager", "account_manager"],
  },
  {
    href: "/technicians",
    label: "Technicians",
    icon: "Users",
    roles: ["administrator", "service_manager"],
  },
  {
    href: "/time-costs",
    label: "Work & Billing",
    icon: "Clock",
    roles: ["administrator", "service_manager", "account_manager", "billing"],
  },
  {
    href: "/billing",
    label: "Billing",
    icon: "Receipt",
    roles: ["administrator", "billing", "account_manager"],
  },
  {
    href: "/recommendations",
    label: "Recommendations & Risk",
    icon: "Lightbulb",
    roles: ["administrator", "executive", "service_manager", "account_manager", "client_admin"],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: "BarChart3",
    roles: ["administrator", "executive", "service_manager", "billing", "account_manager"],
  },
  // Admin / specialist setup views — kept out of daily manager nav
  {
    href: "/service-catalog",
    label: "Service Catalog",
    icon: "Package",
    roles: ["administrator", "billing", "client_admin"],
  },
  {
    href: "/hardware",
    label: "Hardware Assets",
    icon: "Monitor",
    roles: ["administrator", "technician", "client_admin"],
  },
  {
    href: "/cybersecurity",
    label: "Cybersecurity",
    icon: "Shield",
    roles: ["administrator", "executive", "client_admin"],
  },
  {
    href: "/ai-governance",
    label: "AI Governance",
    icon: "Brain",
    roles: ["administrator", "executive", "client_admin"],
  },
  {
    href: "/technician",
    label: "My Work",
    icon: "Wrench",
    roles: ["technician"],
  },
  {
    href: "/portal",
    label: "Client Portal",
    icon: "Home",
    roles: ["client_admin"],
  },
  {
    href: "/end-user",
    label: "End User Portal",
    icon: "UserRound",
    roles: ["client_user"],
  },
];

const DEFAULT_DASHBOARDS: Record<UserRole, string> = {
  administrator: "/dashboard",
  executive: "/dashboard",
  service_manager: "/operations",
  account_manager: "/operations",
  technician: "/technician",
  billing: "/billing",
  client_admin: "/portal",
  client_user: "/end-user",
};

export function getNavForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function getDefaultDashboard(role: UserRole): string {
  return DEFAULT_DASHBOARDS[role] ?? "/dashboard";
}

export const DEMO_ROLES: UserRole[] = [
  "administrator",
  "executive",
  "service_manager",
  "account_manager",
  "technician",
  "billing",
  "client_admin",
  "client_user",
];

export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/operations",
  "/customers",
  "/contracts",
  "/service-catalog",
  "/hardware",
  "/service-tickets",
  "/technicians",
  "/time-costs",
  "/billing",
  "/reports",
  "/technician",
  "/cybersecurity",
  "/ai-governance",
  "/recommendations",
  "/portal",
  "/end-user",
];

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Map legacy seeded roles if any remain in local caches. */
export function normalizeRole(role: string | null | undefined): UserRole {
  switch (role) {
    case "billing_specialist":
      return "billing";
    case "customer":
      return "client_admin";
    case "administrator":
    case "executive":
    case "service_manager":
    case "account_manager":
    case "technician":
    case "billing":
    case "client_admin":
    case "client_user":
      return role;
    default:
      return "client_user";
  }
}
