"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { PortalPageHeader } from "@/components/end-user/PortalPageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  coverageLabel,
  deviceDisplayName,
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
      <PortalPageHeader
        title="My devices"
        description="Organization devices covered by Nexus. Each card shows assignment and status at a glance — open a device for full details."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Total devices" value={assets.length} />
        <StatCard
          title="Managed coverage"
          value={coveredCount}
          tone={coveredCount > 0 ? "success" : "default"}
        />
        <StatCard
          title="Active / in use"
          value={
            assets.filter(
              (a) => a.device_status !== "Retired" && a.device_status !== "Offline",
            ).length
          }
          tone="info"
        />
      </div>

      {assets.length === 0 ? (
        <EmptyState
          title="No devices on file"
          description="When Nexus provisions or tracks hardware for your organization, those items will appear here."
        />
      ) : (
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">
              Organization devices ({assets.length})
            </h2>
            <p className="text-sm text-base-content/60">
              Tap a device card to review warranty, software, support history, and backup details.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => {
              return (
                <Link
                  key={asset.id}
                  href={`/end-user/devices/${asset.id}`}
                  className="card border border-base-300 bg-base-100 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="card-body gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-base-content/55">
                          {asset.asset_number}
                        </p>
                        <h3 className="truncate text-base font-semibold">
                          {deviceDisplayName(asset)}
                        </h3>
                        <p className="text-xs capitalize text-base-content/60">
                          {asset.category} · {asset.location ?? "No location"}
                        </p>
                      </div>
                      <StatusBadge status={asset.device_status} />
                    </div>

                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-base-content/50">
                          Assigned
                        </dt>
                        <dd className="mt-0.5 font-medium">
                          {asset.assigned_employee ?? "Unassigned"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-base-content/50">
                          Coverage
                        </dt>
                        <dd className="mt-0.5 font-medium">{coverageLabel(asset)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-base-content/50">
                          Purchased
                        </dt>
                        <dd className="mt-0.5">{formatDate(asset.purchase_date)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-base-content/50">
                          Replace by
                        </dt>
                        <dd className="mt-0.5">
                          {formatDate(asset.estimated_replacement_date)}
                        </dd>
                      </div>
                    </dl>

                    {asset.needs_replacement || asset.nearing_eol ? (
                      <span className="badge badge-warning badge-sm w-fit">
                        Replacement recommended
                      </span>
                    ) : null}

                    <span className="text-sm font-medium text-primary">View device details →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
