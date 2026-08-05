"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createApprovalRequest,
  decideApproval,
} from "@/app/actions/approvals";
import { createClient } from "@/lib/supabase/client";
import type { Approval, ApprovalStatus } from "@/lib/types";

export interface ApprovalRequestInput {
  ticketId: string;
  technicianId: string;
  costEntryId?: string | null;
  workEntryId?: string | null;
  reason: string;
  totalCost?: number | null;
  files?: File[];
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function useApprovalWorkflow(options?: {
  technicianId?: string | null;
  autoLoadPending?: boolean;
}) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("approvals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (options?.technicianId) {
      query = query.eq("technician_id", options.technicianId);
    }

    const { data, error } = await query;
    if (error) {
      setUnavailable(true);
      setApprovals([]);
      setPendingApprovals([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Approval[];
    setUnavailable(false);
    setApprovals(rows);
    setPendingApprovals(rows.filter((row) => row.status === "Pending"));
    setLoading(false);
  }, [options?.technicianId]);

  useEffect(() => {
    if (options?.autoLoadPending) {
      void refresh();
    }
  }, [options?.autoLoadPending, refresh]);

  const requestApproval = useCallback(async (input: ApprovalRequestInput) => {
    setSubmitting(true);
    try {
      const files = await Promise.all(
        (input.files ?? []).map(async (file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
          base64: await fileToBase64(file),
        })),
      );

      const result = await createApprovalRequest({
        ticketId: input.ticketId,
        technicianId: input.technicianId,
        costEntryId: input.costEntryId,
        workEntryId: input.workEntryId,
        reason: input.reason,
        totalCost: input.totalCost,
        files,
      });

      if (result.success) {
        await refresh();
      }

      return result;
    } finally {
      setSubmitting(false);
    }
  }, [refresh]);

  const respondToApproval = useCallback(
    async (input: {
      approvalId: string;
      decision: Extract<ApprovalStatus, "Approved" | "Denied">;
      managerNotes?: string;
    }) => {
      setSubmitting(true);
      try {
        const result = await decideApproval(input);
        if (result.success) {
          await refresh();
        }
        return result;
      } finally {
        setSubmitting(false);
      }
    },
    [refresh],
  );

  return {
    approvals,
    pendingApprovals,
    loading,
    submitting,
    unavailable,
    refresh,
    requestApproval,
    respondToApproval,
  };
}
