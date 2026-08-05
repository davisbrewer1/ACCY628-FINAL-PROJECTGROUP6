import type { UserRole } from "@/lib/types";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Building2,
  Clock,
  FileText,
  Home,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Monitor,
  Package,
  Receipt,
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
import { DemoRoleSwitcher } from "@/components/DemoRoleSwitcher";
import { ThemeSelector } from "@/components/ThemeSelector";
import {
  getNavForRole,
  ROLE_LABELS,
  type NavItem,
} from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

const KnowledgeBasePanel = dynamic(
  () =>
    import("@/components/KnowledgeBasePanel").then(
      (mod) => mod.KnowledgeBasePanel,
    ),
  {
    ssr: false,
    loading: () => (
      <button type="button" className="btn btn-ghost btn-sm gap-2" disabled>
        <BookOpen className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Knowledge Base</span>
      </button>
    ),
  },
);

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

function BrandMark() {
  return (
    <Link
      href="/"
      className="flex items-center gap-3 px-4 py-4 transition-opacity hover:opacity-80"
      aria-label="Nexus Technology Solutions home"
    >
      <div className="flex size-10 items-center justify-center rounded-box bg-primary text-primary-content font-bold tracking-tight">
        NX
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight">Nexus Technology Solutions</p>
        <p className="text-xs text-base-content/60">Technology Operations Platform</p>
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
}) {
  return (
    <div className="flex h-full flex-col">
      <BrandMark />
      <div className="divider my-0" />
      <nav className="flex-1 overflow-y-auto py-2">
        <NavLinks items={navItems} pathname={pathname} onNavigate={onNavigate} />
      </nav>
      <div className="space-y-3 border-t border-base-300 p-4">
        <div>
          <p className="text-sm font-semibold">{userName || userEmail || "Signed in user"}</p>
          {userName && userEmail ? (
            <p className="text-xs text-base-content/60">{userEmail}</p>
          ) : null}
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-primary">
            {ROLE_LABELS[activeRole]}
          </p>
        </div>
        <ThemeSelector />
        {onDemoRoleChange ? (
          <DemoRoleSwitcher
            realRole={realRole}
            activeRole={activeRole}
            onChange={onDemoRoleChange}
          />
        ) : null}
        <button
          type="button"
          className="btn btn-outline btn-sm w-full"
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
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = getNavForRole(activeRole);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="drawer lg:drawer-open">
      <input
        id="app-shell-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={mobileOpen}
        onChange={(event) => setMobileOpen(event.target.checked)}
      />

      <div className="drawer-content flex min-h-screen flex-col bg-base-200">
        <header className="navbar sticky top-0 z-20 border-b border-base-300 bg-base-100 px-4 lg:px-6">
          <div className="flex-none lg:hidden">
            <label
              htmlFor="app-shell-drawer"
              className="btn btn-ghost btn-square"
              aria-label="Open navigation menu"
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
              <span className="flex size-8 shrink-0 items-center justify-center rounded-box bg-primary text-xs font-bold text-primary-content">
                NX
              </span>
              <span className="truncate text-sm font-semibold leading-tight sm:text-base">
                Nexus Technology Solutions
              </span>
            </Link>
            <span className="hidden h-5 w-px shrink-0 bg-base-300 sm:block" aria-hidden="true" />
            <h1 className="hidden truncate text-base font-medium text-base-content/70 sm:block lg:text-lg">
              {pageTitle}
            </h1>
          </div>
          {(activeRole === "technician" ||
            activeRole === "administrator" ||
            activeRole === "service_manager") ? (
            <div className="flex flex-none items-center gap-1">
              <KnowledgeBasePanel
                canEdit={
                  activeRole === "administrator" ||
                  activeRole === "service_manager"
                }
              />
              {(activeRole === "technician" ||
                activeRole === "administrator" ||
                activeRole === "service_manager") && (
                <NotificationCenter />
              )}
            </div>
          ) : null}
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
        <aside className="min-h-full w-72 bg-base-100">
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
          />
        </aside>
      </div>
    </div>
  );
}
