/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute, useLocation } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { PageViewLogger } from "@/components/PageViewLogger";
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { getPublicFlag } from "@/lib/public-flags.functions";

const MAINTENANCE_EXEMPT = ["/auth", "/admin", "/api-panel", "/analytics"];
import appCss from "../styles.css?url";
// H1 display font, preloaded so the LCP hero heading paints in Archivo Black
// on first frame instead of waiting for the CSS @import chain to resolve the
// woff2. Vite resolves this to the same hashed asset URL that the @fontsource
// CSS references, so the browser sees a cache hit (no double download).
import archivoBlackWoff2 from "@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2?url";


/* -----------------------------------------------------------------------------
 * ROOT ROUTE, html shell + fonts + default meta.
 * HOW TO MODIFY:
 * • Fonts: swap the Google Fonts URL below. Display = Archivo Black, Body = Hind.
 * • Default title/description: edit `head()` meta.
 * --------------------------------------------------------------------------- */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Never Galaxy | Cosmic-grade creative studio" },
      {
        name: "description",
        content:
          "Never Galaxy, cosmic-grade creative studio for cinematic video editing, motion graphics, and thumbnail design that make brands feel bigger.",
      },
      { name: "theme-color", content: "#0b0510", media: "(prefers-color-scheme: dark)" },
      { name: "theme-color", content: "#faf7ff", media: "(prefers-color-scheme: light)" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Never Galaxy" },
      { property: "og:title", content: "Never Galaxy | Cosmic-grade creative studio" },
      {
        property: "og:description",
        content: "Video editing, motion graphics, and thumbnail design done at cosmic scale.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/icons/NeverGalaxy.png" },
      { rel: "apple-touch-icon", href: "/icons/NeverGalaxy.png" },
      { rel: "canonical", href: "https://nevergalaxy.vercel.app/" },
      // Preload the H1 display font, cuts LCP element render delay because
      // the hero heading no longer waits for the styles.css @import chain to
      // discover this woff2. crossOrigin is required for font preloads even
      // when same-origin, or the browser fetches twice.
      {
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href: archivoBlackWoff2,
        crossOrigin: "anonymous",
      },
      // Fonts are now self-hosted via @fontsource in src/styles.css, no
      // Google Fonts <link> or drift-prone hard-coded preload. Kills the
      // render-blocking network chain (A.6) and the 404'ing preload (A.2).
    ],

    // Sitewide brand identity for search engines and AI crawlers. Organization
    // + WebSite are the two schema.org types Google explicitly documents for
    // establishing a brand entity; both are safe to ship without a live URL
    // (crawlers resolve relative refs against the host at request time).
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Never Galaxy",
          description:
            "Creative studio for cinematic video editing, motion graphics, and thumbnail design.",
          url: "https://nevergalaxy.vercel.app/",

        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Never Galaxy",
          url: "https://nevergalaxy.vercel.app/",
        }),
      },
    ],
  }),
  shellComponent: RootDocument,
  // SSR-fetch the maintenance flag so the wall renders on the FIRST paint
  // instead of after a client boot delay. Admin/console paths are exempt so
  // you can always turn it back off.
  loader: async ({ location }) => {
    const path = location.pathname;
    if (MAINTENANCE_EXEMPT.some((p) => path === p || path.startsWith(p + "/"))) {
      return { maintenance: null as null | MaintenancePayload };
    }
    try {
      const r = await getPublicFlag({ data: { key: "maintenance_mode" } });
      if (r.enabled !== true) return { maintenance: null };
      const v = (r.value ?? {}) as {
        title?: string; message?: string;
        tone?: "info" | "warn" | "promo";
        until?: string; // ISO timestamp for countdown (optional)
      };
      return {
        maintenance: {
          title: (v.title && String(v.title).trim()) || "We'll be back shortly.",
          message: (v.message && String(v.message).trim()) ||
            "Never Galaxy is briefly offline for updates. Thanks for your patience — check back in a few minutes.",
          tone: (v.tone === "warn" || v.tone === "promo") ? v.tone : "info",
          until: v.until && !Number.isNaN(Date.parse(v.until)) ? v.until : null,
          updatedAt: r.updatedAt ?? null,
        } as MaintenancePayload,
      };
    } catch {
      return { maintenance: null };
    }
  },
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background text-foreground sec-violet">
      <div className="text-center">
        <p className="label-mono mb-2">404 · Lost in space</p>
        <h1 className="text-4xl font-display">This coordinate doesn't exist.</h1>
      </div>
    </div>
  ),
  pendingComponent: MaintenanceSkeleton,
  pendingMs: 0,
  component: RootComponent,
});

