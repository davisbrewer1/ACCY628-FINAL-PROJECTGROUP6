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
}

export function StatCard({ title, value, hint, tone = "default" }: StatCardProps) {
  return (
    <div className={`card border bg-base-100 shadow-sm ${TONE_CLASSES[tone]}`}>
      <div className="card-body gap-1 p-4">
        <p className="text-sm font-medium text-base-content/70">{title}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="text-xs text-base-content/60">{hint}</p> : null}
      </div>
    </div>
  );
}
