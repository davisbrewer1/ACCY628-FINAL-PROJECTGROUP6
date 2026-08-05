"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UserRole } from "@/lib/types";

const DEMO_ROLE_STORAGE_KEY = "nexus-demo-role";

interface DemoRoleContextValue {
  realRole: UserRole;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
}

const DemoRoleContext = createContext<DemoRoleContextValue | null>(null);

interface DemoRoleProviderProps {
  realRole: UserRole;
  children: ReactNode;
}

export function DemoRoleProvider({ realRole, children }: DemoRoleProviderProps) {
  const [activeRole, setActiveRoleState] = useState<UserRole>(realRole);

  useEffect(() => {
    if (realRole !== "administrator") {
      setActiveRoleState(realRole);
      return;
    }

    const stored = sessionStorage.getItem(DEMO_ROLE_STORAGE_KEY) as UserRole | null;
    if (stored) {
      setActiveRoleState(stored);
    } else {
      setActiveRoleState(realRole);
    }
  }, [realRole]);

  const setActiveRole = useCallback(
    (role: UserRole) => {
      setActiveRoleState(role);
      if (realRole === "administrator") {
        sessionStorage.setItem(DEMO_ROLE_STORAGE_KEY, role);
      }
    },
    [realRole],
  );

  const value = useMemo(
    () => ({ realRole, activeRole, setActiveRole }),
    [realRole, activeRole, setActiveRole],
  );

  return (
    <DemoRoleContext.Provider value={value}>{children}</DemoRoleContext.Provider>
  );
}

export function useDemoRole(): DemoRoleContextValue {
  const context = useContext(DemoRoleContext);
  if (!context) {
    throw new Error("useDemoRole must be used within DemoRoleProvider");
  }
  return context;
}
