/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "../styles.css?url";
// H1 display font — preloaded so the LCP hero heading paints in Archivo Black
// on first frame instead of waiting for the CSS @import chain to resolve the
// woff2. Vite resolves this to the same hashed asset URL that the @fontsource
// CSS references, so the browser sees a cache hit (no double download).
import archivoBlackWoff2 from "@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2?url";


/* -----------------------------------------------------------------------------
 * ROOT ROUTE — html shell + fonts + default meta.
 * HOW TO MODIFY:
 * • Fonts: swap the Google Fonts URL below. Display = Archivo Black, Body = Hind.
 * • Default title/description: edit `head()` meta.
 * --------------------------------------------------------------------------- */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Never Galaxy — Cosmic-grade creative studio" },
      {
        name: "description",
        content:
          "Never Galaxy — cosmic-grade creative studio for cinematic video editing, motion graphics, and thumbnail design that make brands feel bigger.",
      },
      { name: "theme-color", content: "#0b0510", media: "(prefers-color-scheme: dark)" },
      { name: "theme-color", content: "#faf7ff", media: "(prefers-color-scheme: light)" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Never Galaxy" },
      { property: "og:title", content: "Never Galaxy — Cosmic-grade creative studio" },
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
      // Preload the H1 display font — cuts LCP element render delay because
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
      // Fonts are now self-hosted via @fontsource in src/styles.css — no
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
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center bg-background text-foreground sec-violet">
      <div className="text-center">
        <p className="label-mono mb-2">404 · Lost in space</p>
        <h1 className="text-4xl font-display">This coordinate doesn't exist.</h1>
      </div>
    </div>
  ),
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-hydration boot script below intentionally
    // rewrites <html>'s class from the SSR default ("light") to whatever the
    // visitor picked last ("dark" or "light") BEFORE React hydrates. That is a
    // legit, wanted mismatch — it's how we avoid a wrong-theme flash. Without
    // this flag React logs a noisy hydration warning on every load, which also
    // costs a full client re-render of the root subtree. Silencing it fixes both.
    <html lang="en" className="light" suppressHydrationWarning>
      {/* suppressHydrationWarning on <head> and the boot <script>: Lovable's
          dev-only Vite plugin injects `data-tsd-source` attributes with
          line-number values that differ between SSR and client renders (the
          plugin runs at different points in each pipeline). It's dev
          noise, not a real mismatch — silencing it avoids a full root
          re-hydrate on every preview load. */}
      <head suppressHydrationWarning>
        <HeadContent />
        {/* Pre-hydration theme boot — reads localStorage and applies the
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
