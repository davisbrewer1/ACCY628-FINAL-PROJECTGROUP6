"use client";

import { PORTAL_LOCK_MESSAGE } from "@/lib/customer-access";

export function PortalContractLockBanner({ locked }: { locked: boolean }) {
  if (!locked) return null;
  return (
    <div className="alert alert-warning">
      <span>{PORTAL_LOCK_MESSAGE}</span>
    </div>
  );
}
