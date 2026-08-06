"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PortalContractLockBanner } from "@/components/PortalContractLockBanner";
import {
  contractsUnlockPortal,
  PORTAL_LOCK_MESSAGE,
} from "@/lib/customer-access";
import { createClient } from "@/lib/supabase/client";
import type { Contract } from "@/lib/types";

interface PortalAccessValue {
  locked: boolean;
  loading: boolean;
  customerId: string | null;
  contracts: Contract[];
  lockMessage: string;
}

const PortalAccessContext = createContext<PortalAccessValue>({
  locked: false,
  loading: true,
  customerId: null,
  contracts: [],
  lockMessage: PORTAL_LOCK_MESSAGE,
});

export function usePortalAccess() {
  return useContext(PortalAccessContext);
}

export function PortalAccessProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("customer_id")
        .eq("id", user.id)
        .maybeSingle();
      const cid = profile?.customer_id ?? null;
      setCustomerId(cid);
      if (cid) {
        const { data } = await supabase
          .from("contracts")
          .select("*")
          .eq("customer_id", cid);
        setContracts((data as Contract[]) ?? []);
      }
      setLoading(false);
    }
    void init();
  }, []);

  const locked = useMemo(
    () => !loading && Boolean(customerId) && !contractsUnlockPortal(contracts),
    [loading, customerId, contracts],
  );

  const value = useMemo(
    () => ({
      locked,
      loading,
      customerId,
      contracts,
      lockMessage: PORTAL_LOCK_MESSAGE,
    }),
    [locked, loading, customerId, contracts],
  );

  return (
    <PortalAccessContext.Provider value={value}>
      <div className="space-y-4">
        <PortalContractLockBanner locked={locked} />
        {children}
      </div>
    </PortalAccessContext.Provider>
  );
}
