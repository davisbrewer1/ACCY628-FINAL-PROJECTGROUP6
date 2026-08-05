"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardCheck, Paperclip, X } from "lucide-react";
import { useApprovalWorkflow } from "@/hooks/useApprovalWorkflow";
import { useToast } from "@/components/Toast";
import { formatCurrency } from "@/lib/format";

interface ApprovalRequestButtonProps {
  ticketId?: string;
  technicianId?: string;
  costEntryId?: string | null;
  workEntryId?: string | null;
  totalCost?: number;
  approvalRequired?: boolean;
  autoOpen?: boolean;
  disabled?: boolean;
  onSubmitted?: () => void;
}

export function ApprovalRequestButton({
  ticketId,
  technicianId,
  costEntryId,
  workEntryId,
  totalCost,
  approvalRequired = false,
  autoOpen = false,
  disabled = false,
  onSubmitted,
}: ApprovalRequestButtonProps) {
  const { showToast } = useToast();
  const { requestApproval, submitting, approvals, refresh } =
    useApprovalWorkflow({
      technicianId,
      autoLoadPending: Boolean(technicianId),
    });

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const promptedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingPending = approvals.find(
    (item) =>
      item.status === "Pending" &&
      item.ticket_id === ticketId &&
      (!costEntryId || item.cost_entry_id === costEntryId),
  );

  useEffect(() => {
    if (technicianId) {
      void refresh();
    }
  }, [technicianId, refresh]);

  useEffect(() => {
    if (
      autoOpen &&
      approvalRequired &&
      !promptedRef.current &&
      !existingPending &&
      ticketId &&
      technicianId
    ) {
      promptedRef.current = true;
      setOpen(true);
    }
  }, [
    autoOpen,
    approvalRequired,
    existingPending,
    ticketId,
    technicianId,
  ]);

  async function handleSubmit() {
    if (!ticketId || !technicianId) {
      showToast("Select a ticket and technician first.", "error");
      return;
    }

    const result = await requestApproval({
      ticketId,
      technicianId,
      costEntryId,
      workEntryId,
      reason,
      totalCost,
      files,
    });

    if (!result.success) {
      showToast(result.message, "error");
      return;
    }

    showToast(result.message);
    setOpen(false);
    setReason("");
    setFiles([]);
    onSubmitted?.();
  }

  return (
    <>
      <button
        type="button"
        className={`btn btn-sm gap-2 ${
          approvalRequired || existingPending ? "btn-warning" : "btn-outline"
        }`}
        disabled={disabled || !ticketId || !technicianId || Boolean(existingPending)}
        onClick={() => setOpen(true)}
      >
        <ClipboardCheck className="size-4" aria-hidden="true" />
        {existingPending ? "Approval Pending" : "Request Approval"}
      </button>

      {existingPending ? (
        <span className="badge badge-warning badge-sm">Pending</span>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-base-content/40"
            aria-label="Close approval request"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-box border border-base-300 bg-base-100 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Request approval</h3>
                <p className="text-sm text-base-content/60">
                  Explain why this billable work needs manager approval.
                  {totalCost != null ? (
                    <>
                      {" "}
                      Estimated total:{" "}
                      <span className="font-medium text-base-content">
                        {formatCurrency(totalCost)}
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                onClick={() => setOpen(false)}
              >
                <X className="size-4" />
              </button>
            </div>

            <label className="form-control w-full">
              <span className="mb-1 text-xs font-medium">Reason</span>
              <textarea
                className="textarea textarea-bordered min-h-28 w-full"
                placeholder="Why is this approval needed?"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>

            <div className="mt-3">
              <button
                type="button"
                className="btn btn-ghost btn-sm gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-4" />
                Attach photos or documents
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={(event) => {
                  const next = Array.from(event.target.files ?? []);
                  setFiles((current) => [...current, ...next]);
                  event.target.value = "";
                }}
              />
              {files.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-base-content/70">
                  {files.map((file) => (
                    <li key={`${file.name}-${file.size}`} className="flex justify-between gap-2">
                      <span className="truncate">{file.name}</span>
                      <button
                        type="button"
                        className="link"
                        onClick={() =>
                          setFiles((current) =>
                            current.filter((item) => item !== file),
                          )
                        }
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={submitting || !reason.trim()}
                onClick={() => void handleSubmit()}
              >
                {submitting ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
