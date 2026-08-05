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
  "/crm": "Account Health",
  "/contracts": "Contracts",
  "/service-catalog": "Service Catalog",
  "/hardware": "Hardware Assets",
  "/service-tickets": "Service Tickets",
  "/technicians": "Technicians",
  "/time-costs": "Time & Costs",
  "/billing": "Billing",
  "/reports": "Reports",
  "/technician": "My Work",
  "/cybersecurity": "Cybersecurity",
  "/ai-governance": "AI Governance",
  "/recommendations": "Recommendations & Risk",
  "/portal": "Client Portal",
  "/end-user": "End User Portal",
};

function resolvePageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }

  const match = Object.entries(PAGE_TITLES).find(
    ([path]) => pathname.startsWith(`${path}/`),
  );

  return match?.[1] ?? "Nexus Technology Solutions";
}

interface AppShellClientProps {
  profile: Profile;
  userEmail?: string | null;
  children: ReactNode;
}

export function AppShellClient({
  profile,
  userEmail,
  children,
}: AppShellClientProps) {
  const pathname = usePathname();
  const { realRole, activeRole, setActiveRole } = useDemoRole();
  const pageTitle = resolvePageTitle(pathname);

  return (
    <AppShell
      pageTitle={pageTitle}
      userName={profile.full_name}
      userEmail={userEmail ?? profile.email}
      realRole={realRole}
      activeRole={activeRole}
      onDemoRoleChange={setActiveRole}
    >
      {children}
    </AppShell>
  );
}
