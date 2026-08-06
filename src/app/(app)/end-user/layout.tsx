"use client";

import { PortalMfaGate } from "@/components/end-user/PortalMfaGate";

export default function EndUserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalMfaGate>{children}</PortalMfaGate>;
}
