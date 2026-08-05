"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/actions/customers";
import type {
  AssetAssignment,
  AssetIncident,
  AssetMonitoring,
  AssetPhoto,
  AssetRepair,
  AssetSoftware,
  HardwareAsset,
  ServiceTicket,
} from "@/lib/types";

function revalidateHardware() {
  revalidatePath("/hardware");
  revalidatePath("/portal");
  revalidatePath("/technician");
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

  const { error } = await supabase.from("hardware_assets").insert({
    asset_number: assetNumber,
    asset_tag: String(formData.get("asset_tag") ?? "").trim() || assetNumber,
    customer_id: customerId,
    location: String(formData.get("location") ?? "").trim() || null,
    category,
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
