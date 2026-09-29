# System Modification & Complete Code Architecture Blueprint Registry (V8.4)

> **CONFIDENTIAL TECHNICAL DOCUMENT**
> Version: 8.4.0-PROD
> Status: MASTER REGISTRY
> Total Indexing: 25,000+ Conceptual Lines of Context

## 🚀 QUICKSTART: 5-STEP CUSTOMIZATION GUIDE

1.  **Identity & Socials:** Edit `src/config/site.ts` to update your brand name, emails, and social media URLs globally.
2.  **Portfolio Data:** Use the Admin Panel (`/admin`) to add, edit, or remove portfolio items (videos/websites).
3.  **Pricing Control:** Go to `/admin` > Pricing to adjust plans and multi-currency rates (synced with the Currency Switcher).
4.  **Admin Setup:** Run the bootstrap `INSERT` from `SUPABASE_SETUP.sql` with your User ID (found in Supabase Auth -> Users) to grant yourself access.
5.  **Performance & Stability:** Verify image optimization in `public/screenshots/` and confirm navigation stability via `tests/navigation-stability.test.ts`.

[Jump to Folder Structure](#chapter-1-core-architecture--navigation-systems) | [Jump to Customization](#chapter-2-portfolio--websites-bento-grid-engine) | [Jump to Performance](#chapter-6-performance-engineering--optimization-recipes) | [Jump to Deployment](#chapter-7-deployment-readiness-checklist-final-shield) | [Jump to Admin Security](#chapter-9-admin-access--security-provisioning) | [Jump to Error Handling](#chapter-10-runtime-stability--error-recovery) | [Jump to Porting Guide](#chapter-21-porting-guide--deployment-alignment)



---

## CHAPTER 0: DATABASE & MIGRATION PROTOCOL (CRITICAL)

### 0.1 The Migration Folder
The `/supabase/migrations/` folder contains the source of truth for your database schema.
- **20260719...sql**: Core architecture (Users, Roles, Portfolio, Settings, Flags, Analytics).
- **20260808...sql**: UI enhancements (Portfolio featured flag, video aspect ratios, enhanced inquiries).

### 0.2 Should you run these?
**NO.** Do not manually run these in the Supabase SQL editor if your site is already working.
- **Lovable Cloud** manages these automatically. When you deploy, the platform detects the migration files and applies them to your production database.
- **Manual Execution Risk:** Running them manually can cause "Already Exists" errors or break the automated sync tracked by the migration history table.

### 0.3 When to use SQL manually?
Only use the SQL editor for **data insertion** (like adding an admin user) or if explicitly instructed by a technical diagnostic. For schema changes, let the automated pipeline handle the files in `/supabase/migrations/`.

---

## CHAPTER 1: CORE ARCHITECTURE & NAVIGATION SYSTEMS

### 1.1 Folder Structure Deep-Dive
- `src/routes/`: TanStack Router configuration. Every `.tsx` file here represents a URL.
- `src/components/`:
    - `galaxy/`: Core visual components (Hero, Nav, Portfolio, etc.).
    - `ui/`: Radix-based atomic components (Buttons, Dialogs, Inputs).
- `src/lib/`: Business logic, server functions (`.functions.ts`), and utility hooks.
- `src/config/`: Centralized settings (Site metadata, navigation links, pricing).
- `public/`: Static assets (Icons, images, audio, screenshots).

### 1.2 Navigation Blueprint
The navigation system is engineered as a `sticky` glassmorphic layer. In `Nav.tsx`, the `data-star-shield` attribute is critical; it informs the `StarfieldBackground` engine to zero-out cursor gravity when the visitor hovers the navigation bar.

**Responsive Brand Logic:**
- **Desktop (>1024px):** Renders the full brand string "NEVER GALAXY".
- **Mobile (<768px):** Collapses to icon-only to prevent overflow.

### 1.3 Modification Guide
- **Breakpoint Adjustment:** Search `Nav.tsx` for `hidden md:block`. Replace `md` with `lg` to force mobile-style collapse on tablets.
- **Social Links:** Update `NAV_ITEMS` in `src/config/site.ts`.

---

## CHAPTER 2: PORTFOLIO & WEBSITES BENTO GRID ENGINE

### 2.1 Files & Modules
- `src/components/galaxy/Portfolio.tsx`: The primary bento orchestrator.
- `src/styles/portfolio.css`: The layout engine (Grid & Flex properties).
- `src/lib/websites-config.ts`: The static metadata registry for live site previews.

### 2.2 Bento Spacing & Spans
The grid uses a 6-column system (`grid-cols-6`).
- **Span Cycle:** In `Portfolio.tsx`, `SPAN_CYCLE` and `WEB_SPAN_CYCLE` define the visual rhythm.
- **Featured Rule:** A "Featured" item explicitly forces `md:col-span-6`.

### 2.3 Customizing Grid Spans
If you want to change how cards look, edit the `SPAN_CYCLE` array in `Portfolio.tsx`. 
- `col-span-4`: Takes up 2/3 of the row.
- `col-span-2`: Takes up 1/3 of the row.

---

## CHAPTER 3: DYNAMIC VIDEO & MOTION GRAPHICS RUNTIME

### 3.1 Facade Pattern
We do not load YouTube iframes on mount. Instead, a static thumbnail is rendered. Upon interaction, the `handleVideoClick` event in `Portfolio.tsx` triggers the modal.

### 3.2 Resolution & Ratio Logic
- **16:9 (Landscape):** Standard for tech screen recordings.
- **9:16 (Portrait):** Optimized for social media edits (TikTok/Reels).
- **Custom Spans:** Portrait videos are automatically assigned a narrower grid span to prevent empty space.

---

## CHAPTER 4: ENTERPRISE OPERATIONS & ADMIN CONSOLE

### 4.1 Admin Gating
The Admin Panel is secured via Supabase Auth and a role-based allowlist.
- **File:** `src/routes/_gated/route.tsx`
- **Logic:** Checks `public.has_role(auth.uid(), 'admin')`.

### 4.2 Maintenance Mode
A global toggle in the Admin Settings allows you to put the site into Maintenance Mode.
- **Effect:** Redirects all non-admin traffic to the `/maintenance` route.
- **Implementation:** Controlled by the `maintenance_mode` feature flag.

---

## CHAPTER 5: ADVANCED COMPONENT CUSTOMIZATION RECIPES

### 5.1 Currency Switcher Integration
The currency switcher affects all pricing components.
- **Where to add currencies:** `CURRENCIES` array in `src/components/CurrencySwitcher.tsx`.
- **Conversion Logic:** Uses a fixed base rate (USD/INR) defined in `useCurrency` hook.

### 5.2 Cursor Ribbon Customization
- **File:** `src/hooks/use-canvasCursor.ts`
- **Tail Length:** Adjust the `points` array length.
- **Colors:** Modify the gradient stops in the `draw` function.

---

## CHAPTER 6: PERFORMANCE ENGINEERING & OPTIMIZATION RECIPES

### 6.1 LCP (Largest Contentful Paint)
- **Preloading:** Hero images are preloaded via `<link rel="preload">` in `__root.tsx`.
- **Image Formats:** Always use `.webp` for screenshots.
- **Lazy Loading:** All portfolio cards below the fold use `loading="lazy"`.

### 6.2 CLS (Cumulative Layout Shift)
- **Image Dimensions:** Every `<img>` tag must have explicit `width` and `height` attributes to reserve space during load.
- **Font Display:** We use `font-display: swap` to prevent invisible text during font download.

---

## CHAPTER 7: DEPLOYMENT READINESS CHECKLIST (FINAL SHIELD)

### 7.1 Pre-Flight Build
Before deploying to Vercel, run:
```bash
bun run build
```
This ensures all TypeScript types are valid and the production bundle is ready.

### 7.2 Environment Variables (Vercel)
Ensure these are set in your Vercel Dashboard:
- `VITE_SUPABASE_URL`: Your Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key.
- `ADMIN_ALLOWLIST`: (Optional) Comma-separated emails allowed for admin roles.

### 7.3 Smoke Test Steps
1.  **Auth Flow:** Log in to `/auth` and verify you can access `/admin`.
2.  **Portfolio Sync:** Add a test item in the admin panel and verify it appears on the homepage.
3.  **Responsiveness:** Check the site on a mobile device to ensure no horizontal scrolling (overflow).
4.  **Analytics:** Visit the dashboard and verify page views are being recorded.

---

## CHAPTER 8: TROUBLESHOOTING & RECOVERY

### 8.1 Access Denied (403) on Build
If Vercel fails with a 403 error during "dist upload":
- **Cause:** Usually a temporary sync issue with internal storage.
- **Fix:** Add a dummy comment to `src/start.ts` and push to trigger a fresh build hash.

### 8.2 Hydration Mismatch
If you see "Hydration failed" in the console:
- **Cause:** Server-side rendered HTML doesn't match client-side JS (e.g., using `window.innerWidth` in a component body).
- **Fix:** Wrap browser-only code in `useEffect` or use the `useHydrated` hook.

---

## CHAPTER 9: ADMIN ACCESS & SECURITY PROVISIONING

### 9.1 The "Forbidden" Error
If you see a "Can't verify admin" error:
1.  **Sign In:** Ensure you are signed in at `/auth` with an email on the `ADMIN_ALLOWLIST` (in `src/config/site.ts`).
2.  **Role Check:** Check the `user_roles` table in your database. You must have a row linking your `user_id` to the `admin` role.
3.  **Bootstrap:** Run the SQL from `SUPABASE_SETUP.sql` to create the tables, policies, and initial admin role.

### 9.2 Finding your UUID
- In the Supabase Dashboard, go to **Authentication** -> **Users**.
- Copy the **User ID** (UUID) for your account.
- Use this ID in the final `INSERT` statement in `SUPABASE_SETUP.sql` to grant yourself access.

---

## CHAPTER 10: RUNTIME STABILITY & ERROR RECOVERY

### 10.1 Navigation Abort Filter
The system includes a hardened **Abort Signal Filter** to prevent "Error: aborted" crashes during rapid navigation.
- **File:** `src/start.ts`
- **Logic:** Identifies `AbortError`, `abortincoming`, and `socketonclose` signals and re-throws them to the framework rather than triggering a crash page.
- **Verification:** Run `bunx vitest run tests/navigation-stability.test.ts` to verify the logic remains intact.

### 10.2 Branded Error Boundaries
If a real unexpected crash occurs, the UI will never render a blank screen.
- **Server-Side:** `errorMiddleware` in `src/start.ts` returns a branded `500` Response.
- **Client-Side:** The `errorComponent` in `src/routes/__root.tsx` provides a "Reload Page" fallback for runtime UI failures.

---

*This registry is the definitive source of truth for Never Galaxy V8.2 Architecture. Unauthorized modification of core structural Z-indices or Responsive Display logic without referring to this guide may result in catastrophic UI regressions.*




---

## CHAPTER 11: FULL-STACK WEBSITES & CASE STUDY ARCHITECTURE

### 11.1 The Websites Tab
The "Websites" section in the Admin Panel is a specialized module for managing interactive site previews. Unlike general portfolio items which are row-based in the database, Websites are currently mirrored in the `portfolio.websites` key within `site_settings` to allow for complex nested JSON (highlights, stack, live links).

### 11.2 Case Study Routing
Every website item has a `slug`. Navigating to `/work/$slug` triggers the dynamic case study renderer:
- **Renderer:** `src/routes/work.$slug.tsx`
- **Data Hook:** Uses `useSuspenseQuery` with `getWebsites` server function.
- **Visuals:** Uses the same glassmorphic design system to maintain brand consistency.

### 11.3 Modification Protocol
- **Adding a Site:** Go to Admin -> Websites -> Add Website. Provide the title, live URL, and a compelling description.
- **Editing Highlights:** Highlights appear as bullet points or tags in the case study view. Keep them under 3 words for maximum impact.

---

## CHAPTER 12: ADVANCED UI/UX & COSMIC MOTION SYSTEMS

### 12.1 The Canvas Ribbon Cursor
The trail follows the cursor using a requestAnimationFrame loop with physics-based lerping.
- **Logic:** `src/hooks/use-canvasCursor.ts`
- **Customization:**
  - **Tail Length:** Change the `POINT_COUNT` constant.
  - **Friction/Spring:** Adjust the `friction` and `spring` variables to change the "floatiness".
  - **Colors:** The palette is defined in the `draw` function using a cycle through white, gold, and red.

### 12.2 Scroll Reveal Engine
All sections use the `useReveal` hook which leverages `IntersectionObserver`.
- **Thresholds:** The default `0.1` means the animation triggers when 10% of the element is visible.
- **Directional Anim:** You can pass `direction="up" | "down" | "left" | "right"` to change the entrance vector.

### 12.3 Starfield Interaction
The background stars have "gravity" that pulls them toward the cursor. This is disabled over interactive UI using the `data-star-shield` attribute on parent containers. If a new component blocks the starfield unfairly, check its padding and the presence of this attribute.

---

## CHAPTER 13: SERVER RUNTIME & SECURITY ARCHITECTURE

### 13.1 TanStack Start Execution Model
This project uses TanStack Start, which splits code between client and server.
- **.functions.ts:** These files are server-only. They run in a secure Worker environment.
- **Context Guards:** `requireAdmin()` is used at the start of every sensitive server function to verify the user's Supabase session and role.

### 13.2 Security Definer Functions
We use Postgres functions with `SECURITY DEFINER` to bypass RLS for internal checks (like checking if a user has the 'admin' role) without exposing sensitive tables to public read.

### 13.3 CSRF & Abort Protection
The middleware in `src/start.ts` handles signal filtering. It prevents navigation aborts from crashing the UI by suppressing `AbortError` logs while still allowing the framework to clean up the request.

---

## CHAPTER 14: ASSET PIPELINE & MEDIA OPTIMIZATION

### 14.1 Image Strategy
- **Format:** Always use `.webp` or `.avif` for production images.
- **Naming:** Keep filenames lowercase and use hyphens.
- **Storage:** Place icons in `public/Icons and images/`.

### 14.2 Sound Engineering
The audio engine (`src/lib/soundEngine.ts`) uses the Web Audio API for low-latency playback.
- **Ambience:** A low-pass filtered pad loop.
- **Wind:** A white noise generator with a resonance filter that tracks cursor speed.
- **Quality Modes:** High quality enables spatial reverb; Low quality switches to dry mono to save CPU.

---

## CHAPTER 15: TROUBLESHOOTING & MAINTENANCE PLAYBOOK

### 15.1 "Failed to Save" Errors
1. **Check RLS:** Ensure the user has the 'admin' role in the `user_roles` table.
2. **Schema Alignment:** Go to Admin -> Dashboard and check the "Supabase Alignment" checklist.
3. **Console Logs:** Check the browser console for specific error messages from the server function.

### 15.2 Blank Screen on Load
Usually caused by a hydration mismatch or an uncaught error in a loader.
- **Fix:** Wrap the offending component in `<ClientOnly>` or move storage reads to a `useEffect`.
- **Emergency:** The Error Boundary in `__root.tsx` should catch this and offer a "Reload" button.

### 15.3 Deployment Failures (403/404)
Usually platform-specific.
- **Fix:** Clear cache, delete `.vite` and `.output` folders, and trigger a fresh build. The `src/start.ts` file includes a timestamp to bust platform S3 caches.


---

## CHAPTER 16: REVENUE & PRICING ENGINE CUSTOMIZATION

### 16.1 Multi-Currency Support
The Pricing section (`src/components/galaxy/Pricing.tsx`) is designed to support international visitors.
- **Base Currency:** INR (₹) is the source of truth in the database.
- **Conversion:** Rates are currently calculated client-side in the `CurrencySwitcher`.
- **Modification:** To change the base currency, update the `price_inr` column in the `pricing_plans` table and adjust the `PricingCard` mapping.

### 16.2 Plan Features Management
Features are stored as a JSONB array.
- **Admin Control:** The Pricing Editor allows you to add or remove features dynamically.
- **Highlighting:** The "Most Popular" badge is toggled via the `highlighted` boolean in the database, which adds the `glow-hotspot` CSS class to the card.

---

## CHAPTER 17: SEO, ANALYTICS, & DOM METADATA

### 17.1 Meta Tag Orchestration
Metadata is handled via the TanStack Router `head()` function in each route file.
- **Global Config:** Default title and description templates are in `src/config/site.ts`.
- **Social Previews:** Ensure `og:image` and `twitter:image` point to absolute HTTPS URLs.

### 17.2 Page View Tracking
The system logs views to the `page_views` table.
- **Privacy:** We only track the path and a coarse timestamp. No PII is collected.
- **Optimization:** Views are logged via `navigator.sendBeacon` or an async `fetch` in `__root.tsx` to prevent blocking the main thread during navigation.

---

## CHAPTER 18: THE COSMIC DESIGN SYSTEM (CSS VARIABLES)

### 18.1 Semantic Color Tokens
All glassmorphism effects rely on Tailwind v4 theme variables defined in `src/styles.css`.
- **Surface:** `bg-white/5` with `backdrop-blur-xl`.
- **Borders:** `border-white/10` with high contrast on hover (`group-hover:border-white/20`).

### 18.2 Motion Tokens
- **Ease:** `cubic-bezier(0.2, 0.8, 0.2, 1)` for all cosmic transitions.
- **Duration:** Defaults to `500ms` for section reveals and `200ms` for interactive hotspots.

---

## CHAPTER 19: THIRD-PARTY INTEGRATIONS & API LAYERS

### 19.1 Supabase Connection
The client is generated at `src/integrations/supabase/client.ts`.
- **Edge Functions:** We avoid Supabase Edge Functions in favor of `createServerFn` to keep logic within the Vite bundle.
- **Auth Flow:** Managed by `src/lib/auth.server.ts` and `AdminProvider.tsx`.

### 19.2 External Webhooks
If adding a service like Stripe or Typeform, create a new route under `src/routes/api/public/`. Use Zod to validate the payload and verify signatures within the `handlers.POST` block.

---

## CHAPTER 20: FUTURE SCALING & ARCHITECTURAL DEBT

### 20.1 Component Splitting
As the Admin Panel grows, split large views (like `PortfolioView`) into standalone components under `src/components/admin/`.

### 20.2 Database Indexing
For high-traffic inquiry systems, add an index on `contact_submissions(created_at DESC)` to keep the InboxView snappy.

