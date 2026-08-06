import type { UserRole } from "@/lib/types";
import {
  Activity,
  BarChart3,
  Bell,
  Brain,
  Building2,
  CircleDollarSign,
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
import { useMemo, useState, type ReactNode } from "react";
import { AdminTechnicianPortalSwitcher } from "@/components/admin/AdminTechnicianPortalSwitcher";
import { NexusLogo } from "@/components/brand/NexusLogo";
import { DemoRoleSwitcher } from "@/components/DemoRoleSwitcher";
import { TechnicianHeaderTools } from "@/components/technician/TechnicianHeaderTools";
import { canViewTechnicianPortalAs } from "@/lib/admin-technician-view";
import {
  getNavForRole,
  NAV_ITEMS,
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
  CircleDollarSign,
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

const NAV_BUTTON_SHADES = [
  "#1e3a8a", // deep royal
  "#1d4ed8",
  "#2563eb",
  "#3b82f6",
  "#0ea5e9",
  "#14b8a6",
  "#2dd4bf",
  "#5eead4",
  "#99f6e4",
  "#a5f3fc",
  "#bae6fd",
  "#bfdbfe",
] as const;

/** Muted gray-blue header bar tones — shift with the active nav tab. */
const HEADER_BAR_SHADES = [
  "#1e293b", // slate-800
  "#1e3a5f", // deep blue-gray
  "#243447",
  "#1e40af", // blue-800
  "#334155", // slate-700
  "#1d4ed8", // royal
  "#0f766e", // teal-700
  "#164e63", // cyan-900
  "#1e3a8a", // indigo-navy
  "#312e81", // indigo-900
  "#0c4a6e", // sky-900
  "#115e59", // teal-800
] as const;

function shadeAtIndex(
  shades: readonly string[],
  index: number,
  total: number,
): string {
  if (total <= 1) return shades[0] ?? "#1e293b";
  const last = shades.length - 1;
  const t = Math.min(1, Math.max(0, index / (total - 1)));
  const pos = Math.round(t * last);
  return shades[pos] ?? shades[last] ?? "#1e293b";
}

function navButtonShade(index: number, total: number): string {
  return shadeAtIndex(NAV_BUTTON_SHADES, index, total);
}

function navButtonTextClass(index: number, total: number): string {
  const t = total <= 1 ? 0 : index / (total - 1);
  // Darker blues need light text; mint/sky near the end need dark ink
  return t >= 0.72 ? "text-[#0B1220]" : "text-white";
}

function activeNavIndex(items: NavItem[], pathname: string): number {
  let best = 0;
  let bestScore = -1;
  items.forEach((item, index) => {
    const exact = pathname === item.href;
    const nested = pathname.startsWith(`${item.href}/`);
    if (!exact && !nested) return;
    const score = item.href.length + (exact ? 1000 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
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
    <ul className="flex flex-col gap-2 px-3 py-1">
      {items.map((item, index) => {
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
        const shade = navButtonShade(index, items.length);
        const textClass = navButtonTextClass(index, items.length);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={`font-button flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[1.05rem] font-normal leading-snug tracking-[0.02em] shadow-sm transition ${textClass} hover:brightness-110 ${
                isActive
                  ? "ring-2 ring-[#5EEAD4] ring-offset-2 ring-offset-[#0B1220]"
                  : "ring-1 ring-white/10"
              }`}
              style={{ backgroundColor: shade }}
            >
              <Icon className="size-4 shrink-0 opacity-95" aria-hidden="true" />
              <span>{item.label}</span>
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
      <NexusLogo size="lg" decorative />
      <div>
        <p className="font-display text-sm leading-tight text-white">
          Nexus Technology Solutions
        </p>
        <p className="text-xs text-slate-400">Technology Operations Platform</p>
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
    <div className="flex h-full flex-col bg-[#0B1220] text-slate-100">
      <BrandMark />
      <div className="divider my-0 before:bg-blue-500/25 after:bg-blue-500/25" />
      <nav className="flex-1 overflow-y-auto py-2">
        <NavLinks items={navItems} pathname={pathname} onNavigate={onNavigate} />
      </nav>
      <div className="space-y-3 border-t border-blue-500/25 p-4">
        <div>
          <p className="text-sm font-semibold text-white">
            {userName || userEmail || "Signed in user"}
          </p>
          {userName && userEmail ? (
            <p className="text-xs text-slate-400">{userEmail}</p>
          ) : null}
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-[#5EEAD4]">
            {ROLE_LABELS[activeRole]}
          </p>
        </div>
        {onDemoRoleChange ? (
          <DemoRoleSwitcher
            realRole={realRole}
            activeRole={activeRole}
            onChange={onDemoRoleChange}
          />
        ) : null}
        <button
          type="button"
          className="btn btn-sm w-full border-slate-500 bg-transparent text-slate-100 hover:border-[#5EEAD4] hover:bg-blue-500/15"
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navItems = useMemo(() => {
    const base = getNavForRole(activeRole);
    // Managers and admins always keep My Work in the sidebar.
    if (!canViewTechnicianPortalAs(realRole)) return base;
    if (base.some((item) => item.href === "/technician")) return base;
    const myWork = NAV_ITEMS.find((item) => item.href === "/technician");
    if (!myWork) return base;
    const techIdx = base.findIndex((item) => item.href === "/technicians");
    if (techIdx >= 0) {
      const next = [...base];
      next.splice(techIdx + 1, 0, myWork);
      return next;
    }
    return [...base, myWork];
  }, [activeRole, realRole]);
  const onTechnicianPortal =
    pathname === "/technician" || pathname.startsWith("/technician/");
  const techTheme =
    activeRole === "technician" ||
    (canViewTechnicianPortalAs(realRole) && onTechnicianPortal);
  const headerNavIndex = activeNavIndex(navItems, pathname);
  const headerBarColor = shadeAtIndex(
    HEADER_BAR_SHADES,
    headerNavIndex,
    Math.max(navItems.length, 1),
  );

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div
      className={`drawer ${
        techTheme ? "tech-shell" : "lg:drawer-open"
      }`}
    >
      <input
        id="app-shell-drawer"
        type="checkbox"
        className="drawer-toggle"
        checked={sidebarOpen}
        onChange={(event) => setSidebarOpen(event.target.checked)}
      />

      <div
        className={`drawer-content flex min-h-screen flex-col ${
          techTheme
            ? "bg-gradient-to-br from-[#0B1220] via-[#111827] to-[#1E3A5F] text-slate-100"
            : "bg-base-200"
        }`}
      >
        <header
          className="navbar sticky top-0 z-20 border-b border-white/10 px-4 text-white backdrop-blur transition-[background-color] duration-300 lg:px-6"
          style={{ backgroundColor: headerBarColor }}
        >
          <div
            className={`flex-none ${techTheme ? "" : "lg:hidden"}`}
            suppressHydrationWarning
          >
            <button
              type="button"
              className={`btn btn-square btn-ghost ${techTheme ? "text-white" : ""}`}
              aria-label={
                sidebarOpen ? "Close navigation menu" : "Open navigation menu"
              }
              aria-expanded={sidebarOpen}
              suppressHydrationWarning
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <Menu className="size-5" />
            </button>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80"
              aria-label="Nexus Technology Solutions home"
            >
              <NexusLogo size="lg" decorative />
              <span className="font-display truncate text-sm leading-tight text-white sm:text-base">
                Nexus Technology Solutions
              </span>
            </Link>
            <span
              className="hidden h-5 w-px shrink-0 bg-white/25 sm:block"
              aria-hidden="true"
            />
            <h1 className="hidden truncate text-base font-medium text-slate-200 sm:block lg:text-lg">
              {pageTitle}
            </h1>
          </div>
          <div className="flex flex-none items-center gap-1 text-white [&_.btn-ghost]:text-white">
            {canViewTechnicianPortalAs(realRole) && onTechnicianPortal ? (
              <AdminTechnicianPortalSwitcher variant="header" />
            ) : null}
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

      <div className="drawer-side z-40">
        <button
          type="button"
          className="drawer-overlay"
          aria-label="Close navigation menu"
          onClick={() => setSidebarOpen(false)}
        />
        <aside
          className="min-h-full w-72 border-r border-blue-500/25 bg-[#0B1220] text-slate-100"
          onClick={(event) => event.stopPropagation()}
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
            onNavigate={() => setSidebarOpen(false)}
          />
        </aside>
      </div>
    </div>
  );
}
