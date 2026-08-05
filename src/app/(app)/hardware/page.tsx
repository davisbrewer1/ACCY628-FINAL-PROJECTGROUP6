"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, ClipboardList, PackagePlus, Plus, Search } from "lucide-react";
import {
  createAssetOrderTicket,
  createHardwareAsset,
  restockInventoryPart,
  reviewAssetOrderTicket,
} from "@/app/actions/hardware";
import { AssetDetailDrawer } from "@/components/AssetDetailDrawer";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  HARDWARE_CATEGORIES,
  type AssetOrderTicket,
  type AssetOrderTicketStatus,
  type Customer,
  type HardwareAsset,
  type InventoryPart,
} from "@/lib/types";

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
  const orderDialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<HardwareAsset[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orderTickets, setOrderTickets] = useState<AssetOrderTicket[]>([]);
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [restockQuantities, setRestockQuantities] = useState<Record<string, number>>({});
  const [orderAssetId, setOrderAssetId] = useState("");
  const [drawerAssetId, setDrawerAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const canAdd = CAN_ADD_ROLES.has(activeRole);
  const isTechnicianView = activeRole === "technician";
  const isAdministratorView = activeRole === "administrator";

  function onAssetClick(assetId: string) {
    setDrawerAssetId(assetId);
  }

  async function loadData() {
    const supabase = createClient();
    const [a, c, o, p] = await Promise.all([
      supabase.from("hardware_assets").select("*").order("asset_number"),
      supabase.from("customers").select("*").order("customer_name"),
      supabase
        .from("asset_order_tickets")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("inventory_parts")
        .select("*")
        .eq("active", true)
        .order("part_name"),
    ]);
    setAssets(a.data ?? []);
    setCustomers(c.data ?? []);
    setOrderTickets(o.data ?? []);
    setParts(p.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // Initial client-side Supabase hydration follows the existing app data-loading pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const replacementAssets = assets.filter((asset) => asset.needs_replacement);
  const selectedAsset = assets.find((asset) => asset.id === orderAssetId);
  const unavailableOrderAssetIds = new Set(
    orderTickets
      .filter((ticket) => ticket.status !== "Rejected")
      .map((ticket) => ticket.asset_id),
  );
  const normalizedPartSearch = partSearch.trim().toLowerCase();
  const filteredParts = parts.filter((part) => {
    if (!normalizedPartSearch) return true;
    return [
      part.part_name,
      part.sku,
      part.category,
      part.compatible_assets,
    ].some((value) => value.toLowerCase().includes(normalizedPartSearch));
  });
  const lowStockCount = parts.filter(
    (part) => part.quantity <= part.low_stock_threshold,
  ).length;

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

  function handleOrderSubmit(formData: FormData) {
    setOrderError(null);
    startTransition(async () => {
      const result = await createAssetOrderTicket(formData);
      if (result.success) {
        showToast(result.message);
        orderDialogRef.current?.close();
        setOrderAssetId("");
        await loadData();
      } else {
        setOrderError(result.message);
      }
    });
  }

  function handleReview(
    ticketId: string,
    status: AssetOrderTicketStatus,
  ) {
    startTransition(async () => {
      const result = await reviewAssetOrderTicket(
        ticketId,
        status,
        reviewNotes[ticketId] ?? "",
      );
      if (result.success) {
        showToast(result.message);
        await loadData();
      } else {
        showToast(result.message, "error");
      }
    });
  }

  function handleRestock(part: InventoryPart) {
    const amount = restockQuantities[part.id] ?? Math.min(5, 50 - part.quantity);
    startTransition(async () => {
      const result = await restockInventoryPart(part.id, amount);
      showToast(result.message, result.success ? "success" : "error");
      if (result.success) {
        await loadData();
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
          canAdd || isTechnicianView ? (
            <div className="flex flex-wrap justify-end gap-2">
              {isTechnicianView ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => orderDialogRef.current?.showModal()}
                >
                  <ClipboardList className="size-4" />
                  Asset Order Ticket
                </button>
              ) : null}
              {canAdd ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => dialogRef.current?.showModal()}
                >
                  <Plus className="size-4" />
                  Add Asset
                </button>
              ) : null}
            </div>
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

      {isAdministratorView ? (
        <section className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <div>
              <h2 className="card-title text-base">Asset order reviews</h2>
              <p className="text-sm text-base-content/60">
                Review replacement requests submitted from Technician view.
              </p>
            </div>
            {orderTickets.length === 0 ? (
              <p className="text-sm text-base-content/60">No asset order tickets submitted.</p>
            ) : (
              <div className="mt-2 space-y-3">
                {orderTickets.map((ticket) => {
                  const asset = assets.find((item) => item.id === ticket.asset_id);
                  const customer = customers.find(
                    (item) => item.id === ticket.customer_id,
                  );
                  const total = ticket.estimated_unit_cost === null
                    ? null
                    : ticket.estimated_unit_cost * ticket.requested_quantity;

                  return (
                    <div key={ticket.id} className="rounded-box border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-semibold">
                              {ticket.ticket_number}
                            </span>
                            <StatusBadge status={ticket.status} />
                            <span className="badge badge-outline badge-sm">
                              {ticket.priority}
                            </span>
                          </div>
                          <p className="mt-1 font-medium">
                            {asset?.asset_number ?? "Unknown asset"} →{" "}
                            {ticket.replacement_manufacturer} {ticket.replacement_model}
                          </p>
                          <p className="text-sm text-base-content/60">
                            {customer?.customer_name ?? "Unknown customer"} · Qty{" "}
                            {ticket.requested_quantity}
                            {total === null ? "" : ` · Estimated total ${formatCurrency(total)}`}
                          </p>
                        </div>
                        <span className="text-xs text-base-content/50">
                          Needed {formatDate(ticket.needed_by)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm">{ticket.business_justification}</p>
                      {ticket.technical_requirements ? (
                        <p className="mt-1 text-xs text-base-content/60">
                          Requirements: {ticket.technical_requirements}
                        </p>
                      ) : null}
                      {ticket.admin_notes ? (
                        <div className="mt-3 rounded-box bg-base-200 p-3 text-sm">
                          <span className="font-semibold">Administrator note:</span>{" "}
                          {ticket.admin_notes}
                        </div>
                      ) : null}
                      {ticket.status !== "Approved" && ticket.status !== "Rejected" ? (
                        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-end">
                          <label className="form-control flex-1">
                            <span className="label-text mb-1 text-xs">
                              Administrator note
                            </span>
                            <input
                              className="input input-bordered input-sm w-full"
                              value={reviewNotes[ticket.id] ?? ""}
                              onChange={(event) =>
                                setReviewNotes((current) => ({
                                  ...current,
                                  [ticket.id]: event.target.value,
                                }))
                              }
                              placeholder="Required when rejecting or requesting more information"
                            />
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              disabled={isPending}
                              onClick={() => handleReview(ticket.id, "Approved")}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={isPending}
                              onClick={() =>
                                handleReview(ticket.id, "Needs more information")
                              }
                            >
                              Request info
                            </button>
                            <button
                              type="button"
                              className="btn btn-error btn-outline btn-sm"
                              disabled={isPending}
                              onClick={() => handleReview(ticket.id, "Rejected")}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}

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
                  <th>Qty</th>
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
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-base-200/80"
                    onClick={() => onAssetClick(row.id)}
                  >
                    <td className="font-mono text-sm">{row.asset_number}</td>
                    <td>{row.customerName}</td>
                    <td>{row.category}</td>
                    <td>{row.quantity}</td>
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
                          <span className="text-xs">
                            {row.alertBadges.join(" · ")}
                          </span>
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

      {isAdministratorView || isTechnicianView ? (
        <details className="collapse collapse-arrow card border bg-base-100 shadow-sm">
          <summary className="collapse-title cursor-pointer">
            <h2 className="card-title">Parts Inventory</h2>
            <p className="text-sm text-base-content/60">
              Replacement parts matched to hardware assets currently on file.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="badge badge-outline">{parts.length} part types</span>
              <span className={`badge ${lowStockCount > 0 ? "badge-error" : "badge-success"}`}>
                {lowStockCount} low inventory
              </span>
            </div>
          </summary>
          <div className="collapse-content flex flex-col gap-5">
            <label className="input input-bordered flex w-full items-center gap-2 lg:max-w-md">
              <Search className="size-4 opacity-60" />
              <input
                type="search"
                className="grow"
                value={partSearch}
                onChange={(event) => setPartSearch(event.target.value)}
                placeholder="Search part or associated asset"
                aria-label="Search parts inventory"
              />
            </label>

            {filteredParts.length === 0 ? (
              <div className="rounded-box border border-dashed p-8 text-center text-sm text-base-content/60">
                No parts match “{partSearch}”.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Part</th>
                      <th>Compatible assets</th>
                      <th>Unit cost</th>
                      <th>On hand</th>
                      <th>Inventory status</th>
                      {isTechnicianView ? <th>Order more</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParts.map((part) => {
                      const isLow = part.quantity <= part.low_stock_threshold;
                      const capacity = 50 - part.quantity;
                      const orderAmount =
                        restockQuantities[part.id] ?? Math.min(5, capacity);
                      return (
                        <tr key={part.id}>
                          <td>
                            <div className="font-medium">{part.part_name}</div>
                            <div className="text-xs text-base-content/50">
                              {part.sku} · {part.category}
                            </div>
                          </td>
                          <td className="max-w-sm text-sm text-base-content/70">
                            {part.compatible_assets}
                          </td>
                          <td>{formatCurrency(part.unit_cost)}</td>
                          <td>
                            <span className="text-lg font-bold">{part.quantity}</span>
                            <span className="text-xs text-base-content/50"> / 50</span>
                          </td>
                          <td>
                            {isLow ? (
                              <span className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full bg-error px-2.5 py-1 text-xs font-medium leading-none text-error-content">
                                <AlertTriangle className="size-3 shrink-0" />
                                Low inventory
                              </span>
                            ) : (
                              <span className="inline-flex w-fit items-center whitespace-nowrap rounded-full bg-success px-2.5 py-1 text-xs font-medium leading-none text-success-content">
                                In stock
                              </span>
                            )}
                            <div className="mt-1 text-xs text-base-content/50">
                              Reorder at {part.low_stock_threshold}
                            </div>
                          </td>
                          {isTechnicianView ? (
                            <td>
                              <div className="flex min-w-48 items-center gap-2">
                                <input
                                  type="number"
                                  min="1"
                                  max={capacity}
                                  className="input input-bordered input-sm w-20"
                                  value={orderAmount}
                                  disabled={capacity === 0 || isPending}
                                  onChange={(event) =>
                                    setRestockQuantities((current) => ({
                                      ...current,
                                      [part.id]: Number(event.target.value),
                                    }))
                                  }
                                  aria-label={`Order quantity for ${part.part_name}`}
                                />
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  disabled={
                                    capacity === 0 ||
                                    isPending ||
                                    !Number.isInteger(orderAmount) ||
                                    orderAmount < 1 ||
                                    orderAmount > capacity
                                  }
                                  onClick={() => handleRestock(part)}
                                >
                                  <PackagePlus className="size-4" />
                                  {capacity === 0 ? "Full" : "Order"}
                                </button>
                              </div>
                              <div className="mt-1 text-xs text-base-content/50">
                                No approval required
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </details>
      ) : null}

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
            <FormField label="Quantity" htmlFor="quantity" required>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                step="1"
                defaultValue="1"
                className="input input-bordered w-full"
                required
              />
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

      {isTechnicianView ? (
      <dialog ref={orderDialogRef} className="modal">
        <div className="modal-box max-h-[90vh] max-w-4xl overflow-y-auto">
          <h3 className="text-lg font-bold">Asset Order Ticket</h3>
          <p className="mt-1 text-sm text-base-content/60">
            Request a replacement asset for administrator review. Order quantity
            always matches the quantity of the selected asset.
          </p>

          {orderError ? (
            <div className="alert alert-error mt-4 text-sm">
              <span>{orderError}</span>
            </div>
          ) : null}

          <form action={handleOrderSubmit} className="form-grid mt-5 grid gap-4 sm:grid-cols-2">
            <FormField label="Asset being replaced" htmlFor="asset_id" required className="sm:col-span-2">
              <select
                id="asset_id"
                name="asset_id"
                className="select select-bordered w-full"
                required
                value={orderAssetId}
                onChange={(event) => setOrderAssetId(event.target.value)}
              >
                <option value="" disabled>Select an asset marked Needs replacement</option>
                {replacementAssets.map((asset) => {
                  const unavailable = unavailableOrderAssetIds.has(asset.id);
                  return (
                    <option key={asset.id} value={asset.id} disabled={unavailable}>
                      {asset.asset_number} — {asset.manufacturer} {asset.model}
                      {unavailable ? " (ticket already placed)" : ""}
                    </option>
                  );
                })}
              </select>
            </FormField>

            <FormField label="Order quantity" htmlFor="requested_quantity">
              <input
                id="requested_quantity"
                className="input input-bordered w-full"
                value={selectedAsset?.quantity ?? ""}
                placeholder="Select an asset"
                readOnly
              />
            </FormField>
            <FormField label="Priority" htmlFor="priority" required>
              <select id="priority" name="priority" className="select select-bordered w-full" defaultValue="Medium" required>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </FormField>
            <FormField label="Replacement manufacturer" htmlFor="replacement_manufacturer" required>
              <input id="replacement_manufacturer" name="replacement_manufacturer" className="input input-bordered w-full" required />
            </FormField>
            <FormField label="Replacement model" htmlFor="replacement_model" required>
              <input id="replacement_model" name="replacement_model" className="input input-bordered w-full" required />
            </FormField>
            <FormField label="Preferred vendor" htmlFor="preferred_vendor">
              <input id="preferred_vendor" name="preferred_vendor" className="input input-bordered w-full" />
            </FormField>
            <FormField label="Estimated unit cost" htmlFor="estimated_unit_cost">
              <input
                id="estimated_unit_cost"
                name="estimated_unit_cost"
                type="number"
                min="0"
                step="0.01"
                className="input input-bordered w-full"
              />
            </FormField>
            <FormField label="Needed by" htmlFor="needed_by">
              <input id="needed_by" name="needed_by" type="date" className="input input-bordered w-full" />
            </FormField>
            <FormField
              label="Technical requirements"
              htmlFor="technical_requirements"
              className="sm:col-span-2"
            >
              <textarea
                id="technical_requirements"
                name="technical_requirements"
                className="textarea textarea-bordered w-full"
                rows={2}
                placeholder="Compatibility, operating system, memory, warranty, or security requirements"
              />
            </FormField>
            <FormField
              label="Business justification"
              htmlFor="business_justification"
              required
              className="sm:col-span-2"
            >
              <textarea
                id="business_justification"
                name="business_justification"
                className="textarea textarea-bordered w-full"
                rows={3}
                placeholder="Explain the failure, risk, service impact, and why replacement is needed"
                required
              />
            </FormField>
            <div className="modal-action sm:col-span-2">
              <button
                type="button"
                className="btn"
                onClick={() => orderDialogRef.current?.close()}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <span className="loading loading-spinner loading-sm" /> : "Submit for Approval"}
              </button>
            </div>
          </form>

          <div className="divider my-6">Administrator approval status</div>
          {orderTickets.length === 0 ? (
            <p className="text-sm text-base-content/60">No order tickets submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {orderTickets.map((ticket) => {
                const asset = assets.find((item) => item.id === ticket.asset_id);
                return (
                  <div key={ticket.id} className="rounded-box border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-sm font-semibold">
                          {ticket.ticket_number}
                        </span>
                        <span className="ml-2 text-sm">
                          {asset?.asset_number ?? "Unknown asset"} · Qty{" "}
                          {ticket.requested_quantity}
                        </span>
                      </div>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <p className="mt-1 text-sm">
                      {ticket.replacement_manufacturer} {ticket.replacement_model}
                    </p>
                    {ticket.admin_notes ? (
                      <p className="mt-2 text-xs text-base-content/70">
                        Administrator note: {ticket.admin_notes}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>
      ) : null}

      <AssetDetailDrawer
        assetId={drawerAssetId}
        customerName={
          drawerAssetId
            ? rows.find((r) => r.id === drawerAssetId)?.customerName
            : undefined
        }
        onClose={() => setDrawerAssetId(null)}
        onUpdated={loadData}
      />
    </div>
  );
}
