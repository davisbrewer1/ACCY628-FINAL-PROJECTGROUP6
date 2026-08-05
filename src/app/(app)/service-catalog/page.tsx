"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createCatalogItem } from "@/app/actions/catalog";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_FAMILIES, type ServiceCatalogItem } from "@/lib/types";

const CAN_ADD_ROLES = new Set([
  "administrator",
  "service_manager",
  "account_manager",
  "billing",
]);

export default function ServiceCatalogPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canAdd = CAN_ADD_ROLES.has(activeRole);

  async function loadData() {
    const supabase = createClient();
    const { data } = await supabase
      .from("service_catalog_items")
      .select("*")
      .order("service_name");
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const byFamily = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = item.service_family || "Other";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [items]);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createCatalogItem(formData);
      if (result.success) {
        showToast(result.message);
        dialogRef.current?.close();
        await loadData();
      } else {
        setError(result.message);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service catalog"
        description="Nexus Technology Solutions offerings — scope, pricing models, and provider cost components."
        action={
          canAdd ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => dialogRef.current?.showModal()}
            >
              <Plus className="size-4" />
              Add Service
            </button>
          ) : undefined
        }
      />

      {byFamily.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {byFamily.map(({ name, count }) => (
            <span key={name} className="badge badge-outline">
              {name}: {count}
            </span>
          ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="No catalog items"
          description="Define managed services offerings so teams can quote and deliver consistently."
          action={
            canAdd ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => dialogRef.current?.showModal()}
              >
                Add Service
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="card border bg-base-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Family</th>
                  <th>Business problem</th>
                  <th>What&apos;s included</th>
                  <th>Pricing model</th>
                  <th>Provider costs</th>
                  <th>Base price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.service_name}</td>
                    <td className="text-sm">{item.service_family}</td>
                    <td className="max-w-xs text-sm text-base-content/80">
                      {item.business_problem ?? "—"}
                    </td>
                    <td className="max-w-xs text-sm">
                      {item.whats_included ?? "—"}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.includes_hardware ? (
                          <span className="badge badge-ghost badge-xs">Hardware</span>
                        ) : null}
                        {item.includes_software ? (
                          <span className="badge badge-ghost badge-xs">Software</span>
                        ) : null}
                        {item.includes_labor ? (
                          <span className="badge badge-ghost badge-xs">Labor</span>
                        ) : null}
                        {item.includes_support ? (
                          <span className="badge badge-ghost badge-xs">Support</span>
                        ) : null}
                      </div>
                    </td>
                    <td>{item.pricing_model ?? "—"}</td>
                    <td className="text-sm">
                      <div>{item.provider_cost_components ?? "—"}</div>
                      {item.estimated_provider_cost != null ? (
                        <div className="text-xs text-base-content/60">
                          Est. {formatCurrency(item.estimated_provider_cost)}
                        </div>
                      ) : null}
                    </td>
                    <td>{formatCurrency(item.base_price)}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-h-[90vh] max-w-3xl overflow-y-auto">
          <h3 className="text-lg font-bold">Add Service Catalog Item</h3>
          {error ? (
            <div className="alert alert-error mt-4 text-sm">
              <span>{error}</span>
            </div>
          ) : null}
          <form action={handleSubmit} className="form-grid mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label="Service name" htmlFor="service_name" required className="sm:col-span-2">
              <input id="service_name" name="service_name" className="input input-bordered w-full" required />
            </FormField>
            <FormField label="Service family" htmlFor="service_family" required>
              <select id="service_family" name="service_family" className="select select-bordered w-full" required defaultValue="">
                <option value="" disabled>Select family</option>
                {SERVICE_FAMILIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Status" htmlFor="status">
              <select id="status" name="status" className="select select-bordered w-full" defaultValue="Active">
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Retired">Retired</option>
              </select>
            </FormField>
            <FormField label="Business problem" htmlFor="business_problem" className="sm:col-span-2">
              <textarea id="business_problem" name="business_problem" className="textarea textarea-bordered w-full" rows={2} />
            </FormField>
            <FormField label="What&apos;s included" htmlFor="whats_included" className="sm:col-span-2">
              <textarea id="whats_included" name="whats_included" className="textarea textarea-bordered w-full" rows={2} />
            </FormField>
            <FormField label="Pricing model" htmlFor="pricing_model">
              <input id="pricing_model" name="pricing_model" className="input input-bordered w-full" placeholder="Per device, per user, fixed fee..." />
            </FormField>
            <FormField label="Base price" htmlFor="base_price">
              <input id="base_price" name="base_price" type="number" min="0" step="0.01" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Provider cost components" htmlFor="provider_cost_components" className="sm:col-span-2">
              <textarea id="provider_cost_components" name="provider_cost_components" className="textarea textarea-bordered w-full" rows={2} placeholder="Labor, licensing, vendor fees..." />
            </FormField>
            <FormField label="Estimated provider cost" htmlFor="estimated_provider_cost">
              <input id="estimated_provider_cost" name="estimated_provider_cost" type="number" min="0" step="0.01" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Includes hardware" htmlFor="includes_hardware">
              <select id="includes_hardware" name="includes_hardware" className="select select-bordered w-full" defaultValue="false">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </FormField>
            <FormField label="Includes software" htmlFor="includes_software">
              <select id="includes_software" name="includes_software" className="select select-bordered w-full" defaultValue="false">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </FormField>
            <FormField label="Includes labor" htmlFor="includes_labor">
              <select id="includes_labor" name="includes_labor" className="select select-bordered w-full" defaultValue="true">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </FormField>
            <FormField label="Includes support" htmlFor="includes_support">
              <select id="includes_support" name="includes_support" className="select select-bordered w-full" defaultValue="true">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </FormField>
            <div className="modal-action sm:col-span-2">
              <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <span className="loading loading-spinner loading-sm" /> : "Save Service"}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button type="submit">close</button></form>
      </dialog>
    </div>
  );
}
