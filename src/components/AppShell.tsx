import type { UserRole } from "@/lib/types";
import {
  Activity,
  BarChart3,
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
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

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
    <div className="flex items-center gap-3 px-4 py-4">
      <div className="flex size-10 items-center justify-center rounded-box bg-primary text-primary-content font-bold tracking-tight">
        NX
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight">Nexus Technology Solutions</p>
        <p className="text-xs text-base-content/60">Technology Operations Platform</p>
      </div>
    </div>
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
          <div className="flex-1">
            <h1 className="text-lg font-semibold lg:text-xl">{pageTitle}</h1>
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
