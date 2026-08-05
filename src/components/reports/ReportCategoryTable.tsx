"use client";

import {
  REPORT_CATEGORIES,
  type ReportCategoryId,
} from "@/components/reports/registry";

const BLUE_SHADES = ["#1e3a8a", "#2563eb", "#3b82f6"] as const;

interface ReportCategoryTableProps {
  selectedReportId: string | null;
  onSelectReport: (categoryId: ReportCategoryId, reportId: string | null) => void;
}

export function ReportCategoryTable({
  selectedReportId,
  onSelectReport,
}: ReportCategoryTableProps) {
  return (
    <nav aria-label="Report categories" className="w-full">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {REPORT_CATEGORIES.map((category, index) => {
          const bg = BLUE_SHADES[index % BLUE_SHADES.length];
          const categoryReportIds = new Set(category.reports.map((r) => r.id));
          const value =
            selectedReportId && categoryReportIds.has(selectedReportId)
              ? selectedReportId
              : "";

          return (
            <div
              key={category.id}
              className="flex min-h-20 flex-col gap-2 rounded-box px-3 py-3 shadow-sm"
              style={{ backgroundColor: bg }}
            >
              <p className="text-sm font-semibold leading-tight text-white">
                {category.title}
              </p>
              <select
                className="select select-sm w-full border-white/40 bg-white/15 text-white focus:border-white focus:outline-none [&>option]:bg-base-100 [&>option]:text-base-content"
                value={value}
                aria-label={`${category.title} reports`}
                onChange={(event) => {
                  const next = event.target.value;
                  onSelectReport(category.id, next === "" ? null : next);
                }}
              >
                <option value="">Select a report…</option>
                {category.reports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.featured ? `★ ${report.title}` : report.title}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
