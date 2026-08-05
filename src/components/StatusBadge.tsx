import type { InvoiceStatus, SlaStatus, TicketStatus } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  New: "badge-info",
  Assigned: "badge-primary",
  "In Progress": "badge-primary",
  "Waiting on Customer": "badge-warning",
  "Waiting on Approval": "badge-warning",
  Completed: "badge-success",
  Closed: "badge-ghost",
  Draft: "badge-ghost",
  "Pending Approval": "badge-warning",
  Issued: "badge-info",
  "Partially Paid": "badge-warning",
  Paid: "badge-success",
  "Past Due": "badge-error",
  Disputed: "badge-error",
  Pending: "badge-warning",
  Approved: "badge-success",
  Included: "badge-ghost",
  Billable: "badge-info",
  "Not Billed": "badge-ghost",
  "Ready to Invoice": "badge-primary",
  Billed: "badge-success",
  Canceled: "badge-ghost",
  "On Track": "badge-success",
  "Approaching Deadline": "badge-warning",
  Overdue: "badge-error",
  "Completed on Time": "badge-success",
  "Completed Late": "badge-error",
  Healthy: "badge-success",
  Watch: "badge-warning",
  "At risk": "badge-error",
};

interface StatusBadgeProps {
  status: TicketStatus | InvoiceStatus | SlaStatus | string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const tone = STATUS_STYLES[status] ?? "badge-ghost";

  return (
    <span className={`badge badge-sm whitespace-nowrap ${tone} ${className}`.trim()}>
      {status}
    </span>
  );
}
