// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact,
// tailwindcss, tsConfigPaths, nitro (Cloudflare default), componentTagger (dev),
// VITE_* env injection, @ alias, React/TanStack dedupe, and sandbox detection.
// Do NOT add those plugins manually — duplicates break the build.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Route TanStack Start's server entry through our SSR error wrapper.
    server: { entry: "server" },
  },
  // Deploy target: Vercel. Overrides the Cloudflare default so the build
  // emits .vercel/output (functions + static assets) instead of Workers
  // artifacts — otherwise Vercel serves the SPA fallback for /assets/*.css
  // requests, causing the "MIME text/html" white screen.
  nitro: {
    preset: process.env.NITRO_PRESET || "vercel",
  },
});
