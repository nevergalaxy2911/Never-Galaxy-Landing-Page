import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { logPageView } from "@/lib/analytics.functions";

/**
 * PageViewLogger, fires one logPageView call per client-side route change.
 * Skips SSR (no window). Best-effort, never blocks navigation. Consumed by
 * /admin -> Analytics.
 */
export function PageViewLogger() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip logging the admin console itself so it doesn't pollute visit charts.
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api-panel") ||
      pathname.startsWith("/analytics") ||
      pathname.startsWith("/auth")
    ) return;
    const referrer = document.referrer || null;
    // Fire and forget.
    logPageView({ data: { path: pathname, referrer, verdict: null } }).catch(() => {});
  }, [pathname]);

  return null;
}
