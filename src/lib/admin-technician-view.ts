export const ADMIN_VIEW_TECH_STORAGE_KEY = "nexus-admin-view-technician-id";
export const ADMIN_VIEW_TECH_EVENT = "nexus-admin-view-technician";

const PORTAL_VIEWER_ROLES = new Set([
  "administrator",
  "service_manager",
  "account_manager",
]);

/** Managers/admins can open any technician My Work board without re-login. */
export function canViewTechnicianPortalAs(role: string | null | undefined) {
  return Boolean(role && PORTAL_VIEWER_ROLES.has(role));
}

export function readAdminViewTechnicianId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ADMIN_VIEW_TECH_STORAGE_KEY);
}

export function writeAdminViewTechnicianId(technicianId: string) {
  sessionStorage.setItem(ADMIN_VIEW_TECH_STORAGE_KEY, technicianId);
  window.dispatchEvent(
    new CustomEvent(ADMIN_VIEW_TECH_EVENT, { detail: { technicianId } }),
  );
}
