import type { UserRole } from "@/lib/types";
import {
  Activity,
  BarChart3,
  Bell,
  Brain,
  Building2,
  Clock,
  FileText,
  Home,
  Layers,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Monitor,
  Package,
  Receipt,
  Settings,
  Shield,
  Ticket,
  UserRound,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { NexusLogo } from "@/components/brand/NexusLogo";
import { DemoRoleSwitcher } from "@/components/DemoRoleSwitcher";
import { ThemeSelector } from "@/components/ThemeSelector";
import { TechnicianHeaderTools } from "@/components/technician/TechnicianHeaderTools";
import {
  getNavForRole,
  ROLE_LABELS,
  type NavItem,
} from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

const NotificationCenter = dynamic(
  () =>
    import("@/components/NotificationCenter").then(
      (mod) => mod.NotificationCenter,
    ),
  {
    ssr: false,
    loading: () => (
      <button
        type="button"
        className="btn btn-ghost btn-square btn-sm"
        disabled
        aria-label="Notifications"
      >
        <Bell className="size-5" aria-hidden="true" />
      </button>
    ),
  },
);

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Activity,
  Building2,
  FileText,
  Layers,
  Package,
  Monitor,
  Ticket,
  Users,
  Clock,
  Receipt,
  BarChart3,
  Wrench,
  Home,
  Shield,
  Brain,
  Lightbulb,
  UserRound,
  Settings,
};

