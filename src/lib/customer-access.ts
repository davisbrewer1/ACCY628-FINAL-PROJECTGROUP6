import type { Contract } from "@/lib/types";

/** Active (and preferably Approved) contracts unlock the customer portal. */
export function isActiveServiceContract(
  contract: Pick<Contract, "contract_status" | "approval_status">,
): boolean {
  if (contract.contract_status !== "Active") return false;
  const approval = contract.approval_status;
  if (!approval || approval === "Approved") return true;
  return approval !== "Rejected";
}

export function contractsUnlockPortal(
  contracts: Pick<Contract, "contract_status" | "approval_status">[],
): boolean {
  return contracts.some(isActiveServiceContract);
}

/** Prefer a single Active contract; if several, pick earliest start then id. */
export function pickPrimaryActiveContract<T extends Contract>(
  contracts: T[],
): T | null {
  const active = contracts.filter(isActiveServiceContract);
  if (active.length === 0) return null;
  if (active.length === 1) return active[0];
  return [...active].sort((a, b) => {
    const sa = a.start_date ?? "";
    const sb = b.start_date ?? "";
    if (sa !== sb) return sa.localeCompare(sb);
    return a.id.localeCompare(b.id);
  })[0];
}

export const PORTAL_LOCK_MESSAGE =
  "Account pending setup — a manager must assign a service contract before you can use the portal.";
