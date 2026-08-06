"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { PortalPageHeader } from "@/components/end-user/PortalPageHeader";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { formatDate } from "@/lib/format";
import { buildRecentUpdates } from "@/lib/portal-activity";
import { createClient } from "@/lib/supabase/client";
import type {
  Contract,
  HardwareAsset,
  Invoice,
  Payment,
  Profile,
  SecurityScore,
  ServiceTicket,
  Technician,
} from "@/lib/types";

export default function EndUserActivityPage() {
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [assets, setAssets] = useState<HardwareAsset[]>([]);
  const [securityScore, setSecurityScore] = useState<SecurityScore | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

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

      if (!profileData?.customer_id) {
        setLoading(false);
        return;
      }

      const customerId = profileData.customer_id;
      const [
        ticketsRes,
        techniciansRes,
        assetsRes,
        securityRes,
        invoicesRes,
        paymentsRes,
        contractsRes,
      ] = await Promise.all([
        supabase
          .from("service_tickets")
          .select("*")
          .eq("customer_id", customerId)
          .order("opened_at", { ascending: false }),
        supabase.from("technicians").select("*"),
        supabase
          .from("hardware_assets")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("security_scores")
          .select("*")
          .eq("customer_id", customerId)
          .order("last_assessed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("invoices")
          .select("*")
          .eq("customer_id", customerId)
          .order("invoice_date", { ascending: false }),
        supabase
          .from("payments")
          .select("*")
          .eq("customer_id", customerId)
          .order("payment_date", { ascending: false }),
        supabase
          .from("contracts")
          .select("*")
          .eq("customer_id", customerId)
          .order("start_date", { ascending: false }),
      ]);

      setTickets(ticketsRes.data ?? []);
      setTechnicians(techniciansRes.data ?? []);
      setAssets(assetsRes.data ?? []);
      setSecurityScore(securityRes.data ?? null);
      setInvoices(invoicesRes.data ?? []);
      setPayments(paymentsRes.data ?? []);
      setContracts(contractsRes.data ?? []);
      setLoading(false);
    }

    void init();
  }, []);

  const activity = useMemo(
    () =>
      buildRecentUpdates({
        tickets,
        technicians,
        assets,
        securityScore,
        invoices,
        payments,
        contracts,
      }),
    [tickets, technicians, assets, securityScore, invoices, payments, contracts],
  );

  if (activeRole !== "client_user" && activeRole !== "administrator") {
    return (
      <AlertBanner
        tone="info"
        title="Recent activity"
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
        title="Recent activity"
        description="Full history of ticket, billing, device, payment, and contract updates for your organization."
        action={
          <Link href="/end-user" className="btn btn-outline btn-sm">
            Back to Client Home
          </Link>
        }
      />

      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="card-title text-base">All updates</h2>
            <p className="text-sm text-base-content/60">
              {activity.length} item{activity.length === 1 ? "" : "s"}
            </p>
          </div>

          {activity.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Ticket, billing, device, and contract updates will appear here as they happen."
            />
          ) : (
            <ul className="divide-y divide-base-300 rounded-box border border-base-300">
              {activity.map((update) => (
                <li key={update.id}>
                  <Link
                    href={update.href}
                    className="flex items-start justify-between gap-3 px-4 py-3 transition hover:bg-base-200/50"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{update.title}</p>
                      <p className="mt-1 text-sm text-base-content/70">{update.detail}</p>
                    </div>
                    <span className="shrink-0 text-xs text-base-content/55">
                      {formatDate(update.at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
