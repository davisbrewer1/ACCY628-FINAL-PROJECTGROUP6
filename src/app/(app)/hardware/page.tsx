"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, ClipboardList, PackagePlus, Plus, Search } from "lucide-react";
import {
  assignHardwareAsset,
  createAssetOrderTicket,
  createHardwareAsset,
  requestPartsBudgetIncrease,
  restockInventoryPart,
  reviewAssetOrderTicket,
  reviewInventoryReorderRequest,
  reviewPartsBudgetIncreaseRequest,
  updateTechnicianPartsBudget,
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
  type InventoryPartOrder,
  type InventoryReorderRequest,
  type Technician,
  type TechnicianBudgetIncreaseRequest,
  type TechnicianPartsBudget,
} from "@/lib/types";

const CAN_ADD_ROLES = new Set([
  "administrator",
  "service_manager",
  "account_manager",
  "technician",
]);

const MANAGER_ROLES = new Set([
  "administrator",
  "service_manager",
  "account_manager",
]);

type ManagerSubTab = "devices" | "budgets";
type DeviceFilterMode = "all" | "inventory" | "customer";

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
  const assignDialogRef = useRef<HTMLDialogElement>(null);
  const budgetRequestDialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<HardwareAsset[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orderTickets, setOrderTickets] = useState<AssetOrderTicket[]>([]);
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [reorderRequests, setReorderRequests] = useState<InventoryReorderRequest[]>(
    [],
  );
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [partsBudgets, setPartsBudgets] = useState<TechnicianPartsBudget[]>([]);
  const [partOrders, setPartOrders] = useState<InventoryPartOrder[]>([]);
  const [budgetRequests, setBudgetRequests] = useState<
    TechnicianBudgetIncreaseRequest[]
  >([]);
  const [myTechnicianId, setMyTechnicianId] = useState<string | null>(null);
  const [partSearch, setPartSearch] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [reorderQuantities, setReorderQuantities] = useState<Record<string, number>>(
    {},
  );
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({});
  const [partsOpen, setPartsOpen] = useState(true);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [managerTab, setManagerTab] = useState<ManagerSubTab>("devices");
  const [deviceFilterMode, setDeviceFilterMode] =
    useState<DeviceFilterMode>("all");
  const [filterCustomerId, setFilterCustomerId] = useState("");
  const [assignAssetId, setAssignAssetId] = useState("");
  const [orderAssetId, setOrderAssetId] = useState("");
  const [orderRequestType, setOrderRequestType] = useState<
    "purchase" | "replacement"
  >("purchase");
  const [drawerAssetId, setDrawerAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const canAdd = CAN_ADD_ROLES.has(activeRole);
  const isTechnicianView = activeRole === "technician";
  const isAdministratorView = activeRole === "administrator";
  const isManagerView = MANAGER_ROLES.has(activeRole);
  const canReviewReorders =
    activeRole === "administrator" || activeRole === "service_manager";

  function onAssetClick(assetId: string) {
    setDrawerAssetId(assetId);
  }

  async function loadData() {
    const supabase = createClient();
    try {
      const monthStart = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
      ).toISOString();

      const [a, c, o, p, r, tech, budgets, orders, reqs, auth] =
        await Promise.all([
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
          supabase
            .from("inventory_reorder_requests")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("technicians")
            .select("*")
            .eq("active", true)
            .order("technician_name"),
          supabase.from("technician_parts_budgets").select("*"),
          supabase
            .from("inventory_part_orders")
            .select("*")
            .gte("created_at", monthStart),
          supabase
            .from("technician_budget_increase_requests")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase.auth.getUser(),
        ]);
      setAssets((a.data as HardwareAsset[]) ?? []);
      setCustomers(c.data ?? []);
      setOrderTickets(o.data ?? []);
      setParts(p.data ?? []);
      setReorderRequests(
        r.error ? [] : ((r.data as InventoryReorderRequest[] | null) ?? []),
      );
      setTechnicians((tech.data as Technician[]) ?? []);
      setPartsBudgets((budgets.data as TechnicianPartsBudget[]) ?? []);
      setPartOrders((orders.data as InventoryPartOrder[]) ?? []);
      setBudgetRequests(
        (reqs.data as TechnicianBudgetIncreaseRequest[]) ?? [],
      );

      const userId = auth.data.user?.id;
      if (userId) {
        const linked = ((tech.data as Technician[]) ?? []).find(
          (row) => row.profile_id === userId,
        );
        setMyTechnicianId(linked?.id ?? null);
      } else {
        setMyTechnicianId(null);
      }

      const drafts: Record<string, string> = {};
      for (const b of (budgets.data as TechnicianPartsBudget[]) ?? []) {
        drafts[b.technician_id] = String(b.monthly_limit);
      }
      setBudgetDrafts(drafts);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const customerMap = useMemo(
    () => new Map(customers.map((c) => [c.id, c.customer_name])),
    [customers],
  );

  const rows: AssetRow[] = useMemo(
    () =>
      assets.map((asset) => ({
        ...asset,
        customerName: asset.customer_id
          ? (customerMap.get(asset.customer_id) ?? "Unknown")
          : "Inventory",
        alertBadges: getAlertBadges(asset),
      })),
    [assets, customerMap],
  );

  const normalizedAssetSearch = assetSearch.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    let next = rows;
    if (deviceFilterMode === "inventory") {
      next = next.filter((row) => !row.customer_id);
    } else if (deviceFilterMode === "customer" && filterCustomerId) {
      next = next.filter((row) => row.customer_id === filterCustomerId);
    }
    if (!normalizedAssetSearch) return next;
    return next.filter((row) =>
      [
        row.asset_number,
        row.customerName,
        row.category,
        row.manufacturer,
        row.model,
        row.serial_number,
        row.location,
        row.lifecycle_stage,
        row.device_status,
        row.alertBadges.join(" "),
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(normalizedAssetSearch),
      ),
    );
  }, [
    normalizedAssetSearch,
    rows,
    deviceFilterMode,
    filterCustomerId,
  ]);

  const inventoryCount = useMemo(
    () => assets.filter((a) => !a.customer_id).length,
    [assets],
  );

  const mtdSpendByTech = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of partOrders) {
      map.set(
        order.technician_id,
        (map.get(order.technician_id) ?? 0) + Number(order.total_cost ?? 0),
      );
    }
    return map;
  }, [partOrders]);

  const myBudget = useMemo(() => {
    if (!myTechnicianId) return null;
    const limit = Number(
      partsBudgets.find((b) => b.technician_id === myTechnicianId)
        ?.monthly_limit ?? 500,
    );
    const spent = mtdSpendByTech.get(myTechnicianId) ?? 0;
    return {
      limit,
      spent,
      remaining: Math.max(0, Math.round((limit - spent) * 100) / 100),
    };
  }, [myTechnicianId, partsBudgets, mtdSpendByTech]);

  const pendingBudgetRequests = useMemo(
    () => budgetRequests.filter((r) => r.status === "Pending"),
    [budgetRequests],
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
  const pendingPurchaseRequests = useMemo(
    () =>
      orderTickets.filter(
        (t) => t.status === "Pending" || t.status === "Needs more information",
      ),
    [orderTickets],
  );
  const replacementAssets = assets.filter((asset) => asset.needs_replacement);
  const selectedAsset = assets.find((asset) => asset.id === orderAssetId);
  const unavailableOrderAssetIds = new Set(
    orderTickets
      .filter(
        (ticket) =>
          Boolean(ticket.asset_id) &&
          (ticket.status === "Pending" ||
            ticket.status === "Needs more information"),
      )
      .map((ticket) => ticket.asset_id as string),
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
  const pendingReorderRequests = reorderRequests.filter(
    (request) => request.status === "Pending",
  );

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

  function handleOrder(part: InventoryPart) {
    const amount =
      reorderQuantities[part.id] ?? Math.min(5, 50 - part.quantity);
    startTransition(async () => {
      const result = await restockInventoryPart(part.id, amount);
      showToast(result.message, result.success ? "success" : "error");
      if (result.success) {
        await loadData();
      }
    });
  }

  function handleReorderReview(
    requestId: string,
    status: "Approved" | "Rejected",
  ) {
    startTransition(async () => {
      const result = await reviewInventoryReorderRequest(
        requestId,
        status,
        reviewNotes[requestId] ?? "",
      );
      showToast(result.message, result.success ? "success" : "error");
      if (result.success) {
        await loadData();
      }
    });
  }

  function handleAssign(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await assignHardwareAsset(formData);
      if (result.success) {
        showToast(result.message);
        assignDialogRef.current?.close();
        setAssignAssetId("");
        await loadData();
      } else {
        setError(result.message);
        showToast(result.message, "error");
      }
    });
  }

  function handleSaveBudget(technicianId: string) {
    const raw = budgetDrafts[technicianId];
    const limit = Number(raw);
    startTransition(async () => {
      const result = await updateTechnicianPartsBudget(technicianId, limit);
      showToast(result.message, result.success ? "success" : "error");
      if (result.success) await loadData();
    });
  }

  function handleBudgetIncreaseRequest(formData: FormData) {
    const requested = Number(formData.get("requested_limit"));
    const reason = String(formData.get("reason") ?? "");
    startTransition(async () => {
      const result = await requestPartsBudgetIncrease(requested, reason);
      showToast(result.message, result.success ? "success" : "error");
      if (result.success) {
        budgetRequestDialogRef.current?.close();
        await loadData();
      }
    });
  }

  function handleBudgetRequestReview(
    requestId: string,
    decision: "Approved" | "Rejected",
  ) {
    startTransition(async () => {
      const result = await reviewPartsBudgetIncreaseRequest(
        requestId,
        decision,
        reviewNotes[requestId] ?? "",
      );
      showToast(result.message, result.success ? "success" : "error");
      if (result.success) await loadData();
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
    <div className="hardware-page space-y-6">
      <PageHeader
        title="Hardware assets"
        description={
          isManagerView
            ? "Deployed devices, unassigned inventory, and technician parts restock budgets."
            : "Track device inventory, lifecycle stages, and proactive replacement alerts."
        }
        action={
          canAdd || isTechnicianView ? (
            <div className="flex flex-wrap justify-end gap-2">
              {isTechnicianView ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setOrderError(null);
                    setOrderRequestType("purchase");
                    setOrderAssetId("");
                    orderDialogRef.current?.showModal();
                  }}
                >
                  <ClipboardList className="size-4" />
                  Request asset purchase
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

      {isManagerView ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn btn-sm ${managerTab === "devices" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setManagerTab("devices")}
          >
            Devices
            {pendingPurchaseRequests.length > 0 ? (
              <span className="badge badge-warning badge-sm">
                {pendingPurchaseRequests.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${managerTab === "budgets" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setManagerTab("budgets")}
          >
            Parts budgets
            {pendingBudgetRequests.length > 0 ? (
              <span className="badge badge-warning badge-sm">
                {pendingBudgetRequests.length}
              </span>
            ) : null}
          </button>
        </div>
      ) : null}

      {isManagerView && managerTab === "budgets" ? (
        <div className="space-y-6">
          {pendingBudgetRequests.length > 0 ? (
            <div className="card border border-warning/40 bg-warning/5 shadow-sm">
              <div className="card-body gap-3">
                <h2 className="card-title text-base">
                  Pending limit increase requests
                </h2>
                <p className="text-sm text-base-content/70">
                  These are the only parts-budget items that need your approval.
                  Day-to-day restocks within a tech’s monthly limit do not.
                </p>
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Technician</th>
                        <th>Current</th>
                        <th>Requested</th>
                        <th>Reason</th>
                        <th>Notes</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {pendingBudgetRequests.map((req) => {
                        const tech = technicians.find(
                          (t) => t.id === req.technician_id,
                        );
                        return (
                          <tr key={req.id}>
                            <td>{tech?.technician_name ?? "Technician"}</td>
                            <td>{formatCurrency(req.current_limit)}</td>
                            <td className="font-medium">
                              {formatCurrency(req.requested_limit)}
                            </td>
                            <td className="max-w-xs text-sm">
                              {req.reason ?? "—"}
                            </td>
                            <td>
                              <input
                                className="input input-bordered input-xs w-40"
                                placeholder="Optional note"
                                value={reviewNotes[req.id] ?? ""}
                                onChange={(e) =>
                                  setReviewNotes((prev) => ({
                                    ...prev,
                                    [req.id]: e.target.value,
                                  }))
                                }
                              />
                            </td>
                            <td className="text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  className="btn btn-success btn-xs"
                                  disabled={isPending}
                                  onClick={() =>
                                    handleBudgetRequestReview(req.id, "Approved")
                                  }
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-error btn-xs"
                                  disabled={isPending}
                                  onClick={() =>
                                    handleBudgetRequestReview(req.id, "Rejected")
                                  }
                                >
                                  Deny
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          <div className="card border bg-base-100 shadow-sm">
            <div className="card-body gap-3">
              <h2 className="card-title text-base">
                Technician parts restock budgets (this month)
              </h2>
              <p className="text-sm text-base-content/70">
                Technicians restock parts on their own as long as the order stays
                within their monthly limit (quantity × unit cost). No manager
                approval is required for those orders. You only review requests
                here when a tech needs a higher limit after hitting the cap.
              </p>
              {technicians.length === 0 ? (
                <EmptyState
                  title="No technicians"
                  description="Active technicians will appear here with monthly parts budgets."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Technician</th>
                        <th className="text-right">MTD spend</th>
                        <th className="text-right">Monthly limit</th>
                        <th className="text-right">Remaining</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {technicians.map((tech) => {
                        const limit = Number(
                          partsBudgets.find((b) => b.technician_id === tech.id)
                            ?.monthly_limit ?? 500,
                        );
                        const spent = mtdSpendByTech.get(tech.id) ?? 0;
                        const remaining = Math.max(0, limit - spent);
                        const atLimit = spent >= limit;
                        const nearLimit =
                          !atLimit && limit > 0 && spent / limit >= 0.8;
                        return (
                          <tr key={tech.id}>
                            <td className="font-medium">{tech.technician_name}</td>
                            <td className="text-right">{formatCurrency(spent)}</td>
                            <td className="text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="input input-bordered input-sm w-28 text-right"
                                value={budgetDrafts[tech.id] ?? String(limit)}
                                onChange={(e) =>
                                  setBudgetDrafts((prev) => ({
                                    ...prev,
                                    [tech.id]: e.target.value,
                                  }))
                                }
                              />
                            </td>
                            <td className="text-right">
                              {formatCurrency(remaining)}
                            </td>
                            <td>
                              {atLimit ? (
                                <StatusBadge status="At limit" />
                              ) : nearLimit ? (
                                <StatusBadge status="Near limit" />
                              ) : (
                                <StatusBadge status="OK" />
                              )}
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                disabled={isPending}
                                onClick={() => handleSaveBudget(tech.id)}
                              >
                                Save
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total devices" value={assets.length} />
        <StatCard title="In inventory" value={inventoryCount} tone="info" />
        <StatCard title="With alerts" value={alertCount} tone={alertCount > 0 ? "warning" : "success"} />
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

      {isManagerView ? (
        <section className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <div>
              <h2 className="card-title text-base">Asset purchase requests</h2>
              <p className="text-sm text-base-content/60">
                Technicians request purchases (or replacements). Approving adds
                the asset to inventory or the selected customer — nothing is
                created until you approve.
              </p>
            </div>
            {orderTickets.length === 0 ? (
              <p className="text-sm text-base-content/60">
                No asset purchase requests submitted.
              </p>
            ) : (
              <div className="mt-2 space-y-3">
                {orderTickets.map((ticket) => {
                  const asset = ticket.asset_id
                    ? assets.find((item) => item.id === ticket.asset_id)
                    : null;
                  const customer = ticket.customer_id
                    ? customers.find((item) => item.id === ticket.customer_id)
                    : null;
                  const total =
                    ticket.estimated_unit_cost === null
                      ? null
                      : ticket.estimated_unit_cost * ticket.requested_quantity;
                  const isPurchase =
                    ticket.request_type === "purchase" || !ticket.asset_id;

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
                            <span className="badge badge-ghost badge-sm">
                              {isPurchase ? "New purchase" : "Replacement"}
                            </span>
                          </div>
                          <p className="mt-1 font-medium">
                            {isPurchase
                              ? `${ticket.category ?? "Asset"} · ${ticket.replacement_manufacturer} ${ticket.replacement_model}`
                              : `${asset?.asset_number ?? "Unknown asset"} → ${ticket.replacement_manufacturer} ${ticket.replacement_model}`}
                          </p>
                          <p className="text-sm text-base-content/60">
                            {customer?.customer_name ?? "Unassigned inventory"} ·
                            Qty {ticket.requested_quantity}
                            {total === null
                              ? ""
                              : ` · Estimated total ${formatCurrency(total)}`}
                            {ticket.created_asset_id
                              ? " · Asset created"
                              : ""}
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
                          <span className="font-semibold">Manager note:</span>{" "}
                          {ticket.admin_notes}
                        </div>
                      ) : null}
                      {ticket.status !== "Approved" &&
                      ticket.status !== "Rejected" ? (
                        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-end">
                          <label className="form-control flex-1">
                            <span className="label-text mb-1 text-xs">
                              Manager note
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
                              onClick={() =>
                                handleReview(ticket.id, "Approved")
                              }
                            >
                              Approve &amp; add asset
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              disabled={isPending}
                              onClick={() =>
                                handleReview(
                                  ticket.id,
                                  "Needs more information",
                                )
                              }
                            >
                              Request info
                            </button>
                            <button
                              type="button"
                              className="btn btn-error btn-outline btn-sm"
                              disabled={isPending}
                              onClick={() =>
                                handleReview(ticket.id, "Rejected")
                              }
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

      {isAdministratorView || isTechnicianView || canReviewReorders ? (
        <section
          className={`card border shadow-sm ${
            isTechnicianView
              ? "border-cyan-500/20 bg-slate-900/80 text-slate-100"
              : "bg-base-100"
          }`}
        >
          <button
            type="button"
            className="flex w-full items-start justify-between gap-3 px-6 py-5 text-left"
            onClick={() => setPartsOpen((open) => !open)}
            aria-expanded={partsOpen}
          >
            <div>
              <h2
                className={`card-title ${isTechnicianView ? "text-white" : ""}`}
              >
                Parts Inventory
              </h2>
              <p
                className={`text-sm ${
                  isTechnicianView ? "text-slate-400" : "text-base-content/60"
                }`}
              >
                Replacement parts matched to hardware assets currently on file.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="badge badge-outline">
                  {parts.length} part types
                </span>
                <span
                  className={`badge ${lowStockCount > 0 ? "badge-error" : "badge-success"}`}
                >
                  {lowStockCount} low inventory
                </span>
              </div>
            </div>
            <span
              className={`mt-1 text-xl leading-none ${isTechnicianView ? "text-slate-300" : "text-base-content/50"}`}
              aria-hidden="true"
            >
              {partsOpen ? "▾" : "▸"}
            </span>
          </button>

          {partsOpen ? (
          <div className="flex flex-col gap-5 border-t border-base-300/20 px-6 pb-6 pt-4">
            {isTechnicianView && myBudget ? (
              <div
                className={`rounded-box border p-3 text-sm ${
                  myBudget.remaining <= 0
                    ? "border-error/40 bg-error/10"
                    : "border-cyan-500/30 bg-slate-950/80"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Parts budget this month:{" "}
                    <strong>{formatCurrency(myBudget.spent)}</strong> of{" "}
                    <strong>{formatCurrency(myBudget.limit)}</strong>
                    {" "}({formatCurrency(myBudget.remaining)} remaining)
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline btn-xs"
                    onClick={() => budgetRequestDialogRef.current?.showModal()}
                  >
                    Request limit increase
                  </button>
                </div>
              </div>
            ) : null}
            <label
              className={`input input-bordered flex w-full items-center gap-2 lg:max-w-md ${
                isTechnicianView
                  ? "border-slate-600 bg-slate-950 text-slate-100"
                  : ""
              }`}
            >
              <Search className="size-4 opacity-60" />
              <input
                type="search"
                className="grow bg-transparent"
                value={partSearch}
                onChange={(event) => setPartSearch(event.target.value)}
                placeholder="Search part or associated asset"
                aria-label="Search parts inventory"
              />
            </label>

            {filteredParts.length === 0 ? (
              <div
                className={`rounded-box border border-dashed p-8 text-center text-sm ${
                  isTechnicianView
                    ? "border-slate-700 text-slate-400"
                    : "text-base-content/60"
                }`}
              >
                {partSearch.trim()
                  ? `No parts match “${partSearch}”.`
                  : "No parts in inventory."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className={`table ${isTechnicianView ? "text-slate-100" : ""}`}
                >
                  <thead>
                    <tr
                      className={
                        isTechnicianView
                          ? "border-b border-slate-700 [&_th]:!bg-slate-950 [&_th]:!text-slate-300"
                          : undefined
                      }
                    >
                      <th>Part</th>
                      <th>Compatible assets</th>
                      <th>Unit cost</th>
                      <th>On hand</th>
                      <th>Inventory status</th>
                      {isTechnicianView ? <th>Order more</th> : null}
                    </tr>
                  </thead>
                  <tbody
                    className={
                      isTechnicianView
                        ? "[&>tr]:!bg-slate-900 [&>tr]:!text-slate-100"
                        : undefined
                    }
                  >
                    {filteredParts.map((part) => {
                      const isLow = part.quantity <= part.low_stock_threshold;
                      const capacity = 50 - part.quantity;
                      const orderAmount =
                        reorderQuantities[part.id] ?? Math.min(5, capacity);
                      return (
                        <tr
                          key={part.id}
                          className={
                            isTechnicianView
                              ? "border-b border-slate-700/70 !bg-slate-900"
                              : undefined
                          }
                        >
                          <td>
                            <div className="font-medium">{part.part_name}</div>
                            <div
                              className={`text-xs ${
                                isTechnicianView
                                  ? "text-slate-400"
                                  : "text-base-content/50"
                              }`}
                            >
                              {part.sku} · {part.category}
                            </div>
                          </td>
                          <td
                            className={`max-w-sm text-sm ${
                              isTechnicianView
                                ? "text-slate-300"
                                : "text-base-content/70"
                            }`}
                          >
                            {part.compatible_assets}
                          </td>
                          <td>{formatCurrency(part.unit_cost)}</td>
                          <td>
                            <span className="text-lg font-bold">
                              {part.quantity}
                            </span>
                            <span
                              className={`text-xs ${
                                isTechnicianView
                                  ? "text-slate-400"
                                  : "text-base-content/50"
                              }`}
                            >
                              {" "}
                              / 50
                            </span>
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
                            <div
                              className={`mt-1 text-xs ${
                                isTechnicianView
                                  ? "text-slate-400"
                                  : "text-base-content/50"
                              }`}
                            >
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
                                  className="input input-bordered input-sm w-20 border-slate-600 bg-slate-950 text-slate-100"
                                  value={orderAmount}
                                  disabled={capacity === 0 || isPending}
                                  onChange={(event) =>
                                    setReorderQuantities((current) => ({
                                      ...current,
                                      [part.id]: Number(event.target.value),
                                    }))
                                  }
                                  aria-label={`Order quantity for ${part.part_name}`}
                                />
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm gap-1"
                                  disabled={
                                    capacity === 0 ||
                                    isPending ||
                                    !Number.isInteger(orderAmount) ||
                                    orderAmount < 1 ||
                                    orderAmount > capacity
                                  }
                                  onClick={() => handleOrder(part)}
                                >
                                  <PackagePlus className="size-4" />
                                  {capacity === 0 ? "Full" : "Order"}
                                </button>
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
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
          ) : null}
        </section>
      ) : null}

      {canReviewReorders ? (
        <section className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <div>
              <h2 className="card-title text-base">Parts reorder requests</h2>
              <p className="text-sm text-base-content/60">
                Routine restocks do not appear here — technicians order parts
                directly when they are within their monthly budget. Manager
                approval is only needed for limit-increase requests on the Parts
                budgets tab.
              </p>
            </div>
            <div className="alert alert-info mt-2 text-sm">
              <span>
                This list is only for any leftover approval-queue requests. New
                restocks within budget skip this queue entirely.
              </span>
            </div>
            {pendingReorderRequests.length === 0 ? (
              <p className="mt-2 text-sm text-base-content/60">
                No pending approval-queue requests. Within-budget restocks are
                already applied by technicians without review.
              </p>
            ) : (
              <div className="mt-2 space-y-3">
                {pendingReorderRequests.map((request) => {
                  const part = parts.find((item) => item.id === request.part_id);
                  return (
                    <div key={request.id} className="rounded-box border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {part?.part_name ?? "Unknown part"}
                            </span>
                            <StatusBadge status={request.status} />
                            <span className="badge badge-outline badge-sm">
                              Qty {request.requested_quantity}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-base-content/60">
                            {part
                              ? `${part.sku} · On hand ${part.quantity} / 50`
                              : "Part details unavailable"}
                          </p>
                          {request.notes ? (
                            <p className="mt-2 text-sm">{request.notes}</p>
                          ) : null}
                        </div>
                        <span className="text-xs text-base-content/50">
                          {formatDate(request.created_at)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-end">
                        <label className="form-control flex-1">
                          <span className="label-text mb-1 text-xs">
                            Review note
                          </span>
                          <input
                            className="input input-bordered input-sm w-full"
                            value={reviewNotes[request.id] ?? ""}
                            onChange={(event) =>
                              setReviewNotes((current) => ({
                                ...current,
                                [request.id]: event.target.value,
                              }))
                            }
                            placeholder="Required when rejecting"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            disabled={isPending}
                            onClick={() =>
                              handleReorderReview(request.id, "Approved")
                            }
                          >
                            Approve & restock
                          </button>
                          <button
                            type="button"
                            className="btn btn-error btn-outline btn-sm"
                            disabled={isPending}
                            onClick={() =>
                              handleReorderReview(request.id, "Rejected")
                            }
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section
        className={`card border shadow-sm ${
          isTechnicianView
            ? "border-cyan-500/20 bg-slate-900/80 text-slate-100"
            : "bg-base-100"
        }`}
      >
        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 px-6 py-5 text-left"
          onClick={() => setAssetsOpen((open) => !open)}
          aria-expanded={assetsOpen}
        >
          <div>
            <h2 className={`card-title ${isTechnicianView ? "text-white" : ""}`}>
              Hardware Assets
            </h2>
            <p
              className={`text-sm ${
                isTechnicianView ? "text-slate-400" : "text-base-content/60"
              }`}
            >
              Device inventory, lifecycle stages, and replacement alerts.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="badge badge-outline">{filteredRows.length} shown</span>
              <span className="badge badge-outline">{inventoryCount} in inventory</span>
              <span
                className={`badge ${alertCount > 0 ? "badge-warning" : "badge-success"}`}
              >
                {alertCount} with alerts
              </span>
            </div>
          </div>
          <span
            className={`mt-1 text-xl leading-none ${isTechnicianView ? "text-slate-300" : "text-base-content/50"}`}
            aria-hidden="true"
          >
            {assetsOpen ? "▾" : "▸"}
          </span>
        </button>

        {assetsOpen || isManagerView ? (
        <div className="flex flex-col gap-5 border-t border-base-300/20 px-6 pb-6 pt-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <label
              className={`input input-bordered flex w-full items-center gap-2 lg:max-w-md ${
                isTechnicianView
                  ? "border-slate-600 bg-slate-950 text-slate-100"
                  : ""
              }`}
            >
              <Search className="size-4 opacity-60" />
              <input
                type="search"
                className="grow bg-transparent"
                value={assetSearch}
                onChange={(event) => setAssetSearch(event.target.value)}
                placeholder="Search asset, customer, device, or alert"
                aria-label="Search hardware assets"
              />
            </label>
            <label className="form-control w-full max-w-xs">
              <span className="label-text mb-1 text-xs">Filter</span>
              <select
                className="select select-bordered select-sm"
                value={deviceFilterMode}
                onChange={(e) => {
                  const mode = e.target.value as DeviceFilterMode;
                  setDeviceFilterMode(mode);
                  if (mode !== "customer") setFilterCustomerId("");
                }}
              >
                <option value="all">All devices</option>
                <option value="inventory">In inventory (unassigned)</option>
                <option value="customer">By customer</option>
              </select>
            </label>
            {deviceFilterMode === "customer" ? (
              <label className="form-control w-full max-w-xs">
                <span className="label-text mb-1 text-xs">Customer</span>
                <select
                  className="select select-bordered select-sm"
                  value={filterCustomerId}
                  onChange={(e) => setFilterCustomerId(e.target.value)}
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="No hardware assets"
              description="Register laptops, servers, and network devices to monitor warranty and lifecycle."
              action={
                canAdd ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => dialogRef.current?.showModal()}
                  >
                    Add Asset
                  </button>
                ) : undefined
              }
            />
          ) : filteredRows.length === 0 ? (
            <div
              className={`rounded-box border border-dashed p-8 text-center text-sm ${
                isTechnicianView
                  ? "border-slate-700 text-slate-400"
                  : "text-base-content/60"
              }`}
            >
              No assets match “{assetSearch}”.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className={`table ${isTechnicianView ? "text-slate-100" : ""}`}
              >
                <thead>
                  <tr
                    className={
                      isTechnicianView
                        ? "border-b border-slate-700 [&_th]:!bg-slate-950 [&_th]:!text-slate-300"
                        : undefined
                    }
                  >
                    <th>Asset #</th>
                    <th>Customer / inventory</th>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>Device</th>
                    <th>Location</th>
                    <th>Lifecycle</th>
                    <th>Status</th>
                    <th>Warranty</th>
                    <th>Alerts</th>
                    {isManagerView ? <th /> : null}
                  </tr>
                </thead>
                <tbody
                  className={
                    isTechnicianView
                      ? "[&>tr]:!bg-slate-900 [&>tr]:!text-slate-100"
                      : undefined
                  }
                >
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        isTechnicianView
                          ? "cursor-pointer border-b border-slate-700/70 !bg-slate-900 hover:!bg-slate-800"
                          : "cursor-pointer hover:bg-base-200/80"
                      }
                      onClick={() => onAssetClick(row.id)}
                    >
                      <td>
                        <div className="font-medium">{row.asset_number}</div>
                      </td>
                      <td>{row.customerName}</td>
                      <td>{row.category}</td>
                      <td>{row.quantity}</td>
                      <td>
                        <div className="font-medium">
                          {row.manufacturer ?? "—"} {row.model ?? ""}
                        </div>
                        <div
                          className={`text-xs ${
                            isTechnicianView
                              ? "text-slate-400"
                              : "text-base-content/60"
                          }`}
                        >
                          {row.serial_number ?? "—"}
                        </div>
                      </td>
                      <td>{row.location ?? "—"}</td>
                      <td>{row.lifecycle_stage}</td>
                      <td>
                        <StatusBadge status={row.device_status} />
                      </td>
                      <td>{formatDate(row.warranty_expiration)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {row.alertBadges.length === 0 ? (
                            <span
                              className={`text-xs ${
                                isTechnicianView
                                  ? "text-slate-400"
                                  : "text-base-content/50"
                              }`}
                            >
                              None
                            </span>
                          ) : (
                            <span className="text-xs">
                              {row.alertBadges.join(" · ")}
                            </span>
                          )}
                        </div>
                      </td>
                      {isManagerView ? (
                        <td className="text-right">
                          {!row.customer_id ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssignAssetId(row.id);
                                setError(null);
                                assignDialogRef.current?.showModal();
                              }}
                            >
                              Assign
                            </button>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        ) : null}
      </section>
        </>
      )}

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-h-[90vh] max-w-3xl overflow-y-auto">
          <h3 className="text-lg font-bold">Add Hardware Asset</h3>
          {error ? <div className="alert alert-error mt-4 text-sm"><span>{error}</span></div> : null}
          <form action={handleSubmit} className="form-grid mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label="Customer" htmlFor="customer_id">
              <select id="customer_id" name="customer_id" className="select select-bordered w-full" defaultValue="unassigned">
                <option value="unassigned">Unassigned (inventory)</option>
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
          <h3 className="text-lg font-bold">Request asset purchase</h3>
          <p className="mt-1 text-sm text-base-content/60">
            Submit a purchase request for manager approval. The asset is not
            added to inventory until a manager approves.
          </p>

          {orderError ? (
            <div className="alert alert-error mt-4 text-sm">
              <span>{orderError}</span>
            </div>
          ) : null}

          <form action={handleOrderSubmit} className="form-grid mt-5 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="request_type" value={orderRequestType} />
            <FormField label="Request type" htmlFor="order_request_type" className="sm:col-span-2">
              <select
                id="order_request_type"
                className="select select-bordered w-full"
                value={orderRequestType}
                onChange={(event) => {
                  const next = event.target.value === "replacement"
                    ? "replacement"
                    : "purchase";
                  setOrderRequestType(next);
                  setOrderAssetId("");
                }}
              >
                <option value="purchase">New purchase</option>
                <option value="replacement">Replace existing asset</option>
              </select>
            </FormField>

            {orderRequestType === "replacement" ? (
              <FormField
                label="Asset being replaced"
                htmlFor="asset_id"
                required
                className="sm:col-span-2"
              >
                <select
                  id="asset_id"
                  name="asset_id"
                  className="select select-bordered w-full"
                  required
                  value={orderAssetId}
                  onChange={(event) => setOrderAssetId(event.target.value)}
                >
                  <option value="" disabled>
                    Select an asset marked Needs replacement
                  </option>
                  {replacementAssets.map((asset) => {
                    const unavailable = unavailableOrderAssetIds.has(asset.id);
                    return (
                      <option
                        key={asset.id}
                        value={asset.id}
                        disabled={unavailable}
                      >
                        {asset.asset_number} — {asset.manufacturer}{" "}
                        {asset.model}
                        {unavailable ? " (ticket already placed)" : ""}
                      </option>
                    );
                  })}
                </select>
              </FormField>
            ) : (
              <>
                <FormField label="Category" htmlFor="order_category" required>
                  <select
                    id="order_category"
                    name="category"
                    className="select select-bordered w-full"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select type
                    </option>
                    {HARDWARE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Assign to customer" htmlFor="order_customer_id">
                  <select
                    id="order_customer_id"
                    name="customer_id"
                    className="select select-bordered w-full"
                    defaultValue="unassigned"
                  >
                    <option value="unassigned">
                      Unassigned inventory (stock)
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customer_name}
                      </option>
                    ))}
                  </select>
                </FormField>
              </>
            )}

            {orderRequestType === "replacement" && selectedAsset?.category ? (
              <input type="hidden" name="category" value={selectedAsset.category} />
            ) : null}
            <FormField label="Quantity" htmlFor="requested_quantity" required>
              {orderRequestType === "replacement" ? (
                <input
                  id="requested_quantity"
                  className="input input-bordered w-full"
                  value={selectedAsset?.quantity ?? ""}
                  placeholder="Select an asset"
                  readOnly
                />
              ) : (
                <input
                  id="requested_quantity"
                  name="requested_quantity"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue="1"
                  className="input input-bordered w-full"
                  required
                />
              )}
            </FormField>
            <FormField label="Priority" htmlFor="priority" required>
              <select
                id="priority"
                name="priority"
                className="select select-bordered w-full"
                defaultValue="Medium"
                required
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </FormField>
            <FormField
              label={
                orderRequestType === "replacement"
                  ? "Replacement manufacturer"
                  : "Manufacturer"
              }
              htmlFor="replacement_manufacturer"
              required
            >
              <input
                id="replacement_manufacturer"
                name="replacement_manufacturer"
                className="input input-bordered w-full"
                required
              />
            </FormField>
            <FormField
              label={
                orderRequestType === "replacement"
                  ? "Replacement model"
                  : "Model"
              }
              htmlFor="replacement_model"
              required
            >
              <input
                id="replacement_model"
                name="replacement_model"
                className="input input-bordered w-full"
                required
              />
            </FormField>
            <FormField label="Preferred vendor" htmlFor="preferred_vendor">
              <input
                id="preferred_vendor"
                name="preferred_vendor"
                className="input input-bordered w-full"
              />
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
              <input
                id="needed_by"
                name="needed_by"
                type="date"
                className="input input-bordered w-full"
              />
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
                placeholder="Why this purchase is needed"
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
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isPending}
              >
                {isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Submit for manager approval"
                )}
              </button>
            </div>
          </form>

          <div className="divider my-6">Your request status</div>
          {orderTickets.length === 0 ? (
            <p className="text-sm text-base-content/60">
              No purchase requests submitted yet.
            </p>
          ) : (
            <div className="space-y-3">
              {orderTickets.map((ticket) => {
                const asset = ticket.asset_id
                  ? assets.find((item) => item.id === ticket.asset_id)
                  : null;
                return (
                  <div key={ticket.id} className="rounded-box border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-sm font-semibold">
                          {ticket.ticket_number}
                        </span>
                        <span className="ml-2 text-sm">
                          {ticket.request_type === "replacement" || ticket.asset_id
                            ? `${asset?.asset_number ?? "Replacement"} · `
                            : `${ticket.category ?? "Purchase"} · `}
                          Qty {ticket.requested_quantity}
                        </span>
                      </div>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <p className="mt-1 text-sm">
                      {ticket.replacement_manufacturer}{" "}
                      {ticket.replacement_model}
                    </p>
                    {ticket.admin_notes ? (
                      <p className="mt-2 text-xs text-base-content/70">
                        Manager note: {ticket.admin_notes}
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

      <dialog ref={assignDialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold">Assign inventory asset</h3>
          {error ? (
            <div className="alert alert-error mt-4 text-sm">
              <span>{error}</span>
            </div>
          ) : null}
          <form action={handleAssign} className="mt-4 grid gap-4">
            <input type="hidden" name="asset_id" value={assignAssetId} />
            <FormField label="Customer" htmlFor="assign_customer_id" required>
              <select
                id="assign_customer_id"
                name="customer_id"
                className="select select-bordered w-full"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select customer
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Location" htmlFor="assign_location">
              <input
                id="assign_location"
                name="location"
                className="input input-bordered w-full"
              />
            </FormField>
            <FormField label="Device status" htmlFor="assign_device_status">
              <select
                id="assign_device_status"
                name="device_status"
                className="select select-bordered w-full"
                defaultValue="Active"
              >
                <option value="Active">Active</option>
                <option value="Offline">Offline</option>
                <option value="In repair">In repair</option>
              </select>
            </FormField>
            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={() => assignDialogRef.current?.close()}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Assign"
                )}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      <dialog ref={budgetRequestDialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold">Request parts budget increase</h3>
          <p className="mt-1 text-sm text-base-content/70">
            Current monthly limit:{" "}
            {myBudget ? formatCurrency(myBudget.limit) : "—"}. Managers review
            requests on the Parts budgets tab.
          </p>
          <form action={handleBudgetIncreaseRequest} className="mt-4 grid gap-4">
            <FormField label="Requested monthly limit" htmlFor="requested_limit" required>
              <input
                id="requested_limit"
                name="requested_limit"
                type="number"
                min="0"
                step="0.01"
                className="input input-bordered w-full"
                required
                defaultValue={
                  myBudget ? String(Math.ceil(myBudget.limit * 1.5)) : "750"
                }
              />
            </FormField>
            <FormField label="Reason" htmlFor="reason">
              <textarea
                id="reason"
                name="reason"
                className="textarea textarea-bordered w-full"
                rows={3}
                placeholder="Why do you need a higher restock limit?"
              />
            </FormField>
            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={() => budgetRequestDialogRef.current?.close()}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Submit request"
                )}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit">close</button>
        </form>
      </dialog>

      <AssetDetailDrawer
        assetId={drawerAssetId}
        seedAsset={
          drawerAssetId
            ? (assets.find((asset) => asset.id === drawerAssetId) ?? null)
            : null
        }
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
