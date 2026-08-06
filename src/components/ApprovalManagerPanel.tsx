"use client";

import { useMemo, useState } from "react";
import { Check, ShieldAlert, X } from "lucide-react";
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Approval, ServiceTicket, Technician } from "@/lib/types";

interface ApprovalManagerPanelProps {
  tickets?: ServiceTicket[];
  technicians?: Technician[];
}

export function ApprovalManagerPanel({
  tickets = [],
  technicians = [],
}: ApprovalManagerPanelProps) {
  const { showToast } = useToast();
  const {
    pendingApprovals,
    approvals,
    loading,
    submitting,
    unavailable,
    refresh,
    respondToApproval,
  } = useApprovalWorkflow({ autoLoadPending: true });

  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);

  const ticketMap = useMemo(
    () => new Map(tickets.map((ticket) => [ticket.id, ticket])),
    [tickets],
  );
  const techMap = useMemo(
    () => new Map(technicians.map((tech) => [tech.id, tech.technician_name])),
    [technicians],
  );

  const rows: Approval[] = showAll ? approvals : pendingApprovals;

  async function handleDecision(
    approvalId: string,
    decision: "Approved" | "Denied",
  ) {
    const result = await respondToApproval({
      approvalId,
      decision,
      managerNotes: notesById[approvalId],
    });

    if (result.success) {
      showToast(result.message);
      setNotesById((current) => {
        const next = { ...current };
        delete next[approvalId];
        return next;
      });
    } else {
      showToast(result.message, "error");
    }
  }

  return (
    <div className="card border bg-base-100 shadow-sm">
      <div className="card-body gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="card-title text-base">
              <ShieldAlert className="size-4" aria-hidden="true" />
              Billable expense approvals
            </h2>
            <p className="text-sm text-base-content/60">
              Approve Expense Tracker items marked Billable to Customer before
              they can be invoiced. Deny returns them to internal (not billed).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn btn-sm ${showAll ? "btn-ghost" : "btn-primary"}`}
              onClick={() => setShowAll(false)}
            >
              Pending ({pendingApprovals.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${showAll ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setShowAll(true)}
            >
              All
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void refresh()}
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : unavailable ? (
          <div className="rounded-box border border-base-300 px-4 py-8 text-center text-sm text-base-content/60">
            Approvals are unavailable until the{" "}
            <code className="text-xs">approvals</code> table is migrated in
            Supabase.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-box border border-dashed border-base-300 px-4 py-8 text-center text-sm text-base-content/60">
            {showAll ? "No approval requests yet." : "No pending approvals."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Ticket</th>
                  <th>Technician</th>
                  <th>Type</th>
                  <th>Cost</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Manager notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((approval) => {
                  const ticket = approval.ticket_id
                    ? ticketMap.get(approval.ticket_id)
                    : null;
                  const isPending = approval.status === "Pending";
                  return (
                    <tr key={approval.id}>
                      <td className="whitespace-nowrap text-xs">
                        {formatDateTime(approval.created_at)}
                      </td>
                      <td>
                        <div className="font-mono text-xs">
                          {ticket?.ticket_number ?? "—"}
                        </div>
                        <div className="max-w-[12rem] truncate text-xs text-base-content/60">
                          {ticket?.title ?? approval.ticket_id}
                        </div>
                      </td>
                      <td>
                        {approval.technician_id
                          ? techMap.get(approval.technician_id) ?? "Technician"
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {approval.ticket_expense_id
                          ? "Billable expense"
                          : approval.work_entry_id
                            ? "Work entry"
                            : approval.cost_entry_id
                              ? "Cost entry"
                              : "Request"}
                      </td>
                      <td>{formatCurrency(approval.total_cost)}</td>
                      <td className="max-w-[16rem] text-sm">
                        {approval.reason ?? "—"}
                      </td>
                      <td>
                        <StatusBadge status={approval.status} />
                      </td>
                      <td className="min-w-[12rem]">
                        {isPending ? (
                          <textarea
                            className="textarea textarea-bordered textarea-xs min-h-16 w-full"
                            placeholder="Add manager notes…"
                            value={notesById[approval.id] ?? ""}
                            onChange={(event) =>
                              setNotesById((current) => ({
                                ...current,
                                [approval.id]: event.target.value,
                              }))
                            }
                          />
                        ) : (
                          <span className="text-xs text-base-content/70">
                            {approval.manager_notes ?? "—"}
                          </span>
                        )}
                      </td>
                      <td>
                        {isPending ? (
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              className="btn btn-success btn-xs gap-1"
                              disabled={submitting}
                              onClick={() =>
                                void handleDecision(approval.id, "Approved")
                              }
                            >
                              <Check className="size-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-error btn-xs gap-1"
                              disabled={submitting}
                              onClick={() =>
                                void handleDecision(approval.id, "Denied")
                              }
                            >
                              <X className="size-3.5" />
                              Deny
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-base-content/50">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
