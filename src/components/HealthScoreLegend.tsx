import Link from "next/link";
import { HEALTH_SCORE_LEGEND } from "@/lib/crm";
import { StatusBadge } from "@/components/StatusBadge";

export function HealthScoreLegend() {
  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-4">
      <h2 className="text-sm font-semibold tracking-wide text-base-content/80">
        How account health is scored
      </h2>
      <p className="mt-1 text-sm text-base-content/65">
        Labels come from four live signals. The counts and dollars behind each signal are what give the label meaning.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {HEALTH_SCORE_LEGEND.bands.map((band) => (
          <div
            key={band.label}
            className="rounded-lg border border-base-300 bg-base-200/40 p-3"
          >
            <StatusBadge status={band.label} />
            <p className="mt-2 text-sm text-base-content/75">{band.rule}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Source</th>
              <th>What we pull</th>
            </tr>
          </thead>
          <tbody>
            {HEALTH_SCORE_LEGEND.sources.map((source) => (
              <tr key={source.name}>
                <td>
                  <Link href={source.href} className="link link-hover font-medium">
                    {source.name}
                  </Link>
                </td>
                <td className="text-base-content/70">{source.pulls}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
