"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ChevronRight,
  HardDrive,
  MapPin,
  RefreshCw,
  User,
  Wrench,
  X,
} from "lucide-react";
import {
  addAssetIncident,
  addAssetRepairNote,
  fetchAssetDetail,
  flagAssetForReplacement,
  markAssetRepaired,
  updateAssetAssignment,
  updateAssetStatus,
  uploadAssetPhoto,
  type AssetDetailBundle,
} from "@/app/actions/hardware";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatDate, formatDateTime } from "@/lib/format";

const EMPTY_DETAIL: AssetDetailBundle = {
  asset: null,
  incidents: [],
  repairs: [],
  software: [],
  monitoring: [],
  assignments: [],
  photos: [],
  tickets: [],
};

const DEVICE_STATUSES = ["Active", "In Repair", "Offline", "Retired"] as const;

function categoryIcon(category: string): string {
  const value = category.toLowerCase();
  if (value.includes("laptop") || value.includes("mobile")) return "💻";
  if (value.includes("printer")) return "🖨️";
  if (value.includes("server") || value.includes("storage")) return "🖥️";
  if (value.includes("switch") || value.includes("firewall") || value.includes("ap"))
    return "🌐";
  if (value.includes("desktop")) return "🖥️";
  return "📦";
}

function healthTone(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "bg-base-300";
  if (pct >= 85) return "bg-error";
  if (pct >= 70) return "bg-warning";
  return "bg-success";
}

function MetricBar({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  const pct = value == null ? null : Math.max(0, Math.min(100, Number(value)));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-medium">{pct == null ? "—" : `${Math.round(pct)}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-base-300">
        <div
          className={`h-full rounded-full transition-all ${healthTone(pct)}`}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  count,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-base-300 pb-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 py-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold uppercase tracking-wide text-base-content/70">
          {title}
          {count != null ? (
            <span className="ml-2 badge badge-ghost badge-sm">{count}</span>
          ) : null}
        </span>
        {open ? (
          <ChevronDown className="size-4 opacity-60" />
        ) : (
          <ChevronRight className="size-4 opacity-60" />
        )}
      </button>
      {open ? <div className="space-y-3 pt-1">{children}</div> : null}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 text-sm">
      <dt className="text-base-content/55">{label}</dt>
      <dd className="font-medium break-words">{value ?? "—"}</dd>
    </div>
  );
}

interface AssetDetailDrawerProps {
  assetId: string | null;
  customerName?: string;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
}

