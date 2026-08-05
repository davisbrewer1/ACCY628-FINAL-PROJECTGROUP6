"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Announcement, Profile } from "@/lib/types";

export default function EndUserPage() {
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

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
          .from("announcements")
          .select("*")
          .eq("active", true)
          .or(`customer_id.eq.${profileData.customer_id},customer_id.is.null`)
          .order("published_at", { ascending: false });
        setAnnouncements(data ?? []);
      }

      setLoading(false);
    }
    init();
  }, []);

  if (activeRole !== "client_user" && activeRole !== "administrator") {
    return (
      <AlertBanner
        tone="info"
        title="End user portal"
        message="This portal is designed for client end users. Use the Demo Role Switcher to preview this view."
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
        title="End user portal"
        description={`Welcome${profile.full_name ? `, ${profile.full_name}` : ""}. View company announcements and use the menu for support tickets and other concerns.`}
      />

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h2 className="card-title text-base">Announcements</h2>
          {announcements.length === 0 ? (
            <EmptyState
              title="No announcements"
              description="Company announcements from your IT team will appear here."
            />
          ) : (
            <div className="space-y-3">
              {announcements.map((item) => (
                <div key={item.id} className="rounded-box border border-base-300 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{item.title}</p>
                    <span className="text-xs text-base-content/60">
                      {formatDate(item.published_at)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-base-content/80">{item.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h2 className="card-title text-base">Need help?</h2>
          <p className="text-sm text-base-content/70">
            Open the menu (three lines) to submit a support ticket, report an AI issue, or raise a security concern.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/end-user/support" className="btn btn-primary btn-sm">
              Support Tickets
            </Link>
            <Link href="/end-user/devices" className="btn btn-outline btn-sm">
              My Devices
            </Link>
            <Link href="/end-user/ai-concern" className="btn btn-outline btn-sm">
              AI Issue
            </Link>
            <Link href="/end-user/security-concern" className="btn btn-outline btn-sm">
              Security Concern
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
