/* =============================================================================
 * WORK CATEGORIES — the four content buckets of the Work section.
 * -----------------------------------------------------------------------------
 * WHY THIS FILE
 *   Rows have been saved over time with slightly different spellings
 *   ("graphic" vs "graphics", "web" vs "website"). Everything funnels through
 *   normalizeCategory() so old rows keep showing up under the right tab.
 *
 * MOTION IS SHOWN INSIDE VIDEO
 *   Motion pieces are stored as their own category (so the admin can tell them
 *   apart) but the public tab bar folds them into VIDEO. Change TAB_OF below if
 *   you ever want a separate Motion tab.
 *
 * HOW TO MODIFY
 *   • New category → add to WORK_CATEGORIES + ALIASES + TAB_OF.
 *   • Tab labels/order → edit WORK_TABS.
 * ========================================================================== */

export type WorkCategory = "video" | "motion" | "graphics" | "website";

export const WORK_CATEGORIES: Array<{ id: WorkCategory; label: string; hint: string }> = [
  { id: "video", label: "Video", hint: "YouTube link, any ratio" },
  { id: "motion", label: "Motion", hint: "YouTube link, shows in the Video tab" },
  { id: "graphics", label: "Graphics", hint: "Image or asset link" },
  { id: "website", label: "Website", hint: "Live site link plus a thumbnail" },
];

const ALIASES: Record<string, WorkCategory> = {
  video: "video",
  videos: "video",
  motion: "motion",
  "motion-graphics": "motion",
  graphic: "graphics",
  graphics: "graphics",
  design: "graphics",
  thumbnail: "graphics",
  web: "website",
  website: "website",
  websites: "website",
};

export function normalizeCategory(raw: string): WorkCategory {
  return ALIASES[String(raw ?? "").trim().toLowerCase()] ?? "video";
}

/** Public tab ids, in display order. */
export type WorkTab = "all" | "video" | "graphics" | "website";

export const WORK_TABS: Array<{ id: WorkTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "video", label: "Video" },
  { id: "graphics", label: "Graphics" },
  { id: "website", label: "Website" },
];

/** Which public tab a stored category belongs to. */
export function tabOf(category: WorkCategory): Exclude<WorkTab, "all"> {
  if (category === "motion" || category === "video") return "video";
  return category;
}

/** True when the category plays a YouTube embed. */
export function isVideoCategory(category: WorkCategory): boolean {
  return category === "video" || category === "motion";
}
