"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";
import type {
  AssetAssignment,
  AssetIncident,
  AssetMonitoring,
  AssetOrderTicketStatus,
  AssetPhoto,
  AssetRepair,
  AssetSoftware,
  HardwareAsset,
  ServiceTicket,
  UserRole,
} from "@/lib/types";

const ORDER_PRIORITIES = new Set(["Low", "Medium", "High", "Urgent"]);
const REVIEW_STATUSES = new Set<AssetOrderTicketStatus>([
  "Approved",
  "Rejected",
  "Needs more information",
]);

function revalidateHardware() {
  revalidatePath("/hardware");
  revalidatePath("/portal");
  revalidatePath("/technician");
}

async function getUserAndRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, role: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    role: (profile?.role as UserRole | undefined) ?? null,
  };
}

export async function createHardwareAsset(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!customerId || !category) {
    return { success: false, message: "Customer and category are required." };
  }

  const assetNumber =
    String(formData.get("asset_number") ?? "").trim() ||
    `HW-${Date.now().toString().slice(-8)}`;

  const purchaseCostRaw = String(formData.get("purchase_cost") ?? "").trim();
  const quantityRaw = Number(formData.get("quantity") ?? 1);
  const quantity =
    Number.isInteger(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;

  const { error } = await supabase.from("hardware_assets").insert({
    asset_number: assetNumber,
    asset_tag: String(formData.get("asset_tag") ?? "").trim() || assetNumber,
    customer_id: customerId,
    location: String(formData.get("location") ?? "").trim() || null,
    category,
    quantity,
    manufacturer: String(formData.get("manufacturer") ?? "").trim() || null,
    model: String(formData.get("model") ?? "").trim() || null,
    serial_number: String(formData.get("serial_number") ?? "").trim() || null,
    purchase_date: String(formData.get("purchase_date") ?? "").trim() || null,
    warranty_expiration:
      String(formData.get("warranty_expiration") ?? "").trim() || null,
    assigned_employee:
      String(formData.get("assigned_employee") ?? "").trim() || null,
    operating_system:
      String(formData.get("operating_system") ?? "").trim() || null,
    device_status: String(formData.get("device_status") ?? "Active").trim(),
    lifecycle_stage:
      String(formData.get("lifecycle_stage") ?? "In Use").trim() || "In Use",
    estimated_replacement_date:
      String(formData.get("estimated_replacement_date") ?? "").trim() || null,
    purchase_cost: purchaseCostRaw ? Number(purchaseCostRaw) : null,
    managed_coverage: formData.get("managed_coverage") === "true",
    support_contract:
      String(formData.get("support_contract") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateHardware();
  return { success: true, message: `Asset ${assetNumber} registered.` };
}

export interface AssetDetailBundle {
  asset: HardwareAsset | null;
  incidents: AssetIncident[];
  repairs: AssetRepair[];
  software: AssetSoftware[];
  monitoring: AssetMonitoring[];
  assignments: AssetAssignment[];
  photos: AssetPhoto[];
  tickets: ServiceTicket[];
}

export async function fetchAssetDetail(
  assetId: string,
): Promise<AssetDetailBundle> {
  const supabase = await createClient();
  const empty: AssetDetailBundle = {
    asset: null,
    incidents: [],
    repairs: [],
    software: [],
    monitoring: [],
    assignments: [],
    photos: [],
    tickets: [],
  };

  const { data: asset, error } = await supabase
    .from("hardware_assets")
    .select("*")
    .eq("id", assetId)
    .maybeSingle();

  if (error || !asset) {
    return empty;
  }

  const [incidents, repairs, software, monitoring, assignments, photos, tickets] =
    await Promise.all([
      supabase
        .from("asset_incidents")
        .select("*")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false }),
      supabase
        .from("asset_repairs")
        .select("*")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false }),
      supabase
        .from("asset_software")
        .select("*")
        .eq("asset_id", assetId)
        .order("app_name"),
      supabase
        .from("asset_monitoring")
        .select("*")
        .eq("asset_id", assetId)
        .order("checked_at", { ascending: false })
        .limit(10),
      supabase
        .from("asset_assignments")
        .select("*")
        .eq("asset_id", assetId)
        .order("assigned_at", { ascending: false }),
      supabase
        .from("asset_photos")
        .select("*")
        .eq("asset_id", assetId)
        .order("created_at", { ascending: false }),
      supabase
        .from("service_tickets")
        .select("*")
        .eq("customer_id", asset.customer_id)
        .ilike("description", `%${asset.asset_number}%`)
        .order("opened_at", { ascending: false })
        .limit(10),
    ]);

  return {
    asset: asset as HardwareAsset,
    incidents: (incidents.data ?? []) as AssetIncident[],
    repairs: (repairs.data ?? []) as AssetRepair[],
    software: (software.data ?? []) as AssetSoftware[],
    monitoring: (monitoring.data ?? []) as AssetMonitoring[],
    assignments: (assignments.data ?? []) as AssetAssignment[],
    photos: (photos.data ?? []) as AssetPhoto[],
    tickets: (tickets.data ?? []) as ServiceTicket[],
  };
}

