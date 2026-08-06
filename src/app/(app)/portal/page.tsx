"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createPortalTicket } from "@/app/actions/tickets";
import { isOpenTicket, isThisMonth } from "@/lib/dashboard-stats";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { PortalContractLockBanner } from "@/components/PortalContractLockBanner";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ServiceDatePicker } from "@/components/tickets/ServiceDatePicker";
import { useToast } from "@/components/Toast";
import { contractsUnlockPortal } from "@/lib/customer-access";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type {
  AiPlatform,
  Contract,
  Customer,
  HardwareAsset,
  Invoice,
  Profile,
  SecurityScore,
  ServiceTicket,
  WorkEntry,
} from "@/lib/types";

function getAssetAlerts(asset: HardwareAsset): number {
  let count = 0;
  if (asset.warranty_expiring_soon) count++;
  if (asset.nearing_eol) count++;
  if (asset.needs_replacement) count++;
  if (asset.unsupported_os) count++;
  if (asset.missing_security_updates) count++;
  if (asset.device_status === "Offline") count++;
  return count;
}

export default function PortalPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [assets, setAssets] = useState<HardwareAsset[]>([]);
  const [platforms, setPlatforms] = useState<AiPlatform[]>([]);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [workEntries, setWorkEntries] = useState<WorkEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [securityScore, setSecurityScore] = useState<SecurityScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData(customerId: string) {
    const supabase = createClient();
    const [cust, co, hw, ai, t, w, i, sec] = await Promise.all([
      supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
      supabase
        .from("contracts")
        .select("*")
        .eq("customer_id", customerId)
        .order("contract_status"),
      supabase.from("hardware_assets").select("*").eq("customer_id", customerId),
      supabase.from("ai_platforms").select("*").eq("customer_id", customerId),
      supabase
        .from("service_tickets")
        .select("*")
        .eq("customer_id", customerId)
        .order("opened_at", { ascending: false }),
      supabase
        .from("work_entries")
        .select("*")
        .eq("customer_id", customerId)
        .order("work_date", { ascending: false }),
      supabase
        .from("invoices")
        .select("*")
        .eq("customer_id", customerId)
        .order("invoice_date", { ascending: false }),
      supabase
        .from("security_scores")
        .select("*")
        .eq("customer_id", customerId)
        .order("last_assessed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setCustomer(cust.data);
    setContracts(co.data ?? []);
    setAssets(hw.data ?? []);
    setPlatforms(ai.data ?? []);
    setTickets(t.data ?? []);
    setWorkEntries(w.data ?? []);
    setInvoices(i.data ?? []);
    setSecurityScore(sec.data);
    setLoading(false);
  }

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
        await loadData(profileData.customer_id);
      } else {
        setLoading(false);
      }
    }
    init();
  }, []);

  const activeContracts = contracts.filter((c) => c.contract_status === "Active");
  const activeContract = activeContracts[0];
  const portalLocked = !contractsUnlockPortal(contracts);

  const monthHours = useMemo(
    () =>
      workEntries
        .filter((e) => isThisMonth(e.work_date))
        .reduce((sum, e) => sum + (e.hours_worked ?? 0), 0),
    [workEntries],
  );

  const includedHours = activeContract?.included_support_hours ?? 0;
  const remainingHours = Math.max(0, includedHours - monthHours);
  const openTickets = tickets.filter((t) => isOpenTicket(t.status));
  const outstandingBalance = invoices.reduce(
    (sum, i) => sum + (i.remaining_balance ?? 0),
    0,
  );
  const assetsWithAlerts = assets.filter((a) => getAssetAlerts(a) > 0).length;
  const aiMonthlySpend = platforms.reduce(
    (sum, p) => sum + (p.monthly_subscription_cost ?? 0) + (p.monthly_api_cost ?? 0),
    0,
  );

  const healthScore =
    securityScore?.health_score ?? customer?.technology_health_score ?? null;

  function handleSupportRequest(formData: FormData) {
    if (!profile?.customer_id) return;
    if (profile.full_name) {
      formData.set("requester_name", profile.full_name);
    }
    setError(null);
    startTransition(async () => {
      const result = await createPortalTicket(formData, profile.customer_id!);
      if (result.success) {
        showToast(result.message);
        dialogRef.current?.close();
        await loadData(profile.customer_id!);
      } else {
        setError(result.message);
      }
    });
  }

  if (activeRole !== "client_admin" && activeRole !== "administrator") {
    return (
      <AlertBanner
        tone="info"
        title="Client admin portal"
        message="This portal is designed for client administrators. Use the Demo Role Switcher to preview this view."
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
        description="Your account is not linked to a customer organization. Contact Nexus Technology Solutions for access."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client admin portal"
        description={`${customer?.customer_name ?? "Your organization"} — contracts, assets, security health, and support.`}
        action={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={portalLocked}
            title={portalLocked ? "Requires an active service contract" : undefined}
            onClick={() => dialogRef.current?.showModal()}
          >
            <Plus className="size-4" />
            Support Request
          </button>
        }
      />

      <PortalContractLockBanner locked={portalLocked} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Technology health"
          value={healthScore ?? "—"}
          tone={
            healthScore == null
              ? "default"
              : healthScore >= 80
                ? "success"
                : healthScore >= 60
                  ? "warning"
                  : "danger"
          }
        />
        <StatCard title="Active contracts" value={activeContracts.length} />
        <StatCard title="Hardware assets" value={assets.length} tone="info" />
        <StatCard title="Assets with alerts" value={assetsWithAlerts} tone={assetsWithAlerts > 0 ? "warning" : "success"} />
        <StatCard
          title="Outstanding balance"
          value={formatCurrency(outstandingBalance)}
          tone={outstandingBalance > 0 ? "warning" : "success"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Open tickets" value={openTickets.length} tone="warning" />
        <StatCard title="AI platforms" value={platforms.length} />
        <StatCard title="AI monthly spend" value={formatCurrency(aiMonthlySpend)} />
      </div>

      {activeContracts.length > 0 ? (
        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Contracts</h2>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Contract</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Monthly fee</th>
                    <th>Included hours</th>
                    <th>Renewal</th>
                  </tr>
                </thead>
                <tbody>
                  {activeContracts.map((contract) => (
                    <tr key={contract.id}>
                      <td className="font-medium">{contract.contract_name}</td>
                      <td>{contract.service_plan_name ?? "—"}</td>
                      <td><StatusBadge status={contract.contract_status ?? "Unknown"} /></td>
                      <td>{formatCurrency(contract.monthly_recurring_fee)}</td>
                      <td>{contract.included_support_hours ?? "—"}</td>
                      <td>{formatDate(contract.renewal_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {activeContract ? (
              <div className="mt-4 grid gap-4 border-t border-base-300 pt-4 sm:grid-cols-3">
                <StatCard title="Used this month" value={monthHours.toFixed(1)} tone="info" />
                <StatCard
                  title="Remaining hours"
                  value={remainingHours.toFixed(1)}
                  tone={remainingHours <= 0 ? "warning" : "success"}
                />
                <StatCard title="Included hours" value={includedHours} />
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <EmptyState title="No active contracts" description="Your managed-services contracts will appear here." />
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Hardware assets ({assets.length})</h2>
            {assets.length === 0 ? (
              <EmptyState title="No assets" description="Registered hardware assets for your organization will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Type</th>
                      <th>Assigned</th>
                      <th>Status</th>
                      <th>Alerts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.slice(0, 8).map((asset) => (
                      <tr key={asset.id}>
                        <td>
                          <div className="font-mono text-xs">{asset.asset_number}</div>
                          <div className="text-xs">{asset.manufacturer} {asset.model}</div>
                        </td>
                        <td>{asset.category}</td>
                        <td>{asset.assigned_employee ?? "—"}</td>
                        <td><StatusBadge status={asset.device_status} /></td>
                        <td>
                          {getAssetAlerts(asset) > 0 ? (
                            <span className="badge badge-warning badge-sm">{getAssetAlerts(asset)}</span>
                          ) : (
                            <span className="text-xs text-base-content/50">None</span>
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
          <div className="card-body">
            <h2 className="card-title text-base">AI platforms ({platforms.length})</h2>
            {platforms.length === 0 ? (
              <EmptyState title="No AI platforms" description="Approved AI tools licensed to your organization will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Users</th>
                      <th>Utilization</th>
                      <th>Monthly cost</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platforms.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">{p.platform_name}</td>
                        <td>{p.active_users}/{p.licensed_users}</td>
                        <td>{p.utilization_pct != null ? formatPercent(p.utilization_pct) : "—"}</td>
                        <td>
                          {formatCurrency(
                            (p.monthly_subscription_cost ?? 0) + (p.monthly_api_cost ?? 0),
                          )}
                        </td>
                        <td><StatusBadge status={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {securityScore ? (
        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Security health details</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard title="Health score" value={securityScore.health_score} />
              <StatCard title="Endpoint coverage" value={formatPercent(securityScore.endpoint_coverage_pct)} />
              <StatCard title="Patch compliance" value={formatPercent(securityScore.patch_compliance_pct)} />
              <StatCard title="Encryption" value={formatPercent(securityScore.encryption_coverage_pct)} />
              <StatCard title="MFA adoption" value={formatPercent(securityScore.mfa_adoption_pct)} />
            </div>
            <p className="text-xs text-base-content/60">
              Last assessed {formatDate(securityScore.last_assessed_at)} · Firewall: {securityScore.firewall_status ?? "—"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Open support tickets ({openTickets.length})</h2>
            {openTickets.length === 0 ? (
              <EmptyState title="No open tickets" description="Your open support requests will appear here." />
            ) : (
              <div className="space-y-2">
                {openTickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-box border border-base-300 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{ticket.title}</p>
                        <p className="text-xs text-base-content/60">{ticket.ticket_number}</p>
                      </div>
                      <PriorityBadge priority={ticket.priority ?? "Medium"} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge status={ticket.status ?? "New"} />
                      {ticket.ai_involved ? (
                        <span className="badge badge-info badge-xs">AI</span>
                      ) : null}
                      {ticket.cybersecurity_incident ? (
                        <span className="badge badge-warning badge-xs">Security</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base">Recent invoices</h2>
            {invoices.length === 0 ? (
              <EmptyState title="No invoices" description="Invoice history will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.slice(0, 6).map((inv) => (
                      <tr key={inv.id}>
                        <td className="font-mono text-xs">{inv.invoice_number}</td>
                        <td>{formatDate(inv.invoice_date)}</td>
                        <td>{formatCurrency(inv.total_amount)}</td>
                        <td>{formatCurrency(inv.remaining_balance)}</td>
                        <td><StatusBadge status={inv.status ?? "Draft"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold">Submit Support Request</h3>
          {error ? <div className="alert alert-error mt-4 text-sm"><span>{error}</span></div> : null}
          <form action={handleSupportRequest} className="form-grid mt-4 grid gap-4">
            <FormField label="Title" htmlFor="title" required>
              <input id="title" name="title" className="input input-bordered w-full" required />
            </FormField>
            <FormField label="Description" htmlFor="description" required>
              <textarea id="description" name="description" className="textarea textarea-bordered w-full" rows={3} required />
            </FormField>
            <FormField label="Category" htmlFor="category">
              <input id="category" name="category" className="input input-bordered w-full" placeholder="Network, Email, Hardware, etc." />
            </FormField>
            <FormField label="Location" htmlFor="location">
              <input id="location" name="location" className="input input-bordered w-full" />
            </FormField>
            <div>
              <p className="mb-2 text-sm font-medium">
                When do you need service? <span className="text-error">*</span>
              </p>
              <ServiceDatePicker />
            </div>
            <FormField label="Preferred contact method" htmlFor="service_method">
              <select id="service_method" name="service_method" className="select select-bordered w-full" defaultValue="Email">
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
                <option value="Remote session">Remote session</option>
              </select>
            </FormField>
            <FormField label="Availability notes" htmlFor="availability_notes">
              <textarea id="availability_notes" name="availability_notes" className="textarea textarea-bordered w-full" rows={2} placeholder="Best times to reach you" />
            </FormField>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <span className="loading loading-spinner loading-sm" /> : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button type="submit">close</button></form>
      </dialog>
    </div>
  );
}