type MaintenancePayload = {
  title: string;
  message: string;
  tone: "info" | "warn" | "promo";
  until: string | null;
  updatedAt: string | null;
};

function MaintenanceSkeleton() {
  // Rendered during loader-pending phase on client-side nav so users NEVER
  // see interactive marketing content while the maintenance flag resolves.
  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black text-white/70">
      <div className="animate-pulse text-xs uppercase tracking-[0.3em]">Loading…</div>
    </div>
  );
}

function useCountdown(until: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until]);
  if (!until) return null;
  const diff = Date.parse(until) - now;
  if (diff <= 0) return "any moment now";
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
}

function RootComponent() {
  const { maintenance } = Route.useLoaderData();
  const location = useLocation();
  const path = location.pathname;
  const exempt = MAINTENANCE_EXEMPT.some((p) => path === p || path.startsWith(p + "/"));

  if (maintenance && !exempt) {
    return <MaintenanceScreen data={maintenance} />;
  }

  return (
    <>
      <PageViewLogger />
      <AnnouncementBar />
      <Outlet />
    </>
  );
}

function MaintenanceScreen({ data }: { data: MaintenancePayload }) {
  const countdown = useCountdown(data.until);
  const tone = data.tone;
  const chip =
    tone === "warn"  ? "border-amber-400/60 text-amber-200 bg-amber-500/10" :
    tone === "promo" ? "border-fuchsia-500/60 text-fuchsia-200 bg-fuchsia-500/10" :
                        "border-cyan-400/60 text-cyan-200 bg-cyan-500/10";
  const glow =
    tone === "warn"  ? "from-amber-500/20 via-transparent to-red-500/10" :
    tone === "promo" ? "from-fuchsia-500/20 via-transparent to-purple-500/10" :
                        "from-cyan-500/20 via-transparent to-blue-500/10";

  const updated = data.updatedAt ? new Date(data.updatedAt) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="maint-title"
      className="fixed inset-0 z-[9999] grid place-items-center px-6 text-white overflow-hidden bg-black"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${glow} pointer-events-none`} />
      <div className="absolute inset-0 backdrop-blur-md pointer-events-none" />
      <div className="relative max-w-xl text-center">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs uppercase tracking-[0.25em] mb-6 ${chip}`}>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          Maintenance
        </div>
        <h1 id="maint-title" className="text-4xl md:text-5xl font-display mb-4 leading-tight">
          {data.title}
        </h1>
        <p className="text-white/70 text-base md:text-lg whitespace-pre-wrap">
          {data.message}
        </p>
        {countdown && (
          <div className="mt-8 inline-flex flex-col items-center gap-1">
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/50">Back online in</span>
            <span className="font-mono text-2xl md:text-3xl tabular-nums text-white">{countdown}</span>
          </div>
        )}
        {updated && (
          <p className="mt-8 text-xs text-white/40">
            Last updated {updated.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-hydration boot script below intentionally
    // rewrites <html>'s class from the SSR default ("light") to whatever the
    // visitor picked last ("dark" or "light") BEFORE React hydrates. That is a
    // legit, wanted mismatch, it's how we avoid a wrong-theme flash. Without
    // this flag React logs a noisy hydration warning on every load, which also
    // costs a full client re-render of the root subtree. Silencing it fixes both.
    <html lang="en" className="light" suppressHydrationWarning>
      {/* suppressHydrationWarning on <head> and the boot <script>: Lovable's
          dev-only Vite plugin injects `data-tsd-source` attributes with
          line-number values that differ between SSR and client renders (the
          plugin runs at different points in each pipeline). It's dev
          noise, not a real mismatch, silencing it avoids a full root
          re-hydrate on every preview load. */}
      <head suppressHydrationWarning>
        <HeadContent />
        {/* Pre-hydration theme boot, reads localStorage and applies the
            `.light`/`.dark` class BEFORE first paint, so users never see a
            wrong-theme flash. Default = LIGHT. Keep the key in sync with
            ThemeToggle.tsx (key: ng-theme). */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('ng-theme')||'light';var d=document.documentElement;d.classList.remove('light','dark');d.classList.add(t);}catch(e){}`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
