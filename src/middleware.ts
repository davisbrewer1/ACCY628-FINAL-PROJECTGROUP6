import { type NextRequest, NextResponse } from "next/server";
import {
  getDefaultDashboard,
  isProtectedRoute,
  normalizeRole,
} from "@/lib/auth/roles";
import { updateSession } from "@/lib/supabase/middleware";

const AUTH_ROUTES = ["/login", "/signup"];

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function isServerActionRequest(request: NextRequest): boolean {
  return request.headers.has("next-action");
}

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isProtectedRoute(pathname) && !user) {
    // Never redirect Server Actions to an HTML login page — that breaks the
    // action protocol and surfaces "An unexpected response was received from the server."
    // Let the action run so it can return a normal { success: false } payload.
    if (isServerActionRequest(request)) {
      return supabaseResponse;
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute(pathname) && user) {
    // Same rule: do not HTML-redirect an in-flight Server Action away from /login.
    if (isServerActionRequest(request)) {
      return supabaseResponse;
    }

    let dashboardPath = "/dashboard";

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.role) {
      dashboardPath = getDefaultDashboard(normalizeRole(profile.role));
    }

    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = dashboardPath;
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