interface AppShellProps {
  pageTitle: string;
  userName?: string | null;
  userEmail?: string | null;
  realRole: UserRole;
  activeRole: UserRole;
  onDemoRoleChange?: (role: UserRole) => void;
  alertArea?: ReactNode;
  children: ReactNode;
  technicianId?: string | null;
}

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="menu menu-sm gap-1 px-2">
      {items.map((item) => {
        const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;
        const hasMoreSpecificMatch = items.some(
          (other) =>
            other.href !== item.href &&
            other.href.startsWith(`${item.href}/`) &&
            (pathname === other.href || pathname.startsWith(`${other.href}/`)),
        );
        const isActive =
          pathname === item.href ||
          (pathname.startsWith(`${item.href}/`) && !hasMoreSpecificMatch);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={isActive ? "active font-semibold" : undefined}
              onClick={onNavigate}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function BrandMark({ techTheme }: { techTheme?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 px-4 py-4 transition-opacity hover:opacity-80"
      aria-label="Nexus Technology Solutions home"
    >
      <NexusLogo size="lg" decorative />
      <div>
        <p
          className={`text-sm font-semibold leading-tight ${
            techTheme ? "text-white" : ""
          }`}
        >
          Nexus Technology Solutions
        </p>
        <p
          className={`text-xs ${
            techTheme ? "text-slate-400" : "text-base-content/60"
          }`}
        >
          Technology Operations Platform
        </p>
      </div>
    </Link>
  );
}

function SidebarPanel({
  pathname,
  navItems,
  userName,
  userEmail,
  realRole,
  activeRole,
  onDemoRoleChange,
  onLogout,
  onNavigate,
  techTheme,
}: {
  pathname: string;
  navItems: NavItem[];
  userName?: string | null;
  userEmail?: string | null;
  realRole: UserRole;
  activeRole: UserRole;
  onDemoRoleChange?: (role: UserRole) => void;
  onLogout: () => void;
  onNavigate?: () => void;
  techTheme?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <BrandMark techTheme={techTheme} />
      <div className={`divider my-0 ${techTheme ? "before:bg-cyan-500/20 after:bg-cyan-500/20" : ""}`} />
      <nav className="flex-1 overflow-y-auto py-2">
        <NavLinks items={navItems} pathname={pathname} onNavigate={onNavigate} />
      </nav>
      <div
        className={`space-y-3 border-t p-4 ${
          techTheme ? "border-cyan-500/20" : "border-base-300"
        }`}
      >
        <div>
          <p
            className={`text-sm font-semibold ${techTheme ? "text-white" : ""}`}
          >
            {userName || userEmail || "Signed in user"}
          </p>
          {userName && userEmail ? (
            <p className={`text-xs ${techTheme ? "text-slate-400" : "text-base-content/60"}`}>
              {userEmail}
            </p>
          ) : null}
          <p
            className={`mt-1 text-xs font-medium uppercase tracking-wide ${
              techTheme ? "text-cyan-300" : "text-primary"
            }`}
          >
            {ROLE_LABELS[activeRole]}
          </p>
        </div>
        {!techTheme ? <ThemeSelector /> : null}
        {onDemoRoleChange ? (
          <DemoRoleSwitcher
            realRole={realRole}
            activeRole={activeRole}
            onChange={onDemoRoleChange}
          />
        ) : null}
        <button
          type="button"
          className={`btn btn-sm w-full ${
            techTheme
              ? "border-slate-600 bg-slate-950 text-slate-100 hover:border-cyan-500/50"
              : "btn-outline"
          }`}
          onClick={onLogout}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Log out
        </button>
      </div>
    </div>
  );
}

export function AppShell({
  pageTitle,
  userName,
  userEmail,
  realRole,
  activeRole,
  onDemoRoleChange,
  alertArea,
  children,
  technicianId = null,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = getNavForRole(activeRole);
  const techTheme = activeRole === "technician";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className={`drawer lg:drawer-open ${techTheme ? "tech-shell" : ""}`}>
      <input
        id="app-shell-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={mobileOpen}
        onChange={(event) => setMobileOpen(event.target.checked)}
      />

      <div
        className={`drawer-content flex min-h-screen flex-col ${
          techTheme
            ? "bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-slate-100"
            : "bg-base-200"
        }`}
      >
        <header
          className={`navbar sticky top-0 z-20 border-b px-4 lg:px-6 ${
            techTheme
              ? "border-cyan-500/20 bg-slate-950/90 text-white backdrop-blur"
              : "border-base-300 bg-base-100"
          }`}
        >
          <div className="flex-none lg:hidden" suppressHydrationWarning>
            <label
              htmlFor="app-shell-drawer"
              className={`btn btn-square btn-ghost ${techTheme ? "text-white" : ""}`}
              aria-label="Open navigation menu"
              suppressHydrationWarning
            >
              <Menu className="size-5" />
            </label>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80"
              aria-label="Nexus Technology Solutions home"
            >
              <NexusLogo size="lg" decorative />
              <span
                className={`truncate text-sm font-semibold leading-tight sm:text-base ${
                  techTheme ? "text-white" : ""
                }`}
              >
                Nexus Technology Solutions
              </span>
            </Link>
            <span
              className={`hidden h-5 w-px shrink-0 sm:block ${
                techTheme ? "bg-cyan-500/30" : "bg-base-300"
              }`}
              aria-hidden="true"
            />
            <h1
              className={`hidden truncate text-base font-medium sm:block lg:text-lg ${
                techTheme ? "text-slate-300" : "text-base-content/70"
              }`}
            >
              {pageTitle}
            </h1>
          </div>
          <div className="flex flex-none items-center gap-1">
            {techTheme ? (
              <TechnicianHeaderTools technicianId={technicianId} />
            ) : null}
            {activeRole === "administrator" ||
            activeRole === "service_manager" ? (
              <NotificationCenter />
            ) : null}
          </div>
        </header>
        <main className="flex-1 space-y-4 p-4 lg:p-6">
          {alertArea}
          {children}
        </main>
      </div>

      <div className="drawer-side z-30">
        <label
          htmlFor="app-shell-drawer"
          className="drawer-overlay"
          aria-label="Close navigation menu"
        />
        <aside
          className={`min-h-full w-72 ${
            techTheme
              ? "border-r border-cyan-500/20 bg-slate-950 text-slate-100"
              : "bg-base-100"
          }`}
        >
          <SidebarPanel
            pathname={pathname}
            navItems={navItems}
            userName={userName}
            userEmail={userEmail}
            realRole={realRole}
            activeRole={activeRole}
            onDemoRoleChange={onDemoRoleChange}
            onLogout={handleLogout}
            onNavigate={() => setMobileOpen(false)}
            techTheme={techTheme}
          />
        </aside>
      </div>
    </div>
  );
}
