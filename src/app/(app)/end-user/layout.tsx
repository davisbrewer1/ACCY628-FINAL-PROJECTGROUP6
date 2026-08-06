"use client";

import { PortalAccessProvider } from "@/components/PortalAccessProvider";
import { PortalMfaGate } from "@/components/end-user/PortalMfaGate";

export default function EndUserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalAccessProvider>
      <PortalMfaGate>{children}</PortalMfaGate>
    </PortalAccessProvider>
  );
}
