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

---
*End of Record*
