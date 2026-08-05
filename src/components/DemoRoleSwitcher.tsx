"use client";

import { DEMO_ROLES, ROLE_LABELS } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/types";

interface DemoRoleSwitcherProps {
  realRole: UserRole;
  activeRole: UserRole;
  onChange: (role: UserRole) => void;
}

export function DemoRoleSwitcher({
  realRole,
  activeRole,
  onChange,
}: DemoRoleSwitcherProps) {
  if (realRole !== "administrator") {
    return null;
  }

  return (
    <div className="rounded-box border border-warning/40 bg-warning/10 p-3">
      <label className="form-control w-full">
        <span className="label py-0">
          <span className="label-text text-xs font-semibold uppercase tracking-wide">
            Demo Role Switcher (demonstration only)
          </span>
        </span>
        <select
          className="select select-bordered select-sm w-full"
          value={activeRole}
          onChange={(event) => onChange(event.target.value as UserRole)}
          aria-label="Preview application as another role"
        >
          {DEMO_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        <span className="label py-1">
          <span className="label-text-alt text-base-content/70">
            Changes the visible interface for demonstration only. Database
            security and Row Level Security are unchanged.
          </span>
        </span>
      </label>
    </div>
  );
}
