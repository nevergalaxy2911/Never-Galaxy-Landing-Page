/**
 * Portfolio filter/category config, shared client + server safe (no imports
 * that pull in server-only modules).
 *
 * WHY THIS FILE EXISTS
 *   The public Portfolio section renders a tab bar (Video / Motion / Graphics
 *   / Website / ...) whose tabs are ADMIN-EDITABLE. The list is stored in
 *   `site_settings` under key `portfolio.categories` as JSON. If the DB is
 *   empty or unreachable we fall back to DEFAULT_CATEGORIES below so the
 *   site never blanks out.
 *
 * HOW A CATEGORY WORKS
 *   • id     — machine key used to group portfolio_items rows (row.category
 *              must match a category id to appear under that tab)
 *   • label  — text shown on the tab button
 *   • icon   — one of ICON_CHOICES (mapped to a lucide-react icon in
 *              Portfolio.tsx). Add new icons by extending ICON_CHOICES AND
 *              the ICONS map in Portfolio.tsx.
 *   • kind   — "video" → tile uses YouTube facade + Play button (needs a
 *              YouTube URL in the row's url field)
 *              "image" → tile shows an image (row.thumb_url or row.url)
 *   • enabled — false hides the tab entirely (useful for "coming soon"
 *               categories you don't want visible yet)
 *
 * HOW TO ADD A NEW FILTER
 *   /admin → Filters tab → "+ Add filter". Set id (e.g. "podcast"), label,
 *   icon, kind, enabled. Save. Then in Portfolio tab, add rows with
 *   category = "podcast".
 */

export type CategoryKind = "video" | "image";

export type PortfolioCategory = {
  id: string;
  label: string;
  icon: string; // key from ICON_CHOICES
  kind: CategoryKind;
  enabled: boolean;
};

export const ICON_CHOICES = [
  "Play",
  "Sparkles",
  "ImageIcon",
  "Globe",
  "Video",
  "Camera",
  "Palette",
  "Music",
  "Mic",
  "Layers",
] as const;

export const DEFAULT_CATEGORIES: PortfolioCategory[] = [
  { id: "video",   label: "Video",    icon: "Play",      kind: "video", enabled: true },
  { id: "motion",  label: "Motion",   icon: "Sparkles",  kind: "video", enabled: true },
  { id: "graphic", label: "Graphics", icon: "ImageIcon", kind: "image", enabled: true },
  { id: "web",     label: "Website",  icon: "Globe",     kind: "image", enabled: true },
];

/** Validate + coerce whatever the DB returns into a clean list. */
export function sanitizeCategories(input: unknown): PortfolioCategory[] {
  if (!Array.isArray(input)) return DEFAULT_CATEGORIES;
  const out: PortfolioCategory[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (!id || !label) continue;
    const icon = typeof r.icon === "string" && (ICON_CHOICES as readonly string[]).includes(r.icon)
      ? r.icon
      : "ImageIcon";
    const kind: CategoryKind = r.kind === "video" ? "video" : "image";
    const enabled = r.enabled !== false;
    out.push({ id, label, icon, kind, enabled });
  }
  return out.length ? out : DEFAULT_CATEGORIES;
}
