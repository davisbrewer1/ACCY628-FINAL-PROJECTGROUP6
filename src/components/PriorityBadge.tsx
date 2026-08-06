import type { TicketPriority } from "@/lib/types";

const PRIORITY_STYLES: Record<TicketPriority, string> = {
  Critical: "border-0 bg-[#ef4444] text-white",
  High: "border-0 bg-[#ea580c] text-white",
  Medium: "border-0 bg-[#eab308] text-[#422006]",
  Low: "border-0 bg-teal-500 text-[#0B1220]",
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
