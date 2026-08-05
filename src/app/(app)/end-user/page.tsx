"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createPortalTicket } from "@/app/actions/tickets";
import { isOpenTicket } from "@/lib/dashboard-stats";
import { AlertBanner } from "@/components/AlertBanner";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { useDemoRole } from "@/components/providers/DemoRoleProvider";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Announcement, Profile, ServiceTicket } from "@/lib/types";

type RequestType = "support" | "ai" | "security";

export default function EndUserPage() {
  const { activeRole } = useDemoRole();
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [requestType, setRequestType] = useState<RequestType>("support");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function loadData(customerId: string) {
    const supabase = createClient();
    const [t, a] = await Promise.all([
      supabase
        .from("service_tickets")
        .select("*")
        .eq("customer_id", customerId)
        .order("opened_at", { ascending: false }),
      supabase
        .from("announcements")
        .select("*")
        .eq("active", true)
        .or(`customer_id.eq.${customerId},customer_id.is.null`)
        .order("published_at", { ascending: false }),
    ]);
    setTickets(t.data ?? []);
    setAnnouncements(a.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      setProfile(profileData);

      if (profileData?.customer_id) {
        await loadData(profileData.customer_id);
      } else {
        setLoading(false);
      }
    }
    init();
  }, []);

  const myTickets = useMemo(() => {
    if (!profile?.full_name && !profile?.email) return tickets;
    return tickets;
  }, [tickets, profile]);

  const openTickets = myTickets.filter((t) => isOpenTicket(t.status));

  function openDialog(type: RequestType) {
    setRequestType(type);
    dialogRef.current?.showModal();
  }

  function handleSubmit(formData: FormData) {
    if (!profile?.customer_id) return;
    formData.set("request_type", requestType);
    if (profile.full_name) {
      formData.set("requester_name", profile.full_name);
    }
    setError(null);
    startTransition(async () => {
      const result = await createPortalTicket(formData, profile.customer_id!);
      if (result.success) {
        showToast(result.message);
        dialogRef.current?.close();
        await loadData(profile.customer_id!);
      } else {
        setError(result.message);
      }
    });
  }

  const dialogTitle =
    requestType === "ai"
      ? "Report AI Issue"
      : requestType === "security"
        ? "Report Security Concern"
        : "Submit Support Ticket";

  if (activeRole !== "client_user" && activeRole !== "administrator") {
    return (
      <AlertBanner
        tone="info"
        title="End user portal"
        message="This portal is designed for client end users. Use the Demo Role Switcher to preview this view."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!profile?.customer_id) {
    return (
      <EmptyState
        title="No organization linked"
        description="Your account is not linked to a customer organization. Contact your IT administrator."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="End user portal"
        description={`Welcome${profile.full_name ? `, ${profile.full_name}` : ""}. Submit requests and view your support activity.`}
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openDialog("support")}>
              <Plus className="size-4" />
              Support Ticket
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => openDialog("ai")}>
              AI Issue
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => openDialog("security")}>
              Security Concern
            </button>
          </div>
        }
      />

      {announcements.length > 0 ? (
        <div className="card border bg-base-100 shadow-sm">
          <div className="card-body gap-3">
            <h2 className="card-title text-base">Announcements</h2>
            <div className="space-y-3">
              {announcements.map((item) => (
                <div key={item.id} className="rounded-box border border-base-300 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{item.title}</p>
                    <span className="text-xs text-base-content/60">{formatDate(item.published_at)}</span>
                  </div>
                  <p className="mt-2 text-sm text-base-content/80">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState title="No announcements" description="Company announcements from your IT team will appear here." />
      )}

      <div className="card border bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-base">My tickets ({openTickets.length} open)</h2>
          {myTickets.length === 0 ? (
            <EmptyState
              title="No tickets yet"
              description="Submit a support request, AI issue, or security concern to get started."
              action={
                <button type="button" className="btn btn-primary" onClick={() => openDialog("support")}>
                  Submit Ticket
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Ticket #</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {myTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="font-mono text-sm">{ticket.ticket_number}</td>
                      <td className="font-medium">{ticket.title}</td>
                      <td>
                        <div>{ticket.category ?? "—"}</div>
                        <div className="flex gap-1">
                          {ticket.ai_involved ? (
                            <span className="badge badge-info badge-xs">AI</span>
                          ) : null}
                          {ticket.cybersecurity_incident ? (
                            <span className="badge badge-warning badge-xs">Security</span>
                          ) : null}
                        </div>
                      </td>
                      <td><PriorityBadge priority={ticket.priority ?? "Medium"} /></td>
                      <td><StatusBadge status={ticket.status ?? "New"} /></td>
                      <td>{formatDate(ticket.opened_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-lg">
          <h3 className="text-lg font-bold">{dialogTitle}</h3>
          {error ? <div className="alert alert-error mt-4 text-sm"><span>{error}</span></div> : null}
          <form action={handleSubmit} className="form-grid mt-4 grid gap-4">
            <input type="hidden" name="request_type" value={requestType} />
            <FormField label="Title" htmlFor="title" required>
              <input id="title" name="title" className="input input-bordered w-full" required />
            </FormField>
            <FormField label="Description" htmlFor="description" required>
              <textarea id="description" name="description" className="textarea textarea-bordered w-full" rows={3} required />
            </FormField>
            {requestType === "support" ? (
              <FormField label="Category" htmlFor="category">
                <input id="category" name="category" className="input input-bordered w-full" placeholder="Hardware, Software, Network..." />
              </FormField>
            ) : null}
            <FormField label="Location" htmlFor="location">
              <input id="location" name="location" className="input input-bordered w-full" placeholder="Office, desk, remote..." />
            </FormField>
            <FormField label="Severity" htmlFor="severity">
              <select id="severity" name="severity" className="select select-bordered w-full" defaultValue="Medium">
                <option value="Critical">Critical — cannot work</option>
                <option value="High">High — major impact</option>
                <option value="Medium">Medium — partial impact</option>
                <option value="Low">Low — minor inconvenience</option>
              </select>
            </FormField>
            <FormField label="Priority" htmlFor="priority">
              <select id="priority" name="priority" className="select select-bordered w-full" defaultValue="Medium">
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </FormField>
            <FormField label="Preferred contact" htmlFor="service_method">
              <select id="service_method" name="service_method" className="select select-bordered w-full" defaultValue="Email">
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
                <option value="Remote session">Remote session</option>
              </select>
            </FormField>
            <FormField label="Availability notes" htmlFor="availability_notes">
              <textarea id="availability_notes" name="availability_notes" className="textarea textarea-bordered w-full" rows={2} />
            </FormField>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <span className="loading loading-spinner loading-sm" /> : "Submit"}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop"><button type="submit">close</button></form>
      </dialog>
    </div>
  );
}
