import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type PortalZoneAccent = "navy" | "teal" | "royal" | "azure" | "mint";

export const PORTAL_ZONE_ACCENTS: Record<
  PortalZoneAccent,
  {
    panel: string;
    border: string;
    eyebrow: string;
    iconWrap: string;
    chip: string;
    nav: string;
  }
> = {
  navy: {
    panel: "border-[rgba(11,18,32,0.14)] bg-[rgba(11,18,32,0.04)]",
    border: "border-l-[#0B1220]",
    eyebrow: "text-[#1e3a8a]",
    iconWrap: "bg-[rgba(11,18,32,0.1)] text-[#0B1220]",
    chip: "bg-[rgba(11,18,32,0.1)] text-[#0B1220]",
    nav: "border-[rgba(11,18,32,0.2)] bg-[rgba(11,18,32,0.05)] text-[#0B1220] hover:bg-[rgba(11,18,32,0.1)]",
  },
  teal: {
    panel: "border-[rgba(45,212,191,0.28)] bg-[rgba(45,212,191,0.07)]",
    border: "border-l-[#0d9488]",
    eyebrow: "text-[#0f766e]",
    iconWrap: "bg-[rgba(45,212,191,0.16)] text-[#0f766e]",
    chip: "bg-[rgba(45,212,191,0.16)] text-[#0f766e]",
    nav: "border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.1)] text-[#0f766e] hover:bg-[rgba(45,212,191,0.18)]",
  },
  royal: {
    panel: "border-[rgba(37,99,235,0.22)] bg-[rgba(37,99,235,0.06)]",
    border: "border-l-[#1d4ed8]",
    eyebrow: "text-[#1d4ed8]",
    iconWrap: "bg-[rgba(37,99,235,0.12)] text-[#1d4ed8]",
    chip: "bg-[rgba(37,99,235,0.12)] text-[#1d4ed8]",
    nav: "border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.08)] text-[#1d4ed8] hover:bg-[rgba(37,99,235,0.14)]",
  },
  azure: {
    panel: "border-[rgba(30,58,138,0.2)] bg-[rgba(30,58,138,0.05)]",
    border: "border-l-[#1e40af]",
    eyebrow: "text-[#1e40af]",
    iconWrap: "bg-[rgba(30,58,138,0.1)] text-[#1e40af]",
    chip: "bg-[rgba(30,58,138,0.1)] text-[#1e40af]",
    nav: "border-[rgba(30,58,138,0.2)] bg-[rgba(30,58,138,0.06)] text-[#1e40af] hover:bg-[rgba(30,58,138,0.12)]",
  },
  mint: {
    panel: "border-[rgba(94,234,212,0.35)] bg-[rgba(94,234,212,0.09)]",
    border: "border-l-[#14b8a6]",
    eyebrow: "text-[#0f766e]",
    iconWrap: "bg-[rgba(94,234,212,0.22)] text-[#0f766e]",
    chip: "bg-[rgba(94,234,212,0.22)] text-[#0f766e]",
    nav: "border-[rgba(94,234,212,0.35)] bg-[rgba(94,234,212,0.12)] text-[#0f766e] hover:bg-[rgba(94,234,212,0.2)]",
  },
};

export function PortalMetricStrip({
  items,
  ariaLabel = "Key metrics",
}: {
  items: Array<{
    label: string;
    value: string | number;
    accent?: PortalZoneAccent;
    href?: string;
  }>;
  ariaLabel?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="sticky top-16 z-10 -mx-1 flex flex-wrap gap-2 rounded-box border border-[rgba(11,18,32,0.1)] bg-base-100/90 p-2 shadow-sm backdrop-blur"
    >
      {items.map((item) => {
        const accent = item.accent ?? "navy";
        const styles = PORTAL_ZONE_ACCENTS[accent];
        const inner = (
          <>
            <span>{item.label}</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${styles.chip}`}
            >
              {item.value}
            </span>
          </>
        );
        const className = `inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${styles.nav}`;
        if (item.href) {
          return (
            <a key={item.label} href={item.href} className={className}>
              {inner}
            </a>
          );
        }
        return (
          <div key={item.label} className={className}>
            {inner}
          </div>
        );
      })}
    </nav>
  );
}

export function PortalZone({
  id,
  eyebrow,
  title,
  summary,
  accent,
  icon: Icon,
  count,
  countLabel,
  children,
  className = "",
}: {
  id?: string;
  eyebrow: string;
  title: string;
  summary?: string;
  accent: PortalZoneAccent;
  icon: LucideIcon;
  count?: string | number;
  countLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  const styles = PORTAL_ZONE_ACCENTS[accent];
  return (
    <section
      id={id}
      className={`scroll-mt-28 rounded-box border border-l-4 p-4 shadow-sm sm:p-5 ${styles.panel} ${styles.border} ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-current/10 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg ${styles.iconWrap}`}
          >
            <Icon className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 max-w-3xl">
            <p
              className={`text-xs font-semibold uppercase tracking-[0.14em] ${styles.eyebrow}`}
            >
              {eyebrow}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-base-content">
              {title}
            </h2>
            {summary ? (
              <p className="mt-1 text-sm leading-relaxed text-base-content/65">
                {summary}
              </p>
            ) : null}
          </div>
        </div>
        {count != null && countLabel ? (
          <div
            className={`rounded-lg px-3 py-2 text-right ${styles.chip}`}
            aria-label={`${count} ${countLabel}`}
          >
            <p className="text-lg font-semibold leading-none">{count}</p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide opacity-80">
              {countLabel}
            </p>
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
