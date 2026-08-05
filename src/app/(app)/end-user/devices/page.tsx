"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  coverageLabel,
  deviceDisplayName,
  getDeviceHealthScore,
  healthTone,
} from "@/lib/device-utils";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { HardwareAsset, Profile } from "@/lib/types";

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

  const averageHealth = useMemo(() => {
    if (assets.length === 0) return 0;
    const total = assets.reduce((sum, asset) => sum + getDeviceHealthScore(asset), 0);
    return Math.round(total / assets.length);
  }, [assets]);

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
        description="Devices and equipment provided or covered by your IT management service. Open a device for warranty, software, support, and backup details."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <StatCard
          title="Avg. health score"
          value={`${averageHealth}/100`}
          tone={healthTone(averageHealth)}
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
              Review purchase dates, replacement targets, and current health. Click a device for full detail.
            </p>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Asset #</th>
                    <th>Device</th>
                    <th>Assigned to</th>
                    <th>Status</th>
                    <th>Purchase date</th>
                    <th>Replacement date</th>
                    <th>Health score</th>
                    <th>Coverage</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => {
                    const health = getDeviceHealthScore(asset);
                    return (
                      <tr key={asset.id}>
                        <td className="font-mono text-sm">{asset.asset_number}</td>
                        <td>
                          <div className="font-medium">{deviceDisplayName(asset)}</div>
                          <div className="text-xs capitalize text-base-content/60">
                            {asset.category} · {asset.location ?? "No location"}
                          </div>
                        </td>
                        <td>{asset.assigned_employee ?? "Unassigned"}</td>
                        <td>
                          <StatusBadge status={asset.device_status} />
                        </td>
                        <td>{formatDate(asset.purchase_date)}</td>
                        <td>
                          <div>{formatDate(asset.estimated_replacement_date)}</div>
                          {asset.needs_replacement || asset.nearing_eol ? (
                            <span className="badge badge-warning badge-xs mt-1">
                              Replacement recommended
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <div className="font-semibold">{health}/100</div>
                          <progress
                            className={`progress mt-1 w-20 ${
                              health >= 85
                                ? "progress-success"
                                : health >= 50
                                  ? "progress-warning"
                                  : "progress-error"
                            }`}
                            value={health}
                            max={100}
                          />
                        </td>
                        <td className="text-sm">{coverageLabel(asset)}</td>
                        <td className="text-right">
                          <Link
                            href={`/end-user/devices/${asset.id}`}
                            className="btn btn-ghost btn-xs"
                          >
                            View device
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
