/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
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
      return { maintenance: null as null | { title: string; message: string } };
    }
    try {
      const r = await getPublicFlag({ data: { key: "maintenance_mode" } });
      if (r.enabled !== true) return { maintenance: null };
      const v = (r.value ?? {}) as { title?: string; message?: string };
      return {
        maintenance: {
          title: (v.title && String(v.title).trim()) || "We'll be back shortly.",
          message: (v.message && String(v.message).trim()) ||
            "Never Galaxy is briefly offline for updates. Thanks for your patience — check back in a few minutes.",
        },
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
  component: RootComponent,
});

function RootComponent() {
  const { maintenance } = Route.useLoaderData();
  const location = useLocation();
  const path = location.pathname;
  const exempt = MAINTENANCE_EXEMPT.some((p) => path === p || path.startsWith(p + "/"));

  if (maintenance && !exempt) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[9999] grid place-items-center bg-black text-white px-6"
        style={{ backdropFilter: "blur(8px)" }}
      >
        <div className="max-w-lg text-center">
          <div className="inline-block px-3 py-1 rounded-full border border-fuchsia-500/50 text-fuchsia-300 text-xs uppercase tracking-widest mb-6">
            Maintenance
          </div>
          <h1 className="text-4xl md:text-5xl font-display mb-4 leading-tight">
            {maintenance.title}
          </h1>
          <p className="text-white/70 text-base md:text-lg whitespace-pre-wrap">
            {maintenance.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageViewLogger />
      <AnnouncementBar />
      <Outlet />
    </>
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
