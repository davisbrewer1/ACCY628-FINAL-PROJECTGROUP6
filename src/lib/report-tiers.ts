import type { Contract } from "@/lib/types";

export type SimulatedTier = "Bronze" | "Silver" | "Gold";

/** UI-only tier mapping from monthly fee bands (no DB column). */
export function simulateContractTier(
  fee: number | null | undefined,
): SimulatedTier {
  const mrr = fee ?? 0;
  if (mrr >= 5000) return "Gold";
  if (mrr >= 2000) return "Silver";
  return "Bronze";
}

export function contractsInTier(
  contracts: Contract[],
  tier: SimulatedTier | "All",
): Contract[] {
  if (tier === "All") return contracts;
  return contracts.filter(
    (c) => simulateContractTier(c.monthly_recurring_fee) === tier,
  );
}

export function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
