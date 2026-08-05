"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { HardwareAsset, Profile } from "@/lib/types";

function deviceName(asset: HardwareAsset): string {
  const parts = [asset.manufacturer, asset.model].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : asset.category;
}

function coverageLabel(asset: HardwareAsset): string {
  if (asset.managed_coverage) return "Covered by managed IT";
  if (asset.support_contract) return asset.support_contract;
  return "Listed inventory";
}

export default function EndUserDevicesPage() {
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [assets, setAssets] = useState<HardwareAsset[]>([]);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      setProfile(profileData);

      if (profileData?.customer_id) {
        const { data } = await supabase
          .from("hardware_assets")
          .select("*")
          .eq("customer_id", profileData.customer_id)
          .order("asset_number", { ascending: true });
        setAssets(data ?? []);
      }

      setLoading(false);
    }
    init();
  }, []);

  const coveredCount = useMemo(
    () => assets.filter((asset) => asset.managed_coverage).length,
    [assets],
  );

  if (activeRole !== "client_user" && activeRole !== "administrator") {
    return (
      <AlertBanner
        tone="info"
        title="My devices"
        message="This page is designed for client end users. Use the Demo Role Switcher to preview this view."
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

  if (!profile?.customer_id) {
    return (
      <EmptyState
        title="No organization linked"
        description="Your account is not linked to a customer organization. Contact your IT administrator."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My devices"
        description="Devices and equipment provided or covered by your IT management service."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total devices" value={assets.length} />
        <StatCard
          title="Managed coverage"
          value={coveredCount}
          tone={coveredCount > 0 ? "success" : "default"}
        />
        <StatCard
          title="Active / in use"
          value={assets.filter((a) => a.device_status !== "Retired" && a.device_status !== "Offline").length}
          tone="info"
        />
      </div>

      {assets.length === 0 ? (
        <EmptyState
          title="No devices on file"
          description="When Nexus provisions or tracks hardware for your organization, those items will appear here."
        />
      ) : (
        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">Organization devices ({assets.length})</h2>
            <p className="text-sm text-base-content/60">
              Review asset details, assignment, coverage, and warranty information for items tied to your company.
            </p>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Asset #</th>
                    <th>Device</th>
                    <th>Type</th>
                    <th>Assigned to</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Coverage</th>
                    <th>Warranty</th>
                    <th>Serial</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id}>
                      <td className="font-mono text-sm">{asset.asset_number}</td>
                      <td>
                        <div className="font-medium">{deviceName(asset)}</div>
                        <div className="text-xs text-base-content/60">
                          {asset.operating_system ?? "OS not listed"}
                        </div>
                      </td>
                      <td className="capitalize">{asset.category}</td>
                      <td>{asset.assigned_employee ?? "Unassigned"}</td>
                      <td>{asset.location ?? "—"}</td>
                      <td>
                        <StatusBadge status={asset.device_status} />
                      </td>
                      <td>
                        <div className="text-sm">{coverageLabel(asset)}</div>
                        {asset.lifecycle_stage ? (
                          <div className="text-xs text-base-content/60">
                            Lifecycle: {asset.lifecycle_stage}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div className="text-sm">
                          {asset.warranty_expiration
                            ? formatDate(asset.warranty_expiration)
                            : "—"}
                        </div>
                        {asset.warranty_expiring_soon ? (
                          <span className="badge badge-warning badge-xs mt-1">Expiring soon</span>
                        ) : null}
                      </td>
                      <td className="font-mono text-xs">{asset.serial_number ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
