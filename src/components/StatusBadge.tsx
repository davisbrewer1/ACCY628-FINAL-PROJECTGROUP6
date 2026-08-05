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
  Partial: "badge-warning",
  Unpaid: "badge-warning",
  Paid: "badge-success",
  "Past Due": "badge-error",
  Disputed: "badge-error",
  Canceled: "badge-ghost",
  "On Track": "badge-success",
  "Approaching Deadline": "badge-warning",
  Overdue: "badge-error",
  "Completed on Time": "badge-success",
  "Completed Late": "badge-error",
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
