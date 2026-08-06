"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertBanner } from "@/components/AlertBanner";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { useToast } from "@/components/Toast";
import { saveLandingServicesEnabled } from "@/app/actions/ui-config";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_ENABLED_LANDING_SERVICES,
  LANDING_SERVICE_CATALOG,
  LANDING_SERVICES_SETTING_KEY,
  filterLandingCatalog,
  getEnabledSupportCategories,
  getEnabledSupportSubcategories,
  parseEnabledLandingServices,
} from "@/lib/ui-config";
import type { ServiceFamily, SupportIssueCategory } from "@/lib/types";

const MANAGER_ROLES = new Set(["administrator", "service_manager"]);

export default function UiConfigurationPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<ServiceFamily[]>([
    ...DEFAULT_ENABLED_LANDING_SERVICES,
  ]);
  const [savedEnabled, setSavedEnabled] = useState<ServiceFamily[]>([
    ...DEFAULT_ENABLED_LANDING_SERVICES,
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", LANDING_SERVICES_SETTING_KEY)
        .maybeSingle();
      const next = parseEnabledLandingServices(data?.value);
      setEnabled(next);
      setSavedEnabled(next);
      setLoading(false);
    }
    void load();
  }, []);

  const dirty = useMemo(() => {
    if (enabled.length !== savedEnabled.length) return true;
    const saved = new Set(savedEnabled);
    return enabled.some((title) => !saved.has(title));
  }, [enabled, savedEnabled]);

  const ticketPreview = useMemo(() => {
    const categories = getEnabledSupportCategories(enabled);
    return categories.map((category) => ({
      category,
      subcategories: getEnabledSupportSubcategories(enabled, category),
    }));
  }, [enabled]);

  if (!MANAGER_ROLES.has(activeRole)) {
    return (
      <AlertBanner
        tone="info"
        title="UI Configuration"
        message="This page is for administrators and service managers."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  function toggleService(title: ServiceFamily) {
    setEnabled((current) => {
      if (current.includes(title)) {
        return current.filter((item) => item !== title);
      }
      const next = new Set([...current, title]);
      return LANDING_SERVICE_CATALOG.map((service) => service.title).filter(
        (item) => next.has(item),
      );
    });
    setError(null);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveLandingServicesEnabled(enabled);
      if (!result.success) {
        setError(result.message);
        showToast(result.message);
        return;
      }
      setSavedEnabled(result.enabled);
      setEnabled(result.enabled);
      setError(null);
      showToast(result.message);
    });
  }

  const visibleCount = filterLandingCatalog(enabled).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="UI Configuration"
        description="Control which services appear on the public landing page. Disabled services are also removed from client ticket category options."
      />

      {error ? (
        <div className="alert alert-error text-sm">
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-box border border-base-300 bg-base-100 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-base-300 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Landing page services</h2>
            <p className="mt-1 text-sm text-base-content/70">
              {visibleCount} of {LANDING_SERVICE_CATALOG.length} services shown
              on the front page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={isPending}
              onClick={() => {
                setEnabled([...DEFAULT_ENABLED_LANDING_SERVICES]);
                setError(null);
              }}
            >
              Enable all
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={isPending || !dirty}
              onClick={handleSave}
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        <ul className="divide-y divide-base-300">
          {LANDING_SERVICE_CATALOG.map((service) => {
            const on = enabled.includes(service.title);
            const Icon = service.icon;
            return (
              <li
                key={service.title}
                className="flex flex-wrap items-start gap-4 px-5 py-4"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-box border border-base-300 bg-base-200 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{service.title}</h3>
                    <span
                      className={`badge badge-sm ${on ? "badge-success" : "badge-ghost"}`}
                    >
                      {on ? "Shown" : "Hidden"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-base-content/70">
                    {service.problem}
                  </p>
                  <p className="mt-2 text-xs text-base-content/55">
                    Ticket impact:{" "}
                    {service.ticketCategory === "Software/Hardware Issue"
                      ? `Software/Hardware Issue → ${service.ticketSubcategories.join(", ")}`
                      : `Hides entire “${service.ticketCategory}” category when off`}
                  </p>
                </div>
                <label className="label cursor-pointer gap-3 py-0">
                  <span className="label-text text-sm">Offer service</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={on}
                    disabled={isPending}
                    onChange={() => toggleService(service.title)}
                    aria-label={`Offer ${service.title}`}
                  />
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-box border border-base-300 bg-base-100 shadow-sm">
        <div className="border-b border-base-300 px-5 py-4">
          <h2 className="text-base font-semibold">Client ticket options preview</h2>
          <p className="mt-1 text-sm text-base-content/70">
            Categories clients can pick on Support Tickets after you save.
          </p>
        </div>
        <div className="space-y-4 p-5">
          {ticketPreview.length === 0 ? (
            <p className="text-sm text-base-content/60">
              No ticket categories will be available. Clients will see an empty
              category list until at least one related service is enabled.
            </p>
          ) : (
            ticketPreview.map((row: {
              category: SupportIssueCategory;
              subcategories: string[];
            }) => (
              <div key={row.category}>
                <p className="text-sm font-semibold">{row.category}</p>
                <p className="mt-1 text-sm text-base-content/70">
                  {row.subcategories.join(" · ")}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
