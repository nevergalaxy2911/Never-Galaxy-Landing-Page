# Changelog & Work Record

## 2026-08-10 (Current Session)

### Fixed "Failed to save project" in Admin Panel
- **Diagnosis**: The `upsertPortfolio` function was attempting to save aspect ratios to a `site_settings` row named `portfolio.aspects`. In production, this row might not exist or the `maybeSingle()` query might behave differently if RLS or permissions aren't perfect for the admin client (though service role usually bypasses). More importantly, the `id` resolution in `upsertPortfolio` was slightly brittle if the item was new and the `select("id")` didn't return immediately as expected.
- **Fix**: Hardened `upsertPortfolio` in `src/lib/admin-data.functions.ts` to ensure `published` defaults to `true` on new items (so they appear on the site immediately). Improved error logging and ensured the core row save is prioritized.
- **Admin UI**: Updated `src/routes/_gated/admin.tsx` to include `published: true` in the initial payload and improved the toast error feedback to be more descriptive.

### Fixed Portfolio Video Visibility
- **Diagnosis**: The public site uses `getPublicPortfolio` which filters by `published = true`. Items added via the Admin Panel were missing the `published` flag, causing them to be saved as `null` or `false` (depending on DB defaults), making them invisible to visitors.
- **Fix**: Modified `upsertPortfolio` to explicitly set `published: true` for new items if not provided.

### Centralized Documentation
- **Action**: Created `RECORDS.md` (this file) to maintain a persistent log of architectural changes and fixes, ensuring context is never lost across sessions.


### Production Readiness & Handoff
- **Auth Gate**: Flipped `BYPASS_AUTH` to `false` in `src/routes/_gated/route.tsx`. The Admin Panel is now secured by Supabase Auth and the `admin` role check.
- **SQL Verification**: Confirmed `SUPABASE_SETUP.sql` covers all existing logic.
- **Documentation**: Verified `MODIFICATION_GUIDE.md` (V7.0) is the exhaustive source of truth for the user.


### Admin Bootstrap
- **SQL Update**: Hardcoded the user ID `b88cdead-a797-489f-b51d-f07f60394a5b` into the `SUPABASE_SETUP.sql` bootstrap section as requested.

---
*End of Record*
