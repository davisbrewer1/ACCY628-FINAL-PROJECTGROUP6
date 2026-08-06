"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import {
  ADMIN_VIEW_TECH_EVENT,
  canViewTechnicianPortalAs,
  readAdminViewTechnicianId,
  writeAdminViewTechnicianId,
} from "@/lib/admin-technician-view";
import { createClient } from "@/lib/supabase/client";
import type { Technician } from "@/lib/types";

interface AdminTechnicianPortalSwitcherProps {
  /** When true, selecting a tech navigates to /technician if needed. */
  navigateOnChange?: boolean;
  /** Compact header styling vs full page card. */
  variant?: "header" | "panel";
}

export function AdminTechnicianPortalSwitcher({
  navigateOnChange = false,
  variant = "header",
}: AdminTechnicianPortalSwitcherProps) {
  const { realRole } = useDemoRole();
  const pathname = usePathname();
  const router = useRouter();
  const canViewAs = canViewTechnicianPortalAs(realRole);
  const [options, setOptions] = useState<Technician[]>([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (!canViewAs) return;

    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("technicians")
        .select("*")
        .eq("active", true)
        .order("technician_name");
      if (cancelled) return;

      const techs = (data ?? []) as Technician[];
      setOptions(techs);

      const stored = readAdminViewTechnicianId();
      const preferred =
        (stored && techs.some((tech) => tech.id === stored) ? stored : null) ||
        techs[0]?.id ||
        "";
      setSelectedId(preferred);
      if (preferred && preferred !== stored) {
        writeAdminViewTechnicianId(preferred);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [canViewAs]);

  useEffect(() => {
    function onExternal(event: Event) {
      const detail = (event as CustomEvent<{ technicianId: string }>).detail;
      if (detail?.technicianId) {
        setSelectedId(detail.technicianId);
      }
    }
    window.addEventListener(ADMIN_VIEW_TECH_EVENT, onExternal);
    return () => window.removeEventListener(ADMIN_VIEW_TECH_EVENT, onExternal);
  }, []);

  if (!canViewAs) {
    return null;
  }

  function handleChange(nextId: string) {
    setSelectedId(nextId);
    writeAdminViewTechnicianId(nextId);
    if (navigateOnChange && pathname !== "/technician") {
      router.push("/technician");
    }
  }

  if (variant === "panel") {
    return (
      <div className="flex flex-col gap-3 rounded-box border border-primary/30 bg-base-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Viewing as technician
          </p>
          <p className="mt-1 text-sm text-base-content/70">
            Switch My Work boards from this menu — no need to sign out and log
            in as each technician.
          </p>
        </div>
        <label className="flex min-w-[16rem] flex-col gap-1 sm:items-end">
          <span className="text-xs font-medium text-base-content/60">
            Technician
          </span>
          <select
            className="select select-bordered w-full"
            value={selectedId}
            onChange={(event) => handleChange(event.target.value)}
            aria-label="Switch technician portal"
            disabled={options.length === 0}
          >
            {options.length === 0 ? (
              <option value="">Loading technicians…</option>
            ) : (
              options.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.technician_name}
                  {tech.specialty ? ` · ${tech.specialty}` : ""}
                </option>
              ))
            )}
          </select>
        </label>
      </div>
    );
  }

  return (
    <label className="flex items-center gap-2">
      <span className="hidden text-xs font-medium text-cyan-200/80 sm:inline">
        View as
      </span>
      <select
        className="select select-bordered select-sm max-w-[14rem] border-cyan-500/40 bg-slate-900 text-slate-100"
        value={selectedId}
        onChange={(event) => handleChange(event.target.value)}
        aria-label="Switch technician portal"
        disabled={options.length === 0}
      >
        {options.length === 0 ? (
          <option value="">Loading…</option>
        ) : (
          options.map((tech) => (
            <option key={tech.id} value={tech.id}>
              {tech.technician_name}
            </option>
          ))
        )}
      </select>
    </label>
  );
}
