import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for server-only admin Auth operations (no invite emails).
 * Returns null when SUPABASE_SERVICE_ROLE_KEY is not configured.
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
