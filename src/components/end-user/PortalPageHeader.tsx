import type { ReactNode } from "react";

interface PortalPageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: string;
}

/** Soft hero-style page header used across client portal tabs. */
export function PortalPageHeader({
  title,
  description,
  action,
  eyebrow = "Client Portal",
}: PortalPageHeaderProps) {
  return (
    <section className="relative overflow-hidden rounded-box border border-primary/20 bg-gradient-to-br from-primary/15 via-base-100 to-base-200/55 shadow-sm">
      <div className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-primary/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 left-8 h-28 w-28 rounded-full bg-sky-400/10 blur-2xl" />
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-base-content sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-base-content/70 sm:text-[15px]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}
