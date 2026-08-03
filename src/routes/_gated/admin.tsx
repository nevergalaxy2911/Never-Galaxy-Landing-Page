/**
 * /admin, the Never Galaxy content console.
 *
 * SECTIONS (top nav): Portfolio · Websites · Testimonials · Pricing · Filters · Settings
 *
 * DESIGN NOTES (why it looks the way it does)
 *   • One consistent shell: every section is a <Panel> with a title, a short
 *     plain-language description, and its own toolbar. No naked form grids.
 *   • Rows are COLLAPSED by default and show a live thumbnail plus a status
 *     chip, so a long portfolio is scannable. Click Edit to expand.
 *   • Every destructive action asks first, and every save reports success or
 *     the exact server error inline instead of failing silently.
 *
 * HOW TO MODIFY
 *   • Add a section  → add a Tab id, a <TabButton>, and a component below.
 *   • Change styling → the shared primitives at the bottom of this file
 *     (Panel, Field, Toolbar, Chip, Banner) are the only place colours live.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Filter,
  Globe,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  MessageSquareQuote,
  Plus,
  RotateCcw,
  Settings2,
  Tag,
  Trash2,
  Youtube,
} from "lucide-react";
import {
  listSettings,
  upsertSetting,
  deleteSetting,
  listPricing,
  upsertPricing,
  deletePricing,
  resetPricingToDefaults,
  listPortfolio,
  upsertPortfolio,
  deletePortfolio,
  getCategories,
  saveCategories,
  getItemAspects,
  saveItemAspects,
  getTestimonials,
  saveTestimonials,
  getWebsites,
  saveWebsites,
  resetWebsitesToDefaults,
} from "@/lib/admin-data.functions";
import {
  DEFAULT_WEBSITES,
  emptyWebsite,
  slugify,
  type WebsiteEntry,
} from "@/lib/websites-config";
import {
  DEFAULT_CATEGORIES,
  ICON_CHOICES,
  type PortfolioCategory,
} from "@/lib/portfolio-config";
import {
  ASPECT_PRESETS,
  DEFAULT_ASPECT,
  RESOLUTION_PRESETS,
  SIZE_LABELS,
  aspectRatioCss,
  orientationOf,
  presetById,
  sanitizeAspect,
  spanForAspect,
  type AspectConfig,
  type AspectSize,
} from "@/lib/portfolio-aspect";
import { parseImageLink, parseMediaLink, youTubeThumb } from "@/lib/media-links";
import {
  DEFAULT_TESTIMONIALS,
  type Testimonial,
} from "@/lib/testimonials-config";

export const Route = createFileRoute("/_gated/admin")({
  component: AdminPage,
});

type Tab = "portfolio" | "websites" | "testimonials" | "pricing" | "filters" | "settings";

const TABS: Array<{ id: Tab; label: string; icon: typeof LayoutGrid; blurb: string }> = [
  { id: "portfolio", label: "Portfolio", icon: LayoutGrid, blurb: "Videos, graphics and site tiles" },
  { id: "websites", label: "Websites", icon: Globe, blurb: "Live client sites and their preview images" },
  { id: "testimonials", label: "Testimonials", icon: MessageSquareQuote, blurb: "Client quotes and proof chips" },
  { id: "pricing", label: "Pricing", icon: Tag, blurb: "Plans shown on the pricing section" },
  { id: "filters", label: "Filters", icon: Filter, blurb: "The portfolio tab bar" },
  { id: "settings", label: "Settings", icon: Settings2, blurb: "Raw key / value site settings" },
];

function AdminPage() {
  const [tab, setTab] = useState<Tab>("portfolio");
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/40">
          Never Galaxy · Content console
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Site editor</h1>
        <p className="text-sm text-white/55">{current.blurb}</p>
      </header>

      <nav
        aria-label="Editor sections"
        className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-fuchsia-500/15 text-fuchsia-100 shadow-[inset_0_0_0_1px_rgba(217,70,239,0.35)]"
                  : "text-white/60 hover:bg-white/5 hover:text-white/90"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </nav>

      {tab === "portfolio" && <PortfolioEditor />}
      {tab === "websites" && <WebsitesEditor />}
      {tab === "testimonials" && <TestimonialsEditor />}
      {tab === "pricing" && <PricingEditor />}
      {tab === "filters" && <FiltersEditor />}
      {tab === "settings" && <SettingsEditor />}
    </div>
  );
}

/* ========================================================================== */
/* PORTFOLIO                                                                  */
/* ========================================================================== */

const emptyPortfolio = () => ({
  position: 0,
  category: "video",
  title: "New item",
  subtitle: "",
  url: "",
  badge: "Play",
  thumb_url: "",
  published: true,
});

