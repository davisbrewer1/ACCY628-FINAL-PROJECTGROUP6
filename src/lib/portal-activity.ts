import { isOpenTicket } from "@/lib/dashboard-stats";
import { toClientInvoiceStatus } from "@/lib/client-billing";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatTicketScheduleForClient } from "@/lib/ticket-live-status";
import type {
  Contract,
  HardwareAsset,
  Invoice,
  Payment,
  SecurityScore,
  ServiceTicket,
  Technician,
} from "@/lib/types";

export interface PortalUpdate {
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

/** Builds the client portal activity feed, newest first. */
export function buildRecentUpdates(
  input: {
    tickets: ServiceTicket[];
    technicians: Technician[];
    assets: HardwareAsset[];
    securityScore: SecurityScore | null;
    invoices: Invoice[];
    payments: Payment[];
    contracts: Contract[];
  },
  limit?: number,
): PortalUpdate[] {
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

    const scheduleLabel = formatTicketScheduleForClient(ticket);
    if (scheduleLabel && isOpenTicket(ticket.status)) {
      const techName = ticket.assigned_technician_id
        ? (techById.get(ticket.assigned_technician_id) ?? "A technician")
        : "A technician";
      updates.push({
        id: `ticket-scheduled-${ticket.id}`,
        title: "Support ticket added to technician schedule",
        detail: `${techName} scheduled ${ticket.ticket_number} for ${scheduleLabel}`,
        at: ticket.scheduled_start ?? ticket.opened_at ?? ticket.created_at,
        href: "/end-user/support",
      });
    }

    if (!isOpenTicket(ticket.status)) {
      updates.push({
        id: `ticket-closed-${ticket.id}`,
        title: "Support ticket completed",
        detail: `${ticket.ticket_number}: ${ticket.title} · ${ticket.status}`,
        at: ticket.completed_at ?? ticket.opened_at ?? ticket.created_at,
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
        title:
          clientStatus === "Partial"
            ? "Invoice partially paid"
            : "Invoice to be paid",
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

  const sorted = updates.sort((a, b) => toMillis(b.at) - toMillis(a.at));
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}
