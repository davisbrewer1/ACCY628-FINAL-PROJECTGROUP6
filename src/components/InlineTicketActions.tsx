import { useEffect, useRef, useState } from "react";
import {
  addQuickHours,
  addWorkNote,
  flagTicketConcern,
  markTicketComplete,
  updateInlineTicketStatus,
  uploadTicketPhoto,
} from "@/app/actions/inline-ticket-actions";
import { useToast } from "@/components/Toast";
import {
  CheckCircle2,
  Clock3,
  Paperclip,
  Pencil,
  ShieldAlert,
} from "lucide-react";

const STATUS_OPTIONS = [
  "Assigned",
  "In Progress",
  "On Hold",
  "Waiting on Customer",
  "Waiting on Vendor",
  "Completed",
] as const;

export interface InlineTicketActionsProps {
  ticketId: string;
  currentStatus: string;
  technicianId: string;
  customerId: string;
  contractId?: string | null;
  cybersecurityIncident?: boolean | null;
  onUpdated?: () => void | Promise<void>;
  onLogWork?: () => void;
}

export function InlineTicketActions({
  ticketId,
  currentStatus,
  technicianId,
  customerId,
  contractId,
  cybersecurityIncident,
  onUpdated,
  onLogWork,
}: InlineTicketActionsProps) {
  const { showToast } = useToast();
  const [status, setStatus] = useState(currentStatus);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [securityFlagged, setSecurityFlagged] = useState(
    Boolean(cybersecurityIncident),
  );
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [showHours, setShowHours] = useState(false);
  const [hours, setHours] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  useEffect(() => {
    setSecurityFlagged(Boolean(cybersecurityIncident));
  }, [cybersecurityIncident]);

  async function refresh() {
    await onUpdated?.();
  }

  function runAction(
    actionKey: string,
    action: () => Promise<{ success: boolean; message: string }>,
  ) {
    setBusyAction(actionKey);
    void (async () => {
      const result = await action();
      setBusyAction(null);
      if (result.success) {
        showToast(result.message);
        await refresh();
      } else {
        showToast(result.message, "error");
      }
    })();
  }

  function handleStatusChange(nextStatus: string) {
    const previous = status;
    setStatus(nextStatus);
    runAction("status", async () => {
      const result = await updateInlineTicketStatus(ticketId, nextStatus);
      if (!result.success) {
        setStatus(previous);
      }
      return result;
    });
  }

  function handleAddNote() {
    runAction("note", async () => {
      const result = await addWorkNote(ticketId, technicianId, note);
      if (result.success) {
        setNote("");
        setShowNote(false);
      }
      return result;
    });
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const formData = new FormData();
    formData.set("ticket_id", ticketId);
    formData.set("technician_id", technicianId);
    formData.set("file", file);

    runAction("photo", () => uploadTicketPhoto(formData));
  }

  function handleAddHours() {
    const parsed = Number(hours);
    runAction("hours", async () => {
      const result = await addQuickHours({
        ticketId,
        technicianId,
        customerId,
        contractId,
        hours: parsed,
      });
      if (result.success) {
        setHours("");
        setShowHours(false);
      }
      return result;
    });
  }

  function handleFlag() {
    const nextEnabled = !securityFlagged;

    runAction("security", async () => {
      const result = await flagTicketConcern({
        ticketId,
        technicianId,
        flagType: "security",
        enabled: nextEnabled,
      });
      if (result.success) {
        setSecurityFlagged(nextEnabled);
      }
      return result;
    });
  }

  function handleComplete() {
    const isComplete = status === "Completed";
    runAction("complete", async () => {
      const result = await markTicketComplete(ticketId, {
        complete: !isComplete,
      });
      if (result.success) {
        setStatus(isComplete ? "In Progress" : "Completed");
      }
      return result;
    });
  }

  const disabled = busyAction != null;

  return (
    <div className="mt-3 space-y-2 border-t border-base-300 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <select
            className="select select-bordered select-xs min-w-[9.5rem]"
            value={status}
            disabled={disabled}
            aria-label="Ticket status"
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            {!STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number]) ? (
              <option value={status}>{status}</option>
            ) : null}
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {busyAction === "status" ? (
            <span className="loading loading-spinner loading-xs text-primary" />
          ) : null}
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-xs"
          disabled={disabled}
          onClick={() => {
            setShowNote((open) => !open);
            setShowHours(false);
          }}
          title="Add Note"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          Add Note
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-xs"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          title="Upload Photo"
        >
          {busyAction === "photo" ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Paperclip className="size-3.5" aria-hidden="true" />
          )}
          Upload Photo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoChange}
        />

        <button
          type="button"
          className="btn btn-ghost btn-xs"
          disabled={disabled}
          onClick={() => {
            setShowHours((open) => !open);
            setShowNote(false);
          }}
          title="Add Hours"
        >
          <Clock3 className="size-3.5" aria-hidden="true" />
          Add Hours
        </button>

        <button
          type="button"
          className={`btn btn-xs ${securityFlagged ? "btn-warning" : "btn-outline"}`}
          disabled={disabled}
          onClick={() => handleFlag()}
          title={securityFlagged ? "Clear Security Concern" : "Security Concern"}
          aria-pressed={securityFlagged}
        >
          {busyAction === "security" ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <ShieldAlert className="size-3.5" aria-hidden="true" />
          )}
          Security
        </button>

        <button
          type="button"
          className={`btn btn-xs ${status === "Completed" ? "btn-success" : "btn-outline btn-success"}`}
          disabled={disabled}
          onClick={handleComplete}
          title={status === "Completed" ? "Reopen ticket" : "Mark Complete"}
          aria-pressed={status === "Completed"}
        >
          {busyAction === "complete" ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
          )}
          {status === "Completed" ? "Completed" : "Complete"}
        </button>

        {onLogWork ? (
          <button
            type="button"
            className="btn btn-outline btn-xs"
            disabled={disabled}
            onClick={onLogWork}
          >
            Full log
          </button>
        ) : null}
      </div>

      {showNote ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            className="input input-bordered input-xs min-w-[12rem] flex-1"
            placeholder="Quick work note…"
            value={note}
            disabled={disabled}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddNote();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-primary btn-xs"
            disabled={disabled || !note.trim()}
            onClick={handleAddNote}
          >
            {busyAction === "note" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "Submit"
            )}
          </button>
        </div>
      ) : null}

      {showHours ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min="0.25"
            step="0.25"
            className="input input-bordered input-xs w-28"
            placeholder="Hours"
            value={hours}
            disabled={disabled}
            onChange={(e) => setHours(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddHours();
              }
            }}
          />
          <button
            type="button"
            className="btn btn-primary btn-xs"
            disabled={disabled || !hours || Number(hours) <= 0}
            onClick={handleAddHours}
          >
            {busyAction === "hours" ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              "Save hours"
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
