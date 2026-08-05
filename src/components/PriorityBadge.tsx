import type { TicketPriority } from "@/lib/types";

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  Critical: "badge-error",
  High: "badge-warning",
  Medium: "badge-info",
  Low: "badge-ghost",
};

interface PriorityBadgeProps {
  priority: TicketPriority | string;
  className?: string;
}

export function PriorityBadge({ priority, className = "" }: PriorityBadgeProps) {
  const tone =
    PRIORITY_STYLES[priority as TicketPriority] ?? "badge-ghost";

  return (
    <span className={`badge badge-sm whitespace-nowrap ${tone} ${className}`.trim()}>
      {priority}
    </span>
  );
}
