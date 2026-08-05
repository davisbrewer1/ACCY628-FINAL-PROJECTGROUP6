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

  return (
    <DemoRoleProvider realRole={auth.profile.role}>
      <ToastProvider>
        <AppShellClient profile={auth.profile} userEmail={user?.email}>
          {children}
        </AppShellClient>
      </ToastProvider>
    </DemoRoleProvider>
  );
}
