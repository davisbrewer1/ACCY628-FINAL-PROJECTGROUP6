"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { usePortalAccess } from "@/components/PortalAccessProvider";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { isOpenTicket } from "@/lib/dashboard-stats";
import { toClientInvoiceStatus } from "@/lib/client-billing";
import { formatCurrency, formatDate } from "@/lib/format";
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

interface PortalUpdate {
  id: string;
  title: string;
  detail: string;
  at: string;
  href: string;
}

function toMillis(value: string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function deviceName(asset: HardwareAsset): string {
  const parts = [asset.manufacturer, asset.model].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : asset.asset_number;
}

function buildRecentUpdates(input: {
  tickets: ServiceTicket[];
  technicians: Technician[];
  assets: HardwareAsset[];
  securityScore: SecurityScore | null;
  invoices: Invoice[];
  payments: Payment[];
  contracts: Contract[];
}): PortalUpdate[] {
  const {
    tickets,
    technicians,
    assets,
    securityScore,
    invoices,
    payments,
    contracts,
  } = input;
  const techById = new Map(
    technicians.map((tech) => [tech.id, tech.technician_name]),
  );
  const updates: PortalUpdate[] = [];

  for (const ticket of tickets) {
    if (isOpenTicket(ticket.status)) {
      updates.push({
        id: `ticket-created-${ticket.id}`,
        title: "Open support ticket created",
        detail: `${ticket.ticket_number}: ${ticket.title}`,
        at: ticket.opened_at ?? ticket.created_at,
        href: "/end-user/support",
      });
    }

    if (ticket.assigned_technician_id && isOpenTicket(ticket.status)) {
      const techName =
        techById.get(ticket.assigned_technician_id) ?? "A technician";
      updates.push({
        id: `ticket-assigned-${ticket.id}`,
        title: "Technician assigned",
        detail: `${techName} is assigned to ${ticket.ticket_number}`,
        at: ticket.responded_at ?? ticket.opened_at ?? ticket.created_at,
        href: "/end-user/support",
      });
    }
  }

  for (const asset of assets) {
    const lifecycle = (asset.lifecycle_stage ?? "").toLowerCase();
    const isDelivery =
      lifecycle.includes("deploy") ||
      lifecycle.includes("deliver") ||
      asset.device_status === "Deployed" ||
      asset.device_status === "In Transit";

    if (isDelivery) {
      updates.push({
        id: `delivery-${asset.id}`,
        title: "Device delivery / deployment",
        detail: `${deviceName(asset)} (${asset.asset_number}) — ${asset.device_status}`,
        at: asset.purchase_date ?? asset.created_at,
        href: `/end-user/devices/${asset.id}`,
      });
    }
  }

  if (securityScore?.last_assessed_at || securityScore?.firewall_status) {
    updates.push({
      id: `firewall-${securityScore.id}`,
      title: "Firewall / security posture updated",
      detail: `Firewall status: ${securityScore.firewall_status ?? "Reviewed"} · Health score ${securityScore.health_score}`,
      at: securityScore.last_assessed_at ?? securityScore.created_at,
      href: "/end-user/security-concern",
    });
  }

  for (const invoice of invoices) {
    const clientStatus = toClientInvoiceStatus(
      invoice.status,
      invoice.amount_paid,
      invoice.remaining_balance,
    );
    if (clientStatus === "Paid") {
      updates.push({
        id: `invoice-paid-${invoice.id}`,
        title: "Invoice paid",
        detail: `${invoice.invoice_number} · ${formatCurrency(invoice.total_amount)}`,
        at: invoice.invoice_date ?? invoice.created_at,
        href: `/end-user/billing/${invoice.id}`,
      });
    } else if (clientStatus === "Unpaid" || clientStatus === "Partial") {
      updates.push({
        id: `invoice-due-${invoice.id}`,
        title: clientStatus === "Partial" ? "Invoice partially paid" : "Invoice to be paid",
        detail: `${invoice.invoice_number} · Balance ${formatCurrency(invoice.remaining_balance)} · Due ${formatDate(invoice.due_date)}`,
        at: invoice.due_date ?? invoice.invoice_date ?? invoice.created_at,
        href: `/end-user/billing/${invoice.id}`,
      });
    }
  }

  for (const payment of payments) {
    updates.push({
      id: `payment-${payment.id}`,
      title: "Payment recorded",
      detail: `${formatCurrency(payment.payment_amount)}${payment.payment_method ? ` via ${payment.payment_method}` : ""}`,
      at: payment.payment_date ?? payment.created_at,
      href: "/end-user/billing",
    });
  }

  for (const contract of contracts) {
    if (contract.renewal_date) {
      updates.push({
        id: `maintenance-renewal-${contract.id}`,
        title: "Next maintenance / renewal scheduled",
        detail: `${contract.contract_name} renewal on ${formatDate(contract.renewal_date)}${contract.preventive_maintenance_frequency ? ` · PM: ${contract.preventive_maintenance_frequency}` : ""}`,
        at: contract.renewal_date,
        href: "/end-user/contracts",
      });
    } else if (contract.preventive_maintenance_frequency) {
      updates.push({
        id: `maintenance-freq-${contract.id}`,
        title: "Maintenance schedule on file",
        detail: `${contract.contract_name} · ${contract.preventive_maintenance_frequency}`,
        at: contract.start_date ?? contract.created_at,
        href: "/end-user/contracts",
      });
    }
  }

  return updates
    .sort((a, b) => toMillis(b.at) - toMillis(a.at))
    .slice(0, 8);
}

export default function EndUserPage() {
  const { activeRole } = useDemoRole();
  const { locked: portalLocked } = usePortalAccess();
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

  const recentUpdates = useMemo(
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
        description={`Welcome${profile.full_name ? `, ${profile.full_name}` : ""}. See announcements and recent account updates at a glance.`}
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
                    <span className="shrink-0 text-xs text-base-content/60">
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
          <h2 className="card-title text-base">Recent updates</h2>
          {recentUpdates.length === 0 ? (
            <EmptyState
              title="No recent updates yet"
              description="Ticket activity, deliveries, security updates, invoices, and maintenance dates will show here."
            />
          ) : (
            <div className="space-y-3">
              {recentUpdates.map((update) => (
                <Link
                  key={update.id}
                  href={update.href}
                  className="block rounded-box border border-base-300 p-3 transition hover:bg-base-200/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{update.title}</p>
                    <span className="shrink-0 text-xs text-base-content/60">
                      {formatDate(update.at)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-base-content/80">{update.detail}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h2 className="card-title text-base">Need help?</h2>
          <p className="text-sm text-base-content/70">
            Open the menu for support tickets, devices, billing, contracts, and settings.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/end-user/support"
              className={`btn btn-primary btn-sm ${portalLocked ? "btn-disabled" : ""}`}
              aria-disabled={portalLocked}
              onClick={(event) => {
                if (portalLocked) event.preventDefault();
              }}
            >
              Support Tickets
            </Link>
            <Link
              href="/end-user/devices"
              className={`btn btn-outline btn-sm ${portalLocked ? "btn-disabled" : ""}`}
              aria-disabled={portalLocked}
              onClick={(event) => {
                if (portalLocked) event.preventDefault();
              }}
            >
              My Devices
            </Link>
            <Link
              href="/end-user/billing"
              className={`btn btn-outline btn-sm ${portalLocked ? "btn-disabled" : ""}`}
              aria-disabled={portalLocked}
              onClick={(event) => {
                if (portalLocked) event.preventDefault();
              }}
            >
              Billing
            </Link>
            <Link
              href="/end-user/contracts"
              className={`btn btn-outline btn-sm ${portalLocked ? "btn-disabled" : ""}`}
              aria-disabled={portalLocked}
              onClick={(event) => {
                if (portalLocked) event.preventDefault();
              }}
            >
              My Contracts
            </Link>
          </div>
        </div>
      </div>

      <div className="card border border-error/30 bg-base-100 shadow-sm">
        <div className="card-body gap-3">
          <h2 className="card-title text-base text-error">Emergency support hotline</h2>
          <div className="rounded-box border border-base-300 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-medium">24/7 emergency line (demo)</p>
              <a href="tel:+18006398737" className="link link-hover shrink-0 font-semibold text-error">
                1-800-NEXUS-ER
              </a>
            </div>
            <p className="mt-2 text-sm text-base-content/80">
              Use this number only for true emergencies — for example, a company-wide outage,
              suspected security breach, ransomware, or a critical system that cannot wait for a
              normal support ticket. For routine issues, submit a support ticket instead.
            </p>
            <p className="mt-2 text-xs text-base-content/60">
              Demo number for this project: 1-800-639-8737
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
