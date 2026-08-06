"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { PortalPageHeader } from "@/components/end-user/PortalPageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  coverageLabel,
  deviceDisplayName,
  getDeviceHealthScore,
  healthTone,
} from "@/lib/device-utils";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type {
  AssetIncident,
  AssetMonitoring,
  AssetRepair,
  AssetSoftware,
  HardwareAsset,
  Profile,
  ServiceTicket,
} from "@/lib/types";

export default function EndUserDeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const assetId = params.id;
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [asset, setAsset] = useState<HardwareAsset | null>(null);
  const [software, setSoftware] = useState<AssetSoftware[]>([]);
  const [monitoring, setMonitoring] = useState<AssetMonitoring[]>([]);
  const [repairs, setRepairs] = useState<AssetRepair[]>([]);
  const [incidents, setIncidents] = useState<AssetIncident[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !assetId) {
        setLoading(false);
        setNotFound(true);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      setProfile(profileData);

      if (!profileData?.customer_id) {
        setLoading(false);
        setNotFound(true);
        return;
      }

      const { data: assetData } = await supabase
        .from("hardware_assets")
        .select("*")
        .eq("id", assetId)
        .eq("customer_id", profileData.customer_id)
        .maybeSingle();

      if (!assetData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setAsset(assetData);

      const [soft, mon, rep, inc, tix] = await Promise.all([
        supabase
          .from("asset_software")
          .select("*")
          .eq("asset_id", assetId)
          .order("app_name"),
        supabase
          .from("asset_monitoring")
          .select("*")
          .eq("asset_id", assetId)
          .order("checked_at", { ascending: false }),
        supabase
          .from("asset_repairs")
          .select("*")
          .eq("asset_id", assetId)
          .order("created_at", { ascending: false }),
        supabase
          .from("asset_incidents")
          .select("*")
          .eq("asset_id", assetId)
          .order("created_at", { ascending: false }),
        supabase
          .from("service_tickets")
          .select("*")
          .eq("customer_id", profileData.customer_id)
          .eq("hardware_asset_id", assetId)
          .order("opened_at", { ascending: false }),
      ]);

      setSoftware(soft.data ?? []);
      setMonitoring(mon.data ?? []);
      setRepairs(rep.data ?? []);
      setIncidents(inc.data ?? []);
      setTickets(tix.data ?? []);
      setLoading(false);
    }

    void init();
  }, [assetId]);

  const latestMonitoring = monitoring[0] ?? null;
  const health = asset ? getDeviceHealthScore(asset) : 0;

  const supportHistory = useMemo(() => {
    const ticketRows = tickets.map((ticket) => ({
      id: `ticket-${ticket.id}`,
      date: ticket.opened_at ?? ticket.created_at,
      title: ticket.title,
      detail: ticket.ticket_number,
      status: ticket.status ?? "Open",
      kind: "Support ticket" as const,
      severity: ticket.priority ?? null,
    }));

    const repairRows = repairs.map((repair) => ({
      id: `repair-${repair.id}`,
      date: repair.created_at,
      title: repair.note ?? "Repair / service work",
      detail: repair.repaired_by ? `By ${repair.repaired_by}` : "Service record",
      status: repair.status ?? "Logged",
      kind: "Repair" as const,
      severity: null as string | null,
    }));

    const incidentRows = incidents.map((incident) => ({
      id: `incident-${incident.id}`,
      date: incident.created_at,
      title: incident.title,
      detail: incident.description ?? "Device incident",
      status: incident.status ?? "Open",
      kind: "Incident" as const,
      severity: incident.severity,
    }));

    return [...ticketRows, ...repairRows, ...incidentRows].sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    });
  }, [tickets, repairs, incidents]);

  if (activeRole !== "client_user" && activeRole !== "administrator") {
    return (
      <AlertBanner
        tone="info"
        title="Device details"
        message="Switch to the Client End User demo role to review device details."
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

  if (notFound || !asset) {
    return (
      <EmptyState
        title="Device not found"
        description="This device is unavailable or does not belong to your organization."
        action={
          <Link href="/end-user/devices" className="btn btn-primary btn-sm">
            Back to My Devices
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title={deviceDisplayName(asset)}
        description={`${asset.asset_number} · ${coverageLabel(asset)}`}
        action={
          <Link href="/end-user/devices" className="btn btn-outline btn-sm">
            Back to My Devices
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={asset.device_status} />
        <span className="text-sm capitalize text-base-content/60">
          {asset.category}
          {asset.assigned_employee ? ` · Assigned to ${asset.assigned_employee}` : ""}
          {asset.location ? ` · ${asset.location}` : ""}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Current health score"
          value={`${health}/100`}
          tone={healthTone(health)}
          hint={latestMonitoring?.alert_summary ?? "Based on lifecycle and security signals"}
        />
        <StatCard title="Purchase date" value={formatDate(asset.purchase_date)} />
        <StatCard
          title="Replacement date"
          value={formatDate(asset.estimated_replacement_date)}
          tone={asset.needs_replacement || asset.nearing_eol ? "warning" : "default"}
        />
        <StatCard
          title="Last backup"
          value={formatDateTime(asset.last_backup_at)}
          hint={profile?.email ? `Account ${profile.email}` : undefined}
        />
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h3 className="card-title text-base">Warranty details</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-box border border-base-300 bg-base-200/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Warranty expiration
              </p>
              <p className="mt-1 font-medium">{formatDate(asset.warranty_expiration)}</p>
              {asset.warranty_expiring_soon ? (
                <span className="badge badge-warning badge-sm mt-2">Expiring soon</span>
              ) : null}
            </div>
            <div className="rounded-box border border-base-300 bg-base-200/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Support contract
              </p>
              <p className="mt-1 font-medium">{asset.support_contract ?? "Standard covered device"}</p>
              <p className="text-sm text-base-content/70">{coverageLabel(asset)}</p>
            </div>
            <div className="rounded-box border border-base-300 bg-base-200/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Purchase / value
              </p>
              <p className="mt-1 font-medium">{formatCurrency(asset.purchase_cost)}</p>
              <p className="text-sm text-base-content/70">
                Current value {formatCurrency(asset.current_value)}
              </p>
            </div>
            <div className="rounded-box border border-base-300 bg-base-200/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Serial / asset tag
              </p>
              <p className="mt-1 font-mono text-sm">{asset.serial_number ?? "—"}</p>
              <p className="text-sm text-base-content/70">{asset.asset_tag ?? asset.asset_number}</p>
            </div>
            <div className="rounded-box border border-base-300 bg-base-200/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Lifecycle stage
              </p>
              <p className="mt-1 font-medium">{asset.lifecycle_stage ?? "—"}</p>
              <p className="text-sm text-base-content/70">
                OS: {asset.operating_system ?? "Not listed"}
              </p>
            </div>
            <div className="rounded-box border border-base-300 bg-base-200/40 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Monitoring snapshot
              </p>
              <p className="mt-1 text-sm">
                {latestMonitoring
                  ? `${latestMonitoring.online_status ?? "—"} · Patch ${latestMonitoring.patch_status ?? "—"} · AV ${latestMonitoring.antivirus_status ?? "—"}`
                  : "No recent monitoring check"}
              </p>
              <p className="text-xs text-base-content/60">
                Checked {formatDateTime(latestMonitoring?.checked_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h3 className="card-title text-base">Installed software</h3>
          {software.length === 0 ? (
            <EmptyState
              title="No software inventory"
              description="Installed applications for this device have not been reported yet."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Application</th>
                    <th>Version</th>
                    <th>License</th>
                    <th>Updates</th>
                  </tr>
                </thead>
                <tbody>
                  {software.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.app_name}</td>
                      <td className="font-mono text-sm">{item.version ?? "—"}</td>
                      <td>{item.license_status ?? "—"}</td>
                      <td>
                        {item.update_available ? (
                          <span className="badge badge-warning badge-sm">Update available</span>
                        ) : (
                          <span className="badge badge-ghost badge-sm">Current</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h3 className="card-title text-base">Support history</h3>
          <p className="text-sm text-base-content/70">
            Tickets, incidents, and repair notes linked to this device.
          </p>
          {supportHistory.length === 0 ? (
            <EmptyState
              title="No support history"
              description="When this device is referenced on tickets or repair work, that activity will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Summary</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {supportHistory.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap">{formatDate(row.date)}</td>
                      <td>
                        <span className="badge badge-ghost badge-sm">{row.kind}</span>
                      </td>
                      <td>
                        <div className="font-medium">{row.title}</div>
                        <div className="text-sm text-base-content/70">{row.detail}</div>
                        {row.severity ? (
                          <div className="mt-1">
                            <PriorityBadge priority={row.severity} />
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h3 className="card-title text-base">Backup status</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-box border border-base-300 bg-base-200/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Last successful backup
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatDateTime(asset.last_backup_at)}
              </p>
              <p className="mt-2 text-sm text-base-content/70">
                Backup coverage is monitored as part of your managed IT service.
              </p>
            </div>
            <div className="rounded-box border border-base-300 bg-base-200/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/60">
                Last device check-in
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatDateTime(latestMonitoring?.checked_at ?? asset.last_check_in)}
              </p>
              <p className="mt-2 text-sm text-base-content/70">
                Online status: {latestMonitoring?.online_status ?? asset.online_status ?? "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