export async function addAssetIncident(input: {
  assetId: string;
  title: string;
  description?: string;
  severity?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const title = input.title.trim();
  if (!title) {
    return { success: false, message: "Incident title is required." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("asset_incidents").insert({
    asset_id: input.assetId,
    title,
    description: input.description?.trim() || null,
    severity: input.severity || "Medium",
    status: "Open",
    created_by: user?.id ?? null,
  });

  if (error) return { success: false, message: error.message };
  revalidateHardware();
  return { success: true, message: "Incident added." };
}

export async function addAssetRepairNote(input: {
  assetId: string;
  note: string;
  repairedBy?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const note = input.note.trim();
  if (!note) {
    return { success: false, message: "Repair note is required." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("asset_repairs").insert({
    asset_id: input.assetId,
    note,
    repaired_by: input.repairedBy?.trim() || null,
    status: "Logged",
    created_by: user?.id ?? null,
  });

  if (error) return { success: false, message: error.message };
  revalidateHardware();
  return { success: true, message: "Repair note added." };
}

export async function updateAssetStatus(input: {
  assetId: string;
  deviceStatus: string;
  lifecycleStage?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const updates: Record<string, string> = {
    device_status: input.deviceStatus,
  };
  if (input.lifecycleStage) {
    updates.lifecycle_stage = input.lifecycleStage;
  }
  if (input.deviceStatus === "Retired") {
    updates.lifecycle_stage = "Retired";
  }

  const { error } = await supabase
    .from("hardware_assets")
    .update(updates)
    .eq("id", input.assetId);

  if (error) return { success: false, message: error.message };
  revalidateHardware();
  return { success: true, message: "Asset status updated." };
}

export async function updateAssetAssignment(input: {
  assetId: string;
  assignedUser?: string;
  assignedLocation?: string;
  notes?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const assignedUser = input.assignedUser?.trim() || null;
  const assignedLocation = input.assignedLocation?.trim() || null;

  const { error: updateError } = await supabase
    .from("hardware_assets")
    .update({
      assigned_employee: assignedUser,
      location: assignedLocation,
    })
    .eq("id", input.assetId);

  if (updateError) return { success: false, message: updateError.message };

  const { error } = await supabase.from("asset_assignments").insert({
    asset_id: input.assetId,
    assigned_user: assignedUser,
    assigned_location: assignedLocation,
    notes: input.notes?.trim() || null,
    created_by: user?.id ?? null,
  });

  if (error) {
    // History table may not be migrated yet.
    console.warn("asset_assignments insert skipped:", error.message);
  }

  revalidateHardware();
  return { success: true, message: "Assignment updated." };
}

export async function flagAssetForReplacement(
  assetId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("hardware_assets")
    .update({
      needs_replacement: true,
      lifecycle_stage: "End of Life",
      device_status: "Active",
    })
    .eq("id", assetId);

  if (error) return { success: false, message: error.message };

  await supabase.from("asset_incidents").insert({
    asset_id: assetId,
    title: "Flagged for replacement",
    description: "Technician flagged this asset for replacement.",
    severity: "High",
    status: "Open",
  });

  revalidateHardware();
  return { success: true, message: "Asset flagged for replacement." };
}

export async function markAssetRepaired(assetId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("hardware_assets")
    .update({
      device_status: "Active",
      lifecycle_stage: "In Use",
    })
    .eq("id", assetId);

  if (error) return { success: false, message: error.message };

  await supabase.from("asset_repairs").insert({
    asset_id: assetId,
    note: "Marked as repaired by technician.",
    status: "Completed",
    created_by: user?.id ?? null,
  });

  revalidateHardware();
  return { success: true, message: "Asset marked as repaired." };
}

export async function uploadAssetPhoto(input: {
  assetId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  base64: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const safeName = input.fileName.replace(/[^\w.\-]+/g, "_");
  const path = `${input.assetId}/${Date.now()}-${safeName}`;
  const binary = Buffer.from(input.base64, "base64");

  const { error: uploadError } = await supabase.storage
    .from("asset-photos")
    .upload(path, binary, {
      contentType: input.fileType || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return {
      success: false,
      message: `Upload failed: ${uploadError.message}. Ensure the asset-photos bucket exists.`,
    };
  }

  const { error } = await supabase.from("asset_photos").insert({
    asset_id: input.assetId,
    file_name: input.fileName,
    file_path: path,
    file_size: input.fileSize,
    mime_type: input.fileType || null,
  });

  if (error) {
    return {
      success: false,
      message: `File uploaded, but metadata save failed: ${error.message}`,
    };
  }

  revalidateHardware();
  return { success: true, message: "Photo uploaded." };
}

export async function createAssetOrderTicket(
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user, role } = await getUserAndRole();

  if (!user) {
    return { success: false, message: "You must be signed in to submit an order ticket." };
  }
  if (role !== "technician" && role !== "administrator") {
    return { success: false, message: "Only technicians can submit asset order tickets." };
  }

  const assetId = String(formData.get("asset_id") ?? "").trim();
  const replacementManufacturer = String(
    formData.get("replacement_manufacturer") ?? "",
  ).trim();
  const replacementModel = String(
    formData.get("replacement_model") ?? "",
  ).trim();
  const justification = String(
    formData.get("business_justification") ?? "",
  ).trim();
  const priority = String(formData.get("priority") ?? "Medium").trim();

  if (!assetId || !replacementManufacturer || !replacementModel || !justification) {
    return {
      success: false,
      message: "Asset, replacement manufacturer, model, and justification are required.",
    };
  }
  if (!ORDER_PRIORITIES.has(priority)) {
    return { success: false, message: "Invalid order priority." };
  }

  const { data: asset, error: assetError } = await supabase
    .from("hardware_assets")
    .select("id, customer_id, quantity, needs_replacement")
    .eq("id", assetId)
    .maybeSingle();

  if (assetError || !asset) {
    return { success: false, message: "The selected asset could not be found." };
  }
  if (!asset.needs_replacement) {
    return {
      success: false,
      message: "Order tickets can only be submitted for assets marked Needs replacement.",
    };
  }

  const estimatedUnitCostRaw = String(
    formData.get("estimated_unit_cost") ?? "",
  ).trim();
  const estimatedUnitCost = estimatedUnitCostRaw
    ? Number(estimatedUnitCostRaw)
    : null;
  if (
    estimatedUnitCost !== null &&
    (!Number.isFinite(estimatedUnitCost) || estimatedUnitCost < 0)
  ) {
    return { success: false, message: "Estimated unit cost must be zero or greater." };
  }

  const ticketNumber = `AOT-${Date.now().toString().slice(-8)}`;
  const { error } = await supabase.from("asset_order_tickets").insert({
    ticket_number: ticketNumber,
    asset_id: asset.id,
    customer_id: asset.customer_id,
    requested_by: user.id,
    replacement_manufacturer: replacementManufacturer,
    replacement_model: replacementModel,
    requested_quantity: asset.quantity,
    priority,
    business_justification: justification,
    technical_requirements:
      String(formData.get("technical_requirements") ?? "").trim() || null,
    preferred_vendor:
      String(formData.get("preferred_vendor") ?? "").trim() || null,
    estimated_unit_cost: estimatedUnitCost,
    needed_by: String(formData.get("needed_by") ?? "").trim() || null,
    status: "Pending",
  });

  if (error) {
    const message = error.code === "23505"
      ? "This asset already has an active order ticket."
      : error.message;
    return { success: false, message };
  }

  revalidateHardware();
  return { success: true, message: `Order ticket ${ticketNumber} submitted for approval.` };
}

export async function reviewAssetOrderTicket(
  ticketId: string,
  status: AssetOrderTicketStatus,
  adminNotes: string,
): Promise<ActionResult> {
  const { supabase, user, role } = await getUserAndRole();

  if (!user || role !== "administrator") {
    return { success: false, message: "Only administrators can review order tickets." };
  }
  if (!REVIEW_STATUSES.has(status)) {
    return { success: false, message: "Invalid approval status." };
  }

  const notes = adminNotes.trim();
  if ((status === "Rejected" || status === "Needs more information") && !notes) {
    return { success: false, message: "Add an administrator note for this decision." };
  }

  const { error } = await supabase
    .from("asset_order_tickets")
    .update({
      status,
      admin_notes: notes || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateHardware();
  return { success: true, message: `Order ticket marked ${status}.` };
}

export async function requestInventoryReorder(
  partId: string,
  amount: number,
  notes = "",
): Promise<ActionResult> {
  const { supabase, user, role } = await getUserAndRole();

  if (!user || role !== "technician") {
    return {
      success: false,
      message: "Only technicians can request a parts reorder.",
    };
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > 50) {
    return { success: false, message: "Request quantity must be between 1 and 50." };
  }

  const { data: part, error: readError } = await supabase
    .from("inventory_parts")
    .select("id, part_name, quantity")
    .eq("id", partId)
    .maybeSingle();

  if (readError || !part) {
    return { success: false, message: "The selected part could not be found." };
  }
  if (part.quantity + amount > 50) {
    return {
      success: false,
      message: `Only ${50 - part.quantity} more can fit in inventory (cap is 50).`,
    };
  }

  const { data: existing } = await supabase
    .from("inventory_reorder_requests")
    .select("id")
    .eq("part_id", partId)
    .eq("requested_by", user.id)
    .eq("status", "Pending")
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message: "You already have a pending reorder request for this part.",
    };
  }

  const { error } = await supabase.from("inventory_reorder_requests").insert({
    part_id: partId,
    requested_by: user.id,
    requested_quantity: amount,
    notes: notes.trim() || null,
    status: "Pending",
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateHardware();
  return {
    success: true,
    message: `Reorder request sent to management for ${amount} × ${part.part_name}.`,
  };
}

export async function reviewInventoryReorderRequest(
  requestId: string,
  status: "Approved" | "Rejected",
  adminNotes = "",
): Promise<ActionResult> {
  const { supabase, user, role } = await getUserAndRole();

  if (
    !user ||
    (role !== "administrator" && role !== "service_manager")
  ) {
    return {
      success: false,
      message: "Only managers or administrators can review reorder requests.",
    };
  }

  const notes = adminNotes.trim();
  if (status === "Rejected" && !notes) {
    return { success: false, message: "Add a note when rejecting a reorder request." };
  }

  const { data: request, error: readError } = await supabase
    .from("inventory_reorder_requests")
    .select("id, part_id, requested_quantity, status")
    .eq("id", requestId)
    .maybeSingle();

  if (readError || !request) {
    return { success: false, message: "Reorder request not found." };
  }
  if (request.status !== "Pending") {
    return { success: false, message: "This reorder request was already reviewed." };
  }

  if (status === "Approved") {
    const { data: part, error: partError } = await supabase
      .from("inventory_parts")
      .select("id, part_name, quantity")
      .eq("id", request.part_id)
      .maybeSingle();

    if (partError || !part) {
      return { success: false, message: "The requested part could not be found." };
    }
    if (part.quantity + request.requested_quantity > 50) {
      return {
        success: false,
        message: `Cannot approve: only ${50 - part.quantity} units can be added (cap is 50).`,
      };
    }

    const { error: stockError } = await supabase
      .from("inventory_parts")
      .update({
        quantity: part.quantity + request.requested_quantity,
        last_restocked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", part.id);

    if (stockError) {
      return { success: false, message: stockError.message };
    }
  }

  const { error } = await supabase
    .from("inventory_reorder_requests")
    .update({
      status,
      admin_notes: notes || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateHardware();
  return {
    success: true,
    message:
      status === "Approved"
        ? "Reorder approved and inventory updated."
        : "Reorder request rejected.",
  };
}

/** Managers/admins only — direct restock without a technician request. */
export async function restockInventoryPart(
  partId: string,
  amount: number,
): Promise<ActionResult> {
  const { supabase, user, role } = await getUserAndRole();

  if (
    !user ||
    (role !== "administrator" && role !== "service_manager")
  ) {
    return {
      success: false,
      message: "Only managers can restock inventory directly.",
    };
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > 50) {
    return { success: false, message: "Order quantity must be between 1 and 50." };
  }

  const { data: part, error: readError } = await supabase
    .from("inventory_parts")
    .select("id, part_name, quantity")
    .eq("id", partId)
    .maybeSingle();

  if (readError || !part) {
    return { success: false, message: "The selected part could not be found." };
  }
  if (part.quantity + amount > 50) {
    return {
      success: false,
      message: `Only ${50 - part.quantity} more can be ordered; inventory is capped at 50.`,
    };
  }

  const { error } = await supabase
    .from("inventory_parts")
    .update({
      quantity: part.quantity + amount,
      last_restocked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", partId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateHardware();
  return {
    success: true,
    message: `${amount} × ${part.part_name} added to inventory.`,
  };
}
