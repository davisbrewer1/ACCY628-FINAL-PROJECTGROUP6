"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { isOpenTicket } from "@/lib/dashboard-stats";
import { toClientInvoiceStatus } from "@/lib/client-billing";
import { formatDate } from "@/lib/format";
import { buildRecentUpdates } from "@/lib/portal-activity";
import { createClient } from "@/lib/supabase/client";
import type {
  Announcement,
  Contract,
  HardwareAsset,
  Invoice,
  Payment,
  Profile,
  SecurityScore,
  ServiceTicket,
  Technician,
} from "@/lib/types";

export default function EndUserPage() {
  const { activeRole } = useDemoRole();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
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

      if (profileData?.customer_id) {
        const customerId = profileData.customer_id;
        const [
          announcementsRes,
          ticketsRes,
          techniciansRes,
          assetsRes,
          securityRes,
          invoicesRes,
          paymentsRes,
          contractsRes,
        ] = await Promise.all([
          supabase
            .from("announcements")
            .select("*")
            .eq("active", true)
            .or(`customer_id.eq.${customerId},customer_id.is.null`)
            .order("published_at", { ascending: false }),
          supabase
            .from("service_tickets")
            .select("*")
            .eq("customer_id", customerId)
            .order("opened_at", { ascending: false })
            .limit(25),
          supabase.from("technicians").select("*"),
          supabase
            .from("hardware_assets")
            .select("*")
            .eq("customer_id", customerId)
            .order("created_at", { ascending: false })
            .limit(25),
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
            .order("invoice_date", { ascending: false })
            .limit(15),
          supabase
            .from("payments")
            .select("*")
            .eq("customer_id", customerId)
            .order("payment_date", { ascending: false })
            .limit(10),
          supabase
            .from("contracts")
            .select("*")
            .eq("customer_id", customerId)
            .order("renewal_date", { ascending: true }),
        ]);

        setAnnouncements(announcementsRes.data ?? []);
        setTickets(ticketsRes.data ?? []);
        setTechnicians(techniciansRes.data ?? []);
        setAssets(assetsRes.data ?? []);
        setSecurityScore(securityRes.data ?? null);
        setInvoices(invoicesRes.data ?? []);
        setPayments(paymentsRes.data ?? []);
        setContracts(contractsRes.data ?? []);
      }

      setLoading(false);
    }
    init();
  }, []);

  const openTicketCount = useMemo(
    () => tickets.filter((ticket) => isOpenTicket(ticket.status)).length,
    [tickets],
  );

  const unpaidInvoiceCount = useMemo(
    () =>
      invoices.filter((invoice) => {
        const status = toClientInvoiceStatus(
          invoice.status,
          invoice.amount_paid,
          invoice.remaining_balance,
        );
        return status === "Unpaid" || status === "Partial";
      }).length,
    [invoices],
  );

  const recentUpdates = useMemo(
    () =>
      buildRecentUpdates(
        {
          tickets,
          technicians,
          assets,
          securityScore,
          invoices,
          payments,
          contracts,
        },
        4,
      ),
    [tickets, technicians, assets, securityScore, invoices, payments, contracts],
  );

  const firstName = useMemo(() => {
    const full = profile?.full_name?.trim();
    if (!full) return null;
    return full.split(/\s+/)[0] ?? full;
  }, [profile?.full_name]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  if (activeRole !== "client_user" && activeRole !== "administrator") {
    return (
      <AlertBanner
        tone="info"
        title="Client Home Page"
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
      <section className="relative overflow-hidden rounded-box border border-primary/20 bg-gradient-to-br from-primary/15 via-base-100 to-base-200/60 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-sky-400/10 blur-2xl" />
        <div className="relative space-y-4 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Client Home Page
          </p>
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-base-content sm:text-4xl">
              Welcome back{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-2 text-base text-base-content/75">
              {greeting}. Here&apos;s a quick look at your Nexus account — announcements, recent
              activity, and shortcuts to the tools you use most.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            Open tickets
          </p>
          <p className="mt-1 text-2xl font-bold">{openTicketCount}</p>
          <p className="mt-1 text-sm text-base-content/65">
            {openTicketCount === 0
              ? "You're all caught up"
              : "Awaiting updates from Nexus"}
          </p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            Devices on file
          </p>
          <p className="mt-1 text-2xl font-bold">{assets.length}</p>
          <p className="mt-1 text-sm text-base-content/65">Organization hardware</p>
        </div>
        <div className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
            Invoices needing attention
          </p>
          <p className="mt-1 text-2xl font-bold">{unpaidInvoiceCount}</p>
          <p className="mt-1 text-sm text-base-content/65">
            {unpaidInvoiceCount === 0 ? "Billing looks current" : "Review in Billing"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">Announcements</h2>
            <p className="text-sm text-base-content/60">
              Messages from your Nexus IT team.
            </p>
            {announcements.length === 0 ? (
              <EmptyState
                title="No announcements"
                description="Company announcements from your IT team will appear here."
              />
            ) : (
              <div className="space-y-3">
                {announcements.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-box border border-base-300 bg-base-200/30 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{item.title}</p>
                      <span className="shrink-0 text-xs text-base-content/60">
                        {formatDate(item.published_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-base-content/80">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-2 py-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="card-title text-base">Recent updates</h2>
              <Link href="/end-user/activity" className="text-xs font-medium text-primary hover:underline">
                View activity
              </Link>
            </div>
            {recentUpdates.length === 0 ? (
              <p className="text-sm text-base-content/60">
                No recent ticket, billing, or device activity yet.
              </p>
            ) : (
              <ul className="divide-y divide-base-300 rounded-box border border-base-300">
                {recentUpdates.map((update) => (
                  <li key={update.id}>
                    <Link
                      href={update.href}
                      className="flex items-start justify-between gap-3 px-3 py-2.5 transition hover:bg-base-200/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{update.title}</p>
                        <p className="mt-0.5 truncate text-xs text-base-content/60">
                          {update.detail}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-base-content/50">
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

      <div className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-4">
          <div>
            <h2 className="card-title text-base">Quick links</h2>
            <p className="text-sm text-base-content/65">
              Jump back into the areas of your account you need most.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/end-user/support"
              className="rounded-box border border-base-300 bg-base-200/30 p-4 transition hover:border-primary/40 hover:bg-primary/5"
            >
              <p className="font-semibold">Support tickets</p>
              <p className="mt-1 text-sm text-base-content/65">
                Submit requests and track live status
              </p>
            </Link>
            <Link
              href="/end-user/devices"
              className="rounded-box border border-base-300 bg-base-200/30 p-4 transition hover:border-primary/40 hover:bg-primary/5"
            >
              <p className="font-semibold">My devices</p>
              <p className="mt-1 text-sm text-base-content/65">
                Review organization hardware health
              </p>
            </Link>
            <Link
              href="/end-user/billing"
              className="rounded-box border border-base-300 bg-base-200/30 p-4 transition hover:border-primary/40 hover:bg-primary/5"
            >
              <p className="font-semibold">Billing</p>
              <p className="mt-1 text-sm text-base-content/65">
                Invoices, plan hours, and payments
              </p>
            </Link>
            <Link
              href="/end-user/contracts"
              className="rounded-box border border-base-300 bg-base-200/30 p-4 transition hover:border-primary/40 hover:bg-primary/5"
            >
              <p className="font-semibold">My contracts</p>
              <p className="mt-1 text-sm text-base-content/65">
                View plans and request upgrades
              </p>
            </Link>
          </div>
        </div>
      </div>

      <div className="card border border-error/40 bg-gradient-to-br from-error/10 via-base-100 to-base-100 shadow-sm">
        <div className="card-body gap-4">
          <h2 className="card-title text-base text-error">Emergency support hotline</h2>
          <div className="rounded-box border border-error/20 bg-base-100/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-error/80">
                  24/7 critical incident line
                </p>
                <a
                  href="tel:+18006398737"
                  className="mt-1 block text-2xl font-bold tracking-wide text-error hover:underline"
                >
                  1-800-639-8737
                </a>
                <p className="mt-1 text-sm font-medium text-base-content/70">
                  Also dialable as 1-800-NEXUS-ER
                </p>
              </div>
              <a href="tel:+18006398737" className="btn btn-error">
                Call now
              </a>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-base-content/75">
              Use this number for true emergencies only — company-wide outages, suspected security
              breaches, ransomware, or critical systems that cannot wait for a normal support ticket.
              For routine issues, submit a support ticket in the portal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
