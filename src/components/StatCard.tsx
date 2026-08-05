import Link from "next/link";

type StatTone = "default" | "success" | "warning" | "danger" | "info";

const TONE_CLASSES: Record<StatTone, string> = {
  default: "border-base-300",
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  danger: "border-error/30 bg-error/5",
  info: "border-info/30 bg-info/5",
};

interface StatCardProps {
  title: string;
  value: string | number;
  hint?: string;
  tone?: StatTone;
  href?: string;
}

export function StatCard({
  title,
  value,
  hint,
  tone = "default",
  href,
}: StatCardProps) {
  const body = (
    <div className={`card border bg-base-100 shadow-sm ${TONE_CLASSES[tone]} ${href ? "transition hover:border-primary/40 hover:shadow-md" : ""}`}>
      <div className="card-body gap-1 p-4">
        <p className="text-sm font-medium text-base-content/70">{title}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="text-xs text-base-content/60">{hint}</p> : null}
        {href ? (
          <p className="mt-1 text-xs font-medium text-primary">View details →</p>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {body}
      </Link>
    );
  }

  return body;
}
