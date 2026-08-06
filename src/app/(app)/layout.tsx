import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShellClient } from "@/components/AppShellClient";
import { DemoRoleProvider } from "@/components/providers/DemoRoleProvider";
import { SessionKeepAlive } from "@/components/SessionKeepAlive";
import { ToastProvider } from "@/components/Toast";
import { getAuthenticatedProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const auth = await getAuthenticatedProfile();

  if (!auth) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: technician } = await supabase
    .from("technicians")
    .select("id")
    .eq("profile_id", auth.userId)
    .maybeSingle();
  const technicianId = technician?.id ?? null;

  return (
    <DemoRoleProvider realRole={auth.profile.role}>
      <ToastProvider>
        <SessionKeepAlive />
        <AppShellClient
          profile={auth.profile}
          userEmail={auth.email}
          technicianId={technicianId}
        >
          <Suspense
            fallback={
              <div className="flex min-h-[40vh] items-center justify-center">
                <span className="loading loading-spinner loading-lg text-primary" />
              </div>
            }
          >
            {children}
          </Suspense>
        </AppShellClient>
      </ToastProvider>
    </DemoRoleProvider>
  );
}
