/* =============================================================================
 * WORK (PORTFOLIO) ADMIN — server functions for the rebuilt /admin panel.
 * -----------------------------------------------------------------------------
 * WHAT THIS DOES
 *   Full CRUD over `portfolio_items` plus the global maintenance switch.
 *   Every handler calls requireAdmin() first, then loads the service-role
 *   client lazily inside the handler (never at module scope).
 *
 * COLUMN MAPPING (important)
 *   The table grew up with `url` + `position`. The rebuilt panel writes the
 *   canonical names `media_url` + `display_order` AND mirrors them onto the
 *   legacy columns, so older readers keep working. Never stop writing both.
 *
 * HOW TO MODIFY
 *   • New field on an item → add it to WorkItemInput, sanitize() and the
 *     SELECT list, then surface it in src/routes/_gated/admin.tsx.
 *   • New category → extend WORK_CATEGORIES below and in work-categories.ts.
 * ========================================================================== */
import { createServerFn } from "@tanstack/react-start";
import { normalizeCategory, type WorkCategory } from "@/lib/work-categories";
import { parseYouTubeId } from "@/lib/media-links";

async function auth() {
  return (await import("./auth.server")).requireAdmin();
}

export type WorkItemInput = {
  id?: string | null;
  title: string;
  category: string;
  description?: string;
  mediaUrl?: string;
  thumbUrl?: string;
  aspectRatio?: string;
  resolutionTag?: string;
  displayOrder?: number;
  featured?: boolean;
  published?: boolean;
};

export type WorkItemRow = {
  id: string;
  title: string;
  category: WorkCategory;
  description: string;
  mediaUrl: string;
  thumbUrl: string;
  aspectRatio: string;
  resolutionTag: string;
  displayOrder: number;
  featured: boolean;
  published: boolean;
  youtubeId: string | null;
};

const SELECT =
  "id,title,category,subtitle,url,media_url,thumb_url,aspect_ratio,resolution_tag,display_order,position,featured,published";

/** DB row -> UI shape. */
function toRow(r: Record<string, unknown>): WorkItemRow {
  const media = String(r.media_url ?? r.url ?? "");
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    category: normalizeCategory(String(r.category ?? "")),
    description: String(r.subtitle ?? ""),
    mediaUrl: media,
    thumbUrl: String(r.thumb_url ?? ""),
    aspectRatio: String(r.aspect_ratio ?? "16:9"),
    resolutionTag: String(r.resolution_tag ?? ""),
    displayOrder: Number(r.display_order ?? r.position ?? 0),
    featured: !!r.featured,
    published: r.published !== false,
    youtubeId: parseYouTubeId(media) ?? null,
  };
}

function sanitize(d: WorkItemInput) {
  const title = String(d.title ?? "").trim();
  if (!title) throw new Error("Give this piece a title before saving.");
  const category = normalizeCategory(String(d.category ?? ""));
  const media = String(d.mediaUrl ?? "").trim();

  if ((category === "video" || category === "motion") && media && !parseYouTubeId(media)) {
    throw new Error("That is not a YouTube link. Open the video, hit Share, and paste the link it gives you.");
  }

  const order = Number.isFinite(Number(d.displayOrder)) ? Math.round(Number(d.displayOrder)) : 0;
  const row: Record<string, unknown> = {
    title,
    category,
    subtitle: String(d.description ?? "").slice(0, 400),
    // canonical + legacy mirror, kept identical on purpose
    media_url: media,
    url: media,
    thumb_url: String(d.thumbUrl ?? "").trim(),
    aspect_ratio: String(d.aspectRatio ?? "16:9"),
    resolution_tag: String(d.resolutionTag ?? "").trim(),
    display_order: order,
    position: order,
    featured: !!d.featured,
    published: d.published !== false,
    updated_at: new Date().toISOString(),
  };
  if (d.id) row.id = d.id;
  return row;
}

export const listWorkItems = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ rows: WorkItemRow[]; error: string | null }> => {
    await auth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) return { rows: [], error: "Database is not configured for this deployment." };
    const { data, error } = await supabaseAdmin
      .from("portfolio_items")
      .select(SELECT)
      .order("display_order", { ascending: true });
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []).map((r) => toRow(r as Record<string, unknown>)), error: null };
  },
);

export const saveWorkItem = createServerFn({ method: "POST" })
  .inputValidator((d: WorkItemInput) => d)
  .handler(async ({ data }) => {
    await auth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Database is not configured for this deployment.");
    const row = sanitize(data);
    const { data: saved, error } = await supabaseAdmin
      .from("portfolio_items")
      .upsert(row)
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, item: toRow(saved as Record<string, unknown>) };
  });

export const deleteWorkItem = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Nothing selected to remove.");
    return d;
  })
  .handler(async ({ data }) => {
    await auth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Database is not configured for this deployment.");
    const { error } = await supabaseAdmin.from("portfolio_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------------------------------------------------- */
/* GLOBAL CONTROLS — maintenance switch (feature_flags row maintenance_mode)   */
/* -------------------------------------------------------------------------- */

export const getMaintenance = createServerFn({ method: "GET" }).handler(async () => {
  await auth();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (!supabaseAdmin) return { enabled: false, error: "Database is not configured for this deployment." };
  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .select("enabled")
    .eq("key", "maintenance_mode")
    .maybeSingle();
  if (error) return { enabled: false, error: error.message };
  return { enabled: !!(data as { enabled?: boolean } | null)?.enabled, error: null as string | null };
});

export const setMaintenance = createServerFn({ method: "POST" })
  .inputValidator((d: { enabled: boolean }) => ({ enabled: !!d?.enabled }))
  .handler(async ({ data }) => {
    await auth();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!supabaseAdmin) throw new Error("Database is not configured for this deployment.");
    const { error } = await supabaseAdmin.from("feature_flags").upsert(
      { key: "maintenance_mode", enabled: data.enabled, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, enabled: data.enabled };
  });
