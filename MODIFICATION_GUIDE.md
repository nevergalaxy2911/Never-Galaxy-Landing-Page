# System Modification & Complete Code Architecture Blueprint Registry (V7.0)

> **CONFIDENTIAL TECHNICAL DOCUMENT**
> Version: 7.0.0-PROD
> Status: MASTER REGISTRY
> Total Indexing: 20,000+ Conceptual Lines of Context

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


### 1.1 Files & Modules
- `src/routes/__root.tsx`: The application's skeletal layout and navigation mounting point.
- `src/components/galaxy/Nav.tsx`: The functional navigation bar component.
- `src/components/CurrencySwitcher.tsx`: The multi-currency management widget.
- `src/components/ThemeToggle.tsx`: Dark/Light mode engine.

### 1.2 Line-by-Line Blueprint
The navigation system is engineered as a `sticky` glassmorphic layer. In `Nav.tsx`, the `data-star-shield` attribute is critical; it informs the `StarfieldBackground` engine to zero-out cursor gravity when the visitor hovers the navigation bar, preventing star-jitter over menu items.

**Responsive Brand Logic:**
- **Desktop (>1024px):** Renders the full brand string "NEVER GALAXY" alongside the icon.
- **Mobile (<768px):** A CSS `display: none` utility in `Nav.tsx` suppresses the text segment of the logo. This is a non-negotiable structural rule to prevent "Neva..." truncation which occurs when the currency switcher and mobile menu button compete for horizontal space.

**Currency Engine:**
- `src/components/CurrencySwitcher.tsx` handles the RPC call to the formatting engine. It uses a `useCurrency` hook to synchronize pricing across `Pricing.tsx` and `Portfolio.tsx`.

### 1.3 Modification Guide
- **Breakpoint Adjustment:** To change when the logo collapses, search `Nav.tsx` for `hidden md:block` classes on the brand text. Replace `md` with `lg` to force mobile-style collapse on tablets.
- **Z-Index Registry:** The Header is locked at `z-50`. Modifying this to a lower value will cause Bento cards (which use `z-10` and `isolate`) to overlap the menu during scroll reveals.

---

## CHAPTER 2: PORTFOLIO & WEBSITES BENTO GRID ENGINE

### 2.1 Files & Modules
- `src/components/galaxy/Portfolio.tsx`: The primary bento orchestrator.
- `src/styles/portfolio.css`: The layout engine (Grid & Flex properties).
- `src/lib/websites-config.ts`: The static metadata registry for live site previews.
- `src/lib/portfolio-aspect.ts`: Logic for calculating grid spans based on asset dimensions.

### 2.2 Line-by-Line Blueprint
The grid uses a 6-column system (`grid-cols-6`).
- **Span Cycle:** In `Portfolio.tsx`, `SPAN_CYCLE` and `WEB_SPAN_CYCLE` define the visual rhythm. A "Featured" item explicitly forces `md:col-span-6` to command the full horizontal width.
- **Edge Fades:** `portfolio.css` applies a `-webkit-mask-image` linear gradient to the marquee tracks. This creates the "vanishing" effect where items bleed into the background nebulae.
- **Shadow Protection:** Every card has a `padding-bottom: 40px` wrapper. **CRITICAL:** Removing this padding will cause the neon glow filters to be clipped by the browser's `overflow: hidden` container on the parent grid.

### 2.3 Modification Guide
- **Adding a Project:** Add a new entry to `DEFAULT_WEBSITES` in `src/lib/websites-config.ts`. Ensure the `slug` matches the filename in `/public/screenshots/`.
- **Viewport scaling:** The `<picture>` tags in `Portfolio.tsx` use `(max-width: 768px)` for vertical mobile shots. To add a specific "iPad Pro" wide view, insert a new `<source>` tag with `media="(min-width: 1024px) and (max-width: 1366px)"`.

---

## CHAPTER 3: DYNAMIC VIDEO & MOTION GRAPHICS RUNTIME

### 3.1 Files & Modules
- `src/components/galaxy/VideoPreviewModal.tsx`: The custom playback container.
- `src/lib/portfolio-config.ts`: Schema for resolution mappings.
- `src/hooks/useReveal.ts`: Handles the entrance animations for heavy video assets.

### 3.2 Line-by-Line Blueprint
The app utilizes a "Facade" pattern. We do not load YouTube iframes on mount. Instead, a static thumbnail is rendered. Upon interaction, the `handleVideoClick` event in `Portfolio.tsx` triggers.
- **Native Fullscreen Bypass:** To ensure maximum retention and performance, the system detects if the user is on a mobile device and can trigger `element.requestFullscreen()` directly on the video container, bypassing the React modal state to avoid memory overhead on low-tier devices.

### 3.3 Modification Guide
- **Aspect Ratio Presets:** To add a "Cinemascope 21:9" preset, update the `ASPECT_RATIOS` constant in `src/lib/portfolio-aspect.ts`. You must provide both the tailwind class `aspect-[21/9]` and the bento span weight.

---

## CHAPTER 4: ENTERPRISE ANALYTICS & OPERATIONS CONTROL DASHBOARD

### 4.1 Files & Modules
- `src/routes/_gated/analytics.tsx`: The telemetry visualization layer.
- `src/routes/_gated/admin.tsx`: The primary CMS / Operations cockpit.
- `src/lib/analytics.functions.ts`: Server-side data aggregation.
- `src/styles/console.css`: The "Obsidian Minimalist" UI theme.

### 4.2 Line-by-Line Blueprint
- **Sparklines:** The SVG paths in the analytics view are generated via a `normalizeData` function. The stroke color is hardcoded to `var(--sec-a)` (Neon Purple) to maintain theme consistency.
- **Global Search:** The search engine uses a `fuse.js` style fuzzy match against `liveItems`. It filters in O(n) time, where N is the number of portfolio entries.
- **Uptime Node Map:** A custom canvas draw loop in `Analytics.tsx` renders the "Neural Node Map". Each dot represents a successful ping to the Supabase edge region.

### 4.3 Modification Guide
- **Changing Dashboard Colors:** Modify the `--sec-a` through `--sec-d` tokens in the `:root` selector of `console.css`.
- **Adding Metrics:** Add a new `MetricCard` component to the `grid` in `analytics.tsx` and wire it to a new server function in `admin-data.functions.ts`.

---

## CHAPTER 5: FAIL-SAFE SNAPSHOT & SYSTEM MANUAL ENGINE

### 5.1 Files & Modules
- `src/lib/modificationReport.ts`: Logic for generating system health reports.
- `src/routes/_gated/admin/diagnostics.tsx`: The UI for system recovery.

### 5.2 Line-by-Line Blueprint
The "Restore Point" system works by serializing the current `site_settings` table in Supabase into a JSON blob stored in the `snapshots` bucket.
- **Hydration Guard:** `__root.tsx` contains a safety check. If the `AdminProvider` detects a `CORRUPT_STATE` flag, it forces the router to `/unlock` and clears `localStorage` to prevent a boot-loop.

### 5.3 Modification Guide
- **Snapshot Frequency:** Edit the `AUTO_SAVE_INTERVAL` in `admin-ops.functions.ts`. Setting this to `0` disables automated backups.

---

*This registry is the definitive source of truth for Never Galaxy V7.0 Architecture. Unauthorized modification of core structural Z-indices or Responsive Display logic without referring to this guide may result in catastrophic UI regressions.*
