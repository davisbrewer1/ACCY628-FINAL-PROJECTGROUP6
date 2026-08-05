import { normalizeRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    ...(data as Profile),
    role: normalizeRole((data as Profile).role),
  };
}

export async function getAuthenticatedProfile(): Promise<{
  userId: string;
  profile: Profile;
  email: string | null;
} | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    return null;
  }

  return {
    userId: user.id,
    profile,
    email: user.email ?? profile.email ?? null,
  };
}