function PortfolioEditor() {
  const load = useServerFn(listPortfolio);
  const loadCats = useServerFn(getCategories);
  const loadAspects = useServerFn(getItemAspects);
  const persistAspects = useServerFn(saveItemAspects);
  const upsert = useServerFn(upsertPortfolio);
  const del = useServerFn(deletePortfolio);

  const [rows, setRows] = useState<any[]>([]);
  const [cats, setCats] = useState<PortfolioCategory[]>(DEFAULT_CATEGORIES);
  const [aspects, setAspects] = useState<Record<string, AspectConfig>>({});
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c, a] = await Promise.all([load(), loadCats(), loadAspects()]);
      setRows(r.rows);
      setErr(r.error);
      setCats(c.categories);
      setAspects(a.aspects as Record<string, AspectConfig>);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [load, loadCats, loadAspects]);
  useEffect(() => { void refresh(); }, [refresh]);

  /** Save the row itself AND its card shape, then refresh. */
  async function onSave(row: any, aspect?: AspectConfig) {
    setErr(null);
    setNote(null);
    try {
      const res = await upsert({ data: row });
      const id = row.id ?? res.id;
      if (id && aspect) {
        const next = { ...aspects, [id]: aspect };
        setAspects(next);
        await persistAspects({ data: { aspects: next } });
      }
      setNote(`Saved "${row.title}".`);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function onDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}" from the portfolio? This cannot be undone.`)) return;
    setErr(null);
    try {
      await del({ data: { id } });
      const next = { ...aspects };
      delete next[id];
      setAspects(next);
      await persistAspects({ data: { aspects: next } });
      setNote(`Deleted "${title}".`);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function onAdd() {
    await onSave({ ...emptyPortfolio(), category: cats[0]?.id ?? "video" }, { ...DEFAULT_ASPECT });
  }

  return (
    <div className="space-y-4">
      {err && <Banner tone="error" msg={err} />}
      {note && <Banner tone="ok" msg={note} />}

      <Panel
        title="Portfolio items"
        desc="Each item becomes one tile on the public Work section. Pick a card shape so vertical Shorts get tall cards and films get wide ones."
        toolbar={
          <>
            <button className="btn-primary inline-flex items-center gap-1.5" onClick={onAdd}>
              <Plus className="h-4 w-4" aria-hidden /> Add item
            </button>
            <button className="btn-secondary inline-flex items-center gap-1.5" onClick={() => void refresh()}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Reload
            </button>
          </>
        }
      >
        {loading ? (
          <LoadingRow label="Loading portfolio" />
        ) : rows.length === 0 ? (
          <Empty msg="No portfolio items yet. Add your first one and paste a YouTube link." />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <PortfolioRow
                key={r.id}
                row={r}
                cats={cats}
                aspect={sanitizeAspect(aspects[r.id])}
                open={openId === r.id}
                onToggle={() => setOpenId(openId === r.id ? null : r.id)}
                onSave={onSave}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function PortfolioRow({
  row, cats, aspect, open, onToggle, onSave, onDelete,
}: {
  row: any;
  cats: PortfolioCategory[];
  aspect: AspectConfig;
  open: boolean;
  onToggle: () => void;
  onSave: (r: any, a?: AspectConfig) => void;
  onDelete: (id: string, title: string) => void;
}) {
  const [d, setD] = useState<any>({ ...row });
  const [a, setA] = useState<AspectConfig>(aspect);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setD((prev: any) => ({ ...prev, [k]: v }));

  // Keep local state in step when the parent reloads from the server.
  useEffect(() => { setD({ ...row }); }, [row]);
  useEffect(() => { setA(aspect); }, [aspect]);

  const activeCat = cats.find((c) => c.id === d.category);
  const isVideo = activeCat?.kind === "video";

  /* LIVE URL VALIDATION: parsed on every keystroke so a bad link is caught in
     the form, never silently saved. The exact reason is shown under the field. */
  const urlCheck = useMemo(
    () => parseMediaLink(String(d.url ?? ""), isVideo ? "video" : "link"),
    [d.url, isVideo],
  );
  const thumbCheck = useMemo(
    () => (String(d.thumb_url ?? "").trim() ? parseImageLink(String(d.thumb_url)) : null),
    [d.thumb_url],
  );
  const videoId = urlCheck.ok && urlCheck.kind === "youtube" ? urlCheck.id : undefined;
  const previewThumb =
    (String(d.thumb_url ?? "").trim() && thumbCheck?.ok ? String(d.thumb_url) : undefined) ??
    (videoId ? youTubeThumb(videoId) : undefined);

  // Video tiles MUST have a working YouTube link; image tiles may have none.
  const blocking = isVideo && !urlCheck.ok;

  async function save() {
    setSaving(true);
    try {
      await onSave({ ...d, url: urlCheck.ok && urlCheck.kind === "youtube" ? urlCheck.canonical : d.url }, a);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      {/* ---- Collapsed summary row ---- */}
      <div className="flex items-center gap-3 p-3">
        <div className="grid h-14 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-black/40">
          {previewThumb ? (
            <img src={previewThumb} alt="" className="h-full w-full object-cover" />
          ) : isVideo ? (
            <Youtube className="h-5 w-5 text-white/25" aria-hidden />
          ) : (
            <ImageIcon className="h-5 w-5 text-white/25" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{d.title || "Untitled"}</h3>
            <Chip tone={d.published ? "ok" : "muted"}>{d.published ? "Published" : "Hidden"}</Chip>
            <Chip tone="info">{activeCat?.label ?? d.category}</Chip>
            <Chip tone="muted">{a.ratio === "custom" ? `${a.width}x${a.height}` : a.ratio} · {SIZE_LABELS[a.size]}</Chip>
            {blocking && <Chip tone="error">Link needs attention</Chip>}
          </div>
          <p className="mt-0.5 truncate text-xs text-white/45">{d.url || "No link yet"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button className="btn-secondary inline-flex items-center gap-1.5" onClick={onToggle}>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
            {open ? "Close" : "Edit"}
          </button>
          <button
            className="btn-danger inline-flex items-center gap-1.5"
            onClick={() => onDelete(row.id, d.title || "this item")}
            aria-label={`Delete ${d.title}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* ---- Expanded editor ---- */}
      {open && (
        <div className="border-t border-white/10 bg-black/20 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Position (sort order)">
              <input type="number" className="input" value={d.position ?? 0}
                onChange={(e) => set("position", Number(e.target.value))} />
            </Field>
            <Field label="Category (which filter tab)">
              <select className="input" value={d.category ?? "video"}
                onChange={(e) => set("category", e.target.value)}>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.kind === "video" ? "YouTube" : "Image"})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input className="input" value={d.title ?? ""} onChange={(e) => set("title", e.target.value)} />
            </Field>
            <Field label="Subtitle (small caption)">
              <input className="input" value={d.subtitle ?? ""} onChange={(e) => set("subtitle", e.target.value)} />
            </Field>

            <Field
              label={isVideo ? "YouTube link" : "Link (optional)"}
              className="md:col-span-2"
            >
              <input
                className={`input ${d.url && !urlCheck.ok ? "border-red-500/60" : ""}`}
                value={d.url ?? ""}
                placeholder={isVideo ? "https://youtu.be/dQw4w9WgXcQ" : "https://your-project.com"}
                onChange={(e) => set("url", e.target.value)}
              />
              <LinkFeedback check={urlCheck} required={isVideo} okLabel={
                urlCheck.ok && urlCheck.kind === "youtube" ? `Video id ${urlCheck.id} recognised` : "Link looks good"
              } />
            </Field>

            <Field
              label={isVideo ? "Custom thumbnail (optional, overrides YouTube's)" : "Image shown on the tile"}
              className="md:col-span-2"
            >
              <input
                className={`input ${d.thumb_url && thumbCheck && !thumbCheck.ok ? "border-red-500/60" : ""}`}
                value={d.thumb_url ?? ""}
                placeholder="https://cdn.example.com/shot.webp"
                onChange={(e) => set("thumb_url", e.target.value)}
              />
              {thumbCheck && <LinkFeedback check={thumbCheck} required={false} okLabel="Image link looks good" />}
            </Field>

            <Field label="Badge (small corner label)">
              <input className="input" value={d.badge ?? ""} placeholder="Play / View / Soon"
                onChange={(e) => set("badge", e.target.value)} />
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={!!d.published}
                onChange={(e) => set("published", e.target.checked)} />
              Published (visible on the site)
            </label>
          </div>

          <AspectEditor value={a} onChange={setA} />

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
            <button className="btn-primary inline-flex items-center gap-1.5" onClick={() => void save()} disabled={saving || blocking}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              {saving ? "Saving" : "Save item"}
            </button>
            <button className="btn-secondary" onClick={() => { setD({ ...row }); setA(aspect); }}>
              Discard changes
            </button>
            {blocking && (
              <span className="text-xs text-amber-300">
                Fix the YouTube link before saving, otherwise the tile would show an empty player.
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

/** Inline pass/fail feedback for a pasted URL. */
function LinkFeedback({
  check, required, okLabel,
}: {
  check: ReturnType<typeof parseMediaLink>;
  required: boolean;
  okLabel: string;
}) {
  if (check.ok) {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
        <Check className="h-3.5 w-3.5" aria-hidden /> {okLabel}
      </p>
    );
  }
  return (
    <p className={`mt-1.5 flex items-start gap-1.5 text-[11px] ${required ? "text-red-300" : "text-white/45"}`}>
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {check.reason}
        {check.hint && <span className="block text-white/45">{check.hint}</span>}
      </span>
    </p>
  );
}

/**
 * CARD SHAPE editor: aspect ratio, exact resolution, and bento size, with a
 * live preview of the resulting card so the choice is obvious before saving.
 */
function AspectEditor({
  value, onChange,
}: {
  value: AspectConfig;
  onChange: (a: AspectConfig) => void;
}) {
  const preset = presetById(value.ratio);
  const resolutions = RESOLUTION_PRESETS[value.ratio] ?? [];
  const orient = orientationOf(value);

  function pickRatio(id: string) {
    const p = presetById(id);
    onChange({ ...value, ratio: id, width: p?.width ?? value.width, height: p?.height ?? value.height });
  }

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <header className="mb-3">
        <h4 className="text-sm font-semibold">Card shape</h4>
        <p className="text-xs text-white/50">
          Sets the exact box the tile reserves. Vertical clips get tall cards, wide films get wide cards, and the bento layout stays tidy either way.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          <Field label="Aspect ratio">
            <div className="flex flex-wrap gap-1.5">
              {ASPECT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickRatio(p.id)}
                  title={p.note}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    value.ratio === p.id
                      ? "bg-fuchsia-500/20 text-fuchsia-100 shadow-[inset_0_0_0_1px_rgba(217,70,239,0.45)]"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {p.id}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onChange({ ...value, ratio: "custom" })}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  value.ratio === "custom"
                    ? "bg-fuchsia-500/20 text-fuchsia-100 shadow-[inset_0_0_0_1px_rgba(217,70,239,0.45)]"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                Custom
              </button>
            </div>
            {preset && <p className="mt-1.5 text-[11px] text-white/45">{preset.label}: {preset.note}</p>}
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {resolutions.length > 0 && (
              <Field label="Exact resolution" className="sm:col-span-3">
                <select
                  className="input"
                  value={`${value.width}x${value.height}`}
                  onChange={(e) => {
                    const [w, h] = e.target.value.split("x").map(Number);
                    onChange({ ...value, width: w, height: h });
                  }}
                >
                  {resolutions.map((r) => (
                    <option key={r.label} value={`${r.width}x${r.height}`}>{r.label}</option>
                  ))}
                  {!resolutions.some((r) => r.width === value.width && r.height === value.height) && (
                    <option value={`${value.width}x${value.height}`}>
                      {value.width} x {value.height} (current)
                    </option>
                  )}
                </select>
              </Field>
            )}
            <Field label="Width (px)">
              <input type="number" min={1} className="input" value={value.width}
                onChange={(e) => onChange({ ...value, ratio: "custom", width: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Height (px)">
              <input type="number" min={1} className="input" value={value.height}
                onChange={(e) => onChange({ ...value, ratio: "custom", height: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Card size">
              <select className="input" value={value.size}
                onChange={(e) => onChange({ ...value, size: e.target.value as AspectSize })}>
                {(Object.keys(SIZE_LABELS) as AspectSize[]).map((s) => (
                  <option key={s} value={s}>{SIZE_LABELS[s]}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* Live preview of the reserved box + the grid span it will claim. */}
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-white/40">Preview</p>
          <div className="grid place-items-center">
            <div
              className="w-full max-w-[180px] rounded-md border border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-500/15 to-indigo-500/10"
              style={{ aspectRatio: aspectRatioCss(value) }}
            />
          </div>
          <dl className="mt-3 space-y-1 text-[11px] text-white/50">
            <div className="flex justify-between"><dt>Shape</dt><dd className="text-white/75">{orient}</dd></div>
            <div className="flex justify-between"><dt>Box</dt><dd className="text-white/75">{value.width} x {value.height}</dd></div>
            <div className="flex justify-between"><dt>Grid span</dt><dd className="font-mono text-white/75">{spanForAspect(value).replace(/md:/g, "")}</dd></div>
          </dl>
        </div>
      </div>
    </section>
  );
}

/* ========================================================================== */
/* TESTIMONIALS                                                               */
/* ========================================================================== */

function TestimonialsEditor() {
  const load = useServerFn(getTestimonials);
  const save = useServerFn(saveTestimonials);
  const [items, setItems] = useState<Testimonial[]>(DEFAULT_TESTIMONIALS);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await load();
      setItems(r.items as Testimonial[]);
      setErr(r.error);
      setDirty(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  function update(i: number, patch: Partial<Testimonial>) {
    setItems((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
    setDirty(true);
  }
  function move(i: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  }
  function remove(i: number) {
    if (!confirm(`Remove the review from "${items[i].name}"?`)) return;
    setItems((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }
  function add() {
    setItems((prev) => [
      ...prev,
      { name: "New client", role: "Project client", proof: "$40 paid", quote: "", enabled: true },
    ]);
    setDirty(true);
  }
  async function persist() {
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const r = await save({ data: { items } });
      setNote(`Saved ${r.count} testimonials.`);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {err && <Banner tone="error" msg={err} />}
      {note && <Banner tone="ok" msg={note} />}
      <Panel
        title="Client reviews"
        desc="These appear in the Reviews section. The proof chip is the small badge next to the name, for example '$40 paid'. Leave it empty to show 'Verified client'."
        toolbar={
          <>
            <button className="btn-secondary inline-flex items-center gap-1.5" onClick={add}>
              <Plus className="h-4 w-4" aria-hidden /> Add review
            </button>
            <button className="btn-primary inline-flex items-center gap-1.5" onClick={() => void persist()} disabled={busy || !dirty}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              {busy ? "Saving" : dirty ? "Save changes" : "Saved"}
            </button>
          </>
        }
      >
        {loading ? (
          <LoadingRow label="Loading reviews" />
        ) : (
          <div className="space-y-3">
            {items.map((t, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="Name">
                    <input className="input" value={t.name} onChange={(e) => update(i, { name: e.target.value })} />
                  </Field>
                  <Field label="Role / caption">
                    <input className="input" value={t.role} onChange={(e) => update(i, { role: e.target.value })} />
                  </Field>
                  <Field label="Proof chip">
                    <input className="input" placeholder="$40 paid" value={t.proof ?? ""}
                      onChange={(e) => update(i, { proof: e.target.value })} />
                  </Field>
                  <Field label="Quote" className="md:col-span-3">
                    <textarea className="input min-h-[90px]" value={t.quote}
                      onChange={(e) => update(i, { quote: e.target.value })} />
                  </Field>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={t.enabled}
                      onChange={(e) => update(i, { enabled: e.target.checked })} />
                    Visible
                  </label>
                  <span className="flex-1" />
                  <button className="btn-secondary px-2" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                  <button className="btn-secondary px-2" onClick={() => move(i, +1)} aria-label="Move down">↓</button>
                  <button className="btn-danger inline-flex items-center gap-1.5" onClick={() => remove(i)}>
                    <Trash2 className="h-4 w-4" aria-hidden /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* PRICING                                                                    */
/* ========================================================================== */

const emptyPricing = () => ({
  position: 0,
  name: "New plan",
  price_inr: 0,
  custom_price: "",
  price_prefix: "From ",
  cadence: "per deliverable",
  body: "Describe this plan.",
  features: [] as string[],
  highlighted: false,
  published: true,
});

function PricingEditor() {
  const load = useServerFn(listPricing);
  const upsert = useServerFn(upsertPricing);
  const del = useServerFn(deletePricing);
  const reset = useServerFn(resetPricingToDefaults);
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await load();
      setRows(r.rows);
      setErr(r.error);
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function onSave(row: any) {
    try {
      const clean = {
        ...row,
        price_inr: row.price_inr === "" || row.price_inr == null ? null : Number(row.price_inr),
        features: Array.isArray(row.features)
          ? row.features
          : String(row.features || "").split("\n").map((s: string) => s.trim()).filter(Boolean),
      };
      await upsert({ data: clean });
      await refresh();
    } catch (e) { setErr((e as Error).message); }
  }
  async function onDelete(id: string) {
    if (!confirm("Delete this plan?")) return;
    await del({ data: { id } });
    await refresh();
  }
  async function onReset() {
    if (!confirm("Replace all current plans with the three defaults from site.ts?")) return;
    setResetting(true);
    try { await reset(); await refresh(); }
    catch (e) { setErr((e as Error).message); }
    finally { setResetting(false); }
  }

  return (
    <div className="space-y-4">
      {err && <Banner tone="error" msg={err} />}
      <Panel
        title="Pricing plans"
        desc="Leave the INR price empty to show a custom label such as 'Let us talk'."
        toolbar={
          <>
            <button className="btn-primary inline-flex items-center gap-1.5" onClick={() => onSave(emptyPricing())}>
              <Plus className="h-4 w-4" aria-hidden /> Add plan
            </button>
            <button className="btn-secondary inline-flex items-center gap-1.5" onClick={onReset} disabled={resetting}>
              <RotateCcw className="h-4 w-4" aria-hidden /> {resetting ? "Resetting" : "Reset to defaults"}
            </button>
          </>
        }
      >
        {loading ? <LoadingRow label="Loading plans" />
          : rows.length === 0 ? <Empty msg="No pricing plans yet." />
          : (
            <div className="space-y-3">
              {rows.map((r) => <PricingRow key={r.id} row={r} onSave={onSave} onDelete={onDelete} />)}
            </div>
          )}
      </Panel>
    </div>
  );
}

function PricingRow({ row, onSave, onDelete }: any) {
  const [d, setD] = useState({ ...row, features: (row.features ?? []).join("\n") });
  const set = (k: string, v: any) => setD((prev: any) => ({ ...prev, [k]: v }));
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Position (order)">
          <input type="number" className="input" value={d.position ?? 0}
            onChange={(e) => set("position", Number(e.target.value))} />
        </Field>
        <Field label="Name">
          <input className="input" value={d.name ?? ""} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Price INR (blank = custom label)">
          <input type="number" className="input" value={d.price_inr ?? ""}
            onChange={(e) => set("price_inr", e.target.value)} />
        </Field>
        <Field label="Custom price label">
          <input className="input" value={d.custom_price ?? ""}
            onChange={(e) => set("custom_price", e.target.value)} />
        </Field>
        <Field label='Price prefix (e.g. "From ")'>
          <input className="input" value={d.price_prefix ?? ""}
            onChange={(e) => set("price_prefix", e.target.value)} />
        </Field>
        <Field label="Cadence (e.g. per month)">
          <input className="input" value={d.cadence ?? ""} onChange={(e) => set("cadence", e.target.value)} />
        </Field>
        <Field label="Body" className="md:col-span-2">
          <textarea className="input min-h-[70px]" value={d.body ?? ""} onChange={(e) => set("body", e.target.value)} />
        </Field>
        <Field label="Features (one per line)" className="md:col-span-2">
          <textarea className="input min-h-[100px] font-mono text-sm" value={d.features}
            onChange={(e) => set("features", e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!d.highlighted} onChange={(e) => set("highlighted", e.target.checked)} />
          Highlighted
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!d.published} onChange={(e) => set("published", e.target.checked)} />
          Published
        </label>
      </div>
      <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
        <button className="btn-primary inline-flex items-center gap-1.5" onClick={() => onSave(d)}>
          <Check className="h-4 w-4" aria-hidden /> Save
        </button>
        <button className="btn-danger inline-flex items-center gap-1.5" onClick={() => onDelete(row.id)}>
          <Trash2 className="h-4 w-4" aria-hidden /> Delete
        </button>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* FILTERS (portfolio categories / tabs)                                      */
/* ========================================================================== */

function FiltersEditor() {
  const load = useServerFn(getCategories);
  const save = useServerFn(saveCategories);
  const [cats, setCats] = useState<PortfolioCategory[]>(DEFAULT_CATEGORIES);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const refresh = useCallback(async () => {
    const r = await load();
    setCats(r.categories);
    setErr(r.error);
    setDirty(false);
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  function update(i: number, patch: Partial<PortfolioCategory>) {
    setCats((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
    setDirty(true);
  }
  function move(i: number, dir: -1 | 1) {
    setCats((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  }
  function remove(i: number) {
    if (!confirm(`Remove the filter "${cats[i].label}"?`)) return;
    setCats((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }
  function add() {
    setCats((prev) => [
      ...prev,
      { id: `new-${prev.length + 1}`, label: "New filter", icon: "ImageIcon", kind: "image", enabled: true },
    ]);
    setDirty(true);
  }
  async function persist() {
    setBusy(true);
    try { await save({ data: { categories: cats } }); await refresh(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  async function reset() {
    if (!confirm("Reset filters to Video, Motion, Graphics and Website?")) return;
    setBusy(true);
    try { await save({ data: { categories: DEFAULT_CATEGORIES } }); await refresh(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {err && <Banner tone="error" msg={err} />}
      <Panel
        title="Portfolio filter tabs"
        desc="The tab bar on the public Work section. Kind decides how tiles render: YouTube shows a player, Image shows a picture. Each item's Category must match one of these ids."
        toolbar={
          <>
            <button className="btn-secondary inline-flex items-center gap-1.5" onClick={add}>
              <Plus className="h-4 w-4" aria-hidden /> Add filter
            </button>
            <button className="btn-primary inline-flex items-center gap-1.5" onClick={() => void persist()} disabled={busy || !dirty}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              {busy ? "Saving" : dirty ? "Save changes" : "Saved"}
            </button>
            <button className="btn-secondary inline-flex items-center gap-1.5" onClick={reset} disabled={busy}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Reset
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {cats.map((c, i) => (
            <div key={i} className="grid grid-cols-1 items-end gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[90px_1fr_1fr_150px_170px_auto]">
              <Field label="Order">
                <div className="flex gap-1">
                  <button className="btn-secondary px-2" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                  <button className="btn-secondary px-2" onClick={() => move(i, +1)} aria-label="Move down">↓</button>
                </div>
              </Field>
              <Field label="ID (machine key)">
                <input className="input font-mono text-sm" value={c.id} onChange={(e) => update(i, { id: e.target.value })} />
              </Field>
              <Field label="Label (shown on tab)">
                <input className="input" value={c.label} onChange={(e) => update(i, { label: e.target.value })} />
              </Field>
              <Field label="Icon">
                <select className="input" value={c.icon} onChange={(e) => update(i, { icon: e.target.value })}>
                  {ICON_CHOICES.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                </select>
              </Field>
              <Field label="Kind">
                <select className="input" value={c.kind}
                  onChange={(e) => update(i, { kind: e.target.value as "video" | "image" })}>
                  <option value="video">YouTube (video)</option>
                  <option value="image">Image (graphic / web)</option>
                </select>
              </Field>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={c.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} />
                  Enabled
                </label>
                <button className="btn-danger inline-flex items-center gap-1.5" onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* SETTINGS                                                                   */
/* ========================================================================== */

const SETTING_TEMPLATES: Record<string, string> = {
  "brand.name": '"Never Galaxy"',
  "brand.tagline": '"Cosmic-grade creative studio for video, motion, and design."',
  "contact.email": '"nevergalaxy2911@gmail.com"',
  "socials.instagram": '"https://www.instagram.com/nevergalaxystudio/"',
  "socials.youtube": '""',
  "hero.headline": '"Cosmic-grade creative studio."',
  "hero.subhead": '"Cinematic video, motion, and design for brands that want to feel bigger."',
};

function SettingsEditor() {
  const load = useServerFn(listSettings);
  const upsert = useServerFn(upsertSetting);
  const del = useServerFn(deleteSetting);

  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const r = await load();
    setRows(r.rows);
    setErr(r.error);
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState('""');

  async function onSaveNew() {
    if (!newKey) return;
    setBusy(true);
    try {
      await upsert({ data: { key: newKey, value: JSON.parse(newValue) } });
      setNewKey(""); setNewValue('""');
      await refresh();
    } catch (e) { setErr(`Could not save: ${(e as Error).message}. Remember values are JSON, so text must be in quotes.`); }
    finally { setBusy(false); }
  }
  async function onUpdateRow(key: string, value: string) {
    setBusy(true);
    try { await upsert({ data: { key, value: JSON.parse(value) } }); await refresh(); }
    catch (e) { setErr(`Could not save "${key}": ${(e as Error).message}`); }
    finally { setBusy(false); }
  }
  async function onDelete(key: string) {
    if (!confirm(`Delete the setting "${key}"?`)) return;
    await del({ data: { key } });
    await refresh();
  }

  return (
    <div className="space-y-4">
      {err && <Banner tone="error" msg={err} />}

      <Panel
        title="Add or update a setting"
        desc='Keys use dot notation, for example brand.name. Values are JSON, so wrap text in quotes.'
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr_auto]">
          <input list="setting-keys" className="input" placeholder="brand.name"
            value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <datalist id="setting-keys">
            {Object.keys(SETTING_TEMPLATES).map((k) => <option key={k} value={k} />)}
          </datalist>
          <input className="input font-mono text-sm" placeholder='"value" or 123 or {"foo":"bar"}'
            value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          <button disabled={busy} onClick={onSaveNew} className="btn-primary">Save</button>
        </div>
      </Panel>

      <Panel title={`Existing settings (${rows.length})`} desc="Edit a value inline, then hit Save on that row.">
        {rows.length === 0 ? <Empty msg="No settings yet." /> : (
          <div className="space-y-2">
            {rows.map((r) => <SettingRow key={r.key} row={r} onSave={onUpdateRow} onDelete={onDelete} />)}
          </div>
        )}
      </Panel>
    </div>
  );
}

function SettingRow({ row, onSave, onDelete }: {
  row: any;
  onSave: (k: string, v: string) => void;
  onDelete: (k: string) => void;
}) {
  const [v, setV] = useState(JSON.stringify(row.value));
  return (
    <div className="grid grid-cols-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 md:grid-cols-[1fr_2fr_auto_auto]">
      <div className="truncate px-1 font-mono text-sm text-fuchsia-300">{row.key}</div>
      <input className="input font-mono text-sm" value={v} onChange={(e) => setV(e.target.value)} />
      <button className="btn-secondary" onClick={() => onSave(row.key, v)}>Save</button>
      <button className="btn-danger" onClick={() => onDelete(row.key)} aria-label={`Delete ${row.key}`}>
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/* ========================================================================== */
/* SHARED PRIMITIVES, the only place console colours are defined              */
/* ========================================================================== */

function Panel({
  title, desc, toolbar, children,
}: {
  title: string;
  desc?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {desc && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/50">{desc}</p>}
        </div>
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({ label, children, className = "" }: {
  label: string; children: React.ReactNode; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-white/45">{label}</span>
      {children}
    </label>
  );
}

function Chip({ children, tone = "muted" }: {
  children: React.ReactNode;
  tone?: "ok" | "info" | "error" | "muted";
}) {
  const tones: Record<string, string> = {
    ok: "border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
    info: "border-sky-500/35 bg-sky-500/10 text-sky-200",
    error: "border-red-500/40 bg-red-500/10 text-red-200",
    muted: "border-white/12 bg-white/5 text-white/55",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Banner({ msg, tone }: { msg: string; tone: "error" | "ok" }) {
  const cls = tone === "error"
    ? "border-red-500/40 bg-red-500/10 text-red-200"
    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
  return <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{msg}</div>;
}

function LoadingRow({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 py-6 text-sm text-white/50">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </p>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="py-6 text-sm text-white/45">{msg}</p>;
}

/* ========================================================================== */
/* WEBSITES, the "Website" portfolio tab + /work/<slug> case studies          */
/* ========================================================================== */
/* Stored as ONE site_settings row (`portfolio.websites`), so adding or
   removing a client site here instantly changes the homepage tiles, the
   preview modal and the case-study page. Images are plain URLs: either a file
   you dropped in `public/` (e.g. /Icons%20and%20images/portfolio/x.webp) or a
   full https link.
   HOW TO MODIFY: field meanings live in src/lib/websites-config.ts. */

function WebsitesEditor() {
  const load = useServerFn(getWebsites);
  const save = useServerFn(saveWebsites);
  const resetAll = useServerFn(resetWebsitesToDefaults);
  const [items, setItems] = useState<WebsiteEntry[]>(DEFAULT_WEBSITES);
  const [open, setOpen] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await load();
      setItems(r.items as WebsiteEntry[]);
      setErr(r.error);
      setDirty(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [load]);
  useEffect(() => { void refresh(); }, [refresh]);

  function update(i: number, patch: Partial<WebsiteEntry>) {
    setItems((prev) => prev.map((w, idx) => (idx === i ? { ...w, ...patch } : w)));
    setDirty(true);
  }
  function move(i: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  }
  function remove(i: number) {
    if (!confirm(`Remove "${items[i].title}" from the Website tab and delete its case study page?`)) return;
    setItems((prev) => prev.filter((_, idx) => idx !== i));
    setOpen(null);
    setDirty(true);
  }
  function add() {
    setItems((prev) => [...prev, emptyWebsite()]);
    setOpen(items.length);
    setDirty(true);
  }
  // Only one site can own the biggest bento tile, so featuring one clears the rest.
  function feature(i: number, on: boolean) {
    setItems((prev) => prev.map((w, idx) => ({ ...w, featured: on ? idx === i : idx === i ? false : w.featured })));
    setDirty(true);
  }
  async function persist() {
    setBusy(true); setErr(null); setNote(null);
    try {
      const r = await save({ data: { items } });
      setNote(`Saved ${r.count} websites. The live site updates on the next page load.`);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function restoreDefaults() {
    if (!confirm("Replace the current list with the six shipped websites?")) return;
    setBusy(true); setErr(null); setNote(null);
    try {
      const r = await resetAll();
      setNote(`Restored ${r.count} default websites.`);
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {err && <Banner tone="error" msg={err} />}
      {note && <Banner tone="ok" msg={note} />}
      <Panel
        title="Client websites"
        desc="Every entry becomes a tile under the Website filter and its own case study page at /work/<slug>. Paste image URLs from the public folder or any https link."
        toolbar={
          <>
            <button className="btn-secondary inline-flex items-center gap-1.5" onClick={() => void restoreDefaults()} disabled={busy}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Defaults
            </button>
            <button className="btn-secondary inline-flex items-center gap-1.5" onClick={add}>
              <Plus className="h-4 w-4" aria-hidden /> Add website
            </button>
            <button className="btn-primary inline-flex items-center gap-1.5" onClick={() => void persist()} disabled={busy || !dirty}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              {busy ? "Saving" : dirty ? "Save changes" : "Saved"}
            </button>
          </>
        }
      >
        {loading ? (
          <LoadingRow label="Loading websites" />
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/50">No websites yet. Use "Add website" to create the first one.</p>
        ) : (
          <div className="space-y-3">
            {items.map((w, i) => {
              const expanded = open === i;
              const preview = w.tileMobileSrc || w.tileSrc || w.detailDesktopSrc;
              return (
                <div key={`${w.slug}-${i}`} className="rounded-xl border border-white/10 bg-white/[0.03]">
                  {/* Collapsed summary row: thumbnail + status chips. */}
                  <div className="flex items-center gap-3 p-3">
                    <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40">
                      {preview ? (
                        <img src={preview} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-white/30">
                          <ImageIcon className="h-4 w-4" aria-hidden />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{w.title || "Untitled"}</p>
                      <p className="truncate text-xs text-white/45">{w.liveUrl || "No live URL yet"}</p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                      {w.featured && <Chip tone="ok">Featured</Chip>}
                      <Chip tone={w.enabled ? "ok" : "muted"}>{w.enabled ? "Visible" : "Hidden"}</Chip>
                    </div>
                    <button
                      className="btn-secondary inline-flex shrink-0 items-center gap-1.5"
                      onClick={() => setOpen(expanded ? null : i)}
                      aria-expanded={expanded}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
                      {expanded ? "Close" : "Edit"}
                    </button>
                  </div>

                  {expanded && (
                    <div className="space-y-3 border-t border-white/10 p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Field label="Title">
                          <input className="input" value={w.title}
                            onChange={(e) => update(i, { title: e.target.value })} />
                        </Field>
                        <Field label="Subtitle">
                          <input className="input" placeholder="Luxury jewellery house" value={w.subtitle}
                            onChange={(e) => update(i, { subtitle: e.target.value })} />
                        </Field>
                        <Field label="Category">
                          <input className="input" placeholder="Luxury eCommerce" value={w.category}
                            onChange={(e) => update(i, { category: e.target.value })} />
                        </Field>
                        <Field label="Live URL" className="md:col-span-2">
                          <input className="input" placeholder="https://client-site.com" value={w.liveUrl}
                            onChange={(e) => update(i, { liveUrl: e.target.value })} />
                        </Field>
                        <Field label="Page slug (/work/…)">
                          <input className="input" placeholder="auto from title" value={w.slug}
                            onChange={(e) => update(i, { slug: slugify(e.target.value) })}
                            onBlur={() => !w.slug && update(i, { slug: slugify(w.title) })} />
                        </Field>

                        <Field label="Tile image (desktop)" className="md:col-span-3">
                          <input className="input" placeholder="/Icons%20and%20images/portfolio/optimized/site-tile.webp"
                            value={w.tileSrc} onChange={(e) => update(i, { tileSrc: e.target.value })} />
                        </Field>
                        <Field label="Tile image (phone)">
                          <input className="input" placeholder="Empty = reuse desktop tile" value={w.tileMobileSrc}
                            onChange={(e) => update(i, { tileMobileSrc: e.target.value })} />
                        </Field>
                        <Field label="Blur placeholder">
                          <input className="input" placeholder="Empty = reuse desktop tile" value={w.blurSrc}
                            onChange={(e) => update(i, { blurSrc: e.target.value })} />
                        </Field>
                        <Field label="Case study shot (desktop)">
                          <input className="input" placeholder="Big screenshot" value={w.detailDesktopSrc}
                            onChange={(e) => update(i, { detailDesktopSrc: e.target.value })} />
                        </Field>
                        <Field label="Case study shot (phone)" className="md:col-span-3">
                          <input className="input" placeholder="Empty = reuse the desktop shot" value={w.detailMobileSrc}
                            onChange={(e) => update(i, { detailMobileSrc: e.target.value })} />
                        </Field>

                        <Field label="Description" className="md:col-span-3">
                          <textarea className="input min-h-[80px]" value={w.description}
                            onChange={(e) => update(i, { description: e.target.value })} />
                        </Field>
                        <Field label="Highlights, one per line" className="md:col-span-3">
                          <textarea className="input min-h-[80px]" value={w.highlights.join("\n")}
                            onChange={(e) => update(i, { highlights: e.target.value.split("\n") })} />
                        </Field>
                      </div>

                      {/* Live thumbnails so a wrong image path is obvious immediately. */}
                      <div className="flex flex-wrap gap-3 border-t border-white/10 pt-3">
                        {[
                          { label: "Desktop tile", src: w.tileSrc },
                          { label: "Phone tile", src: w.tileMobileSrc },
                          { label: "Case study", src: w.detailDesktopSrc },
                        ].filter((p) => p.src).map((p) => (
                          <figure key={p.label} className="w-32">
                            <img src={p.src} alt={p.label} loading="lazy" decoding="async"
                              className="h-20 w-32 rounded-lg border border-white/10 object-cover" />
                            <figcaption className="mt-1 text-[10px] uppercase tracking-wider text-white/40">{p.label}</figcaption>
                          </figure>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={w.enabled}
                            onChange={(e) => update(i, { enabled: e.target.checked })} />
                          Visible
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={w.featured}
                            onChange={(e) => feature(i, e.target.checked)} />
                          Featured, biggest tile
                        </label>
                        <span className="flex-1" />
                        <button className="btn-secondary px-2" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                        <button className="btn-secondary px-2" onClick={() => move(i, +1)} aria-label="Move down">↓</button>
                        <button className="btn-danger inline-flex items-center gap-1.5" onClick={() => remove(i)}>
                          <Trash2 className="h-4 w-4" aria-hidden /> Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
