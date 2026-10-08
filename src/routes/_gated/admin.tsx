/* =============================================================================
 * /admin — REBUILT CONSOLE (Global Controls + Work manager)
 * -----------------------------------------------------------------------------
 * WHAT THIS PAGE IS
 *   A clean, dark, self-contained panel with two jobs:
 *     1. GLOBAL CONTROLS — flip the whole site into maintenance mode.
 *     2. WORK MANAGER    — add / edit / delete the pieces shown in the public
 *        Work section (categories: video, motion, graphics, website).
 *
 * WHERE THE DATA GOES
 *   Everything runs through src/lib/work-admin.functions.ts (service-role,
 *   admin-only) into the `portfolio_items` table and the `maintenance_mode`
 *   row of `feature_flags`.
 *
 * SMART FIELDS
 *   The form changes with the category:
 *     • Video / Motion → YouTube link (id is parsed live, thumbnail preview),
 *       card ratio + resolution tag.
 *     • Graphics       → image/asset link + card ratio.
 *     • Website        → live link + description + thumbnail link.
 *
 * NOT HERE ON PURPOSE
 *   Pricing, testimonials, filters, submissions and the older website case
 *   studies still live in the previous console at /admin-legacy (linked below),
 *   so nothing that used to work was thrown away.
 *
 * HOW TO MODIFY
 *   • New field  → add it in work-admin.functions.ts first, then here.
 *   • New ratio  → ASPECT_PRESETS in src/lib/portfolio-aspect.ts.
 * ========================================================================== */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, RefreshCw, ExternalLink, ShieldAlert, Loader2 } from "lucide-react";
import {
  listWorkItems,
  saveWorkItem,
  deleteWorkItem,
  getMaintenance,
  setMaintenance,
  type WorkItemRow,
} from "@/lib/work-admin.functions";
import { WORK_CATEGORIES, isVideoCategory, normalizeCategory, type WorkCategory } from "@/lib/work-categories";
import { ASPECT_PRESETS } from "@/lib/portfolio-aspect";
import { parseYouTubeId, youTubeThumb } from "@/lib/media-links";

export const Route = createFileRoute("/_gated/admin")({
  head: () => ({ meta: [{ title: "Work manager | Never Galaxy console" }] }),
  component: AdminPage,
});

const RESOLUTION_TAGS = ["", "1080p", "1440p / 2K", "4K", "Vector", "Print"];

/* The public site only has Video and Website tabs, so the Category dropdown
 * offers exactly those two. (Old Motion rows are coerced to Video below,
 * which is where they show publicly anyway.) */
const ADMIN_CATEGORIES = WORK_CATEGORIES.filter((c) => c.id === "video" || c.id === "website");

type FormState = {
  id: string | null;
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
};

const EMPTY: FormState = {
  id: null,
  title: "",
  category: "video",
  description: "",
  mediaUrl: "",
  thumbUrl: "",
  aspectRatio: "16:9",
  resolutionTag: "",
  displayOrder: 0,
  featured: false,
  published: true,
};

function rowToForm(r: WorkItemRow): FormState {
  return {
    id: r.id,
    title: r.title,
    category: r.category === "motion" ? "video" : r.category,
    description: r.description,
    mediaUrl: r.mediaUrl,
    thumbUrl: r.thumbUrl,
    aspectRatio: r.aspectRatio || "16:9",
    resolutionTag: r.resolutionTag,
    displayOrder: r.displayOrder,
    featured: r.featured,
    published: r.published,
  };
}

