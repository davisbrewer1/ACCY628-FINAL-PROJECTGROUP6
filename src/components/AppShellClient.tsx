"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import type { Profile } from "@/lib/types";
import type { ReactNode } from "react";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Executive Dashboard",
  "/operations": "Manager Command Center",
  "/customers": "Customers",
  "/contracts": "Contracts",
  "/plans": "Plans",
  "/service-catalog": "Service Catalog",
  "/hardware": "Hardware Assets",
  "/service-tickets": "Service Tickets",
  "/technicians": "Technicians",
  "/time-costs": "Work & Billing",
  "/revenue-expenses": "Revenue & Expenses",
  "/ui-configuration": "UI Configuration",
  "/billing": "Invoice",
  "/reports": "Reports",
  "/technician": "My Work",
  "/cybersecurity": "Cybersecurity",
  "/ai-governance": "AI Governance",
  "/recommendations": "Risk Management",
  "/portal": "Client Portal",
  "/end-user": "Client Portal",
  "/end-user/support": "Support Tickets",
  "/end-user/devices": "My Devices",
  "/end-user/contracts": "My Contracts",
  "/end-user/billing": "Billing",
  "/end-user/settings": "Profile / Settings",
};

function resolvePageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }

  const match = Object.entries(PAGE_TITLES)
    .filter(([path]) => pathname.startsWith(`${path}/`))
    .sort((a, b) => b[0].length - a[0].length)[0];

  return match?.[1] ?? "Nexus Technology Solutions";
}

interface AppShellClientProps {
  profile: Profile;
  userEmail?: string | null;
  technicianId?: string | null;
  children: ReactNode;
}

export function AppShellClient({
  profile,
  userEmail,
  technicianId = null,
  children,
}: AppShellClientProps) {
  const pathname = usePathname();
  const { realRole, activeRole, setActiveRole } = useDemoRole();
  const pageTitle =
    pathname === "/time-costs" && activeRole === "technician"
      ? "Expense Tracker"
      : resolvePageTitle(pathname);

  return (
    <AppShell
      pageTitle={pageTitle}
      userName={profile.full_name}
      userEmail={userEmail ?? profile.email}
      realRole={realRole}
      activeRole={activeRole}
      onDemoRoleChange={setActiveRole}
      technicianId={technicianId}
    >
      {children}
    </AppShell>
  );
}
