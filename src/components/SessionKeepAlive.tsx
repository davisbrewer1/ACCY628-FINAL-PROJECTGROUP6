"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Keeps the auth session fresh so idle tabs are not forced to re-login. */
export function SessionKeepAlive() {
  useEffect(() => {
    const supabase = createClient();

    async function refresh() {
      try {
        await supabase.auth.refreshSession();
      } catch {
        // Leave the existing cookies alone; middleware no longer auto-signs out.
      }
    }

    void refresh();
    supabase.auth.startAutoRefresh();

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.startAutoRefresh();
        void refresh();
      }
    };

    // Refresh periodically while the tab stays open (even if unused).
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 10 * 60 * 1000);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  return null;
}