export function AssetDetailDrawer({
  assetId,
  customerName,
  onClose,
  onUpdated,
}: AssetDetailDrawerProps) {
  const { showToast } = useToast();
  const [detail, setDetail] = useState<AssetDetailBundle>(EMPTY_DETAIL);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionPanel, setActionPanel] = useState<
    "incident" | "repair" | "status" | "assign" | null
  >(null);
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentDesc, setIncidentDesc] = useState("");
  const [repairNote, setRepairNote] = useState("");
  const [statusValue, setStatusValue] = useState("Active");
  const [assignUser, setAssignUser] = useState("");
  const [assignLocation, setAssignLocation] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchAssetDetail(id);
      setDetail(data);
      if (data.asset) {
        setStatusValue(data.asset.device_status || "Active");
        setAssignUser(data.asset.assigned_employee ?? "");
        setAssignLocation(data.asset.location ?? "");
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load asset.");
      setDetail(EMPTY_DETAIL);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!assetId) {
      setDetail(EMPTY_DETAIL);
      setActionPanel(null);
      return;
    }
    void loadDetail(assetId);
  }, [assetId, loadDetail]);

  useEffect(() => {
    if (!assetId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assetId, onClose]);

  const asset = detail.asset;
  const latestMonitoring = detail.monitoring[0] ?? null;

  const alertBadges = useMemo(() => {
    if (!asset) return [] as string[];
    const badges: string[] = [];
    if (asset.warranty_expiring_soon) badges.push("Warranty expiring");
    if (asset.nearing_eol) badges.push("Nearing EOL");
    if (asset.needs_replacement) badges.push("Needs Replacement");
    if (asset.unsupported_os) badges.push("Unsupported OS");
    if (asset.missing_security_updates) badges.push("Missing updates");
    const online =
      latestMonitoring?.online_status ??
      asset.online_status ??
      (asset.device_status === "Offline" ? "Offline" : "Online");
    badges.push(online === "Offline" ? "Offline" : "Online");
    if (asset.lifecycle_stage === "Aging") badges.push("Aging");
    return badges;
  }, [asset, latestMonitoring]);

  function runAction(fn: () => Promise<{ success: boolean; message: string }>) {
    startTransition(async () => {
      const result = await fn();
      showToast(result.message);
      if (result.success) {
        setActionPanel(null);
        setIncidentTitle("");
        setIncidentDesc("");
        setRepairNote("");
        if (assetId) await loadDetail(assetId);
        await onUpdated();
      }
    });
  }

  async function handlePhotoChange(file: File | null) {
    if (!file || !assetId) return;
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]!);
    }
    const base64 = btoa(binary);
    runAction(() =>
      uploadAssetPhoto({
        assetId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        base64,
      }),
    );
  }

  if (!assetId) return null;

  const assetName = asset
    ? [asset.manufacturer, asset.model].filter(Boolean).join(" ") ||
      asset.asset_number
    : "Asset";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-base-content/40"
        aria-label="Close asset detail"
        onClick={onClose}
      />

      <aside className="relative flex h-full w-full max-w-[520px] flex-col border-l border-base-300 bg-base-100 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-base-300 px-4 py-4">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">
              {loading ? "Loading asset…" : `${categoryIcon(asset?.category ?? "")} ${assetName}`}
            </p>
            <p className="text-xs text-base-content/60">
              {asset?.asset_number ?? assetId}
              {customerName ? ` · ${customerName}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Refresh"
              disabled={loading || isPending}
              onClick={() => void loadDetail(assetId)}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Close"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-36">
          {loading && !asset ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          ) : null}

          {loadError ? (
            <div className="alert alert-error text-sm">
              <span>{loadError}</span>
            </div>
          ) : null}

          {!loading && !asset && !loadError ? (
            <div className="alert alert-warning text-sm">
              <span>Asset not found. It may have been removed.</span>
            </div>
          ) : null}

          {asset ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {alertBadges.map((badge) => (
                  <span
                    key={badge}
                    className={`badge badge-sm ${
                      badge === "Online"
                        ? "badge-success"
                        : badge === "Offline" || badge === "Needs Replacement"
                          ? "badge-error"
                          : badge === "Aging"
                            ? "badge-warning"
                            : "badge-warning"
                    }`}
                  >
                    {badge}
                  </span>
                ))}
                <StatusBadge status={asset.device_status} />
                <StatusBadge status={asset.lifecycle_stage} />
              </div>

              <CollapsibleSection title="Basic Info">
                <dl className="space-y-2">
                  <InfoRow label="Asset name" value={assetName} />
                  <InfoRow
                    label="Category"
                    value={`${categoryIcon(asset.category)} ${asset.category}`}
                  />
                  <InfoRow label="Serial #" value={asset.serial_number} />
                  <InfoRow
                    label="Asset tag"
                    value={asset.asset_tag ?? asset.asset_number}
                  />
                  <InfoRow label="Assigned user" value={asset.assigned_employee} />
                  <InfoRow label="Location" value={asset.location} />
                  <InfoRow label="Purchase date" value={formatDate(asset.purchase_date)} />
                  <InfoRow
                    label="Warranty exp."
                    value={formatDate(asset.warranty_expiration)}
                  />
                  <InfoRow label="Lifecycle" value={asset.lifecycle_stage} />
                </dl>
              </CollapsibleSection>

              <CollapsibleSection title="Technical Specs">
                <dl className="space-y-2">
                  <InfoRow label="CPU" value={asset.cpu} />
                  <InfoRow label="RAM" value={asset.ram} />
                  <InfoRow label="Storage" value={asset.storage} />
                  <InfoRow label="OS version" value={asset.operating_system} />
                  <InfoRow label="MAC" value={asset.mac_address} />
                  <InfoRow label="IP" value={asset.ip_address} />
                  <InfoRow label="Battery" value={asset.battery_health} />
                  <InfoRow label="SMART disk" value={asset.smart_disk_status} />
                </dl>
                {!asset.cpu && !asset.ram && !asset.storage ? (
                  <p className="text-xs text-base-content/50">
                    Specs not populated yet. Apply the asset detail migration or update the asset record.
                  </p>
                ) : null}
              </CollapsibleSection>

              <CollapsibleSection title="Health & Monitoring">
                <dl className="space-y-2">
                  <InfoRow
                    label="Last check-in"
                    value={formatDateTime(
                      latestMonitoring?.checked_at ?? asset.last_check_in,
                    )}
                  />
                  <InfoRow
                    label="Online status"
                    value={
                      latestMonitoring?.online_status ??
                      asset.online_status ??
                      (asset.device_status === "Offline" ? "Offline" : "Online")
                    }
                  />
                  <InfoRow
                    label="Patch status"
                    value={
                      latestMonitoring?.patch_status ??
                      asset.patch_status ??
                      (asset.missing_security_updates
                        ? "Missing updates"
                        : "Current")
                    }
                  />
                  <InfoRow
                    label="Antivirus"
                    value={
                      latestMonitoring?.antivirus_status ??
                      asset.antivirus_status ??
                      "—"
                    }
                  />
                </dl>
                <div className="space-y-3 rounded-lg border border-base-300 p-3">
                  <MetricBar
                    label="CPU %"
                    value={latestMonitoring?.cpu_pct ?? asset.cpu_pct}
                  />
                  <MetricBar
                    label="RAM %"
                    value={latestMonitoring?.ram_pct ?? asset.ram_pct}
                  />
                  <MetricBar
                    label="Disk %"
                    value={latestMonitoring?.disk_pct ?? asset.disk_pct}
                  />
                </div>
                {(latestMonitoring?.alert_summary || alertBadges.length > 1) && (
                  <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                    <div className="mb-1 flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="size-4 text-warning" />
                      Active alerts
                    </div>
                    <p className="text-base-content/80">
                      {latestMonitoring?.alert_summary ||
                        alertBadges.filter((b) => b !== "Online").join(" · ") ||
                        "None"}
                    </p>
                  </div>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title="History"
                defaultOpen={false}
                count={
                  detail.incidents.length +
                  detail.repairs.length +
                  detail.tickets.length +
                  detail.assignments.length
                }
              >
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-base-content/50">
                    Incidents
                  </p>
                  {detail.incidents.length === 0 ? (
                    <p className="text-sm text-base-content/50">No incidents.</p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.incidents.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-lg border border-base-300 px-3 py-2 text-sm"
                        >
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-base-content/55">
                            {item.severity} · {item.status} ·{" "}
                            {formatDateTime(item.created_at)}
                          </div>
                          {item.description ? (
                            <p className="mt-1 text-base-content/70">{item.description}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-base-content/50">
                    Repairs
                  </p>
                  {detail.repairs.length === 0 ? (
                    <p className="text-sm text-base-content/50">No repair notes.</p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.repairs.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-lg border border-base-300 px-3 py-2 text-sm"
                        >
                          <p>{item.note}</p>
                          <div className="text-xs text-base-content/55">
                            {item.status}
                            {item.repaired_by ? ` · ${item.repaired_by}` : ""} ·{" "}
                            {formatDateTime(item.created_at)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-base-content/50">
                    Related tickets
                  </p>
                  {detail.tickets.length === 0 ? (
                    <p className="text-sm text-base-content/50">
                      No tickets matching this asset number.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.tickets.map((ticket) => (
                        <li
                          key={ticket.id}
                          className="rounded-lg border border-base-300 px-3 py-2 text-sm"
                        >
                          <div className="font-medium">
                            {ticket.ticket_number}: {ticket.title}
                          </div>
                          <div className="text-xs text-base-content/55">
                            {ticket.status} · {formatDate(ticket.opened_at)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-base-content/55">
                    Assignment / replacement history
                  </p>
                  {detail.assignments.length === 0 && !asset.needs_replacement ? (
                    <p className="text-sm text-base-content/50">No assignment history.</p>
                  ) : (
                    <ul className="space-y-2">
                      {asset.needs_replacement ? (
                        <li className="rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-sm">
                          Flagged for replacement
                          {asset.estimated_replacement_date
                            ? ` · target ${formatDate(asset.estimated_replacement_date)}`
                            : ""}
                        </li>
                      ) : null}
                      {detail.assignments.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-lg border border-base-300 px-3 py-2 text-sm"
                        >
                          <div>
                            {item.assigned_user ?? "Unassigned"}
                            {item.assigned_location
                              ? ` @ ${item.assigned_location}`
                              : ""}
                          </div>
                          <div className="text-xs text-base-content/55">
                            {formatDateTime(item.assigned_at)}
                            {item.notes ? ` · ${item.notes}` : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {detail.photos.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-base-content/50">
                      Photos
                    </p>
                    <ul className="space-y-1 text-sm">
                      {detail.photos.map((photo) => (
                        <li key={photo.id} className="flex items-center gap-2">
                          <Camera className="size-3.5 opacity-60" />
                          <span className="truncate">{photo.file_name}</span>
                          <span className="text-xs text-base-content/50">
                            {formatDate(photo.created_at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CollapsibleSection>

              <CollapsibleSection
                title="Installed Software"
                defaultOpen={false}
                count={detail.software.length}
              >
                {detail.software.length === 0 ? (
                  <p className="text-sm text-base-content/50">
                    No software inventory recorded for this asset.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.software.map((app) => (
                      <li
                        key={app.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-base-300 px-3 py-2 text-sm"
                      >
                        <div>
                          <div className="font-medium">{app.app_name}</div>
                          <div className="text-xs text-base-content/55">
                            v{app.version ?? "—"} · {app.license_status ?? "Unknown"}
                          </div>
                        </div>
                        {app.update_available ? (
                          <span className="badge badge-warning badge-sm">Update</span>
                        ) : (
                          <span className="badge badge-ghost badge-sm">Current</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CollapsibleSection>

              {actionPanel === "incident" ? (
                <div className="space-y-2 rounded-lg border border-base-300 p-3">
                  <p className="text-sm font-semibold">Add Incident</p>
                  <input
                    className="input input-bordered input-sm w-full"
                    placeholder="Title"
                    value={incidentTitle}
                    onChange={(e) => setIncidentTitle(e.target.value)}
                  />
                  <textarea
                    className="textarea textarea-bordered textarea-sm w-full"
                    rows={2}
                    placeholder="Description"
                    value={incidentDesc}
                    onChange={(e) => setIncidentDesc(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={isPending || !incidentTitle.trim()}
                      onClick={() =>
                        runAction(() =>
                          addAssetIncident({
                            assetId,
                            title: incidentTitle,
                            description: incidentDesc,
                          }),
                        )
                      }
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setActionPanel(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {actionPanel === "repair" ? (
                <div className="space-y-2 rounded-lg border border-base-300 p-3">
                  <p className="text-sm font-semibold">Add Repair Note</p>
                  <textarea
                    className="textarea textarea-bordered textarea-sm w-full"
                    rows={3}
                    placeholder="What was repaired?"
                    value={repairNote}
                    onChange={(e) => setRepairNote(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={isPending || !repairNote.trim()}
                      onClick={() =>
                        runAction(() =>
                          addAssetRepairNote({ assetId, note: repairNote }),
                        )
                      }
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setActionPanel(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {actionPanel === "status" ? (
                <div className="space-y-2 rounded-lg border border-base-300 p-3">
                  <p className="text-sm font-semibold">Update Status</p>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={statusValue}
                    onChange={(e) => setStatusValue(e.target.value)}
                  >
                    {DEVICE_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={isPending}
                      onClick={() =>
                        runAction(() =>
                          updateAssetStatus({
                            assetId,
                            deviceStatus: statusValue,
                            lifecycleStage:
                              statusValue === "Retired"
                                ? "Retired"
                                : statusValue === "In Repair"
                                  ? asset.lifecycle_stage
                                  : undefined,
                          }),
                        )
                      }
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setActionPanel(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              {actionPanel === "assign" ? (
                <div className="space-y-2 rounded-lg border border-base-300 p-3">
                  <p className="text-sm font-semibold">Assign User / Location</p>
                  <label className="form-control w-full">
                    <span className="label-text text-xs">User</span>
                    <input
                      className="input input-bordered input-sm w-full"
                      value={assignUser}
                      onChange={(e) => setAssignUser(e.target.value)}
                      placeholder="Assigned employee"
                    />
                  </label>
                  <label className="form-control w-full">
                    <span className="label-text text-xs">Location</span>
                    <input
                      className="input input-bordered input-sm w-full"
                      value={assignLocation}
                      onChange={(e) => setAssignLocation(e.target.value)}
                      placeholder="Site / office"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={isPending}
                      onClick={() =>
                        runAction(() =>
                          updateAssetAssignment({
                            assetId,
                            assignedUser: assignUser,
                            assignedLocation: assignLocation,
                          }),
                        )
                      }
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setActionPanel(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {asset ? (
          <div className="absolute inset-x-0 bottom-0 border-t border-base-300 bg-base-100/95 p-3 backdrop-blur">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">
              Technician Actions
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="btn btn-outline btn-xs justify-start gap-1"
                disabled={isPending}
                onClick={() => setActionPanel("incident")}
              >
                <AlertTriangle className="size-3.5" />
                Add Incident
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs justify-start gap-1"
                disabled={isPending}
                onClick={() => setActionPanel("repair")}
              >
                <Wrench className="size-3.5" />
                Add Repair Note
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs justify-start gap-1"
                disabled={isPending}
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera className="size-3.5" />
                Upload Photo
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs justify-start gap-1"
                disabled={isPending}
                onClick={() =>
                  runAction(() => flagAssetForReplacement(assetId))
                }
              >
                <HardDrive className="size-3.5" />
                Flag Replacement
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs justify-start gap-1"
                disabled={isPending}
                onClick={() => runAction(() => markAssetRepaired(assetId))}
              >
                <Wrench className="size-3.5" />
                Mark as Repaired
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs justify-start gap-1"
                disabled={isPending}
                onClick={() => setActionPanel("status")}
              >
                Update Status
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs justify-start gap-1"
                disabled={isPending}
                onClick={() => setActionPanel("assign")}
              >
                <User className="size-3.5" />
                Assign to User
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs justify-start gap-1"
                disabled={isPending}
                onClick={() => setActionPanel("assign")}
              >
                <MapPin className="size-3.5" />
                Assign to Location
              </button>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void handlePhotoChange(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            {isPending ? (
              <div className="mt-2 flex items-center gap-2 text-xs text-base-content/60">
                <span className="loading loading-spinner loading-xs" />
                Saving…
              </div>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
