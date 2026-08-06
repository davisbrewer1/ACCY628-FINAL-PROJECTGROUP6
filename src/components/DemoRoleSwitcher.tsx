"use client";

import type { UserRole } from "@/lib/types";

interface DemoRoleSwitcherProps {
  realRole: UserRole;
  activeRole: UserRole;
  onChange: (role: UserRole) => void;
}

/** Hidden — demos are Manager / Technician / Client only. */
export function DemoRoleSwitcher(_props: DemoRoleSwitcherProps) {
  return null;
}