function AdminPage() {
  const load = useServerFn(listWorkItems);
  const save = useServerFn(saveWorkItem);
  const remove = useServerFn(deleteWorkItem);
  const readFlag = useServerFn(getMaintenance);
  const writeFlag = useServerFn(setMaintenance);

  const [rows, setRows] = useState<WorkItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maintenance, setMaintenanceState] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [filter, setFilter] = useState<"all" | WorkCategory>("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [items, flag] = await Promise.all([load(), readFlag()]);
      setRows(items.rows);
      setError(items.error);
      setMaintenanceState(flag.enabled);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [load, readFlag]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.category === filter)),
    [rows, filter],
  );

  async function toggleMaintenance() {
    setFlipping(true);
    try {
      const next = !maintenance;
      await writeFlag({ data: { enabled: next } });
      setMaintenanceState(next);
      toast.success(next ? "Maintenance mode is ON, visitors see the holding screen." : "Maintenance mode is OFF, the site is live.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setFlipping(false);
    }
  }

  async function onSave(form: FormState) {
    try {
      const res = await save({
        data: {
          id: form.id,
          title: form.title,
          category: form.category,
          description: form.description,
          mediaUrl: form.mediaUrl,
          thumbUrl: form.thumbUrl,
          aspectRatio: form.aspectRatio,
          resolutionTag: form.resolutionTag,
          displayOrder: form.displayOrder,
          featured: form.featured,
          published: form.published,
        },
      });
      setRows((prev) => {
        const without = prev.filter((r) => r.id !== res.item.id);
        return [...without, res.item].sort((a, b) => a.displayOrder - b.displayOrder);
      });
      setEditing(null);
      toast.success("Saved and live on the site.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function onDelete(row: WorkItemRow) {
    setEditing(null);
    try {
      await remove({ data: { id: row.id } });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success(`Removed "${row.title}".`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Work manager</h1>
          <p className="mt-1 text-sm text-white/45">
            Everything in the public Work section, plus the site-wide switches.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void refresh()} className="admin-btn-ghost" disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <Link to="/admin-legacy" className="admin-btn-ghost">Old console</Link>
          <Link to="/diagnostics" className="admin-btn-ghost">Diagnostics</Link>
        </div>
      </header>

      {error && (
        <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {/* ---------------- GLOBAL CONTROLS ---------------- */}
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35">Global controls</h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className={`mt-0.5 h-5 w-5 ${maintenance ? "text-amber-300" : "text-white/30"}`} />
            <div>
              <p className="text-sm font-medium">Maintenance mode</p>
              <p className="text-xs text-white/45">
                {maintenance
                  ? "Visitors currently see the holding screen. The console stays reachable."
                  : "The site is live for everyone."}
              </p>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={maintenance}
            aria-label="Maintenance mode"
            onClick={() => void toggleMaintenance()}
            disabled={flipping}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${maintenance ? "bg-amber-400/80" : "bg-white/10"}`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${maintenance ? "translate-x-7" : "translate-x-1"}`}
            />
          </button>
        </div>
      </section>

      {/* ---------------- WORK ITEMS ---------------- */}
      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
          <div className="flex flex-wrap gap-1">
            {(["all", ...WORK_CATEGORIES.map((c) => c.id)] as Array<"all" | WorkCategory>).map((id) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                  filter === id ? "bg-white text-black" : "text-white/45 hover:text-white"
                }`}
              >
                {id === "all" ? "All" : WORK_CATEGORIES.find((c) => c.id === id)!.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setEditing({ ...EMPTY, displayOrder: rows.length })}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-black"
          >
            <Plus className="h-3.5 w-3.5" /> Add piece
          </button>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 p-8 text-sm text-white/40">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your work…
          </p>
        ) : visible.length === 0 ? (
          <p className="p-8 text-sm text-white/40">Nothing here yet. Use “Add piece” to publish your first tile.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {visible.map((row) => (
              <li key={row.id} className="flex items-center gap-4 p-4">
                <Thumb row={row} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {row.title}
                    {row.featured && <span className="ml-2 text-[10px] uppercase tracking-widest text-amber-300">Featured</span>}
                    {!row.published && <span className="ml-2 text-[10px] uppercase tracking-widest text-white/35">Hidden</span>}
                  </p>
                  <p className="mt-1 truncate text-[11px] uppercase tracking-widest text-white/35">
                    {row.category} · {row.aspectRatio}
                    {row.resolutionTag ? ` · ${row.resolutionTag}` : ""} · order {row.displayOrder}
                  </p>
                </div>
                {row.mediaUrl && (
                  <a
                    href={row.mediaUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="admin-btn-ghost"
                    aria-label={`Open the link for ${row.title}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button onClick={() => setEditing(rowToForm(row))} className="admin-btn-ghost" aria-label={`Edit ${row.title}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => void onDelete(row)}
                  className="admin-btn-ghost text-red-300"
                  aria-label={`Delete ${row.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing && <ItemDialog value={editing} onCancel={() => setEditing(null)} onSubmit={onSave} />}
    </div>
  );
}

/** Small square preview so the list is scannable. */
function Thumb({ row }: { row: WorkItemRow }) {
  const src = row.thumbUrl || (row.youtubeId ? youTubeThumb(row.youtubeId) : "");
  return (
    <span className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/5">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <span className="text-[9px] uppercase tracking-widest text-white/25">No art</span>
      )}
    </span>
  );
}

/* -----------------------------------------------------------------------------
 * ADD / EDIT DIALOG — an in-page modal (never a browser prompt).
 * --------------------------------------------------------------------------- */
function ItemDialog({
  value,
  onCancel,
  onSubmit,
}: {
  value: FormState;
  onCancel: () => void;
  onSubmit: (f: FormState) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(value);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const video = isVideoCategory(form.category);
  const ytId = video ? parseYouTubeId(form.mediaUrl) : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await onSubmit(form);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0d0d18] p-6"
      >
        <h2 className="text-lg font-semibold">{form.id ? "Edit piece" : "Add a piece"}</h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Project name" />
          </Field>

          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => set("category", normalizeCategory(e.target.value))}
            >
              {ADMIN_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Card ratio">
            <select value={form.aspectRatio} onChange={(e) => set("aspectRatio", e.target.value)}>
              {ASPECT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </Field>

          {video && (
            <>
              <Field label="YouTube link (unlisted works)" className="sm:col-span-2">
                <input
                  value={form.mediaUrl}
                  onChange={(e) => set("mediaUrl", e.target.value)}
                  placeholder="https://youtu.be/…"
                />
                <p className="mt-1.5 text-[11px] text-white/40">
                  {form.mediaUrl
                    ? ytId
                      ? `Video found: ${ytId}`
                      : "That link has no video id in it yet."
                    : "Paste the link from the Share button."}
                </p>
              </Field>
              <Field label="Quality tag">
                <select value={form.resolutionTag} onChange={(e) => set("resolutionTag", e.target.value)}>
                  {RESOLUTION_TAGS.map((t) => (
                    <option key={t || "none"} value={t}>{t || "No tag"}</option>
                  ))}
                </select>
              </Field>
              <Field label="Custom thumbnail (optional)">
                <input value={form.thumbUrl} onChange={(e) => set("thumbUrl", e.target.value)} placeholder="https://…" />
              </Field>
            </>
          )}

          {form.category === "graphics" && (
            <>
              <Field label="Image or asset link" className="sm:col-span-2">
                <input value={form.mediaUrl} onChange={(e) => set("mediaUrl", e.target.value)} placeholder="https://…/artwork.webp" />
              </Field>
              <Field label="Quality tag">
                <select value={form.resolutionTag} onChange={(e) => set("resolutionTag", e.target.value)}>
                  {RESOLUTION_TAGS.map((t) => (
                    <option key={t || "none"} value={t}>{t || "No tag"}</option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {form.category === "website" && (
            <>
              <Field label="Live site link" className="sm:col-span-2">
                <input value={form.mediaUrl} onChange={(e) => set("mediaUrl", e.target.value)} placeholder="https://client-site.com" />
              </Field>
              <Field label="Thumbnail link" className="sm:col-span-2">
                <input value={form.thumbUrl} onChange={(e) => set("thumbUrl", e.target.value)} placeholder="/screenshots/site-desktop.webp" />
              </Field>
            </>
          )}

          <Field label="Short description" className="sm:col-span-2">
            <input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="One line shown under the title" />
          </Field>

          <Field label="Order (low shows first)">
            <input
              type="text"
              inputMode="numeric"
              value={String(form.displayOrder)}
              onChange={(e) => set("displayOrder", Number(e.target.value.replace(/[^0-9-]/g, "")) || 0)}
            />
          </Field>

          <div className="flex items-end gap-5">
            <Check label="Featured" checked={form.featured} onChange={(v) => set("featured", v)} />
            <Check label="Published" checked={form.published} onChange={(v) => set("published", v)} />
          </div>
        </div>

        {/* Live preview of exactly what the tile will show */}
        {(ytId || form.thumbUrl || form.mediaUrl) && (
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Preview</p>
            <img
              src={form.thumbUrl || (ytId ? youTubeThumb(ytId) : form.mediaUrl)}
              alt=""
              className="mt-2 max-h-48 rounded-xl border border-white/10 object-contain"
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="admin-btn-ghost">Cancel</button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-5 py-2 text-[11px] font-black uppercase tracking-widest text-black disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{label}</span>
      <div className="mt-1.5 [&_input]:w-full [&_select]:w-full">{children}</div>
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-white/70">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-fuchsia-500" />
      {label}
    </label>
  );
}
