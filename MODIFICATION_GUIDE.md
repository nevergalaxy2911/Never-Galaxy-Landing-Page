# System Modification & Complete Code Architecture Blueprint Registry (V8.0)

> **CONFIDENTIAL TECHNICAL DOCUMENT**
> Version: 8.0.0-PROD
> Status: MASTER REGISTRY
> Total Indexing: 25,000+ Conceptual Lines of Context

## 🚀 QUICKSTART: 5-STEP CUSTOMIZATION GUIDE

1.  **Identity & Socials:** Edit `src/config/site.ts` to update your brand name, emails, and social media URLs globally.
2.  **Portfolio Data:** Use the Admin Panel (`/admin`) to add, edit, or remove portfolio items (videos/websites).
3.  **Pricing Control:** Go to `/admin` > Pricing to adjust plans and multi-currency rates (synced with the Currency Switcher).
4.  **Content Edits:** Modify component files under `src/components/galaxy/` (e.g., `Hero.tsx`, `About.tsx`) for static text.
5.  **Performance Check:** Verify image optimization in `public/screenshots/` and check the maintenance toggle in `/admin` before launch.

[Jump to Folder Structure](#chapter-1-core-architecture--navigation-systems) | [Jump to Customization](#chapter-2-portfolio--websites-bento-grid-engine) | [Jump to Performance](#chapter-6-performance-engineering--optimization-recipes) | [Jump to Deployment](#chapter-7-deployment-readiness-checklist-final-shield)

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

*This registry is the definitive source of truth for Never Galaxy V8.0 Architecture. Unauthorized modification of core structural Z-indices or Responsive Display logic without referring to this guide may result in catastrophic UI regressions.*

