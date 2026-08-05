import { redirect } from "next/navigation";
import { AppShellClient } from "@/components/AppShellClient";
import { DemoRoleProvider } from "@/components/providers/DemoRoleProvider";
import { ToastProvider } from "@/components/Toast";
import { getAuthenticatedProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const auth = await getAuthenticatedProfile();

  if (!auth) {
    redirect("/login");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let technicianId: string | null = null;
  if (user) {
    const { data: technician } = await supabase
      .from("technicians")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();
    technicianId = technician?.id ?? null;
  }

  return (
    <DemoRoleProvider realRole={auth.profile.role}>
      <ToastProvider>
        <AppShellClient
          profile={auth.profile}
          userEmail={user?.email}
          technicianId={technicianId}
        >
          {children}
        </AppShellClient>
      </ToastProvider>
    </DemoRoleProvider>
  );
}
