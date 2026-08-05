"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createHardwareAsset } from "@/app/actions/hardware";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { HARDWARE_CATEGORIES, type Customer, type HardwareAsset } from "@/lib/types";

const CAN_ADD_ROLES = new Set([
  "administrator",
  "service_manager",
  "account_manager",
  "technician",
]);

interface AssetRow extends HardwareAsset {
  customerName: string;
  alertBadges: string[];
}

function getAlertBadges(asset: HardwareAsset): string[] {
  const badges: string[] = [];
  if (asset.warranty_expiring_soon) badges.push("Warranty expiring");
  if (asset.nearing_eol) badges.push("Nearing EOL");
  if (asset.needs_replacement) badges.push("Needs replacement");
  if (asset.unsupported_os) badges.push("Unsupported OS");
  if (asset.missing_security_updates) badges.push("Missing updates");
  if (asset.device_status === "Offline") badges.push("Offline");
  return badges;
}

export default function HardwarePage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<HardwareAsset[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canAdd = CAN_ADD_ROLES.has(activeRole);

  async function loadData() {
    const supabase = createClient();
    const [a, c] = await Promise.all([
      supabase.from("hardware_assets").select("*").order("asset_number"),
      supabase.from("customers").select("*").order("customer_name"),
    ]);
    setAssets(a.data ?? []);
    setCustomers(c.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.customer_name])),
    [customers],
  );

  const rows: AssetRow[] = useMemo(
    () =>
      assets.map((asset) => ({
        ...asset,
        customerName: customerMap.get(asset.customer_id) ?? "Unknown",
        alertBadges: getAlertBadges(asset),
      })),
    [assets, customerMap],
  );

  const typeSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assets) {
      map.set(a.category, (map.get(a.category) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [assets]);

  const lifecycleSummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assets) {
      map.set(a.lifecycle_stage, (map.get(a.lifecycle_stage) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [assets]);

  const alertCount = rows.filter((r) => r.alertBadges.length > 0).length;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createHardwareAsset(formData);
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
        title="Hardware assets"
        description="Track device inventory, lifecycle stages, and proactive replacement alerts."
        action={
          canAdd ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => dialogRef.current?.showModal()}>
              <Plus className="size-4" />
              Add Asset
            </button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total assets" value={assets.length} />
        <StatCard title="With alerts" value={alertCount} tone={alertCount > 0 ? "warning" : "success"} />
        <StatCard title="Categories" value={typeSummary.length} tone="info" />
        <StatCard title="Needs replacement" value={assets.filter((a) => a.needs_replacement).length} tone="danger" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">By type</h2>
            {typeSummary.length === 0 ? (
              <p className="text-sm text-base-content/60">No assets registered.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {typeSummary.map(({ name, count }) => (
                  <span key={name} className="badge badge-outline">{name}: {count}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">By lifecycle</h2>
            {lifecycleSummary.length === 0 ? (
              <p className="text-sm text-base-content/60">No lifecycle data.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {lifecycleSummary.map(({ name, count }) => (
                  <span key={name} className="badge badge-outline">{name}: {count}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No hardware assets"
          description="Register laptops, servers, and network devices to monitor warranty and lifecycle."
          action={
            canAdd ? (
              <button type="button" className="btn btn-primary" onClick={() => dialogRef.current?.showModal()}>
                Add Asset
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
                  <th>Asset #</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Device</th>
                  <th>Location</th>
                  <th>Lifecycle</th>
                  <th>Status</th>
                  <th>Warranty</th>
                  <th>Alerts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-mono text-sm">{row.asset_number}</td>
                    <td>{row.customerName}</td>
                    <td>{row.category}</td>
                    <td>
                      <div className="font-medium">{row.manufacturer ?? "—"} {row.model ?? ""}</div>
                      <div className="text-xs text-base-content/60">{row.serial_number ?? "—"}</div>
                    </td>
                    <td>{row.location ?? "—"}</td>
                    <td>{row.lifecycle_stage}</td>
                    <td><StatusBadge status={row.device_status} /></td>
                    <td>{formatDate(row.warranty_expiration)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {row.alertBadges.length === 0 ? (
                          <span className="text-xs text-base-content/50">None</span>
                        ) : (
                          row.alertBadges.map((badge) => (
                            <span key={badge} className="badge badge-warning badge-xs">{badge}</span>
                          ))
                        )}
                      </div>
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
          <h3 className="text-lg font-bold">Add Hardware Asset</h3>
          {error ? <div className="alert alert-error mt-4 text-sm"><span>{error}</span></div> : null}
          <form action={handleSubmit} className="form-grid mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label="Customer" htmlFor="customer_id" required>
              <select id="customer_id" name="customer_id" className="select select-bordered w-full" required defaultValue="">
                <option value="" disabled>Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.customer_name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Category" htmlFor="category" required>
              <select id="category" name="category" className="select select-bordered w-full" required defaultValue="">
                <option value="" disabled>Select type</option>
                {HARDWARE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Asset number" htmlFor="asset_number">
              <input id="asset_number" name="asset_number" className="input input-bordered w-full" placeholder="Auto-generated if blank" />
            </FormField>
            <FormField label="Location" htmlFor="location">
              <input id="location" name="location" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Manufacturer" htmlFor="manufacturer">
              <input id="manufacturer" name="manufacturer" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Model" htmlFor="model">
              <input id="model" name="model" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Serial number" htmlFor="serial_number">
              <input id="serial_number" name="serial_number" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Operating system" htmlFor="operating_system">
              <input id="operating_system" name="operating_system" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Purchase date" htmlFor="purchase_date">
              <input id="purchase_date" name="purchase_date" type="date" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Warranty expiration" htmlFor="warranty_expiration">
              <input id="warranty_expiration" name="warranty_expiration" type="date" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Assigned employee" htmlFor="assigned_employee">
              <input id="assigned_employee" name="assigned_employee" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Device status" htmlFor="device_status">
              <select id="device_status" name="device_status" className="select select-bordered w-full" defaultValue="Active">
                <option value="Active">Active</option>
                <option value="Offline">Offline</option>
                <option value="In repair">In repair</option>
                <option value="Retired">Retired</option>
              </select>
            </FormField>
            <FormField label="Lifecycle stage" htmlFor="lifecycle_stage">
              <select id="lifecycle_stage" name="lifecycle_stage" className="select select-bordered w-full" defaultValue="In Use">
                <option value="New">New</option>
                <option value="In Use">In Use</option>
                <option value="Aging">Aging</option>
                <option value="End of Life">End of Life</option>
                <option value="Retired">Retired</option>
              </select>
            </FormField>
            <FormField label="Estimated replacement" htmlFor="estimated_replacement_date">
              <input id="estimated_replacement_date" name="estimated_replacement_date" type="date" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Purchase cost" htmlFor="purchase_cost">
              <input id="purchase_cost" name="purchase_cost" type="number" min="0" step="0.01" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Managed coverage" htmlFor="managed_coverage">
              <select id="managed_coverage" name="managed_coverage" className="select select-bordered w-full" defaultValue="true">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </FormField>
            <FormField label="Support contract" htmlFor="support_contract">
              <input id="support_contract" name="support_contract" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Notes" htmlFor="notes" className="sm:col-span-2">
              <textarea id="notes" name="notes" className="textarea textarea-bordered w-full" rows={2} />
            </FormField>
            <div className="modal-action sm:col-span-2">
              <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <span className="loading loading-spinner loading-sm" /> : "Save Asset"}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button type="submit">close</button></form>
      </dialog>
    </div>
  );
}
