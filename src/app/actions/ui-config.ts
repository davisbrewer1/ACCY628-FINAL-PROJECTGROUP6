"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  LANDING_SERVICE_CATALOG,
  LANDING_SERVICES_SETTING_KEY,
  parseEnabledLandingServices,
} from "@/lib/ui-config";
import type { ServiceFamily } from "@/lib/types";

export type UiConfigActionResult =
  | { success: true; message: string; enabled: ServiceFamily[] }
  | { success: false; message: string };

const MANAGER_ROLES = new Set(["administrator", "service_manager"]);

export async function saveLandingServicesEnabled(
  titles: string[],
): Promise<UiConfigActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be signed in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !MANAGER_ROLES.has(profile.role)) {
    return {
      success: false,
      message: "Only administrators and service managers can change UI configuration.",
    };
  }

  const enabled = parseEnabledLandingServices(titles);
  // Allow empty catalog (all off) — managers may temporarily hide everything.
  const catalogTitles = new Set(
    LANDING_SERVICE_CATALOG.map((service) => service.title),
  );
  const sanitized = enabled.filter((title) => catalogTitles.has(title));

  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LANDING_SERVICES_SETTING_KEY,
      value: sanitized,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/");
  revalidatePath("/ui-configuration");
  revalidatePath("/end-user/support");
  revalidatePath("/portal");

  return {
    success: true,
    message: "Landing page services updated. Client ticket options now match.",
    enabled: sanitized,
  };
}
