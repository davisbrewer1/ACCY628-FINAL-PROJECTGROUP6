"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createCatalogItem } from "@/app/actions/catalog";
import { saveLandingServicesEnabled } from "@/app/actions/ui-config";
import { AlertBanner } from "@/components/AlertBanner";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/format";
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
import {
  SERVICE_FAMILIES,
  type ServiceCatalogItem,
  type ServiceFamily,
  type SupportIssueCategory,
} from "@/lib/types";

const MANAGER_ROLES = new Set(["administrator", "service_manager"]);

export default function UiConfigurationPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const catalogDialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState<ServiceFamily[]>([
    ...DEFAULT_ENABLED_LANDING_SERVICES,
  ]);
  const [savedEnabled, setSavedEnabled] = useState<ServiceFamily[]>([
    ...DEFAULT_ENABLED_LANDING_SERVICES,
  ]);
  const [catalogItems, setCatalogItems] = useState<ServiceCatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCatalogPending, startCatalogTransition] = useTransition();

  async function loadCatalog() {
    const supabase = createClient();
    const { data } = await supabase
      .from("service_catalog_items")
      .select("*")
      .order("created_at", { ascending: false });
    setCatalogItems((data as ServiceCatalogItem[]) ?? []);
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data }, catalog] = await Promise.all([
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", LANDING_SERVICES_SETTING_KEY)
          .maybeSingle(),
        supabase
          .from("service_catalog_items")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      const next = parseEnabledLandingServices(data?.value);
      setEnabled(next);
      setSavedEnabled(next);
      setCatalogItems((catalog.data as ServiceCatalogItem[]) ?? []);
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

  function handleCreateCustomService(formData: FormData) {
    setCatalogError(null);
    startCatalogTransition(async () => {
      const result = await createCatalogItem(formData);
      if (!result.success) {
        setCatalogError(result.message);
        showToast(result.message);
        return;
      }
      catalogDialogRef.current?.close();
      setCatalogError(null);
      showToast(result.message);
      await loadCatalog();
    });
  }

  const visibleCount = filterLandingCatalog(enabled).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="UI Configuration"
        description="Control landing-page services, client ticket options, and custom service catalog offerings."
        action={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setCatalogError(null);
              catalogDialogRef.current?.showModal();
            }}
          >
            <Plus className="size-4" />
            Add Custom Service
          </button>
        }
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

      <section className="rounded-box border border-base-300 bg-base-100 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-base-300 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Custom services</h2>
            <p className="mt-1 text-sm text-base-content/70">
              Add billable offerings to the service catalog used for quoting and
              delivery.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setCatalogError(null);
              catalogDialogRef.current?.showModal();
            }}
          >
            <Plus className="size-4" />
            Add Custom Service
          </button>
        </div>
        {catalogItems.length === 0 ? (
          <p className="px-5 py-6 text-sm text-base-content/60">
            No catalog services yet. Add a custom service to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Family</th>
                  <th>Pricing</th>
                  <th>Base price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {catalogItems.slice(0, 12).map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.service_name}</td>
                    <td className="text-sm">{item.service_family || "—"}</td>
                    <td className="text-sm">{item.pricing_model || "—"}</td>
                    <td>{formatCurrency(item.base_price)}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <dialog ref={catalogDialogRef} className="modal">
        <div className="modal-box max-h-[90vh] max-w-2xl overflow-y-auto">
          <h3 className="text-lg font-bold">Add Custom Service</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Creates a new service catalog item available across plans and quoting.
          </p>
          {catalogError ? (
            <div className="alert alert-error mt-4 text-sm">
              <span>{catalogError}</span>
            </div>
          ) : null}
          <form
            action={handleCreateCustomService}
            className="form-grid mt-4 grid gap-4 sm:grid-cols-2"
          >
            <FormField
              label="Service name"
              htmlFor="ui_service_name"
              required
              className="sm:col-span-2"
            >
              <input
                id="ui_service_name"
                name="service_name"
                className="input input-bordered w-full"
                required
              />
            </FormField>
            <FormField label="Service family" htmlFor="ui_service_family" required>
              <select
                id="ui_service_family"
                name="service_family"
                className="select select-bordered w-full"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select family
                </option>
                {SERVICE_FAMILIES.map((family) => (
                  <option key={family} value={family}>
                    {family}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Status" htmlFor="ui_status">
              <select
                id="ui_status"
                name="status"
                className="select select-bordered w-full"
                defaultValue="Active"
              >
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Retired">Retired</option>
              </select>
            </FormField>
            <FormField
              label="Business problem"
              htmlFor="ui_business_problem"
              className="sm:col-span-2"
            >
              <textarea
                id="ui_business_problem"
                name="business_problem"
                className="textarea textarea-bordered w-full"
                rows={2}
              />
            </FormField>
            <FormField
              label="What&apos;s included"
              htmlFor="ui_whats_included"
              className="sm:col-span-2"
            >
              <textarea
                id="ui_whats_included"
                name="whats_included"
                className="textarea textarea-bordered w-full"
                rows={2}
              />
            </FormField>
            <FormField label="Pricing model" htmlFor="ui_pricing_model">
              <input
                id="ui_pricing_model"
                name="pricing_model"
                className="input input-bordered w-full"
                placeholder="Per device, per user, fixed fee..."
              />
            </FormField>
            <FormField label="Base price" htmlFor="ui_base_price">
              <input
                id="ui_base_price"
                name="base_price"
                type="number"
                min="0"
                step="0.01"
                className="input input-bordered w-full"
              />
            </FormField>
            <input type="hidden" name="includes_labor" value="true" />
            <input type="hidden" name="includes_support" value="true" />
            <input type="hidden" name="includes_hardware" value="false" />
            <input type="hidden" name="includes_software" value="false" />
            <div className="modal-action sm:col-span-2">
              <button
                type="button"
                className="btn"
                onClick={() => catalogDialogRef.current?.close()}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isCatalogPending}
              >
                {isCatalogPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Save Service"
                )}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
    </div>
  );
}
